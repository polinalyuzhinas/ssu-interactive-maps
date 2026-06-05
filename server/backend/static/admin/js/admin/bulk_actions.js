document.addEventListener('DOMContentLoaded', function() {
  // ========== КНОПКИ ВЫБОРА ==========
  const selectAllBtn = document.getElementById('select-all-btn');
  const removeAllBtn = document.getElementById('remove-all-btn');
  const bulkCounter = document.getElementById('bulk-counter');
  const checkboxes = document.querySelectorAll('.action-select');
  
  if (selectAllBtn && removeAllBtn && bulkCounter) {
    function updateCounter() {
      const checked = document.querySelectorAll('.action-select:checked').length;
      const total = checkboxes.length;
      bulkCounter.textContent = `Выбрано ${checked} объектов из ${total}`;
      
      checkboxes.forEach(cb => {
        const row = cb.closest('tr');
        if (cb.checked) {
          row.classList.add('selected');
        } else {
          row.classList.remove('selected');
        }
      });
    }
    
    selectAllBtn.addEventListener('click', function() {
      checkboxes.forEach(cb => {
        cb.checked = true;
      });
      updateCounter();
      updateDeleteButton();
    });
    
    removeAllBtn.addEventListener('click', function() {
      checkboxes.forEach(cb => {
        cb.checked = false;
      });
      updateCounter();
    });
    
    checkboxes.forEach(cb => {
      cb.addEventListener('change', updateCounter);
    });
    
    updateCounter();
  }

  // ========== КНОПКА УДАЛЕНИЯ ==========
  const deleteBtn = document.getElementById('btn-delete-selected');
  const changelistForm = document.getElementById('changelist-form');
  
  if (deleteBtn && changelistForm) {
    
    function updateDeleteButton() {
      const checked = document.querySelectorAll('.action-select:checked');
      deleteBtn.disabled = checked.length === 0;
    }

    deleteBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      if (deleteBtn.disabled) return;
      
      const checked = document.querySelectorAll('.action-select:checked');
      const count = checked.length;
      
      if (confirm(`Вы уверены, что хотите удалить ${count} выбранный(ых) элемент(ов)? Это действие необратимо.`)) {
        // Находим или создаём поле action
        let actionInput = changelistForm.querySelector('select[name="action"]');
        if (!actionInput) {
          actionInput = document.createElement('select');
          actionInput.name = 'action';
          actionInput.style.display = 'none';
          changelistForm.appendChild(actionInput);
        }
        
        // Очищаем и добавляем option для delete_selected
        actionInput.innerHTML = '';
        const deleteOption = document.createElement('option');
        deleteOption.value = 'delete_selected';
        deleteOption.selected = true;
        actionInput.appendChild(deleteOption);
        
        // Отправляем форму (CSRF токен уже есть в форме)
        changelistForm.submit();
      }
    });

    checkboxes.forEach(cb => {
      cb.addEventListener('change', updateDeleteButton);
    });

    updateDeleteButton();
  }
});