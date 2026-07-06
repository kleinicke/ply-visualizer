// Phase 1 write-through store: starts the depth/calibration settings store
// named in the migration plan. For now it only mirrors which files have
// "live update" enabled (main.ts's liveDepthUpdateFiles Set) - the one piece
// of depth-panel state that already lives in JS memory rather than being
// scraped from DOM inputs on demand (see depth/panelState.ts's
// getDepthSettingsFromFileUI). Phase 3 is where the rest of the per-file
// fx/fy/cx/cy/distortion fields move from DOM-scrape to this store, inverting
// panelState.ts so the DOM becomes a view instead of the source of truth.
//
// Plain JS on purpose - see files.svelte.js for why (svelte-loader compiles
// .svelte.js/.svelte.ts via Svelte's compileModule, which parses without
// TypeScript support as of svelte@5.56).
export const depthSettingsState = $state(
  /** @type {{ liveUpdateFileIndices: number[] }} */ ({
    liveUpdateFileIndices: [],
  })
);
