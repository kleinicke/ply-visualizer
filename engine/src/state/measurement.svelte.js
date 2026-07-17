// Measurement-path UI state, written by MeasurementManager and the host,
// read by the Measurements section of ControlsTabTop.svelte.
//
// Plain JS on purpose - see files.svelte.js for why (svelte-loader compiles
// .svelte.js/.svelte.ts via Svelte's compileModule, which parses without
// TypeScript support as of svelte@5.56).
export const measurementState = $state(
  /**
   * @type {{
   *   pathActive: boolean;
   *   pathPointCount: number;
   *   segmentLengths: number[];
   *   totalLength: number;
   * }}
   */ ({
    // True while double-clicks append measurement-path points instead of
    // setting the rotation center.
    pathActive: false,
    pathPointCount: 0,
    segmentLengths: [],
    totalLength: 0,
  })
);
