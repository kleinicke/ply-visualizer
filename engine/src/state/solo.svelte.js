// DAW-style solo layer. Solo never edits a file's own visibility setting
// ("mute"): the setting is saved when solo starts and restored when it ends.
// While solo is active, `entry.state.visible` is the *effective* visibility,
// so every renderer/picker that reads it stays correct without knowing about
// solo. Keyed by stable entry id, never by index.
export const soloState = $state(
  /** @type {{ ids: number[]; primaryId: number | null; saved: Record<number, boolean>; layered: boolean; scopeIds: number[] | null }} */ ({
    ids: [],
    primaryId: null,
    // Own visibility of every entry while any layer (solo or scene scope) is
    // active; `entry.state.visible` is then the effective visibility.
    saved: {},
    layered: false,
    // Top-level entry ids of the active scene, or null when not grouping.
    scopeIds: null,
  })
);

// v2: list became the default layout and the panel can be hidden. A v1
// layout keeps its size/position/columns/abbreviation but not its mode.
const LAYOUT_KEY = 'ply-visualizer.soloPanel.v2';
const LEGACY_LAYOUT_KEY = 'ply-visualizer.soloPanel.v1';

/** @typedef {{ mode: 'list' | 'tiles'; columns: number; abbreviate: boolean; hidden: boolean; rect: { x: number; y: number; w: number; h: number } | null }} SoloLayout */

/** @returns {SoloLayout} */
function loadLayout() {
  /** @type {SoloLayout} */
  const fallback = { mode: 'list', columns: 3, abbreviate: true, hidden: false, rect: null };
  try {
    const current = localStorage.getItem(LAYOUT_KEY);
    const raw = current ?? localStorage.getItem(LEGACY_LAYOUT_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      mode: current && parsed.mode === 'tiles' ? 'tiles' : 'list',
      hidden: parsed.hidden === true,
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
