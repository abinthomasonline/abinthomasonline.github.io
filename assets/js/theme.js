(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-theme-toggle]"));

  function readTheme() {
    try {
      return localStorage.getItem("theme");
    } catch (error) {
      return null;
    }
  }

  function writeTheme(theme) {
    try {
      localStorage.setItem("theme", theme);
    } catch (error) {
      return;
    }
  }

  function preferredTheme() {
    var saved = readTheme();
    if (saved === "dark" || saved === "light") {
      return saved;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function currentTheme() {
    return root.classList.contains("dark") ? "dark" : "light";
  }

  function updateButton(button, theme) {
    var useLight = theme === "dark";
    var icon = button.querySelector("[data-theme-icon]");
    var label = button.querySelector("[data-theme-label]");
    var action = useLight ? "Use light theme" : "Use dark theme";
    if (icon) {
      icon.textContent = useLight ? "☀" : "☾";
    }
    if (label) {
      label.textContent = useLight ? "Light" : "Dark";
    }
    button.setAttribute("aria-label", action);
    button.setAttribute("title", action);
  }

  function setTheme(theme) {
    var next = theme === "dark" ? "dark" : "light";
    root.classList.toggle("dark", next === "dark");
    body.classList.toggle("dark", next === "dark");
    writeTheme(next);
    buttons.forEach(function (button) {
      updateButton(button, next);
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", next === "dark" ? "#1a1a1a" : "#ffffff");
    }
  }

  setTheme(preferredTheme());

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  });

  window.requestAnimationFrame(function () {
    root.classList.add("theme-ready");
  });
}());
