document.addEventListener('DOMContentLoaded', function () {
  function updateDeleteButton() {
    const deleteBtn = document.getElementById('btn-delete-selected');
    const checked = document.querySelectorAll('.action-select:checked');
    const hasSelection = checked.length > 0;

    deleteBtn.disabled = !hasSelection;

    if (hasSelection) {
      deleteBtn.classList.remove('unactive');
    } else {
      deleteBtn.classList.add('unactive');
    }
  }

  function updateCounter() {
    const checkboxes = document.querySelectorAll('.action-select');
    const checked = document.querySelectorAll('.action-select:checked').length;
    const total = checkboxes.length;
    const bulkCounter = document.getElementById('bulk-counter');

    if (bulkCounter) {
      bulkCounter.textContent = `Выбрано ${checked} объектов из ${total}`;
    }

    checkboxes.forEach((cb) => {
      const row = cb.closest('tr');
      if (row) {
        if (cb.checked) {
          row.classList.add('selected');
        } else {
          row.classList.remove('selected');
        }
      }
    });
  }

  document.addEventListener('change', function (e) {
    if (e.target.classList && e.target.classList.contains('action-select')) {
      updateCounter();
      updateDeleteButton();
    }
  });

  const selectAllBtn = document.getElementById('select-all-btn');
  const removeAllBtn = document.getElementById('remove-all-btn');

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function () {
      document.querySelectorAll('.action-select').forEach((cb) => {
        cb.checked = true;
      });
      updateCounter();
      updateDeleteButton();
    });
  }

  if (removeAllBtn) {
    removeAllBtn.addEventListener('click', function () {
      document.querySelectorAll('.action-select').forEach((cb) => {
        cb.checked = false;
      });
      updateCounter();
      updateDeleteButton();
    });
  }

  document.addEventListener('click', function (e) {
    const deleteBtn = e.target.closest('#btn-delete-selected');
    if (!deleteBtn) return;

    e.preventDefault();
    if (deleteBtn.disabled) {
      return;
    }

    const changelistForm = document.getElementById('changelist-form');
    if (!changelistForm) {
      return;
    }

    let actionInput = changelistForm.querySelector('[name="action"]');
    if (!actionInput) {
      actionInput = document.createElement('input');
      actionInput.type = 'hidden';
      actionInput.name = 'action';
      changelistForm.appendChild(actionInput);
    }
    actionInput.value = 'delete_selected';
    changelistForm.submit();
  });

  updateCounter();
  updateDeleteButton();
});
