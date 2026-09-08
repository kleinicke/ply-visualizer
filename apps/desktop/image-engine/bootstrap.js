let saved = {};
window.acquireVsCodeApi = () => ({
  getState: () => saved,
  setState: value => {
    saved = value;
  },
  postMessage: message => {
    window.dispatchEvent(new CustomEvent('image-message', { detail: message }));
  },
});
// The desktop owns menus; keep pointer interaction with the image engine.
document.addEventListener(
  'contextmenu',
  event => {
    event.preventDefault();
    event.stopImmediatePropagation();
  },
  true
);
