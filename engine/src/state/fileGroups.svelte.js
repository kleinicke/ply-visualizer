// Scene grouping: files sharing a name prefix form a scene; only the active
// scene is listed and drawn. Remembered per installation.
const KEY = 'ply-visualizer.fileGroups.v1';

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      enabled: parsed.enabled === true,
      depth: Math.min(8, Math.max(1, Number(parsed.depth) || 1)),
      /** Prefix of the scene currently shown; null = first scene. */
      active: typeof parsed.active === 'string' ? parsed.active : null,
    };
  } catch {
    return { enabled: false, depth: 1, active: null };
  }
}

export const fileGroupsState = $state(load());

export function saveFileGroups() {
  try {
    localStorage.setItem(KEY, JSON.stringify(fileGroupsState));
  } catch {
    // storage unavailable
  }
}
