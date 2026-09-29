/* Shared behavior for every page: theme, navigation, language, reveal-on-scroll. */
(function () {
  var root = document.documentElement;

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  // Theme is applied as early as possible (see inline snippet in <head>); this keeps the button in sync.
  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    store('theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  // Optional bilingual content: a page defines window.I18N = {en: {...}, es: {...}}
  // and marks elements with data-i18n="key" (innerHTML is swapped).
  var originals = {};
  function setLang(lang) {
    if (!window.I18N) return;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!(key in originals)) originals[key] = el.innerHTML;
      var dict = window.I18N[lang] || {};
      el.innerHTML = lang === 'en' || !(key in dict) ? originals[key] : dict[key];
    });
    root.setAttribute('lang', lang);
    store('language', lang);
    document.querySelectorAll('[data-lang-toggle]').forEach(function (btn) {
      btn.textContent = lang === 'es' ? 'EN' : 'ES';
      btn.setAttribute('aria-label', lang === 'es' ? 'Switch to English' : 'Cambiar a español');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    setTheme(root.getAttribute('data-theme') || 'light');
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      });
    });

    if (window.I18N) {
      setLang(store('language') === 'es' ? 'es' : 'en');
      document.querySelectorAll('[data-lang-toggle]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setLang(root.getAttribute('lang') === 'es' ? 'en' : 'es');
        });
      });
    } else {
      document.querySelectorAll('[data-lang-toggle]').forEach(function (btn) { btn.remove(); });
    }

    // Mobile menu
    var topbar = document.querySelector('.topbar');
    var burger = document.querySelector('.burger');
    if (topbar && burger) {
      burger.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = topbar.classList.toggle('menu-open');
        burger.setAttribute('aria-expanded', open);
      });
      document.addEventListener('click', function (e) {
        if (!topbar.contains(e.target)) topbar.classList.remove('menu-open');
      });
      topbar.querySelectorAll('.nav-links a').forEach(function (a) {
        a.addEventListener('click', function () { topbar.classList.remove('menu-open'); });
      });
    }

    // Research dropdown: click toggles (needed on touch / small screens)
    document.querySelectorAll('.dropdown > .nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var dd = btn.parentElement;
        var open = dd.classList.toggle('open');
        btn.setAttribute('aria-expanded', open);
      });
    });
    document.addEventListener('click', function () {
      document.querySelectorAll('.dropdown.open').forEach(function (dd) { dd.classList.remove('open'); });
    });

    // Reveal on scroll
    var items = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      items.forEach(function (el) { io.observe(el); });
    } else {
      items.forEach(function (el) { el.classList.add('in'); });
    }
  });
})();
