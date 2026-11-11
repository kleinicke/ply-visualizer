/**
 * Covers the whole window with a transparent layer for the duration of a UI
 * drag (panel resize/move) so no pointer or wheel input reaches the 3D scene
 * underneath. Returns a function that removes the mask (safe to call twice).
 *
 * The mask also removes itself whenever the drag must be over - any pointer
 * release or cancel, the window losing focus, or a press on the mask itself -
 * so a drag whose end event never reaches its owner (lost pointer capture, a
 * trackpad gesture, a second button) cannot leave an invisible layer that
 * swallows every click.
 */
export function maskPointerInput(cursor: string): () => void {
  const mask = document.createElement('div');
  mask.setAttribute('aria-hidden', 'true');
  mask.style.cssText = `position:fixed;inset:0;z-index:2147483646;cursor:${cursor};background:transparent;touch-action:none;`;
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  let removed = false;
  const remove = () => {
    if (removed) {
      return;
    }
    removed = true;
    mask.remove();
    window.removeEventListener('pointerup', remove, true);
    window.removeEventListener('pointercancel', remove, true);
    window.removeEventListener('blur', remove);
  };
  mask.addEventListener('wheel', swallow, { passive: false });
  mask.addEventListener('contextmenu', swallow);
  // A press on the mask means no drag is holding it any more.
  mask.addEventListener('pointerdown', event => {
    swallow(event);
    remove();
  });
  window.addEventListener('pointerup', remove, true);
  window.addEventListener('pointercancel', remove, true);
  window.addEventListener('blur', remove);
  document.body.appendChild(mask);
  return remove;
}
