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
   *   canUndoAll: boolean;
   *   alignEntries: { index: number; name: string; state: 'queued' | 'running' | 'aligned' | 'failed'; detail: string }[];
   *   alignDone: number;
   *   alignmentAnchorIndex: number | null;
   *   alignedIndices: number[];
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
    // Align-all touches many files at once, so its undo and its per-file
    // report are separate from the single-pair session's.
    canUndoAll: false,
    // One entry per cloud the run will touch, seeded 'queued' before the first
    // solve so the panel can show what is coming rather than growing a list out
    // of nothing. A run that takes a minute per cloud is unreadable as a
    // spinner and legible as a checklist.
    alignEntries: [],
    alignDone: 0,
    // Successful members of the latest anchor-wide registration. Colouring
    // uses this allow-list so a failed/unaligned station's photos cannot
    // compete merely because its identity transform is still on screen.
    alignmentAnchorIndex: null,
    alignedIndices: [],
    upAxis: 'z',
  })
);

// Archive-wide pipeline (X3A only). Separate from the pair/align-all state
// because it runs in the extension host across a fresh parse, not in here.
export const stationPipelineUi = $state(
  /** @type {{ busy: boolean; message: string; recolorAlreadyColored: boolean; projectionDiagnostic: import('../parsers/stonexX3aParser').StonexProjectionDiagnostic; scans: { name: string; colored: boolean }[] }} */ ({
    busy: false,
    message: '',
    recolorAlreadyColored: false,
    projectionDiagnostic: 'normal',
    // Scans this run is responsible for, flipped to coloured as the host
    // publishes each one. The host colours progressively, so this is a measure
    // of how far along the run actually is, not an estimate.
    scans: [],
  })
);
