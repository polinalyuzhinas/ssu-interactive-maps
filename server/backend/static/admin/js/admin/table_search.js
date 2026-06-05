'use strict';

document.addEventListener('DOMContentLoaded', function() {
    const searchInputs = document.querySelectorAll('#result_list .search-input');
    if (searchInputs.length === 0) {
        return;
    }

    searchInputs.forEach((searchInput, index) => {
        const colIndex = searchInput.dataset.col;
        const fieldName = searchInput.dataset.fieldName;
        
        let debounceTimer;
        
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const searchTerm = this.value.trim();
                filterTableByField(colIndex, searchTerm);
            }, 300);
        });
        
        searchInput.addEventListener('search', function() {
            if (this.value === '') {
                filterTableByField(colIndex, '');
            }
        });
    });

    function getCellText(cell) {
        if (!cell) {
            return '';
        }

        const select = cell.querySelector('.cell-select');
        if (select) {
            const selectedOption = select.options[select.selectedIndex];
            const text = selectedOption ? selectedOption.text.trim() : '';
            return text;
        }

        const input = cell.querySelector('.cell-input');
        if (input && input.type !== 'checkbox') {
            const text = input.value || '';
            return text;
        }
        
        const checkbox = cell.querySelector('.cell-boolean');
        if (checkbox) {
            const text = checkbox.checked ? 'Да' : 'Нет';
            return text;
        }
        
        // fallback (all textContent of element)
        const text = cell.textContent || '';
        return text;
    }

    function filterTableByField(colIndex, searchTerm) {
    
    const rows = document.querySelectorAll('#result_list tbody tr');
    
    if (rows.length === 0) {
        return;
    }

    const searchInput = document.querySelector(`.search-input[data-col="${colIndex}"]`);
    const fieldName = searchInput?.dataset.fieldName;
    
    if (!fieldName) {
        return;
    }

    let visibleCount = 0;
    let debugInfo = [];
    
    rows.forEach((row, rowIndex) => {
        const cell = row.querySelector(`td[data-field-name="${fieldName}"]`);
        
        if (!cell) {
            return;
        }
        
        const cellText = getCellText(cell).toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        
        const matches = searchTerm === '' || cellText.includes(searchLower);
        
        if (matches) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    updateVisibleCounter(visibleCount, rows.length);
}

    function updateVisibleCounter(visibleCount, totalRows) {
        const bulkCounter = document.getElementById('bulk-counter');
        if (bulkCounter) {
            if (visibleCount === totalRows) {
                bulkCounter.textContent = `Выбрано 0 из ${totalRows}`;
            } else {
                bulkCounter.textContent = `Выбрано 0 из ${visibleCount} (отфильтровано из ${totalRows})`;
            }
        }
    }
});