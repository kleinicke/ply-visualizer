// DAW-style solo layer. Solo never edits a file's own visibility setting
// ("mute"): the setting is saved when solo starts and restored when it ends.
// While solo is active, `entry.state.visible` is the *effective* visibility,
// so every renderer/picker that reads it stays correct without knowing about
// solo. Keyed by stable entry id, never by index.
export const soloState = $state(
  /** @type {{ ids: number[]; primaryId: number | null; saved: Record<number, boolean>; layered: boolean; scopeIds: number[] | null; barCollapsed: boolean }} */ ({
    ids: [],
    primaryId: null,
    // Own visibility of every entry while any layer (solo or scene scope) is
    // active; `entry.state.visible` is then the effective visibility.
    saved: {},
    layered: false,
    // Top-level entry ids of the active scene, or null when not grouping.
    scopeIds: null,
    barCollapsed: false,
  })
);

const LAYOUT_KEY = 'ply-visualizer.soloPanel.v1';

/** @typedef {{ mode: 'list' | 'tiles'; columns: number; abbreviate: boolean; rect: { x: number; y: number; w: number; h: number } | null }} SoloLayout */

/** @returns {SoloLayout} */
function loadLayout() {
  /** @type {SoloLayout} */
  const fallback = { mode: 'tiles', columns: 3, abbreviate: true, rect: null };
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode === 'list' ? 'list' : 'tiles',
      columns: Math.min(12, Math.max(1, Number(parsed.columns) || 3)),
      abbreviate: parsed.abbreviate !== false,
      rect: parsed.rect && Number.isFinite(parsed.rect.w) ? parsed.rect : null,
    };
  } catch {
    return fallback;
  }
}

/** Panel presentation; remembered per viewer installation. */
export const soloLayout = $state(loadLayout());

export function saveSoloLayout() {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(soloLayout));
  } catch {
    // Storage may be unavailable (private window, webview policy); layout
    // then simply resets next time.
  }
}
