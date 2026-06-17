'use strict';

// эти переменные хранят данные между вызовами функций в течение жизни страницы.
// все они инициализируются при загрузке dom и используются при каждой фильтрации.

let allData = [];           // массив всех объектов модели, загруженных с сервера
let listDisplay = [];       // список имён полей в порядке отображения в таблице (из admin.list_display)
let currentFilter = {};     // текущие активные фильтры: { fieldName: searchText, ... }
let appLabel = '';          // метка django-приложения (например, 'core')
let modelName = '';         // имя модели (например, 'lessons')
let rowTemplate = null;     // клонированный шаблон строки таблицы для быстрого создания новых строк
let originalRows = [];      // массив оригинальных dom-узлов строк таблицы (для отката при сбросе фильтров)

document.addEventListener('DOMContentLoaded', async function () {
  // -----------------------------------------------------------------
  // определяем, для какой модели работает текущая страница.
  // берём первую редактируемую ячейку и читаем data-атрибуты,
  // которые django-шаблон проставил при рендеринге таблицы.
  // -----------------------------------------------------------------
  const firstCell = document.querySelector('.editable-cell');
  if (!firstCell) return;

  appLabel = firstCell.dataset.appLabel;
  modelName = firstCell.dataset.modelName;

  if (!appLabel || !modelName) {
    console.error('Cannot determine app/model from dataset');
    return;
  }

  await loadAllData();

  const tbody = document.querySelector('#result_list tbody');
  if (tbody) {
    originalRows = Array.from(tbody.querySelectorAll('tr'));

    const firstRow = tbody.querySelector('tr');
    if (firstRow) {
      rowTemplate = firstRow.cloneNode(true);
    }
  }

  // -----------------------------------------------------------------
  // находим все поля поиска в шапке таблицы.
  // в django admin такие поля имеют класс .search-input и располагаются
  // над соответствующими колонками таблицы.
  // -----------------------------------------------------------------
  const searchInputs = document.querySelectorAll('#result_list .search-input');
  if (!searchInputs.length) return;

  const changelistForm = document.getElementById('changelist-form');
  if (changelistForm) {
    changelistForm.addEventListener('submit', function (e) {
      if (Object.keys(currentFilter).length > 0) {
        e.preventDefault();
      }
    });
  }

  // -----------------------------------------------------------------
  // навешиваем обработчики на каждое поисковое поле.
  // index позиции поля соответствует индексу в list_display -
  // это позволяет сопоставить поле с конкретным именем поля модели.
  // -----------------------------------------------------------------
  searchInputs.forEach((searchInput, idx) => {
    if (idx >= listDisplay.length) return;
    const fieldName = listDisplay[idx];

    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
    });

    searchInput.addEventListener('input', function () {
      const value = this.value.trim().toLowerCase();
      if (value === '') {
        delete currentFilter[fieldName];
      } else {
        currentFilter[fieldName] = value;
      }
      applyFilters();
    });
  });

  // =================================================================
  // основная функция фильтрации
  // =================================================================
  // вызывается при каждом изменении любого поискового поля.
  // решает, показывать ли оригинальные строки или отфильтрованные данные
  function applyFilters() {
    const hasActiveFilter = Object.keys(currentFilter).length > 0;
    const tbody = document.querySelector('#result_list tbody');
    if (!tbody) return;

    // случай 1: фильтров нет - восстанавливаем оригинальные строки
    // это быстрее, чем перерисовывать из allData, и сохраняет
    // все оригинальные стили, классы и dom-структуру django admin.
    if (!hasActiveFilter) {
      tbody.innerHTML = '';
      originalRows.forEach((row) => tbody.appendChild(row));
      updateVisibleCounter(originalRows.length);

      const pagination = document.querySelector('.pagination');
      if (pagination) {
        pagination.style.display = '';
      }
      return;
    }

    // случай 2: есть фильтры - фильтруем allData в памяти
    const filteredData = allData.filter((item) => {
      for (const [field, searchTerm] of Object.entries(currentFilter)) {
        if (!searchTerm) continue;

        let cellValue = '';
        const fieldValue = item[field];
        const fieldInfo = window.field_info?.[field] || {};
        const fieldType = fieldInfo.type || 'text';

        if (fieldType === 'choices') {
          const choices = fieldInfo.choices || [];
          const selectedChoice = choices.find((c) => String(c.value) === String(fieldValue));
          cellValue = selectedChoice ? selectedChoice.label.toLowerCase() : '';
        } else if (fieldType === 'foreignkey' && fieldValue && typeof fieldValue === 'object') {
          cellValue = (fieldValue.text || '').toLowerCase();
        } else if (fieldType === 'boolean') {
          cellValue = fieldValue ? 'да' : 'нет';
        } else {
          cellValue = String(fieldValue || '').toLowerCase();
        }

        if (!cellValue.includes(searchTerm)) {
          return false;
        }
      }
      return true;
    });

    // перерисовываем таблицу и обновляем счётчик
    updateTableRows(filteredData);
    updateVisibleCounter(filteredData.length);

    const pagination = document.querySelector('.pagination');
    if (pagination) {
      pagination.style.display = 'none';
    }
  }

  // =================================================================
  // перерисовка строк таблицы
  // =================================================================
  function updateTableRows(data) {
    const tbody = document.querySelector('#result_list tbody');
    if (!tbody || !rowTemplate) return;

    tbody.innerHTML = '';

    const maxRows = Math.min(data.length, 100);
    for (let i = 0; i < maxRows; i++) {
      const newRow = createRow(data[i]);
      tbody.appendChild(newRow);
    }

    if (data.length > 100) {
      const warningRow = document.createElement('tr');
      warningRow.innerHTML = `<td colspan="${listDisplay.length + 1}" style="background: none; text-align: center; padding: 20px; color: #C62F2F;">
                Показано 100 из ${data.length} найденных записей. Уточните поиск для просмотра остальных.
            </td>`;
      tbody.appendChild(warningRow);
    }
  }

  // =================================================================
  // создание одной строки таблицы из данных
  // =================================================================
  function createRow(item) {
    const row = rowTemplate.cloneNode(true);
    const cells = row.querySelectorAll('td');

    cells.forEach((cell) => {
      if (cell.classList.contains('editable-cell')) {
        cell.dataset.pk = item.pk;
        cell.dataset.appLabel = appLabel;
        cell.dataset.modelName = modelName;
      }
    });

    const checkboxInput = cells[0].querySelector('.action-select');
    if (checkboxInput) {
      checkboxInput.value = item.pk;
      checkboxInput.checked = false;
    }

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
          const text = fieldValue && fieldValue.text ? fieldValue.text : '';
          const pk = fieldValue && fieldValue.pk ? String(fieldValue.pk) : '';

          input.value = text;
          input.dataset.originalPk = pk;
          input.dataset.originalValue = pk;
          delete input.dataset.selectedPk;
        }
      } else if (fieldType === 'choices') {
        if (select) {
          let newValue = '';
          if (fieldValue && typeof fieldValue === 'object' && fieldValue.pk) {
            newValue = String(fieldValue.pk);
          } else {
            newValue = String(fieldValue || '');
          }

          Array.from(select.options).forEach((option) => {
            option.selected = String(option.value) === String(newValue);
          });

          select.dataset.originalValue = newValue;
        }
      } else if (fieldType === 'boolean') {
        if (checkbox) {
          const isChecked = fieldValue === true || fieldValue === 'true';
          checkbox.checked = isChecked;
          checkbox.dataset.originalValue = isChecked ? 'true' : 'false';
        }
      } else {
        if (input) {
          const displayValue = fieldValue || '';
          input.value = displayValue;
          input.dataset.originalValue = displayValue;
        }
      }
    });

    return row;
  }

  // =================================================================
  // загрузка всех записей модели с сервера
  // =================================================================
  async function loadAllData() {
    try {
      const response = await fetch(`/api/get-all/${appLabel}/${modelName}/`);

      if (!response.ok) {
        console.error(`HTTP error: ${response.status} ${response.statusText}`);
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return;
      }

      const data = await response.json();

      if (data.success) {
        allData = data.data;
        listDisplay = data.list_display;
        window.field_info = data.field_info;
      } else {
        console.error('Failed to load data:', data.error);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // =================================================================
  // обновление счётчика найденных записей
  // =================================================================
  function updateVisibleCounter(visibleCount) {
    const bulkCounter = document.getElementById('bulk-counter');
    if (bulkCounter) {
      bulkCounter.textContent = `Найдено ${visibleCount} записей`;
    }
  }

  
  // =================================================================
  // сброс всех чекбоксов массовых действий
  // =================================================================
  const checkboxes = document.querySelectorAll('.action-select');
  checkboxes.forEach((cb) => {
    if (cb.checked) {
      cb.checked = false;
      const row = cb.closest('tr');
      if (row) {
        row.classList.remove('selected');
      }
    }
  });
});
