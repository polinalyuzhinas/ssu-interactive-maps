'use strict';
// with styles and some html, todo: move it out of there

function getCSRFToken() {
    const cookieValue = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];
    return cookieValue || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
}

function showNotification(message, type = 'success') {
    const oldNotifications = document.querySelectorAll('.autosave-notification');
    oldNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'autosave-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 10px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white; border-radius: 4px; z-index: 10001;
        animation: fadeInOut 2s ease; font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

function updateSelectSelection(select, value) {
    if (!select || select.tagName !== 'SELECT') return;
    Array.from(select.options).forEach(option => { option.selected = false; });
    const optionToSelect = Array.from(select.options).find(option => String(option.value) === String(value));
    if (optionToSelect) { optionToSelect.selected = true; }
}

async function saveValue(cell, fieldName, value) {
    const pk = cell.dataset.pk;
    const appLabel = cell.dataset.appLabel;
    const modelName = cell.dataset.modelName;
    const input = cell.querySelector('.cell-input, .cell-select, .cell-boolean');
    
    if (!input) {
        showNotification('Ошибка: поле не найдено', 'error');
        return false;
    }

    let valueToSave = value;
    if (input.classList.contains('cell-foreignkey')) {
        const finalValue = input.dataset.selectedPk || input.dataset.originalValue;
        if (!finalValue || String(finalValue) === 'undefined' || String(finalValue) === 'null') {
            showNotification('Выберите значение из списка', 'error');
            return false;
        }
        valueToSave = finalValue;
    }

    const originalValue = input.dataset.originalValue;
    if (String(valueToSave) === String(originalValue)) {
        return false;
    }

    let saveIndicator = cell.querySelector('.save-indicator');
    if (!saveIndicator) {
        saveIndicator = document.createElement('span');
        saveIndicator.className = 'save-indicator';
        saveIndicator.textContent = 'save';
        saveIndicator.style.cssText = 'margin-left: 8px; font-size: 12px;';
        const cellEditor = cell.querySelector('.cell-editor');
        if (cellEditor) cellEditor.appendChild(saveIndicator);
    }
    saveIndicator.style.display = 'inline';

    try {
        const url = `/api/update-cell/${appLabel}/${modelName}/`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken(),
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                pk: pk,
                field: fieldName,
                value: valueToSave
            })
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            showNotification('Сессия истекла. Обновите страницу.', 'error');
            return false;
        }

        if (!response.ok) {
            if (response.status === 403) showNotification('Ошибка доступа. Обновите страницу.', 'error');
            else if (response.status === 401) showNotification('Сессия истекла. Обновите страницу.', 'error');
            else throw new Error(`HTTP ${response.status}`);
            return false;
        }

        const data = await response.json();

        if (data.success) {
            input.dataset.originalValue = valueToSave;
            
            if (input.classList.contains('cell-foreignkey')) {
                input.dataset.originalPk = valueToSave;
                input.dataset.originalText = input.value;
                delete input.dataset.selectedPk;
            }
            else if (input.tagName === 'INPUT' && input.type !== 'checkbox') {
                input.value = valueToSave;
            }

            if (input.tagName === 'SELECT') {
                updateSelectSelection(input, valueToSave);
            } else if (input.type === 'checkbox') {
                input.checked = valueToSave === 'True';
            }

            showNotification('Сохранено', 'success');
            return true;
        } else {
            throw new Error(data.error || 'Ошибка сохранения');
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');

        if (input.tagName === 'SELECT') {
            updateSelectSelection(input, originalValue);
        } else if (input.type === 'checkbox') {
            input.checked = originalValue === 'true';
        } else {
            if (input.classList.contains('cell-foreignkey')) {
                input.value = input.dataset.originalText || '';
                delete input.dataset.selectedPk;
            } else {
                input.value = originalValue;
            }
        }
        return false;
    } finally {
        if (saveIndicator) saveIndicator.style.display = 'none';
    }
}

function enableEditMode(cell, input, editBtn) {
    if (cell.classList.contains('editing')) return;
    cell.classList.add('editing');
    if (input && input.tagName === 'INPUT' && input.type !== 'checkbox') {
        if (input.classList.contains('cell-foreignkey')) {
            input.dataset.originalText = input.value;
        }
        input.disabled = false;
        input.classList.remove('is-disabled');
        input.focus();
        input.select();
    }
    if (input && input.tagName === 'SELECT') {
        input.disabled = false;
        input.classList.remove('is-disabled');
        setTimeout(() => { input.focus(); }, 10);
    }
    if (input && input.type === 'checkbox') {
        input.disabled = false;
        input.classList.remove('is-disabled');
    }
    if (editBtn) {
        editBtn.innerHTML = `<svg width="26" height="25" viewBox="0 0 26 25" fill="none"><path d="M21.5 3L9.5 15L4.5 10" stroke="#4caf50" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        editBtn.classList.add('save-mode');
        editBtn.title = 'Сохранить';
    }
}

function disableEditMode(cell, input, editBtn, restoreValue = true) {
    if (!cell.classList.contains('editing')) return;
    if (restoreValue && input) {
        if (input.tagName === 'SELECT') {
            updateSelectSelection(input, input.dataset.originalValue);
        } else if (input.type === 'checkbox') {
            input.checked = input.dataset.originalValue === 'true';
        } else {
            if (input.classList.contains('cell-foreignkey')) {
                input.value = input.dataset.originalText || '';
                delete input.dataset.selectedPk;
            } else {
                input.value = input.dataset.originalValue || '';
            }
        }
    }
    cell.classList.remove('editing');
    if (input) {
        input.disabled = true;
        input.classList.add('is-disabled');
        input.classList.remove('changed');
    }
    if (editBtn) {
        editBtn.innerHTML = editBtn.dataset.originalIcon || editBtn.innerHTML;
        editBtn.classList.remove('save-mode');
        editBtn.title = 'Редактировать';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const cells = document.querySelectorAll('.editable-cell');

    cells.forEach((cell) => {
        const input = cell.querySelector('.cell-input, .cell-select, .cell-boolean');
        const editBtn = cell.querySelector('.edit-icon-btn');

        if (!input || !editBtn) return;   

        const fieldName = cell.dataset.fieldName;
        editBtn.dataset.originalIcon = editBtn.innerHTML;

        input.disabled = true;
        input.classList.add('is-disabled');

        if (cell.dataset.editable === 'False') {
            editBtn.style.display = 'none'; 
            return;
        }

        editBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (cell.classList.contains('editing')) {
                if (input.tagName === 'INPUT' && input.type !== 'checkbox') {
                    const currentVal = input.value;
                    const originalVal = input.dataset.originalValue;
                    
                    if (String(currentVal) !== String(originalVal)) {
                        input.classList.add('changed');
                        const success = await saveValue(cell, fieldName, currentVal);
                        if (success) {
                            disableEditMode(cell, input, editBtn, false);
                            return;
                        } else {
                            disableEditMode(cell, input, editBtn, true);
                            return;
                        }
                    }
                }
                disableEditMode(cell, input, editBtn, true);
            } else {
                enableEditMode(cell, input, editBtn);
            }
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && cell.classList.contains('editing')) {
                e.preventDefault();
                disableEditMode(cell, input, editBtn, true);
            }
        });

        if (input.tagName === 'SELECT') {
            input.addEventListener('focus', function() {
                if (!cell.classList.contains('editing')) {
                    enableEditMode(cell, input, editBtn);
                }
            });

            input.addEventListener('change', async function() {
                const newValue = input.value;
                const originalValue = input.dataset.originalValue;

                if (newValue !== originalValue) {
                    input.classList.add('changed');
                    const success = await saveValue(cell, fieldName, newValue);
                    if (success) {
                        disableEditMode(cell, input, editBtn, false);
                    } else {
                        updateSelectSelection(input, originalValue);
                        input.classList.remove('changed');
                    }
                }
            });
        }

        if (input.type === 'checkbox') {
            input.addEventListener('change', async function() {
                if (!cell.classList.contains('editing')) return;
                const newValue = input.checked ? 'True' : 'False';
                const originalValue = input.dataset.originalValue;

                if (newValue !== originalValue) {
                    input.classList.add('changed');
                    const success = await saveValue(cell, fieldName, newValue);
                    if (success) {
                        disableEditMode(cell, input, editBtn, false);
                    } else {
                        input.checked = originalValue === 'true';
                        input.classList.remove('changed');
                    }
                }
            });
        }

        if (input.tagName === 'INPUT' && input.type !== 'checkbox') {
            if (input.classList.contains('cell-foreignkey')) {
                input.addEventListener('change', async function() {
                    if (!cell.classList.contains('editing')) return;
                    
                    const selectedPk = input.dataset.selectedPk;
                    const originalPk = input.dataset.originalPk || input.dataset.originalValue;
                    const originalText = input.dataset.originalText || '';
                    const currentText = input.value.trim();

                    // selected valid new variant from options
                    if (selectedPk && String(selectedPk) !== String(originalPk)) {
                        input.classList.add('changed');
                        const success = await saveValue(cell, fieldName, selectedPk);
                        if (success) {
                            disableEditMode(cell, input, editBtn, false);
                        } else {
                            input.value = originalText;
                            delete input.dataset.selectedPk;
                            input.classList.remove('changed');
                        }
                        return;
                    }

                    // input not valid text
                    if (!selectedPk && currentText !== originalText && currentText !== '') {
                        showNotification('Выберите значение из выпадающего списка', 'error');
                        input.value = originalText;
                        input.classList.remove('changed');
                        disableEditMode(cell, input, editBtn, false);
                        return;
                    }

                    // same new value
                    input.value = originalText;
                    delete input.dataset.selectedPk;
                    input.classList.remove('changed');
                    disableEditMode(cell, input, editBtn, false);
                });
            }
            else {
                input.addEventListener('input', function() {
                    if (input.value !== input.dataset.originalValue) {
                        input.classList.add('changed');
                    } else {
                        input.classList.remove('changed');
                    }
                });

                input.addEventListener('change', async function() {
                    if (!cell.classList.contains('editing')) return;
                    const newValue = input.value;
                    const originalValue = input.dataset.originalValue;

                    if (newValue !== originalValue) {
                        input.classList.add('changed');
                        const success = await saveValue(cell, fieldName, newValue);
                        if (success) {
                            disableEditMode(cell, input, editBtn, false);
                        } else {
                            input.value = originalValue;
                            input.classList.remove('changed');
                        }
                    }
                });
            }
        }
    });
});

if (!document.querySelector('#cell-edit-styles')) {
    const style = document.createElement('style');
    style.id = 'cell-edit-styles';
    style.textContent = `@keyframes fadeInOut { 0% { opacity: 0; transform: translateY(20px); } 15% { opacity: 1; transform: translateY(0); } 85% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(20px); } } .cell-input.changed, .cell-select.changed { border-color: #ff9800 !important; background-color: #fff8e1 !important; } .editing .cell-input, .editing .cell-select { background-color: white !important; border-color: #4caf50 !important; } .cell-editor { display: flex; align-items: center; gap: 8px; } .cell-input, .cell-select { flex: 1; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; transition: all 0.2s; background-color: #f5f5f5; } .cell-input:focus, .cell-select:focus { outline: none; border-color: #4caf50; box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2); } .edit-icon-btn { background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; opacity: 1; } .edit-icon-btn:hover { background-color: rgba(0, 0, 0, 0.05); } .edit-icon-btn.save-mode svg path { stroke: #4caf50; } .save-indicator { display: inline-block; }`;
    document.head.appendChild(style);
}