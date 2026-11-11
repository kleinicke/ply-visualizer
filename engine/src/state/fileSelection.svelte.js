// Multi-selection in the file list (click a name; Ctrl/Cmd toggles, Shift
// extends). Keyed by stable entry id. Used by actions that apply to several
// files at once, such as subsampling loaded clouds.
export const fileSelection = $state(
  /** @type {{ ids: number[]; anchor: number | null }} */ ({ ids: [], anchor: null })
);

/** Ids of the rows as currently listed, top to bottom (set by the file list). */
let order = /** @type {number[]} */ ([]);

/** @param {number[]} ids */
export function setSelectionOrder(ids) {
  order = ids;
  // Drop ids that are no longer listed (removed, or in another group).
  const listed = new Set(ids);
  if (fileSelection.ids.some(id => !listed.has(id))) {
    fileSelection.ids = fileSelection.ids.filter(id => listed.has(id));
  }
}

/**
 * @param {number} id
 * @param {{ toggle?: boolean; range?: boolean }} mode
 */
export function clickSelect(id, mode = {}) {
  if (mode.range && fileSelection.anchor !== null) {
    const a = order.indexOf(fileSelection.anchor);
    const b = order.indexOf(id);
    if (a >= 0 && b >= 0) {
      const span = order.slice(Math.min(a, b), Math.max(a, b) + 1);
      fileSelection.ids = mode.toggle ? [...new Set([...fileSelection.ids, ...span])] : span;
      return;
    }
  }
  if (mode.toggle) {
    fileSelection.ids = fileSelection.ids.includes(id)
      ? fileSelection.ids.filter(x => x !== id)
      : [...fileSelection.ids, id];
  } else {
    fileSelection.ids = fileSelection.ids.length === 1 && fileSelection.ids[0] === id ? [] : [id];
  }
  fileSelection.anchor = id;
}

export function selectAllListed() {
  fileSelection.ids = [...order];
}

export function clearSelection() {
  fileSelection.ids = [];
  fileSelection.anchor = null;
}

/** Selects just `id` (right-click on an unselected row). */
/** @param {number} id */
export function selectOnly(id) {
  fileSelection.ids = [id];
  fileSelection.anchor = id;
}

// Action UI shared by the action bar and the right-click menu: the open
// context menu's position, and the action whose parameter form is open.
export const fileActionUi = $state(
  /** @type {{ menu: { x: number; y: number } | null; form: string | null }} */ ({
    menu: null,
    form: null,
  })
);
