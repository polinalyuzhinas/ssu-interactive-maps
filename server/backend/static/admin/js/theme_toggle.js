document.addEventListener('DOMContentLoaded', function() {
  const lightBtn = document.querySelector('.theme-btn-light');
  const darkBtn = document.querySelector('.theme-btn-dark');
  const originalToggle = document.querySelector('.theme-toggle');

  if (!lightBtn || !darkBtn || !originalToggle) return;

  function getCurrentTheme() {
    return document.documentElement.dataset.theme || 'auto';
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    // saving in localStorage
    try {
        localStorage.setItem('django-admin-theme', theme);
    } catch (e) {
      console.log(e)
    }
    updateButtonStates();
  }

  function updateButtonStates() {
    const theme = getCurrentTheme();

    lightBtn.disabled = false;
    lightBtn.classList.remove('unactive');
    darkBtn.disabled = false;
    darkBtn.classList.remove('unactive');

    if (theme === 'light') {
      lightBtn.disabled = true;
      darkBtn.classList.add('unactive');
    } else if (theme === 'dark') {
      darkBtn.disabled = true;
      lightBtn.classList.add('unactive');
    }
    // if theme === 'auto' both buttons activated
  }

  function handleThemeClick(targetTheme) {
    const currentTheme = getCurrentTheme();
    if (currentTheme === targetTheme) return;
    setTheme(targetTheme);
    setTimeout(updateButtonStates, 50);
  }

  lightBtn.addEventListener('click', function() {
    handleThemeClick('light');
  });

  darkBtn.addEventListener('click', function() {
    handleThemeClick('dark');
  });

  updateButtonStates();

  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.attributeName === 'data-theme') {
        updateButtonStates();
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
});