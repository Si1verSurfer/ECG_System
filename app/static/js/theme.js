/**
 * Central theme management: light/dark mode with localStorage and system preference fallback.
 * Dispatches "ecg-theme-change" so charts and other UI can react.
 */
(function () {
  var THEME_KEY = "ecg-theme";
  var EVENT_THEME_CHANGE = "ecg-theme-change";

  function getTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
    if (typeof window.matchMedia !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  }

  function setTheme(theme) {
    var next = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
    updateToggleLabel();
    try {
      window.dispatchEvent(new CustomEvent(EVENT_THEME_CHANGE, { detail: { theme: next } }));
    } catch (e) {}
  }

  function updateToggleLabel() {
    var btn = document.getElementById("themeToggle");
    if (!btn) return;
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var label = isDark ? "Switch to light mode" : "Switch to dark mode";
    btn.setAttribute("title", label);
    btn.setAttribute("aria-label", label);
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
  }

  // Apply saved or system theme on load (before paint when possible)
  setTheme(getTheme());

  // Attach toggle to button when DOM is ready
  function attachToggle() {
    var btn = document.getElementById("themeToggle");
    if (btn) {
      btn.addEventListener("click", toggleTheme);
      updateToggleLabel();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachToggle);
  } else {
    attachToggle();
  }

  // Expose for other scripts
  window.ECGTheme = {
    getTheme: getTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    THEME_KEY: THEME_KEY,
    EVENT_THEME_CHANGE: EVENT_THEME_CHANGE,
  };
})();
