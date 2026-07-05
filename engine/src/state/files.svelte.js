// Phase 1 write-through store: mirrors the parallel per-file arrays that
// main.ts already maintains (fileVisibility, individualColorModes,
// fileItemsCollapsed, pointSizes). Nothing reads from this store yet - it's
// populated alongside the existing arrays so Phase 3's FileList.svelte can
// switch over without a behavior change in this phase.
//
// NOTE: this is a plain JS file (not .ts) on purpose. svelte-loader compiles
// `.svelte.js`/`.svelte.ts` modules via Svelte's `compileModule`, which (as
// of svelte@5.56) parses with TypeScript support disabled - no `as` casts, no
// type annotations. JSDoc `@type` casts give tsc/svelte-check real element
// types for consumers like main.ts, but tsc only honors JSDoc types in files
// it treats as JS (allowJs/checkJs) - hence the .js extension here.
export const filesState = $state(
  /** @type {{ visibility: boolean[]; collapsed: boolean[]; colorModes: string[]; pointSizes: number[]; renderTick: number; statsTick: number; statsLoadingFileName: string | null }} */ ({
    visibility: [],
    collapsed: [],
    colorModes: [],
    pointSizes: [],
    // Phase 3 (FileList.svelte): bumped by main.ts's updateFileList() instead
    // of rebuilding an HTML string. FileList.svelte reads this to know when
    // to re-read host.spatialFiles/poseGroups/cameraGroups from scratch,
    // mirroring the old "regenerate everything on every call" model without
    // needing every underlying field to be individually reactive.
    renderTick: 0,
    // Phase 4 (Stats.svelte): same pattern as renderTick, but separate since
    // updateFileStats() is sometimes called without updateFileList() (e.g.
    // liveDepthUpdate.ts after applying settings to an existing file).
    statsTick: 0,
    // Set by updateFileStatsImmediate() during the very first file's load
    // (before parsing completes); cleared by updateFileStats() once real
    // stats are available.
    statsLoadingFileName: null,
  })
);
