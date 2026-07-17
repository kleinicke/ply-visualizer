// Video-mode (camera keyframe) UI state, written by film/FilmManager.ts and
// read by components/FilmPanel.svelte.
//
// Plain JS on purpose - see files.svelte.js for why (svelte-loader compiles
// .svelte.js/.svelte.ts via Svelte's compileModule, which parses without
// TypeScript support as of svelte@5.56).
export const filmState = $state(
  /**
   * @type {{
   *   keyframes: { name: string; duration: number; dwell: number; fov: number }[];
   *   playing: boolean;
   *   recording: boolean;
   *   loop: boolean;
   *   frustumsVisible: boolean;
   *   totalDuration: number;
   * }}
   */ ({
    keyframes: [],
    playing: false,
    recording: false,
    loop: false,
    frustumsVisible: false,
    totalDuration: 0,
  })
);
