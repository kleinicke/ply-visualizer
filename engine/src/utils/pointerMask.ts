/**
 * Covers the whole window with a transparent layer for the duration of a UI
 * drag (panel resize/move) so no pointer or wheel input reaches the 3D scene
 * underneath. Returns a function that removes the mask.
 */
export function maskPointerInput(cursor: string): () => void {
  const mask = document.createElement('div');
  mask.setAttribute('aria-hidden', 'true');
  mask.style.cssText = `position:fixed;inset:0;z-index:2147483646;cursor:${cursor};background:transparent;touch-action:none;`;
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  mask.addEventListener('wheel', swallow, { passive: false });
  mask.addEventListener('pointerdown', swallow);
  mask.addEventListener('contextmenu', swallow);
  document.body.appendChild(mask);
  return () => mask.remove();
}
