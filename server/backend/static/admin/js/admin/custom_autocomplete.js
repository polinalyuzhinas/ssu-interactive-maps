'use strict';

(function($) {
    // Функция для получения CSRF токена
    function getCSRFToken() {
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        return cookieValue || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    }
    
    function attachAutocomplete(input) {
        const $input = $(input);
        const cell = $input.closest('.editable-cell');
        
        const appLabel = cell.data('app-label');
        const modelName = cell.data('model-name');
        const fieldName = $input.data('field-name');
        
        if (!appLabel || !modelName || !fieldName) return;
        
        const dropdown = $('<div class="autocomplete-dropdown" style="display:none; position:absolute; background:white; border:1px solid #ccc; max-height:200px; overflow-y:auto; z-index:10000;"></div>');
        $('body').append(dropdown);
        
        let currentRequest = null;
        let selectedIndex = -1;
        
        $input.on('input', function() {
            const query = $input.val().trim();
            
            if (query.length < 2) {
                dropdown.hide().empty();
                return;
            }
            
            if (currentRequest) {
                currentRequest.abort();
            }
            
            dropdown.html('<div style="padding:8px;">Загрузка...</div>').show();
            
            currentRequest = $.ajax({
                url: '/api/autocomplete/',
                method: 'GET',  // GET запрос не требует CSRF, но на всякий случай
                data: {
                    term: query,
                    app_label: appLabel,
                    model_name: modelName,
                    field_name: fieldName
                },
                dataType: 'json',
                headers: {
                    'X-CSRFToken': getCSRFToken()  // Добавляем CSRF токен
                },
                success: function(data) {
                    if (data.error) {
                        dropdown.html('<div style="padding:8px; color:red;">' + data.error + '</div>');
                        setTimeout(() => dropdown.hide(), 2000);
                    } else {
                        renderDropdown(data.results || []);
                    }
                },
                error: function(xhr) {
                    console.error('AJAX error:', xhr.status, xhr.statusText);
                    let errorMsg = 'Ошибка загрузки';
                    if (xhr.status === 403) {
                        errorMsg = 'Ошибка 403: недостаточно прав. Обновите страницу.';
                    } else if (xhr.status === 404) {
                        errorMsg = 'Ошибка 404: эндпоинт не найден';
                    }
                    dropdown.html('<div style="padding:8px; color:red;">' + errorMsg + '</div>');
                    setTimeout(() => dropdown.hide(), 3000);
                },
                complete: function() {
                    currentRequest = null;
                }
            });
        });
        
        function renderDropdown(items) {
            dropdown.empty();
            
            if (!items.length) {
                dropdown.html('<div style="padding:8px;">Ничего не найдено</div>');
                return;
            }
            
            items.forEach((item, index) => {
                const $item = $('<div class="autocomplete-item" style="padding:6px 8px; cursor:pointer; border-bottom:1px solid #eee;">' + escapeHtml(item.text) + '</div>');
                $item.data('value', item.id);
                $item.on('click', function() {
                    $input.val($(this).data('value'));
                    $input.trigger('change');
                    dropdown.hide();
                    
                    if ($input.val() !== $input.attr('data-original-value')) {
                        $input.addClass('changed');
                        cell.addClass('editing');
                    }
                });
                $item.on('mouseenter', function() {
                    $(this).css('background-color', '#e3f2fd');
                });
                $item.on('mouseleave', function() {
                    $(this).css('background-color', '');
                });
                dropdown.append($item);
            });
            
            const offset = $input.offset();
            dropdown.css({
                top: offset.top + $input.outerHeight(),
                left: offset.left,
                width: $input.outerWidth()
            }).show();
            
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
            
            switch(e.key) {
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
                        $input.val($selected.data('value'));
                        $input.trigger('change');
                        dropdown.hide();
                        
                        if ($input.val() !== $input.attr('data-original-value')) {
                            $input.addClass('changed');
                            cell.addClass('editing');
                        }
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
                const selected = items[selectedIndex];
                selected.scrollIntoView({ block: 'nearest' });
            }
        }
    }
    
    $(document).ready(function() {
        $('.cell-text').each(function() {
            attachAutocomplete(this);
        });
    });
    
})(jQuery);