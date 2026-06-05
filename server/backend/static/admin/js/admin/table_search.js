'use strict';

document.addEventListener('DOMContentLoaded', function() {
    const searchInputs = document.querySelectorAll('#result_list .search-input');
    
    searchInputs.forEach(searchInput => {
        const colIndex = searchInput.dataset.col;
        const fieldName = searchInput.dataset.fieldName;
        
        // debounce delay
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
    
    // read-only
    function getCellText(cell) {
        if (!cell) return '';
        
        const select = cell.querySelector('.cell-select');
        if (select) {
            const selectedOption = select.options[select.selectedIndex];
            return selectedOption ? selectedOption.text.trim() : '';
        }

        const input = cell.querySelector('.cell-input');
        if (input && input.type !== 'checkbox') {
            return input.value || '';
        }
        
        const checkbox = cell.querySelector('.cell-boolean');
        if (checkbox) {
            return checkbox.checked ? 'Да' : 'Нет';
        }
        
        return cell.textContent || '';
    }
    
    function filterTableByField(colIndex, searchTerm) {
        const rows = document.querySelectorAll('#result_list tbody tr');
        let visibleCount = 0;
        
        // indexes + 1 because first col always with selection checkboxes
        const cellIndex = parseInt(colIndex) + 1;
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length <= cellIndex) return;
            
            const cell = cells[cellIndex];
            
            // read only
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
        
        updateVisibleCounter(visibleCount);
    }
    
    function updateVisibleCounter(visibleCount) {
        const bulkCounter = document.getElementById('bulk-counter');
        if (bulkCounter) {
            const originalTotal = document.querySelectorAll('#result_list tbody tr').length;
            if (visibleCount === originalTotal) {
                bulkCounter.textContent = `Выбрано 0 из ${originalTotal}`;
            } else {
                bulkCounter.textContent = `Выбрано 0 из ${visibleCount} (отфильтровано из ${originalTotal})`;
            }
        }
    }
    
    function updateFilterIndicator() {
        const hasActiveFilter = Array.from(searchInputs).some(input => input.value.trim() !== '');
        const resetBtn = document.querySelector('.reset-filters-btn');
        if (resetBtn) {
            resetBtn.style.background = hasActiveFilter ? '#dc3545' : '#6c757d';
            resetBtn.textContent = hasActiveFilter ? '✖ Сбросить фильтры' : 'Сбросить фильтры';
        }
    }
    
    searchInputs.forEach(input => {
        input.addEventListener('input', updateFilterIndicator);
        input.addEventListener('search', updateFilterIndicator);
    });
    
    updateFilterIndicator();
});