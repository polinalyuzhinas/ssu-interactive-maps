'use strict';
(function($) {
    function getCSRFToken() {
        const cookieValue = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];
        return cookieValue || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    }

    function activateEditMode(cell, input, $input) {
        if (!cell || cell.classList.contains('editing')) return;

        cell.classList.add('editing');
        const editBtn = cell.querySelector('.edit-icon-btn');
        if (editBtn) {
            editBtn.classList.add('is-editing');
            editBtn.title = 'Сохранить';
        }

        input.disabled = false;
        input.classList.remove('is-disabled');

        if (!input.dataset.originalText) {
            input.dataset.originalText = input.value;
        }
        if (!input.dataset.originalPk) {
            input.dataset.originalPk = input.dataset.originalValue || '';
        }

        if ($input) {
            $input.focus();
        }
    }

    function attachAutocomplete(input) {
        const $input = $(input);
        const $cell = $input.closest('.editable-cell');

        if (!$cell.length) return;

        const cell = $cell[0];
        const appLabel = $cell.data('app-label');
        const modelName = $cell.data('model-name');
        const fieldName = $input.data('field-name');

        if (!appLabel || !modelName || !fieldName) return;

        const dropdown = $('<div class="autocomplete-dropdown"></div>');
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
            if (currentRequest) {
                currentRequest.abort();
            }
            dropdown.html('<div class="autocomplete-loading">Загрузка...</div>').show();
            currentRequest = $.ajax({
                url: '/api/autocomplete/',
                method: 'GET',
                data: {
                    term: query,
                    app_label: appLabel,
                    model_name: modelName,
                    field_name: fieldName
                },
                dataType: 'json',
                headers: { 'X-CSRFToken': getCSRFToken() },
                success: function(data) {
                    if (data.error) {
                        dropdown.html('<div class="autocomplete-error">' + data.error + '</div>');
                        setTimeout(() => dropdown.hide(), 2000);
                    } else {
                        renderDropdown(data.results || []);
                    }
                },
                error: function() {
                    dropdown.html('<div class="autocomplete-error">Ошибка загрузки</div>');
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
                dropdown.hide();
                return;
            }
            items.forEach((item) => {
                const $item = $('<div class="autocomplete-item">' + escapeHtml(item.text) + '</div>');
                $item.data('value', item.id);
                $item.data('text', item.text);
                $item.on('mousedown', function(e) {
                    e.preventDefault();
                    const selectedText = $(this).data('text');
                    const selectedId = $(this).data('value');

                    activateEditMode(cell, input, $input);

                    $input.val(selectedText);
                    input.dataset.selectedPk = String(selectedId);
                    isValidOption = true;

                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    dropdown.hide();
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

                        activateEditMode(cell, input, $input);

                        $input.val(selectedText);
                        input.dataset.selectedPk = String(selectedId);
                        isValidOption = true;

                        input.dispatchEvent(new Event('change', { bubbles: true }));
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
            items.removeClass('selected');
            if (selectedIndex >= 0) {
                items.eq(selectedIndex).addClass('selected');
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