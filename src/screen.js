// Toggles the CSS classes on <html> that drive mobile.css: which mobile
// controls are visible depends on which screen (menu / play / gameover) is
// active. Shared by all three scenes, so it lives outside main.js to avoid
// a circular import between main.js and the scene modules.
export function setScreen(name) {
  document.documentElement.classList.toggle("menu", name === "menu");
  document.documentElement.classList.toggle("over", name === "over");
  document.documentElement.classList.toggle("play", name === "play");
}
