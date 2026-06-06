'use strict';
// with styles and some html, todo: move it out of there

(function($) {
    if (!document.querySelector('#autocomplete-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'autocomplete-notification-styles';
        style.textContent = `.autosave-notification { position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; border-radius: 4px; z-index: 10001; animation: fadeInOut 2s ease; font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); } @keyframes fadeInOut { 0% { opacity: 0; transform: translateY(20px); } 15% { opacity: 1; transform: translateY(0); } 85% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(20px); } }`;
        document.head.appendChild(style);
    }

    function getCSRFToken() {
        const cookieValue = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];
        return cookieValue || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    }

    function attachAutocomplete(input) {
        const $input = $(input);
        const cell = $input.closest('.editable-cell');
        const appLabel = cell.data('app-label');
        const modelName = cell.data('model-name');
        const fieldName = $input.data('field-name');
        
        if (!appLabel || !modelName || !fieldName) return;

        const dropdown = $('<div class="autocomplete-dropdown" style="display:none; position:absolute; background:white; border:1px solid #ccc; max-height:200px; overflow-y:auto; z-index:10000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>');
        $('body').append(dropdown);

        let currentRequest = null;
        let selectedIndex = -1;
        let isValidOption = false;

        $input.on('input', function() {
            isValidOption = false;
            const query = $input.val().trim();
            if (query.length < 2) {
                dropdown.hide().empty();
                return;
            }
            
            currentRequest = $.ajax({
                url: '/api/autocomplete/',
                method: 'GET',
                data: { term: query, app_label: appLabel, model_name: modelName, field_name: fieldName },
                dataType: 'json',
                headers: { 'X-CSRFToken': getCSRFToken() },
                success: function(data) {
                    if (data.error) {
                        dropdown.html('<div style="padding:8px; color:red;">' + data.error + '</div>');
                        setTimeout(() => dropdown.hide(), 2000);
                    } else {
                        renderDropdown(data.results || []);
                    }
                },
                error: function() {
                    dropdown.html('<div style="padding:8px; color:red;">Ошибка загрузки</div>');
                    setTimeout(() => dropdown.hide(), 3000);
                },
                complete: function() { currentRequest = null; }
            });
        });

        function renderDropdown(items) {
            dropdown.empty();
            if (!items.length) {
                dropdown.hide();
                return;
            }
            items.forEach((item) => {
                const $item = $('<div class="autocomplete-item" style="padding:6px 8px; cursor:pointer; border-bottom:1px solid #eee;">' + escapeHtml(item.text) + '</div>')
                    .data('value', item.id)
                    .data('text', item.text);
                
                $item.on('mousedown', function(e) {
                    e.preventDefault();
                    
                    const selectedText = $(this).data('text');
                    const selectedId = $(this).data('value');
                    
                    $input.val(selectedText);
                    input.dataset.selectedPk = String(selectedId);
                    isValidOption = true;
                    
                    $input.trigger('change');
                    dropdown.hide();
                });
                
                $item.on('mouseenter', function() { $(this).css('background-color', '#e3f2fd'); })
                     .on('mouseleave', function() { $(this).css('background-color', ''); });
                dropdown.append($item);
            });
            
            const offset = $input.offset();
            dropdown.css({ top: offset.top + $input.outerHeight(), left: offset.left, width: $input.outerWidth() }).show();
            selectedIndex = -1;
        }

        function escapeHtml(str) {
            return String(str).replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }

        $(document).on('click', function(e) {
            if (!dropdown.is(e.target) && !$input.is(e.target) && !dropdown.has(e.target).length) {
                dropdown.hide();
            }
        });

        $input.on('keydown', function(e) {
            const items = dropdown.children('.autocomplete-item');
            if (!items.length) return;
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                    updateSelected(items);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, -1);
                    updateSelected(items);
                    break;
                case 'Enter':
                    if (selectedIndex >= 0) {
                        e.preventDefault();
                        const $selected = items.eq(selectedIndex);
                        const selectedText = $selected.data('text');
                        const selectedId = $selected.data('value');
                        
                        $input.val(selectedText);
                        input.dataset.selectedPk = String(selectedId);
                        isValidOption = true;
                        
                        $input.trigger('change');
                        dropdown.hide();
                    }
                    break;
                case 'Escape':
                    dropdown.hide();
                    selectedIndex = -1;
                    break;
            }
        });

        function updateSelected(items) {
            items.removeClass('selected').css('background-color', '');
            if (selectedIndex >= 0) {
                items.eq(selectedIndex).addClass('selected').css('background-color', '#e3f2fd');
                items[selectedIndex].scrollIntoView({ block: 'nearest' });
            }
        }
    }

    $(document).ready(function() {
        $('.cell-text, .cell-foreignkey').each(function() { 
            attachAutocomplete(this); 
        });
    });
})(jQuery);