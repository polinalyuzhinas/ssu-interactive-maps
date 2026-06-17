'use strict';
{
  window.addEventListener('load', function (e) {
    const lightBtn = document.querySelector('.theme-btn-light');
    const darkBtn = document.querySelector('.theme-btn-dark');

    function getCurrentTheme() {
      return document.documentElement.getAttribute('data-theme') || 'light';
    }

    function updateButtonStates() {
      const theme = getCurrentTheme();

      lightBtn.disabled = theme === 'light';
      darkBtn.disabled = theme === 'dark';
      lightBtn.classList.toggle('unactive', theme === 'light');
      darkBtn.classList.toggle('unactive', theme === 'dark');
    }

    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      sessionStorage.setItem('user-theme', theme);
      updateButtonStates();
    }

    lightBtn.addEventListener('click', () => setTheme('light'));
    darkBtn.addEventListener('click', () => setTheme('dark'));

    updateButtonStates();
  });
}
