document.addEventListener('DOMContentLoaded', function() {
    const tbody = document.querySelector('#result_list tbody');
    if (!tbody) return;

    const initialRows = Array.from(tbody.querySelectorAll('tr'));
    initialRows.forEach((row, index) => {
        row.dataset.originalIndex = index;
    });

    function getCellValue(row, colIndex) {
        const cell = row.cells[colIndex + 1];
        if (!cell) return '';

        const originalWidget = cell.querySelector('.original-widget');
        if (originalWidget) {
            const visibleSelect = cell.querySelector('.cell-select');
            if (visibleSelect && visibleSelect.tagName === 'SELECT') {
                const opt = visibleSelect.options[visibleSelect.selectedIndex];
                return opt ? opt.textContent.trim().toLowerCase() : '';
            }
            return String(originalWidget.value || '').toLowerCase();
        }

        const input = cell.querySelector('.cell-input, input[type="text"]');
        if (input) return String(input.value || '').toLowerCase();

        const select = cell.querySelector('select');
        if (select) {
            const opt = select.options[select.selectedIndex];
            return opt ? opt.textContent.trim().toLowerCase() : '';
        }

        const checkbox = cell.querySelector('.cell-boolean, input[type="checkbox"]');
        if (checkbox) return checkbox.checked ? 'да' : 'нет';

        return cell.textContent.trim().toLowerCase();
    }

    function sortTable(colIndex, direction) {
        const rows = Array.from(tbody.querySelectorAll('tr'));

        if (direction === 'none') {
            rows.sort((a, b) => {
                return parseInt(a.dataset.originalIndex, 10) - parseInt(b.dataset.originalIndex, 10);
            });
        } else {
            rows.sort((a, b) => {
                const valA = getCellValue(a, colIndex);
                const valB = getCellValue(b, colIndex);

                const numA = parseFloat(valA);
                const numB = parseFloat(valB);
                if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
                    return direction === 'asc' ? numA - numB : numB - numA;
                }

                const cmp = valA.localeCompare(valB, 'ru', { sensitivity: 'base' });
                return direction === 'asc' ? cmp : -cmp;
            });
        }

        rows.forEach(row => tbody.appendChild(row));
    }

    document.querySelectorAll('.sort-toggle-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const col = parseInt(this.dataset.col, 10);
            const currentState = this.dataset.state || 'none';

            // cecle of sort states none -> asc -> desc -> none
            let newState;
            if (currentState === 'none') newState = 'asc';
            else if (currentState === 'asc') newState = 'desc';
            else newState = 'none';

            document.querySelectorAll('.sort-toggle-btn').forEach(b => {
                if (b !== this) b.dataset.state = 'none';
            });
            this.dataset.state = newState;

            const url = new URL(window.location);
            if (newState === 'none') {
                url.searchParams.delete('o');
            } else {
                url.searchParams.set('o', newState === 'desc' ? `-${col}` : `${col}`);
            }
            window.history.pushState({}, '', url);

            sortTable(col, newState);
        });
    });

    function initSortStates() {
        const urlParams = new URLSearchParams(window.location.search);
        const oParam = urlParams.get('o') || '';
        
        document.querySelectorAll('.sort-toggle-btn').forEach(b => b.dataset.state = 'none');

        if (oParam) {
            const isDesc = oParam.startsWith('-');
            const colIndex = parseInt(isDesc ? oParam.substring(1) : oParam, 10);
            const state = isDesc ? 'desc' : 'asc';
            const btn = document.querySelector(`.sort-toggle-btn[data-col="${colIndex}"]`);
            if (btn) {
                btn.dataset.state = state;
                sortTable(colIndex, state);
            }
        }
    }

    window.addEventListener('popstate', function() {
        initSortStates();
    });

    initSortStates();
});