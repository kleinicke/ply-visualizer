// Reactive state for the registration panel. Only one alignment session is
// active at a time: the panel is per-file, but picking correspondences takes
// over the double-click gesture, so two sessions at once would be ambiguous for
// the user and for the picker.
//
// Plain JS with JSDoc types for the same reason as files.svelte.js - svelte's
// compileModule parses `.svelte.js` without TypeScript support.
export const registrationState = $state(
  /** @type {{
   *   sourceIndex: number | null;
   *   targetIndex: number | null;
   *   picking: boolean;
   *   pairCount: number;
   *   awaiting: 'source' | 'target' | null;
   *   busy: boolean;
   *   status: string;
   *   result: string;
   *   canUndo: boolean;
   *   upAxis: 'x' | 'y' | 'z';
   * }} */ ({
    // Unified file index of the cloud being moved, or null when idle.
    sourceIndex: null,
    // Unified file index of the cloud held fixed.
    targetIndex: null,
    picking: false,
    pairCount: 0,
    // Which cloud the next double-click is expected to land on, once one half
    // of a correspondence has been picked.
    awaiting: null,
    busy: false,
    status: '',
    result: '',
    canUndo: false,
    upAxis: 'z',
  })
);
