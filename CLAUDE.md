# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A VS Code extension for viewing 3D data (point clouds, meshes, depth images).
One shared visualization engine with host adapters:

1. **VS Code extension** (`src/`) — the primary product; wires the engine into a
   custom editor webview
2. **Standalone page** (`engine/`, deployed at https://3d.f-kleinicke.de) —
   public demo and the fast test surface (Playwright against a browser page
   skips booting VS Code/Electron)
3. **Desktop workspace** (`apps/desktop/`) — Tauri host for the shared viewer
4. **Python / MCP integrations** (`packages/python/`, `engine/src/hosts/`) —
   local sessions and embedded viewer surfaces

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

The standalone engine is served at `/` in local browser tests and at the root of
`3d.f-kleinicke.de` in production. The separate portfolio website is not part of
this repository.

- Performance work has a method, and it is not optional reading:
  **docs/performance-method.md**. Short version: measure the PERF line the user
  sees, discard the first (cold) run, check `uptime` before believing a number,
  and verify the output as well as the speed. The benchmark scenario is
  scriptable beyond loading —
  `STEPS=open,alignAll,recolorAll FILES=testfiles/lidar/Abschnitt_A.x3a node scripts/benchmark-vscode.mjs`
  opens an archive, aligns every scan to the first, and recolours from the
  cameras, timing each step from the extension's own log. `reapplyDepth` times a
  depth-settings change; `alignAllNested`/`alignAllComplex` the growing
  strategies.

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
- Integration tests and VS Code benchmarks prune old completed downloads from
  `.vscode-test/` after selecting their runtime. They retain that runtime, the
  minimum supported version, the newest cached release, any version still
  running, incomplete downloads, and test profiles. The shared helper is
  `scripts/prune-vscode-test-cache.cjs`; if process inspection is unavailable,
  cleanup is skipped rather than risking an active test instance.

## Where code goes

| What                        | Where                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| New format parser           | `engine/src/parsers/` (follow an existing parser)                                                                                       |
| Depth reader / camera model | `engine/src/depth/` (`readers/` for formats)                                                                                            |
| Camera controls             | `engine/src/controls.ts`                                                                                                                |
| File detection/handling     | `engine/src/fileHandler.ts`                                                                                                             |
| Webview UI                  | Svelte 5 component in `engine/src/components/` reading `engine/src/state/*.svelte.js` — never new HTML-string generators                |
| Rendering helpers           | `engine/src/visualization/`                                                                                                             |
| Webview workers             | `spawnWorker` in `engine/src/utils/webviewWorker.ts`, imported as `../utils/webviewWorker` (see its header)                             |
| Extension-host decoding     | Worker pool `src/providerHandlers/parsePool.ts` + `parseWorker.ts`; parallel splits in `parallelTextParse.ts` / `parallelLidarParse.ts` |
| Scan alignment / solvers    | `engine/src/registration/` (pure math, no DOM); host glue in `engine/src/registrationFeature.ts`                                        |
| Themes                      | `engine/src/themes/`                                                                                                                    |
| Utilities                   | `engine/src/utils/`                                                                                                                     |
| `engine/src/main.ts`        | Last resort — core Three.js scene logic only                                                                                            |

Keep `main.ts` focused on scene composition. Put feature implementation in the
modules above. Shared file presentation state and transforms belong to stable
`FileEntryRegistry` entries; never add parallel arrays or Svelte mirrors for
them. Async entry work must retain the entry ID and resolve its current index
after awaiting. Build file objects off-scene with `visualization/fileObject.ts`
and commit their prepared registry entry only after construction succeeds. Each
entry owns its spatial data/root, pose data/settings, or camera profile. The
viewer's collection getters are readonly derived views; iterate entries directly
in rendering loops and write through the entry. Depth and volume replacements
build with copied data/settings before swapping resources, so a failed build
leaves the displayed file intact. Dispose entry-owned resources through its
shared disposal helper. Viewer listeners, mounts and timers belong to
`ViewerLifetime`; disposal must stop rendering, unmount UI, cancel depth work
and release scene resources. Depth conversions accept an `AbortSignal`: entries
cancel obsolete jobs, and the client serializes worker requests so it can
terminate an active conversion without killing another file's work. Main-thread
fallback checks cancellation between phases; synchronous WASM on that path
cannot be interrupted mid-call. Decoded geometry is checked by
`visualization/validateSpatialData.ts` before GPU allocation (counts, attribute
lengths/types and face bounds). Depth source bytes belong to
`SpatialData.depthSource`. Depth inputs and calibration selection live in
`entry.state.depthForm`; bind components to that state rather than reading or
restoring input values through DOM IDs.

`engine/src/interfaces.ts` owns the spatial data contract. Format detection,
decoding and raw-byte delivery policy belong in `formats/builtinFormats.ts`;
`decodeInViewer` routes use the validated `fileData` message. Host streaming,
container and companion-file loaders stay explicit in the host adapters.
`hosts/viewerProtocol.ts` defines validated host/viewer message contracts;
`hosts/viewerRouter.ts` owns dispatch, background accounting, and entry-ID
resolution. Sequence frames use one raw-byte `sequence:file` response and the
shared decoders. A generation-scoped request ID deduplicates pending frames and
rejects replies from restarted sequences. The sequence cache owns complete file
entries outside the normal registry. Eviction uses both a six-frame limit and a
256 MiB estimate of retained CPU buffers and GPU payloads, counting shared CPU
buffers once. The visible frame always survives, even if it exceeds the budget;
decoding peaks and driver overhead are outside this estimate. Extension senders
use `providerHandlers/webviewTransport.ts` for readiness and timing. Never
replace `Webview.postMessage`. Native agent requests also wait until the host
has dispatched the initial document load.

`npm run build:wasm` builds both WASM packages with locked dependencies and
records source/artifact hashes. The copied image backend and its local patches
are documented in `docs/image-decoder-backend.md`; run
`npm run lint:rust:image`, `npm run lint:rust:image:wasm`, and
`npm run format:rust:image:check` when updating it. Commit `wasm/artifacts.json`
with the generated outputs. CI checks those hashes, runs `npm run test:rust`,
and tests rebuilt WASM as well.

## Conventions and gotchas

- Aligning is a scene-wide operation, so its entry point is **Tools → Align
  point clouds** beside "+ Add Point Cloud" (`GlobalAlignMenu.svelte`). Tools
  appears once an object is loaded; Align becomes available once two clouds with
  point data are loaded. The per-file panel (`RegistrationPanel.svelte`) keeps
  the things that are genuinely about one file: manual pair picking, single-pair
  ICP, capture-place scope, projection diagnostics. Both fire the archive
  colouring pipeline through the shared `stationPipelineTrigger.ts` — never
  re-implement the scope rules in a component. The split is by scope, not by
  convenience: the Tools menu's Align workspace owns everything scene- or
  archive-wide (align all, refine all, undo, colour all, capture-place scope,
  projection diagnostics), and the per-file panel owns exactly one thing —
  correcting a single pair (`RegistrationPanel.svelte`: choose the moving cloud,
  then auto-align/ICP or pick three correspondences). Long-running work reports
  progress as structured state, not as a spinner plus a string:
  `registrationState.alignEntries` (one seeded row per cloud, queued → running →
  aligned/failed) and `stationPipelineUi.scans` (one row per scan, ticked as the
  host publishes it). Keep new long operations to that shape.
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
- Eye Dome Lighting defaults to **Auto** and `E` cycles Auto → All → Off. Auto
  runs only when a visible point cloud uses a uniform material colour and masks
  per-point RGB/projected/intensity/scalar-coloured pixels from darkening; all
  visible geometry still contributes to the shared depth buffer. Keep this
  eligibility tied to the active colour mode, not merely to source RGB data. A
  cloud's child objects (the round-disc pass) share its eligibility.
- The render loop sleeps after 1.2 s without a frame or camera change
  (`rendering/renderLoopSleep.ts`). Input, host messages and `requestRender()`
  (or any `needsRender = true`) wake it; a 4 Hz watchdog only catches camera
  moves. Code that changes the scene in any other way must call
  `requestRender()` - a frame is no longer drawn just because the loop ticks.
- A viewer hidden for 10 s gives its WebGL context back and restores it when
  shown (`visualization/contextRecovery.ts`, `viewVisibility` message), except
  while loading, recording or showing splats. Work that must draw while hidden
  awaits `gpuResidency.ensureResident()` first, as agent requests do.
- The optional WebGPU picker and visibility renderer start after the viewer is
  ready (`visualizer.webgpuReady`); their capabilities live in `viewerState` for
  the UI. Specs that read WebGPU state await `webgpuReady` first.
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
- Control schemes: "Legacy Trackball" (`I`), the delta-based three.js
  TrackballControls implementation, is the default. The CloudCompare-style
  virtual-ball "Trackball" scheme remains available under `T`; see the resolved
  rotation-direction post-mortem in docs/BACKLOG.md.
- Not every small feature gets added to the readme. Ask me if you want to
  mention a new feature there.
- I've got a tiff/image viewing extension as well. Sometimes I add a prompt in
  the wrong window. Tell me.

## Dependency notes

- Node 24 is the repository build and development toolchain, declared once in
  `.nvmrc` and consumed by local nvm, GitHub Actions, and Netlify. This does not
  change the Node runtime embedded in supported VS Code versions.
- `@types/vscode` and `@types/node` are pinned deliberately, not stale.
  `@types/vscode` tracks `engines.vscode` (currently `^1.106.0`, which ships
  Node 22.20.0 with native Brotli DecompressionStream support) and `@types/node`
  tracks the Node that the _minimum_ VS Code ships. Raising either alone lets
  code compile against APIs absent at runtime, so move them together with
  `engines`.
- **TypeScript stays on 6.x.** TS 7 (the native compiler rewrite) breaks
  `ts-loader` with `Cannot read properties of undefined (reading 'fileExists')`,
  and `svelte-preprocess` declares `typescript: ^5 || ^6`. Retry once both ship
  TS 7 support.
- After bumping `@playwright/test`, run `npx playwright install chromium` in
  `engine/` or every spec fails with "Executable doesn't exist".
- `engine/` is an npm workspace declared by the root `package.json`. Run
  `npm install` at the repository root so the extension and standalone engine
  are provisioned from the single committed `package-lock.json`; do not create a
  separate lockfile inside `engine/`. The extension bundle legitimately resolves
  `@sparkjsdev/spark` from the engine workspace, which is why both packages are
  installed together.
- The engine Playwright suite is GPU- and memory-bound, so
  `engine/playwright.config.ts` caps workers rather than using Playwright's
  default of half the cores. Raising it makes the heavy file-loading specs time
  out whenever anything else is building.

## Test projects

Playwright's `chromium` project runs on a clean checkout. Specs needing the
separately downloaded datasets belong in `engine/test/externalFixtures.ts` and
run in the `external-fixtures` project. New regression tests should generate
small fixtures whenever practical. CI runs `--project=chromium` explicitly.

The VS Code integration runner accepts `VSCODE_TEST_VERSION=minimum`, `stable`,
or an explicit version. `minimum` is read from `engines.vscode` in package.json;
CI tests both minimum and stable. Each run uses a disposable trusted workspace.
