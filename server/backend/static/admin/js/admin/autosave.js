'use strict';
// =============================================================================
// скрипт собственной логики сохранения значения ячейки на сервере
// =============================================================================


// извлечение csrf-токена из cookies django или из скрытого поля формы.
// токен необходим для прохождения проверки csrfviewmiddleware при post-запросах.
// приоритет: сначала ищем в cookies (csrftoken=...), потом в hidden input.
function getCSRFToken() {
  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrftoken='))
    ?.split('=')[1];
  return cookieValue || document.querySelector('[name=csrfmiddlewaretoken]')?.value;
}

// показ всплывающего уведомления в углу экрана.
// тип может быть 'success' (зелёный) или 'error' (красный).
// уведомление автоматически удаляется из dom через 2.5 секунды.
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `autosave-notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2500);
}

// программное выделение нужной опции в <select> по её значению.
// сначала снимает выделение со всех опций, потом ставит у подходящей.
// используется для отката значений при ошибке сохранения и при инициализации.
function updateSelectSelection(select, value) {
  if (!select || select.tagName !== 'SELECT') return;
  Array.from(select.options).forEach((option) => {
    option.selected = false;
  });
  const optionToSelect = Array.from(select.options).find(
    (option) => String(option.value) === String(value),
  );
  if (optionToSelect) {
    optionToSelect.selected = true;
  }
}

// если одно сохранение уже идёт, новые вызовы игнорируются, этот флаг будет за этим следить
let isSaving = false;

// отправка изменённого значения ячейки на сервер через post-запрос.
// принимает ячейку, имя поля и новое значение.
// возвращает true при успехе и false при ошибке или отсутствии изменений.
async function saveValue(cell, fieldName, value) {
  if (isSaving) {
    return false;
  }
  isSaving = true;

  const pk = cell.dataset.pk;
  const appLabel = cell.dataset.appLabel;
  const modelName = cell.dataset.modelName;
  const input = cell.querySelector('.cell-input, .cell-select, .cell-boolean');

  if (!input) {
    showNotification('Ошибка: поле не найдено', 'error');
    isSaving = false;
    return false;
  }

  // ---------------------------------------------------------------------
  // "мост" для формы добавления элемента: добавление новой записи (pk === 'add').
  // в этом режиме запроса на сервер вручную не происходит, только синхронизация
  // значений кастомного input и скрытым виджетом django,
  // чтобы доверится встроенной логике Django касаемой добавления элемента в базу данных.
  // ---------------------------------------------------------------------
  if (pk === 'add') {
    let valueToSave = value;
    if (input.classList.contains('cell-foreignkey')) {
      input.dataset.originalPk = input.dataset.originalValue || '';

      if (input.dataset.pk === 'add' && input.dataset.originalPk) {
        input.dataset.selectedPk = input.dataset.originalPk;
      }
    }
    const originalWidget = cell.querySelector('.original-widget');
    if (originalWidget) {
      if (originalWidget.type === 'checkbox') {
        originalWidget.checked = String(valueToSave) === 'True' || valueToSave === true;
      } else {
        originalWidget.value = valueToSave;
      }
    }
    input.dataset.originalValue = valueToSave;
    if (input.classList.contains('cell-foreignkey')) {
      input.dataset.originalPk = valueToSave;
      input.dataset.originalText = input.value;
      delete input.dataset.selectedPk;
    }
    showNotification('Сохранено', 'success');
    isSaving = false;
    return true;
  }

  // значение, которое надо сохранить
  let valueToSave = value;

  // для foreignkey-полей сохраняем именно pk связанного объекта,
  // а не его текстовое представление (оно нужно только для отображения)
  if (input.classList.contains('cell-foreignkey')) {
    const finalValue = input.dataset.selectedPk || input.dataset.originalValue;
    if (!finalValue || String(finalValue) === 'undefined' || String(finalValue) === 'null') {
      showNotification('Выберите значение из списка', 'error');
      isSaving = false;
      return false;
    }
    valueToSave = finalValue;
  }
  
  // если значение не изменилось по сравнению с оригинальным ничего не происходит
  const originalValue = input.dataset.originalValue;
  if (String(valueToSave) === String(originalValue)) {
    isSaving = false;
    return false;
  }

  try {
    const url = `/api/update-cell/${appLabel}/${modelName}/`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCSRFToken(), // csrf-защита
        'X-Requested-With': 'XMLHttpRequest', // признак ajax-запроса
      },
      credentials: 'same-origin', // cookies сессии
      body: JSON.stringify({
        pk: pk,
        field: fieldName,
        value: valueToSave,
      }),
    });
    const data = await response.json();
    if (data.success) {
      // обновляем "оригинальное" значение, чтобы следующие изменения
      // сравнивались уже с новым сохранённым состоянием
      input.dataset.originalValue = valueToSave;
      if (input.classList.contains('cell-foreignkey')) {
        input.dataset.originalPk = valueToSave;
        input.dataset.originalText = input.value;
        delete input.dataset.selectedPk;
      } else if (input.tagName === 'INPUT' && input.type !== 'checkbox') {
        input.value = valueToSave;
      }

      // синхронизируем визуальное состояние элемента управления
      if (input.tagName === 'SELECT') {
        updateSelectSelection(input, valueToSave);
      } else if (input.type === 'checkbox') {
        input.checked = valueToSave === 'True';
      }
      showNotification('Сохранено', 'success');
      isSaving = false;
      return true;
    } else {
      throw new Error(data.error || 'Ошибка сохранения');
    }
  } catch (error) {
    showNotification(`Ошибка: ${error.message}`, 'error');

    // при ошибке откат значение поля к оригинальному состоянию
    if (input.tagName === 'SELECT') {
      updateSelectSelection(input, originalValue);
    } else if (input.type === 'checkbox') {
      input.checked = originalValue === 'true';
    } else {
      if (input.classList.contains('cell-foreignkey')) {
        input.value = input.dataset.originalText || '';
        delete input.dataset.selectedPk;
      } else {
        input.value = originalValue || '';
      }
    }
    isSaving = false;
    return false;
  }
}

// активация режима редактирования: разблокирует input, меняет иконку кнопки,
// запоминает оригинальные значения для возможного отката
function enableEditMode(cell, input, editBtn) {
  if (cell.classList.contains('editing')) return;
  cell.classList.add('editing');

  if (input && input.tagName === 'INPUT' && input.type !== 'checkbox') {
    if (input.classList.contains('cell-foreignkey')) {
      if (!input.dataset.originalText) {
        input.dataset.originalText = input.value;
      }
    }
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
    editBtn.classList.add('is-editing');
    editBtn.title = 'Сохранить';
  }
}

// деактивация режима редактирования.
// если restorevalue === true, значение поля откатывается к оригинальному
// (используется при отмене изменений или ошибке сохранения).
function disableEditMode(cell, input, editBtn, restoreValue = true) {
  if (!cell.classList.contains('editing')) {
    return;
  }

  if (restoreValue && input) {
    if (input.tagName === 'SELECT') {
      updateSelectSelection(input, input.dataset.originalValue);
    } else if (input.type === 'checkbox') {
      input.checked = input.dataset.originalValue === 'true';
    } else {
      if (input.classList.contains('cell-foreignkey')) {
        input.value = input.dataset.originalText || '';
        delete input.dataset.selectedPk;
      } else {
        input.value = input.dataset.originalValue || '';
      }
    }
  }

  cell.classList.remove('editing');
  if (input) {
    input.disabled = true;
    input.classList.add('is-disabled');
    input.classList.remove('changed');
  }
  if (editBtn) {
    editBtn.classList.remove('is-editing');
    editBtn.title = 'Редактировать';
  }
}

// =============================================================================
// инициализация при загрузке страницы
// =============================================================================
document.addEventListener('DOMContentLoaded', function () {
  // -----------------------------------------------------------------
  // первичная инициализация всех редактируемых ячеек таблицы:
  // блокируем input, оригинальные значения сохраняются в data-атрибутах
  // -----------------------------------------------------------------
  const cells = document.querySelectorAll('.editable-cell');
  cells.forEach((cell) => {
    const input = cell.querySelector('.cell-input, .cell-select, .cell-boolean');
    const editBtn = cell.querySelector('.edit-icon-btn');

    if (!editBtn) return;
    editBtn.classList.remove('is-editing');
    editBtn.title = 'Редактировать';

    if (input) {
      input.disabled = true;
      input.classList.add('is-disabled');

      if (input.tagName === 'INPUT' && input.type !== 'checkbox') {
        input.dataset.originalValue = input.value;
        if (input.classList.contains('cell-foreignkey')) {
          input.dataset.originalText = input.value;
          input.dataset.originalPk = input.dataset.originalValue || '';
        }
      } else if (input.tagName === 'SELECT') {
        input.dataset.originalValue = input.value;
      } else if (input.type === 'checkbox') {
        input.dataset.originalValue = input.checked ? 'True' : 'False';
      }
    }
  });

  // -----------------------------------------------------------------
  // обработчик клика на кнопку редактирования/сохранения.
  // одна и та же кнопка работает как переключатель:
  //   - если ячейка не в режиме редактирования - включаем его
  //   - если в режиме редактирования - сохраняем или отменяем изменения
  // -----------------------------------------------------------------
  document.addEventListener('click', function (e) {
    const editBtn = e.target.closest('.edit-icon-btn');
    if (!editBtn) return;

    const cell = editBtn.closest('.editable-cell');
    if (!cell) return;

    const input = cell.querySelector('.cell-input, .cell-select, .cell-boolean');
    const fieldName = cell.dataset.fieldName;

    e.preventDefault();
    e.stopPropagation();

    if (cell.classList.contains('editing')) {
      if (input && input.classList.contains('cell-foreignkey')) {
        const selectedPk = input.dataset.selectedPk;
        const originalPk = input.dataset.originalPk || input.dataset.originalValue;

        if (!selectedPk || String(selectedPk) === String(originalPk)) {
          disableEditMode(cell, input, editBtn, true);
          return;
        }
      }

      if (input && input.tagName === 'INPUT' && input.type !== 'checkbox') {
        const currentVal = input.value;
        const originalVal = input.dataset.originalValue;

        if (String(currentVal) !== String(originalVal)) {
          input.classList.add('changed');
          saveValue(cell, fieldName, currentVal).then((success) => {
            disableEditMode(cell, input, editBtn, success ? false : true);
          });
          return;
        }
      }
      disableEditMode(cell, input, editBtn, true);
    } else {
      enableEditMode(cell, input, editBtn);
    }
  });

  // -----------------------------------------------------------------
  // обработчик события input (ввод текста в реальном времени).
  // отслеживает изменения и добавляет/убирает css-класс 'changed',
  // который визуально выделяет изменённые, но ещё не сохранённые поля.
  // -----------------------------------------------------------------
  document.addEventListener('input', function (e) {
    const input = e.target.closest('.cell-input, .cell-select, .cell-boolean');
    if (!input) return;
    const cell = input.closest('.editable-cell');
    if (!cell) return;

    if (input.classList.contains('cell-foreignkey')) {
      if (input.value !== input.dataset.originalText) input.classList.add('changed');
      else input.classList.remove('changed');
    } else if (input.tagName !== 'SELECT' && input.type !== 'checkbox') {
      if (input.value !== input.dataset.originalValue) input.classList.add('changed');
      else input.classList.remove('changed');
    }
  });

  // -----------------------------------------------------------------
  // обработчик события change (срабатывает для select, checkbox
  // и после завершения ввода в text input).
  // для select и checkbox запускает автосохранение сразу после изменения,
  // для foreignkey - после выбора значения из автодополнения.
  // -----------------------------------------------------------------
  document.addEventListener('change', function (e) {
    const input = e.target.closest('.cell-input, .cell-select, .cell-boolean');
    if (!input) return;
    const cell = input.closest('.editable-cell');
    if (!cell) return;

    const editBtn = cell.querySelector('.edit-icon-btn');
    const fieldName = cell.dataset.fieldName;

    if (!cell.classList.contains('editing')) return;

    if (input.tagName === 'SELECT') {
      const newValue = input.value;
      const originalValue = input.dataset.originalValue;
      if (newValue !== originalValue) {
        input.classList.add('changed');
        saveValue(cell, fieldName, newValue).then((success) => {
          if (success) disableEditMode(cell, input, editBtn, false);
          else {
            updateSelectSelection(input, originalValue);
            input.classList.remove('changed');
          }
        });
      }
    } else if (input.type === 'checkbox') {
      const newValue = input.checked ? 'True' : 'False';
      const originalValue = input.dataset.originalValue;
      if (newValue !== originalValue) {
        input.classList.add('changed');
        saveValue(cell, fieldName, newValue).then((success) => {
          if (success) disableEditMode(cell, input, editBtn, false);
          else {
            input.checked = originalValue === 'true';
            input.classList.remove('changed');
          }
        });
      }
    } else if (input.classList.contains('cell-foreignkey')) {
      const selectedPk = input.dataset.selectedPk;
      const originalPk = input.dataset.originalPk || input.dataset.originalValue;
      if (selectedPk && String(selectedPk) !== String(originalPk)) {
        input.classList.add('changed');
        saveValue(cell, fieldName, selectedPk).then((success) => {
          if (success) disableEditMode(cell, input, editBtn, false);
          else {
            input.value = input.dataset.originalText || '';
            delete input.dataset.selectedPk;
            input.classList.remove('changed');
          }
        });
      }
    }
  });

  // -----------------------------------------------------------------
  // обработчик клавиши escape - отмена редактирования без сохранения.
  // значение поля откатывается к оригинальному.
  // -----------------------------------------------------------------
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const input = e.target.closest('.cell-input, .cell-select, .cell-boolean');
      if (!input) return;
      const cell = input.closest('.editable-cell');
      if (!cell || !cell.classList.contains('editing')) return;

      const editBtn = cell.querySelector('.edit-icon-btn');
      e.preventDefault();
      disableEditMode(cell, input, editBtn, true);
    }
  });

  // -----------------------------------------------------------------
  // инициализация select-элементов с атрибутом data-selected-value:
  // программно выставляем выбранную опцию, пришедшую с сервера.
  // нужно, потому что django-шаблон не всегда корректно проставляет
  // атрибут selected в динамически сгенерированных inline-формах.
  // -----------------------------------------------------------------
  document.querySelectorAll('select[data-selected-value]').forEach(function (select) {
    const selectedValue = select.getAttribute('data-selected-value');
    if (selectedValue) {
      Array.from(select.options).forEach(function (option) {
        if (String(option.value) === String(selectedValue)) {
          option.selected = true;
        }
      });
    }
  });

  // -----------------------------------------------------------------
  // перехват отправки основной формы django-админки.
  // перед сабмитом синхронизируем значения всех кастомных foreignkey-input
  // с их скрытыми оригинальными виджетами (.original-widget),
  // чтобы pk связанного объекта корректно ушёл на сервер.
  //
  // это необходимо, потому что django "видит" только стандартные input/select,
  // а кастомные поля автодополнения хранят pk в data-атрибутах.
  // -----------------------------------------------------------------
  const form = document.querySelector('#content-main form');
  if (form) {
    form.addEventListener('submit', function (e) {
      document.querySelectorAll('.cell-foreignkey').forEach(function (input) {
        const cell = input.closest('td');
        if (!cell) return;
        const originalWidget = cell.querySelector('.original-widget');
        if (!originalWidget) return;
        const pkToSave = input.dataset.selectedPk || input.dataset.originalPk || '';
        originalWidget.value = pkToSave;
      });
    });
  }
});
