document.addEventListener('DOMContentLoaded', function() {
  // state of sorting button (extends from django core)
  function initSortStates() {
    const urlParams = new URLSearchParams(window.location.search);
    const oParam = urlParams.get('o') || '';
    const sorts = oParam ? oParam.split('.').map(s => s.toString()) : [];
    
    document.querySelectorAll('.sort-toggle-btn').forEach(function(btn) {
      const col = btn.dataset.col;
      let state = 'none';
      
      for (const s of sorts) {
        if (s === col) { state = 'asc'; break; }
        if (s === '-' + col) { state = 'desc'; break; }
      }
      btn.dataset.state = state;
    });
  }
  
  document.querySelectorAll('.sort-toggle-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const col = this.dataset.col;
      const currentState = this.dataset.state;
      const urlParams = new URLSearchParams(window.location.search);
      const oParam = urlParams.get('o') || '';
      let sorts = oParam ? oParam.split('.').map(s => s.toString()) : [];
      
      // current state for column
      let sortIndex = -1;
      for (let i = 0; i < sorts.length; i++) {
        const s = sorts[i];
        if (s === col || s === '-' + col) {
          sortIndex = i;
          break;
        }
      }
      
      // none -> asc -> desc -> none cycling
      if (currentState === 'none') {
        sorts.unshift(col);
      } else if (currentState === 'asc') {
        sorts[sortIndex] = '-' + col;
      } else {
        sorts.splice(sortIndex, 1);
      }
      
      const newO = sorts.join('.');
      if (newO) {
        urlParams.set('o', newO);
      } else {
        urlParams.delete('o');
      }
    });
  });
  
  initSortStates();
});