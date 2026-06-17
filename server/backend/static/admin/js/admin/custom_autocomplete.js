'use strict';

  function getCSRFToken() {
    const cookieValue = document.cookie
      .split('; ')
      .find((row) => row.startsWith('csrftoken='))
      ?.split('=')[1];
    const token = cookieValue || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    return token;
  }

  // экранирование HTML для защиты от XSS
  function escapeHtml(str) {
    return String(str).replace(/[&<>]/g, function (m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  // активация режима редактирования ячейки
  function activateEditMode(cell, input) {
    if (!cell || cell.classList.contains('editing')) {
      return;
    }

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

    input.focus();
  }

  // основная функция: привязка автодополнения к input
  function attachAutocomplete(input) {
    const cell = input.closest('.editable-cell');
    if (!cell) {
      return;
    }

    const appLabel = cell.dataset.appLabel;
    const modelName = cell.dataset.modelName;
    const fieldName = input.dataset.fieldName;

    if (!appLabel || !modelName || !fieldName) {
      return;
    }

    // создание dropdown и добавление в body
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    dropdown.style.display = 'none';
    document.body.appendChild(dropdown);

    let currentController = null; // AbortController для отмены запросов
    let selectedIndex = -1;
    let isValidOption = false;

    input.addEventListener('input', function () {
      isValidOption = false;
      const query = input.value.trim();

      if (query.length < 2) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
      }

      // отмена прошлого запроса
      if (currentController) {
        currentController.abort();
      }

      dropdown.innerHTML = '<div class="autocomplete-loading">Загрузка...</div>';
      dropdown.style.display = 'block';

      currentController = new AbortController();

      const params = new URLSearchParams({
        term: query,
        app_label: appLabel,
        model_name: modelName,
        field_name: fieldName,
      });

      const url = `/api/autocomplete/?${params}`;

      fetch(url, {
        method: 'GET',
        headers: {
          'X-CSRFToken': getCSRFToken(),
          Accept: 'application/json',
        },
        signal: currentController.signal,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (data.error) {
            dropdown.innerHTML = `<div class="autocomplete-error">${escapeHtml(data.error)}</div>`;
            setTimeout(() => {
              dropdown.style.display = 'none';
            }, 2000);
          } else {
            renderDropdown(data.results || []);
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError') {
            return;
          }
          dropdown.innerHTML = '<div class="autocomplete-error">Ошибка загрузки</div>';
          setTimeout(() => {
            dropdown.style.display = 'none';
          }, 3000);
        })
        .finally(() => {
          currentController = null;
        });
    });

    // рендеринг списка результатов
    function renderDropdown(items) {
      dropdown.innerHTML = '';

      if (!items.length) {
        dropdown.style.display = 'none';
        return;
      }

      items.forEach((item) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'autocomplete-item';
        itemEl.textContent = item.text; // textContent безопаснее innerHTML
        itemEl.dataset.value = item.id;
        itemEl.dataset.text = item.text;

        itemEl.addEventListener('mousedown', function (e) {
          e.preventDefault();

          const selectedText = itemEl.dataset.text;
          const selectedId = itemEl.dataset.value;

          activateEditMode(cell, input);
          input.value = selectedText;
          input.dataset.selectedPk = String(selectedId);
          isValidOption = true;

          // отправка события change с bubbles:true -
          // это нужно, чтобы Django Admin (и другие скрипты)
          // могли услышать изменение через addEventListener
          input.dispatchEvent(new Event('change', { bubbles: true }));
          dropdown.style.display = 'none';
        });

        dropdown.appendChild(itemEl);
      });

      const rect = input.getBoundingClientRect();
      Object.assign(dropdown.style, {
        position: 'absolute',
        top: `${rect.bottom + window.scrollY}px`,
        left: `${rect.left + window.scrollX}px`,
        width: `${rect.width}px`,
        zIndex: '10000',
      });
      dropdown.style.display = 'block';
      selectedIndex = -1;
    }

    document.addEventListener('click', function (e) {
      const clickedInsideDropdown = dropdown.contains(e.target);
      const clickedOnInput = input === e.target;

      if (!clickedInsideDropdown && !clickedOnInput) {
        if (dropdown.style.display !== 'none') {
          dropdown.style.display = 'none';
        }
      }
    });

    input.addEventListener('keydown', function (e) {
      const items = dropdown.querySelectorAll('.autocomplete-item');
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
            const selected = items[selectedIndex];

            activateEditMode(cell, input);
            input.value = selected.dataset.text;
            input.dataset.selectedPk = String(selected.dataset.value);
            isValidOption = true;

            input.dispatchEvent(new Event('change', { bubbles: true }));
            dropdown.style.display = 'none';
          }
          break;

        case 'Escape':
          dropdown.style.display = 'none';
          selectedIndex = -1;
          break;
      }
    });

    function updateSelected(items) {
      items.forEach((el) => el.classList.remove('selected'));
      if (selectedIndex >= 0 && items[selectedIndex]) {
        items[selectedIndex].classList.add('selected');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const cells = document.querySelectorAll('.cell-text, .cell-foreignkey');
    cells.forEach(attachAutocomplete);
  });
