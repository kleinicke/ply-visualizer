# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A VS Code extension for viewing 3D data (point clouds, meshes, depth images).
One shared visualization engine with two thin hosts:

1. **VS Code extension** (`src/`) — the primary product; wires the engine into a
   custom editor webview
2. **Standalone page** (`engine/`, deployed at https://f-kleinicke.de) — public
   demo and the fast test surface (Playwright against a browser page skips
   booting VS Code/Electron). The usable extension is on the subpage
   /3d-visualizer

**Core rule:** all shared functionality (parsers, rendering, controls, depth
processing, webview UI) lives in `engine/src/`. `src/` stays thin and only does
VS Code integration: commands, custom editor registration, message passing.
Currently the extension uses ts whenever possible, but it should use rust by
default for compute and decode and ts (or js) only if necessary. Whenever you
see the option to transition code to rust do it.

## Commands

```bash
npm run compile          # Build extension (webpack); `watch` for dev
npm run lint             # ESLint
npm run format           # Prettier
npm run test:node        # Pure-logic tests headless (no Electron) — seconds
npm run test             # Full suite in a real VS Code host (Mocha, src/test/suite/)
npm run test:ui          # UI tests (VS Code Extension Tester, ui-tests/)
cd engine && npm test    # Playwright engine tests — fastest feedback loop
cd engine && npm run dev # Standalone page dev server
cd engine && npm run bench:backend -- <file>   # WebGL vs WebGPU on one file
npm run benchmark:vscode # Real VS Code, scrapes the extension's own PERF lines
```

- Performance work has a method, and it is not optional reading:
  **docs/performance-method.md**. Short version: measure the PERF line the user
  sees, discard the first (cold) run, check `uptime` before believing a number,
  and verify the output as well as the speed. The benchmark scenario is
  scriptable beyond loading —
  `STEPS=open,alignAll,recolorAll FILES=testfiles/lidar/Abschnitt_A.x3a node scripts/benchmark-vscode.mjs`
  opens an archive, aligns every scan to the first, and recolours from the
  cameras, timing each step from the extension's own log.

- **F5** launches the Extension Development Host for manual testing. Test data
  lives in `testfiles/`, organized by format (`ply/`, `stl/`, `obj/`, `np/`,
  `tif/`, `png/`, `pfm/`, `json/`); large PLY files for performance testing are
  in the repo root.
- For engine-only changes, iterate in `engine/` with Playwright, but always
  verify in the F5 host before shipping — the extension is the product.
- `npm test` downloads and launches a real VS Code, and its `pretest` first
  cleans, builds, type-checks and lints, so it takes minutes and buries the
  Mocha output — `| tail -40` to see results. Half of `src/test/suite/` is pure
  logic over engine parsers and needs no VS Code at all; `npm run test:node`
  runs exactly those headless in seconds. Reach for it first, and fall back to
  `npm test` for the four files that import `vscode` (`extension`,
  `extensionAdvanced`, `integration`, `pointCloudEditorProviderAdvanced`). Keep
  the `--ignore` list in the `test:node` script in sync if a new test file
  imports `vscode`.

## Where code goes

| What                        | Where                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| New format parser           | `engine/src/parsers/` (follow an existing parser)                                                                        |
| Depth reader / camera model | `engine/src/depth/` (`readers/` for formats)                                                                             |
| Camera controls             | `engine/src/controls.ts`                                                                                                 |
| File detection/handling     | `engine/src/fileHandler.ts`                                                                                              |
| Webview UI                  | Svelte 5 component in `engine/src/components/` reading `engine/src/state/*.svelte.js` — never new HTML-string generators |
| Rendering helpers           | `engine/src/visualization/`                                                                                              |
| Scan alignment / solvers    | `engine/src/registration/` (pure math, no DOM); host glue in `engine/src/registrationFeature.ts`                         |
| Themes                      | `engine/src/themes/`                                                                                                     |
| Utilities                   | `engine/src/utils/`                                                                                                      |
| `engine/src/main.ts`        | Last resort — core Three.js scene logic only                                                                             |

`main.ts` (~4,100 lines) once grew past 15,000 lines and was painfully clawed
back. Never add methods to the `PointCloudVisualizer` class or inline HTML
there; put code in the modules above.

## Conventions and gotchas

- Aligning is a scene-wide operation, so its entry point is the **Align** button
  beside "+ Add Point Cloud" (`GlobalAlignMenu.svelte`), which appears once two
  clouds with point data are loaded. The per-file panel
  (`RegistrationPanel.svelte`) keeps the things that are genuinely about one
  file: manual pair picking, single-pair ICP, capture-place scope, projection
  diagnostics. Both fire the archive colouring pipeline through the shared
  `stationPipelineTrigger.ts` — never re-implement the scope rules in a
  component. Long-running work reports progress as structured state, not as a
  spinner plus a string: `registrationState.alignEntries` (one seeded row per
  cloud, queued → running → aligned/failed) and `stationPipelineUi.scans` (one
  row per scan, ticked as the host publishes it). Keep new long operations to
  that shape.
- Visibility checkboxes use one consistent gesture everywhere: ordinary click
  toggles one item; Shift-click isolates that item; Shift-clicking the already
  isolated item restores the whole sibling group. This applies to files,
  individual camera images, and any future grouped visibility list. Put the
  behavior in the shared component/helper and add a browser regression test.
- Every `input[type="range"]` must reset to its documented default on
  double-click. The delegated handler in `main.ts` covers sliders whose initial
  `value` is their default; controls with a computed or semantic default must
  provide an explicit `ondblclick` handler. Give the slider a reset tooltip and
  test the interaction when adding a new slider family.
- `engine/index.html` is the single source of truth for the UI shell.
  `src/pointCloudEditorProvider.ts` reads and rewrites it at runtime — never
  duplicate HTML between the two hosts.
- Matrices: Three.js column-major internally; the UI displays and accepts
  row-major. Each file has its own 4x4 transform; quaternion and angle-axis
  input are also supported.
- Extension host ↔ webview communicate via `postMessage` (parsed file data in;
  save requests, errors, progress out).
- Files >1M points use chunked loading; 5M+ points are supported — watch memory
  and per-frame cost in rendering code.
- Depth pipeline: `DepthRegistry` picks a reader → user supplies camera
  intrinsics → `DepthProjector` projects to 3D (pinhole/fisheye; OpenGL and
  OpenCV axis conventions).
- Supported formats: PLY, XYZ, XYZN, XYZRGB, PCD, PTS, NPY (points), PLY, OBJ,
  STL, OFF, GLTF, GLB (meshes), TIFF, PNG, PFM, NPY, NPZ, EXR (depth), `.json`
  (poses, experimental). Gaussian splats: 3DGS PLY gets DC-colored points plus a
  per-file Spark splat-render toggle; SPZ/SPLAT/KSPLAT/SOG containers open
  through Spark with splat mode on by default
  (`engine/src/visualization/splatMode.ts`).
- Known issues: (The old "rotation inverted vs CloudCompare" complaint is
  resolved: the default Trackball scheme is now a CloudCompare-style virtual
  ball; the old delta trackball is "Legacy Trackball" (`I`) — see the resolved
  post-mortem in docs/BACKLOG.md.)
- I've got a tiff/image viewing extension as well. Sometimes I add a prompt in
  the wrong window. Tell me.

## Dependency notes

- `@types/vscode` and `@types/node` are pinned deliberately, not stale.
  `@types/vscode` tracks `engines.vscode` (currently `^1.104.0`, a roughly
  12-month support window) and `@types/node` tracks the Node that the _minimum_
  VS Code ships. Raising either alone lets code compile against APIs absent at
  runtime, so move them together with `engines`.
- **TypeScript stays on 6.x.** TS 7 (the native compiler rewrite) breaks
  `ts-loader` with `Cannot read properties of undefined (reading 'fileExists')`,
  and `svelte-preprocess` declares `typescript: ^5 || ^6`. Retry once both ship
  TS 7 support.
- After bumping `@playwright/test`, run `npx playwright install chromium` in
  `engine/` or every spec fails with "Executable doesn't exist".
- `7zip-bin` is transitive (via `7zip-min`), so `webpack.config.js` resolves it
  through its parent rather than assuming `node_modules/7zip-bin` — that path
  only exists when the package manager hoists it, which pnpm does not.
- `engine/` is a pnpm workspace member (`pnpm-workspace.yaml`), so one
  `pnpm install` at the root provisions both trees from the single committed
  `pnpm-lock.yaml`. Do not run `npm install` inside `engine/` — that recreates
  the split, unlocked tree this replaced. The extension bundle legitimately
  resolves `@sparkjsdev/spark` out of `engine/`, which is why the engine has to
  be installed for the root build to work.
- The engine Playwright suite is GPU- and memory-bound, so
  `engine/playwright.config.ts` caps workers rather than using Playwright's
  default of half the cores. Raising it makes the heavy file-loading specs time
  out whenever anything else is building.
