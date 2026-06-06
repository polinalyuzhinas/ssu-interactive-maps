'use strict';

let allData = [];
let listDisplay = [];
let currentFilter = {};
let appLabel = '';
let modelName = '';

document.addEventListener('DOMContentLoaded', async function() {
    const firstCell = document.querySelector('.editable-cell');
    if (!firstCell) {
        return;
    }
    
    appLabel = firstCell.dataset.appLabel;
    modelName = firstCell.dataset.modelName;
    
    if (!appLabel || !modelName) {
        console.error('Cannot determine app/model from dataset');
        return;
    }
    
    await loadAllData();
    
    const searchInputs = document.querySelectorAll('#result_list .search-input');
    if (!searchInputs.length) return;
    
    searchInputs.forEach((searchInput, idx) => {
        if (idx >= listDisplay.length) return;
        const fieldName = listDisplay[idx];
        
        searchInput.addEventListener('input', function() {
            const value = this.value.trim().toLowerCase();
            if (value === '') {
                delete currentFilter[fieldName];
            } else {
                currentFilter[fieldName] = value;
            }
            applyFilters();
        });
    });
    
    function applyFilters() {
        const hasActiveFilter = Object.keys(currentFilter).length > 0;
    
    if (!hasActiveFilter) {
        updateTableRows(allData);
        updateVisibleCounter(allData.length);
        return;
    }
    
    const filteredData = allData.filter(item => {
        for (const [field, searchTerm] of Object.entries(currentFilter)) {
            if (!searchTerm) continue;
            
            let cellValue = '';
            const fieldValue = item[field];
            const fieldInfo = window.field_info?.[field] || {};
            const fieldType = fieldInfo.type || 'text';
            
            if (fieldType === 'choices') {
                const choices = fieldInfo.choices || [];
                const selectedChoice = choices.find(c => String(c.value) === String(fieldValue));
                cellValue = selectedChoice ? selectedChoice.label.toLowerCase() : '';
            }

            else if (fieldType === 'foreignkey' && fieldValue && typeof fieldValue === 'object') {
                cellValue = (fieldValue.text || '').toLowerCase();
            }

            else if (fieldType === 'boolean') {
                cellValue = fieldValue ? 'да' : 'нет';
            }

            else {
                cellValue = String(fieldValue || '').toLowerCase();
            }
            
            if (!cellValue.includes(searchTerm)) {
                return false;
            }
        }
        return true;
    });
    
    updateTableRows(filteredData);
    updateVisibleCounter(filteredData.length);
    }

    function updateTableRows(data) {
        const rows = document.querySelectorAll('#result_list tbody tr');
        
        rows.forEach((row, rowIndex) => {
            if (rowIndex < data.length) {
                row.style.display = '';
                updateRowData(row, data[rowIndex]);
            } else {
                row.style.display = 'none';
            }
        });
    }
    
function updateRowData(row, item) {
    const cells = row.querySelectorAll('td');

    // updated data-attributes
    cells.forEach(cell => {
        if (cell.classList.contains('editable-cell')) {
            cell.dataset.pk = item.pk;
            cell.dataset.appLabel = appLabel;
            cell.dataset.modelName = modelName;
        }
    });

    const checkboxInput = cells[0].querySelector('.action-select');
    if (checkboxInput) checkboxInput.value = item.pk;

    listDisplay.forEach((fieldName, idx) => {
        const cell = cells[idx + 1];
        if (!cell) return;
        
        const fieldInfo = window.field_info?.[fieldName] || {};
        const fieldType = fieldInfo.type || 'text';
        const fieldValue = item[fieldName];
        
        const select = cell.querySelector('.cell-select');
        const input = cell.querySelector('.cell-input');
        const checkbox = cell.querySelector('.cell-boolean');
        
        if (fieldType === 'foreignkey') {
            if (input) {
                const text = (fieldValue && fieldValue.text) ? fieldValue.text : '';
                const pk = (fieldValue && fieldValue.pk) ? String(fieldValue.pk) : '';
                
                input.value = text;
                input.dataset.originalPk = pk;
                input.dataset.originalValue = pk;
                delete input.dataset.selectedPk;
            }
        }
        else if (fieldType === 'choices') {
            if (select) {
                let newValue = '';
                if (fieldValue && typeof fieldValue === 'object' && fieldValue.pk) {
                    newValue = String(fieldValue.pk);
                } else {
                    newValue = String(fieldValue || '');
                }
                
                Array.from(select.options).forEach(option => {
                    option.selected = String(option.value) === String(newValue);
                });
                
                select.dataset.originalValue = newValue;
            }
        } 
        else if (fieldType === 'boolean') {
            if (checkbox) {
                const isChecked = fieldValue === true || fieldValue === 'true';
                checkbox.checked = isChecked;
                checkbox.dataset.originalValue = isChecked ? 'true' : 'false';
            }
        }
        else {
            if (input) {
                const displayValue = fieldValue || '';
                input.value = displayValue;
                input.dataset.originalValue = displayValue;
            }
        }
    });
}
    
    async function loadAllData() {
        try {
            const response = await fetch(`/api/get-all/${appLabel}/${modelName}/`);

            if (!response.ok) {
                console.error(`HTTP error: ${response.status} ${response.statusText}`);
                showSearchError(`Ошибка сервера: ${response.status}`);
                return;
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Received non-JSON response:', text.substring(0, 200));
                showSearchError('Сервер вернул не JSON. Обновите страницу.');
                return;
            }
            const data = await response.json();
            
            if (data.success) {
                allData = data.data;
                listDisplay = data.list_display;
                window.field_info = data.field_info;
                
                const rows = document.querySelectorAll('#result_list tbody tr');
                rows.forEach(row => row.style.display = '');
                updateVisibleCounter(rows.length);
            } else {
                console.error('Failed to load data:', data.error);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }
    
    function updateVisibleCounter(visibleCount) {
        const bulkCounter = document.getElementById('bulk-counter');
        if (bulkCounter) {
            bulkCounter.textContent = `Выбрано 0 из ${visibleCount}`;
        }
    }

    const checkboxes = document.querySelectorAll('.action-select');
    let wasChecked = false;

    checkboxes.forEach(cb => {
        if (cb.checked) {
            wasChecked = true;
            cb.checked = false;
            const row = cb.closest('tr');
            if (row) {
                row.classList.remove('selected');
            }
        }
    });
});