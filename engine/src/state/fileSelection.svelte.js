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
// context menu (where, and the entries its actions apply to), and the
// parameter form that is open (which action, for which entries).
export const fileActionUi = $state(
  /** @type {{ menu: { x: number; y: number; ids: number[] } | null; form: { action: string; ids: number[] } | null }} */ ({
    menu: null,
    form: null,
  })
);

/**
 * Right-click on a row: its actions apply to the selection when the row is
 * part of it, otherwise to that row alone. The selection is not changed.
 * @param {number} id
 * @param {number} x
 * @param {number} y
 */
export function openRowMenu(id, x, y) {
  const ids = fileSelection.ids.includes(id) ? [...fileSelection.ids] : [id];
  fileActionUi.menu = { x, y, ids };
}

// Entries a long-running action is working on: id -> progress 0..1. Their
// cards are locked and show the progress; actions skip them.
export const fileBusy = $state(/** @type {{ byId: Record<number, number> }} */ ({ byId: {} }));
