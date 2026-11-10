/**
 * Cancels the momentum a camera control keeps after the mouse is released
 * (TrackballControls' dynamic damping, OrbitControls' damping, the custom
 * controls' smoothed zoom), so a programmatic camera change stays exactly
 * where it is put instead of being carried on by a previous drag.
 *
 * These are internal fields of the control classes; each is reset only when
 * present, so an unknown control is simply left alone.
 */
type Vec = { copy(other: unknown): unknown; set?(...v: number[]): unknown };

export function stopControlsInertia(controls: unknown): void {
  const c = controls as Record<string, unknown> | null;
  if (!c) {
    return;
  }
  // three/examples TrackballControls
  if (typeof c._lastAngle === 'number') {
    c._lastAngle = 0;
  }
  for (const [from, to] of [
    ['_movePrev', '_moveCurr'],
    ['_zoomStart', '_zoomEnd'],
    ['_panStart', '_panEnd'],
  ] as const) {
    const a = c[from] as Vec | undefined;
    const b = c[to];
    if (a && b && typeof a.copy === 'function') {
      a.copy(b);
    }
  }
  // three/examples OrbitControls
  const spherical = c._sphericalDelta as Vec | undefined;
  spherical?.set?.(0, 0, 0);
  const pan = c._panOffset as Vec | undefined;
  pan?.set?.(0, 0, 0);
  if (typeof c._scale === 'number') {
    c._scale = 1;
  }
  // engine/src/controls.ts smoothed zoom
  if (typeof c.pendingZoomLog === 'number') {
    c.pendingZoomLog = 0;
  }
}
