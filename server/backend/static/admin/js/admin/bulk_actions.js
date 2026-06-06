document.addEventListener('DOMContentLoaded', function() {
  const selectAllBtn = document.getElementById('select-all-btn');
  const removeAllBtn = document.getElementById('remove-all-btn');
  const bulkCounter = document.getElementById('bulk-counter');
  const deleteBtn = document.getElementById('btn-delete-selected');
  const changelistForm = document.getElementById('changelist-form');
  
  function updateDeleteButton() {
    if (!deleteBtn) return;
    const checked = document.querySelectorAll('.action-select:checked');
    deleteBtn.disabled = checked.length === 0;
  }
  
  function updateCounter() {
    const checkboxes = document.querySelectorAll('.action-select');
    const checked = document.querySelectorAll('.action-select:checked').length;
    const total = checkboxes.length;
    if (bulkCounter) {
      bulkCounter.textContent = `Выбрано ${checked} объектов из ${total}`;
    }
    
    checkboxes.forEach(cb => {
      const row = cb.closest('tr');
      if (cb.checked) {
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
      }
    });
  }

  if (selectAllBtn && removeAllBtn && bulkCounter) {
    selectAllBtn.addEventListener('click', function() {
      document.querySelectorAll('.action-select').forEach(cb => {
        cb.checked = true;
      });
      updateCounter();
      updateDeleteButton();
    });
    
    removeAllBtn.addEventListener('click', function() {
      document.querySelectorAll('.action-select').forEach(cb => {
        cb.checked = false;
      });
      updateCounter();
      updateDeleteButton();
    });
    
    document.querySelectorAll('.action-select').forEach(cb => {
      cb.addEventListener('change', function() {
        updateCounter();
        updateDeleteButton();
      });
    });
    
    updateCounter();
    updateDeleteButton();
  }

  deleteBtn.addEventListener('click', function(e) {
    e.preventDefault();
    if (deleteBtn.disabled) return;

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
});