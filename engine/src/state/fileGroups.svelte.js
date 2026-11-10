// Regex grouping: files whose names yield the same captured value form a
// group; only the active group is listed and drawn. Remembered per
// installation, including recently used patterns.
const KEY = 'ply-visualizer.fileGroups.v2';
const MAX_RECENT = 10;

function load() {
  /** @type {{ enabled: boolean; regex: string; recent: string[]; active: string | null }} */
  const fallback = { enabled: false, regex: '^([^_\\-.\\s]+)', recent: [], active: null };
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!parsed) return fallback;
    return {
      enabled: parsed.enabled === true,
      regex: typeof parsed.regex === 'string' && parsed.regex ? parsed.regex : fallback.regex,
      recent: Array.isArray(parsed.recent)
        ? parsed.recent
            .filter((/** @type {unknown} */ r) => typeof r === 'string')
            .slice(0, MAX_RECENT)
        : [],
      /** Key of the group currently shown; null = first group. */
      active: typeof parsed.active === 'string' ? parsed.active : null,
    };
  } catch {
    return fallback;
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

/**
 * Moves a pattern to the front of the recent list.
 * @param {string} source
 */
export function rememberGroupRegex(source) {
  fileGroupsState.recent = [
    source,
    ...fileGroupsState.recent.filter((/** @type {string} */ r) => r !== source),
  ].slice(0, MAX_RECENT);
}
