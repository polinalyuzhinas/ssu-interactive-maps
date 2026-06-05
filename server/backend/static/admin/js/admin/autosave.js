'use strict';

// Получение CSRF токена
function getCSRFToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    return cookieValue || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
}

// Показ уведомлений
function showNotification(message, type = 'success') {
    const oldNotifications = document.querySelectorAll('.autosave-notification');
    oldNotifications.forEach(n => n.remove());
    const notification = document.createElement('div');
    notification.className = 'autosave-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 10px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        border-radius: 4px;
        z-index: 10001;
        animation: fadeInOut 2s ease;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// Обновление выбранной опции в select
function updateSelectSelection(select, value) {
    if (!select || select.tagName !== 'SELECT') return;
    Array.from(select.options).forEach(option => {
        option.selected = false;
    });
    const optionToSelect = Array.from(select.options).find(option => 
        String(option.value) === String(value)
    );
    if (optionToSelect) {
        optionToSelect.selected = true;
    }
}

// Сохранение значения
async function saveValue(cell, fieldName, value) {
    const pk = cell.dataset.pk;
    const appLabel = cell.dataset.appLabel;
    const modelName = cell.dataset.modelName;

    const input = cell.querySelector('.cell-input, .cell-select, .cell-boolean');
    if (!input) {
        showNotification('Ошибка: поле не найдено', 'error');
        return false;
    }

    const originalValue = input.dataset.originalValue;

    if (String(value) === String(originalValue)) {
        return false;
    }

    // Показываем индикатор сохранения
    let saveIndicator = cell.querySelector('.save-indicator');
    if (!saveIndicator) {
        saveIndicator = document.createElement('span');
        saveIndicator.className = 'save-indicator';
        saveIndicator.textContent = '💾';
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
                value: value
            })
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            showNotification('Сессия истекла. Обновите страницу.', 'error');
            return false;
        }

        if (!response.ok) {
            if (response.status === 403) {
                showNotification('Ошибка доступа. Обновите страницу.', 'error');
            } else if (response.status === 401) {
                showNotification('Сессия истекла. Обновите страницу.', 'error');
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
            return false;
        }

        const data = await response.json();

        if (data.success) {
            // Обновляем data-original-value
            input.dataset.originalValue = value;

            // Для SELECT: обновляем выбранную опцию
            if (input.tagName === 'SELECT') {
                updateSelectSelection(input, value);
            }

            // Для INPUT (текстовые поля)
            if (input.tagName === 'INPUT' && input.type !== 'checkbox') {
                input.value = value;
            }

            // Для CHECKBOX
            if (input.type === 'checkbox') {
                input.checked = value === 'True';
            }

            cell.classList.remove('editing');
            input.classList.remove('changed');

            showNotification('Сохранено', 'success');
            return true;
        } else {
            throw new Error(data.error || 'Ошибка сохранения');
        }
    } catch (error) {
        showNotification(`Ошибка: ${error.message}`, 'error');

        // Восстанавливаем значение
        if (input.tagName === 'SELECT') {
            updateSelectSelection(input, originalValue);
        } else if (input.type === 'checkbox') {
            input.checked = originalValue === 'true';
        } else {
            input.value = originalValue;
        }

        return false;
    } finally {
        if (saveIndicator) saveIndicator.style.display = 'none';
    }
}

// Включение режима редактирования
function enableEditMode(cell, input, editBtn) {
    if (cell.classList.contains('editing')) {
        return;
    }
    cell.classList.add('editing');

    if (input && input.tagName === 'INPUT' && input.type !== 'checkbox') {
        input.disabled = false;
        input.classList.remove('is-disabled');
        input.focus();
        input.select();
    }

    if (input && input.tagName === 'SELECT') {
        input.disabled = false;
        input.classList.remove('is-disabled');
        setTimeout(() => {
            input.focus();
        }, 10);
    }

    if (input && input.type === 'checkbox') {
        input.disabled = false;
        input.classList.remove('is-disabled');
    }

    if (editBtn) {
        editBtn.innerHTML = `
            <svg width="26" height="25" viewBox="0 0 26 25" fill="none">
                <path d="M21.5 3L9.5 15L4.5 10" stroke="#4caf50" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
        editBtn.classList.add('save-mode');
        editBtn.title = 'Сохранить';
    }
}

function disableEditMode(cell, input, editBtn, restoreValue = true) {
    if (!cell.classList.contains('editing')) return;

    if (restoreValue && input) {
        const originalValue = input.dataset.originalValue;

        if (input.tagName === 'SELECT') {
            updateSelectSelection(input, originalValue);
        } else if (input.type === 'checkbox') {
            input.checked = originalValue === 'true';
        } else {
            input.value = originalValue;
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

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    const cells = document.querySelectorAll('.editable-cell');

    cells.forEach((cell, idx) => {
        const input = cell.querySelector('.cell-input, .cell-select, .cell-boolean');
        const editBtn = cell.querySelector('.edit-icon-btn');

        if (!input || !editBtn) {
            return;
        }

        const fieldName = cell.dataset.fieldName;
        editBtn.dataset.originalIcon = editBtn.innerHTML;

        // Изначально поле disabled
        input.disabled = true;
        input.classList.add('is-disabled');

        // Если поле not-editable, скрываем кнопку и выходим
        if (cell.dataset.editable === 'False') {
            editBtn.style.display = 'none';
            return;
        }

        // Обработчик клика по кнопке редактирования
        // ПРАВКА 1: повторный клик — выход из режима редактирования без сохранения
        editBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (cell.classList.contains('editing')) {
                // Повторный клик — выход без сохранения
                disableEditMode(cell, input, editBtn, true);
            } else {
                enableEditMode(cell, input, editBtn);
            }
        });

        // Отмена редактирования по Escape
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && cell.classList.contains('editing')) {
                e.preventDefault();
                disableEditMode(cell, input, editBtn, true);
            }
        });

        // Для SELECT: автосохранение при изменении
        if (input.tagName === 'SELECT') {
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
                        updateSelectSelection(input, originalValue);
                        input.classList.remove('changed');
                    }
                }
            });
        }

        // Для CHECKBOX: автосохранение при изменении
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

        // ПРАВКА 3: Для INPUT (текстовые поля) — автосохранение при изменении (аналогично SELECT)
        if (input.tagName === 'INPUT' && input.type !== 'checkbox') {
            input.addEventListener('input', function() {
                if (input.value !== input.dataset.originalValue) {
                    input.classList.add('changed');
                } else {
                    input.classList.remove('changed');
                }
            });

            // Автосохранение при потере фокуса (change для text input)
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
    });
});

// CSS стили
if (!document.querySelector('#cell-edit-styles')) {
    const style = document.createElement('style');
    style.id = 'cell-edit-styles';
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(20px); }
            15% { opacity: 1; transform: translateY(0); }
            85% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(20px); }
        }

        .cell-input.changed,
        .cell-select.changed {
            border-color: #ff9800 !important;
            background-color: #fff8e1 !important;
        }

        .editing .cell-input,
        .editing .cell-select {
            background-color: white !important;
            border-color: #4caf50 !important;
        }

        .cell-editor {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .cell-input, .cell-select {
            flex: 1;
            padding: 6px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            transition: all 0.2s;
            background-color: #f5f5f5;
        }

        .cell-input:focus, .cell-select:focus {
            outline: none;
            border-color: #4caf50;
            box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
        }

        .edit-icon-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            opacity: 1;
        }

        .edit-icon-btn:hover {
            background-color: rgba(0, 0, 0, 0.05);
        }

        .edit-icon-btn.save-mode svg path {
            stroke: #4caf50;
        }

        .save-indicator {
            display: inline-block;
        }
    `;
    document.head.appendChild(style);
}