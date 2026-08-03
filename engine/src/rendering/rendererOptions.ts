declare global {
  interface Window {
    __PLY_ANTIALIAS__?: boolean;
  }
}

/**
 * Whether to request MSAA on the WebGL context.
 *
 * Off by default because of how point clouds fail at low zoom. Zoomed out, all
 * points collapse onto a few pixels, and fragments hitting the same pixel cannot
 * be depth-tested in parallel — the ROPs serialize on one address and the GPU
 * stalls. MSAA multiplies that contended work by the sample count (typically 4x),
 * because the depth test runs per sample. On 1-pixel points it buys nothing
 * visible in return; the smoothing only shows on mesh and line edges.
 *
 * `antialias` is a context-creation flag, so this cannot be toggled at runtime
 * without rebuilding the renderer — hence a startup switch rather than a UI
 * control. Force it back on with `?antialias=1` (standalone page) or by setting
 * `window.__PLY_ANTIALIAS__ = true` before the viewer boots, which is how the two
 * configurations get compared on the same build.
 */
export function useAntialiasing(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  if (window.__PLY_ANTIALIAS__ !== undefined) {
    return window.__PLY_ANTIALIAS__;
  }
  return new URLSearchParams(window.location.search).get('antialias') === '1';
}
