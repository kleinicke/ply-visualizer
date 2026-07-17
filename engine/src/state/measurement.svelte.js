// Measurement-path UI state, written by MeasurementManager and the host,
// read by the Measurements section of ControlsTabTop.svelte.
//
// Plain JS on purpose - see files.svelte.js for why (svelte-loader compiles
// .svelte.js/.svelte.ts via Svelte's compileModule, which parses without
// TypeScript support as of svelte@5.56).
export const measurementState = $state(
  /**
   * @type {{
   *   pathPointCount: number;
   *   pathClosed: boolean;
   *   pathCount: number;
   *   pathStartMode: 'center' | 'free' | null;
   *   segmentLengths: number[];
   *   totalLength: number;
   * }}
   */ ({
    pathPointCount: 0,
    pathClosed: false,
    pathCount: 0,
    pathStartMode: 'center',
    segmentLengths: [],
    totalLength: 0,
  })
);
