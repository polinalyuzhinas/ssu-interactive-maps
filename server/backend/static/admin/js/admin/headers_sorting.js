document.addEventListener('DOMContentLoaded', function() {
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
    btn.addEventListener('click', function(e) {
      e.preventDefault();

      const col = this.dataset.col;
      const currentState = this.dataset.state;
      const urlParams = new URLSearchParams(window.location.search);
      const oParam = urlParams.get('o') || '';
      let sorts = oParam ? oParam.split('.').map(s => s.toString()) : [];

      let sortIndex = -1;
      for (let i = 0; i < sorts.length; i++) {
        const s = sorts[i];
        if (s === col || s === '-' + col) { sortIndex = i; break; }
      }

      if (currentState === 'none') {
        sorts.unshift(col);
        this.dataset.state = 'asc';
      } else if (currentState === 'asc') {
        sorts[sortIndex] = '-' + col;
        this.dataset.state = 'desc';
      } else {
        sorts.splice(sortIndex, 1);
        this.dataset.state = 'none';
      }

      const newO = sorts.join('.');
      if (newO) urlParams.set('o', newO);
      else urlParams.delete('o');

      const newUrl = window.location.pathname + '?' + urlParams.toString();

      window.history.pushState({ path: newUrl }, '', newUrl);
      this.classList.add('loading');
      this.disabled = true;

      // sorted table request
      fetch(newUrl)
        .then(response => {
          if (!response.ok) throw new Error('Сетевая ошибка');
          return response.text();
        })
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const newTbody = doc.querySelector('#result_list tbody');
          const currentTbody = document.querySelector('#result_list tbody');

          if (newTbody && currentTbody) {
            currentTbody.innerHTML = newTbody.innerHTML;
          }
        })
        .catch(error => {
          console.error('Ошибка сортировки:', error);
          // fallback: default refreshing page
          window.location.href = newUrl;
        })
        .finally(() => {
          this.classList.remove('loading');
          this.disabled = false;
        });
    });
  });

  initSortStates();
});