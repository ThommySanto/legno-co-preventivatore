// Apply the saved appearance before React and styles paint the first frame.
// Keep this key aligned with THEME_STORAGE_KEY in src/hooks/useTheme.ts.
(function () {
  var theme = 'light';
  try {
    if (localStorage.getItem('legno-co:theme:v1') === 'dark') theme = 'dark';
  } catch (_) { /* Storage may be disabled. */ }
  var background = theme === 'dark' ? '#111715' : '#faf9f6';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.documentElement.style.backgroundColor = background;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', background);
})();
