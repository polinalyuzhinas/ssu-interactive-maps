'use strict';

function getCSRFToken() {
    const cookieValue = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];
    return cookieValue || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `autosave-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2500);
}

function updateSelectSelection(select, value) {
    if (!select || select.tagName !== 'SELECT') return;
    Array.from(select.options).forEach(option => { option.selected = false; });
    const optionToSelect = Array.from(select.options).find(option => String(option.value) === String(value));
    if (optionToSelect) { optionToSelect.selected = true; }
}

let isSaving = false;

async function saveValue(cell, fieldName, value) {
    if (isSaving) {
        return false;
    }
    isSaving = true;

    const pk = cell.dataset.pk;
    const appLabel = cell.dataset.appLabel;
    const modelName = cell.dataset.modelName;
    const input = cell.querySelector('.cell-input, .cell-select, .cell-boolean');

    if (!input) {
        showNotification('Ошибка: поле не найдено', 'error');
        isSaving = false;
        return false;
    }

    // bridge to "add new constraint" page
    if (pk === 'add') {
        let valueToSave = value;
        if (input.classList.contains('cell-foreignkey')) {
            valueToSave = input.dataset.selectedPk || value;
        } else if (input.classList.contains('cell-boolean')) {
            valueToSave = input.checked ? 'True' : 'False';
        }
        const originalWidget = cell.querySelector('.original-widget');
        if (originalWidget) {
            if (originalWidget.type === 'checkbox') {
                originalWidget.checked = String(valueToSave) === 'True' || valueToSave === true;
            } else {
                originalWidget.value = valueToSave;
            }
        }
        input.dataset.originalValue = valueToSave;
        if (input.classList.contains('cell-foreignkey')) {
            input.dataset.originalPk = valueToSave;
            input.dataset.originalText = input.value;
            delete input.dataset.selectedPk;
        }
        showNotification('Сохранено', 'success');
        isSaving = false;
        return true;
    }

    let valueToSave = value;
    if (input.classList.contains('cell-foreignkey')) {
        const finalValue = input.dataset.selectedPk || input.dataset.originalValue;
        if (!finalValue || String(finalValue) === 'undefined' || String(finalValue) === 'null') {
            showNotification('Выберите значение из списка', 'error');
            isSaving = false;
            return false;
        }
        valueToSave = finalValue;
    }

    const originalValue = input.dataset.originalValue;

    if (String(valueToSave) === String(originalValue)) {
        isSaving = false;
        return false;
    }

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
        const data = await response.json();
        if (data.success) {
            input.dataset.originalValue = valueToSave;
            if (input.classList.contains('cell-foreignkey')) {
                input.dataset.originalPk = valueToSave;
                input.dataset.originalText = input.value;
                delete input.dataset.selectedPk;
            } else if (input.tagName === 'INPUT' && input.type !== 'checkbox') {
                input.value = valueToSave;
            }
            if (input.tagName === 'SELECT') {
                updateSelectSelection(input, valueToSave);
            } else if (input.type === 'checkbox') {
                input.checked = valueToSave === 'True';
            }
            showNotification('Сохранено', 'success');
            isSaving = false;
            return true;
        } else {
            throw new Error(data.error || 'Ошибка сохранения');
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');

        // cancelling changes in field when error appeared
        if (input.tagName === 'SELECT') {
            updateSelectSelection(input, originalValue);
        } else if (input.type === 'checkbox') {
            input.checked = originalValue === 'true';
        } else {
            if (input.classList.contains('cell-foreignkey')) {
                input.value = input.dataset.originalText || '';
                delete input.dataset.selectedPk;
            } else {
                input.value = originalValue || '';
            }
        }
        isSaving = false;
        return false;
    }
}

function enableEditMode(cell, input, editBtn) {
    if (cell.classList.contains('editing')) return;
    cell.classList.add('editing');

    if (input && input.tagName === 'INPUT' && input.type !== 'checkbox') {
        if (input.classList.contains('cell-foreignkey')) {
            if (!input.dataset.originalText) {
                input.dataset.originalText = input.value;
            }
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
        editBtn.classList.add('is-editing');
        editBtn.title = 'Сохранить';
    }
}

function disableEditMode(cell, input, editBtn, restoreValue = true) {
    if (!cell.classList.contains('editing')) {
        return;
    }

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
        editBtn.classList.remove('is-editing');
        editBtn.title = 'Редактировать';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const cells = document.querySelectorAll('.editable-cell');
    cells.forEach((cell) => {
        const input = cell.querySelector('.cell-input, .cell-select, .cell-boolean');
        const editBtn = cell.querySelector('.edit-icon-btn');
        
        if (!editBtn) return;
        editBtn.classList.remove('is-editing');
        editBtn.title = 'Редактировать';

        if (input) {
            input.disabled = true;
            input.classList.add('is-disabled');
            
            if (input.tagName === 'INPUT' && input.type !== 'checkbox') {
                input.dataset.originalValue = input.value;
                if (input.classList.contains('cell-foreignkey')) {
                    input.dataset.originalText = input.value;
                    input.dataset.originalPk = input.dataset.originalValue || '';
                }
            } else if (input.tagName === 'SELECT') {
                input.dataset.originalValue = input.value;
            } else if (input.type === 'checkbox') {
                input.dataset.originalValue = input.checked ? 'True' : 'False';
            }
        }
    });

    document.addEventListener('click', function(e) {
        const editBtn = e.target.closest('.edit-icon-btn');
        if (!editBtn) return;

        const cell = editBtn.closest('.editable-cell');
        if (!cell) return;

        const input = cell.querySelector('.cell-input, .cell-select, .cell-boolean');
        const fieldName = cell.dataset.fieldName;

        e.preventDefault();
        e.stopPropagation();

        if (cell.classList.contains('editing')) {
            if (input && input.classList.contains('cell-foreignkey')) {
                const selectedPk = input.dataset.selectedPk;
                const originalPk = input.dataset.originalPk || input.dataset.originalValue;
                
                if (!selectedPk || String(selectedPk) === String(originalPk)) {
                    disableEditMode(cell, input, editBtn, true);
                    return;
                }
            }

            if (input && input.tagName === 'INPUT' && input.type !== 'checkbox') {
                const currentVal = input.value;
                const originalVal = input.dataset.originalValue;
                
                if (String(currentVal) !== String(originalVal)) {
                    input.classList.add('changed');
                    saveValue(cell, fieldName, currentVal).then(success => {
                        disableEditMode(cell, input, editBtn, success ? false : true);
                    });
                    return;
                }
            }
            disableEditMode(cell, input, editBtn, true);
        } else {
            enableEditMode(cell, input, editBtn);
        }
    });

    document.addEventListener('input', function(e) {
        const input = e.target.closest('.cell-input, .cell-select, .cell-boolean');
        if (!input) return;
        const cell = input.closest('.editable-cell');
        if (!cell) return;

        if (input.classList.contains('cell-foreignkey')) {
            if (input.value !== input.dataset.originalText) input.classList.add('changed');
            else input.classList.remove('changed');
        } else if (input.tagName !== 'SELECT' && input.type !== 'checkbox') {
            if (input.value !== input.dataset.originalValue) input.classList.add('changed');
            else input.classList.remove('changed');
        }
    });

    document.addEventListener('change', function(e) {
        const input = e.target.closest('.cell-input, .cell-select, .cell-boolean');
        if (!input) return;
        const cell = input.closest('.editable-cell');
        if (!cell) return;
        
        const editBtn = cell.querySelector('.edit-icon-btn');
        const fieldName = cell.dataset.fieldName;

        if (!cell.classList.contains('editing')) return;

        if (input.tagName === 'SELECT') {
            const newValue = input.value;
            const originalValue = input.dataset.originalValue;
            if (newValue !== originalValue) {
                input.classList.add('changed');
                saveValue(cell, fieldName, newValue).then(success => {
                    if (success) disableEditMode(cell, input, editBtn, false);
                    else {
                        updateSelectSelection(input, originalValue);
                        input.classList.remove('changed');
                    }
                });
            }
        }
        else if (input.type === 'checkbox') {
            const newValue = input.checked ? 'True' : 'False';
            const originalValue = input.dataset.originalValue;
            if (newValue !== originalValue) {
                input.classList.add('changed');
                saveValue(cell, fieldName, newValue).then(success => {
                    if (success) disableEditMode(cell, input, editBtn, false);
                    else {
                        input.checked = originalValue === 'true';
                        input.classList.remove('changed');
                    }
                });
            }
        }
        else if (input.classList.contains('cell-foreignkey')) {
            const selectedPk = input.dataset.selectedPk;
            const originalPk = input.dataset.originalPk || input.dataset.originalValue;
            if (selectedPk && String(selectedPk) !== String(originalPk)) {
                input.classList.add('changed');
                saveValue(cell, fieldName, selectedPk).then(success => {
                    if (success) disableEditMode(cell, input, editBtn, false);
                    else {
                        input.value = input.dataset.originalText || '';
                        delete input.dataset.selectedPk;
                        input.classList.remove('changed');
                    }
                });
            }
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const input = e.target.closest('.cell-input, .cell-select, .cell-boolean');
            if (!input) return;
            const cell = input.closest('.editable-cell');
            if (!cell || !cell.classList.contains('editing')) return;
            
            const editBtn = cell.querySelector('.edit-icon-btn');
            e.preventDefault();
            disableEditMode(cell, input, editBtn, true);
        }
    });

    document.querySelectorAll('select[data-selected-value]').forEach(function(select) {
        const selectedValue = select.getAttribute('data-selected-value');
        if (selectedValue) {
            Array.from(select.options).forEach(function(option) {
                if (String(option.value) === String(selectedValue)) {
                    option.selected = true;
                }
            });
        }
    });
});