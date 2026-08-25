const modifierState = { shift: false };
let tracking = false;

/** Track modifiers at commit time for controls whose change event omits them. */
export function ensureKeyboardModifierTracking(): void {
  if (tracking || typeof window === 'undefined') {
    return;
  }
  tracking = true;

  window.addEventListener('keydown', event => {
    modifierState.shift = event.shiftKey;
  });
  window.addEventListener('keyup', event => {
    modifierState.shift = event.shiftKey;
  });
  window.addEventListener('blur', () => {
    modifierState.shift = false;
  });
}

export function isShiftPressed(): boolean {
  return modifierState.shift;
}
