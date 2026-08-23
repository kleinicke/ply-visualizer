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
   *   workflow: 'choose' | 'coarse-fixed' | 'coarse-moving' | 'coarse-ready' | 'coarse-done' | 'fine-fixed' | 'fine-moving';
   *   coarseFixedCount: number;
   *   coarseMovingCount: number;
   *   coarseResiduals: number[];
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
   *   unattachedGroups: { indices: number[]; names: string[]; suggestion: { movingIndex: number; fixedIndex: number; movingName: string; fixedName: string; overlapPercent: number } | null }[];
   *   matchAgainstAllOthers: boolean;
   *   upAxis: 'x' | 'y' | 'z';
   *   markerScale: number;
   *   isolateWhilePicking: boolean;
   * }} */ ({
    // Unified file index of the cloud being moved, or null when idle.
    sourceIndex: null,
    // Unified file index of the cloud held fixed.
    targetIndex: null,
    picking: false,
    workflow: 'choose',
    coarseFixedCount: 0,
    coarseMovingCount: 0,
    // Distance between each applied coarse landmark and the fixed point it was
    // matched to. An aggregate RMS hides the one mis-picked corner that caused
    // it, which is the only thing worth knowing after a three-point fit.
    coarseResiduals: [],
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
    // Clouds the automatic run could not attach, grouped by whether they can
    // see each other, each with the single most promising pair that would join
    // it back to the scene. Empty whenever everything was placed.
    unattachedGroups: [],
    // Solve the moving cloud against every other loaded cloud at once, rather
    // than against the one this panel names. It removes the need to decide
    // which single cloud is trustworthy enough to hold still, which is a guess
    // the user often cannot make before seeing the result.
    matchAgainstAllOthers: false,
    upAxis: 'z',
    // Picked-point markers, as a multiple of the default 0.4%-of-the-scene
    // radius. The default used to be that 0.4%, which on a room-scale scan is
    // an 8 cm ball: big enough to sit on top of the feature you are trying to
    // match and hide it, which defeats the one gesture that needs to be
    // precise.
    markerScale: 0.35,
    // Show only the cloud currently being picked. Two overlapping scans of the
    // same room are hard to tell apart at the best of times, and impossible
    // when you are looking for the same corner in both.
    isolateWhilePicking: true,
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
