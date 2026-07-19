# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A VS Code extension for viewing 3D data (point clouds, meshes, depth images).
One shared visualization engine with two thin hosts:

1. **VS Code extension** (`src/`) — the primary product; wires the engine into a
   custom editor webview
2. **Standalone page** (`engine/`, deployed at https://f-kleinicke.de) — public
   demo and the fast test surface (Playwright against a browser page skips
   booting VS Code/Electron)

**Core rule:** all shared functionality (parsers, rendering, controls, depth
processing, webview UI) lives in `engine/src/`. `src/` stays thin and only does
VS Code integration: commands, custom editor registration, message passing.

## Commands

```bash
npm run compile          # Build extension (webpack); `watch` for dev
npm run lint             # ESLint
npm run format           # Prettier
npm run test             # Unit tests (Mocha, src/test/suite/)
npm run test:ui          # UI tests (VS Code Extension Tester, ui-tests/)
cd engine && npm test    # Playwright engine tests — fastest feedback loop
cd engine && npm run dev # Standalone page dev server
```

- **F5** launches the Extension Development Host for manual testing. Test data
  lives in `testfiles/`, organized by format (`ply/`, `stl/`, `obj/`, `np/`,
  `tif/`, `png/`, `pfm/`, `json/`); large PLY files for performance testing are
  in the repo root.
- For engine-only changes, iterate in `engine/` with Playwright, but always
  verify in the F5 host before shipping — the extension is the product.

## Where code goes

| What                        | Where                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| New format parser           | `engine/src/parsers/` (follow an existing parser)                                                                        |
| Depth reader / camera model | `engine/src/depth/` (`readers/` for formats)                                                                             |
| Camera controls             | `engine/src/controls.ts`                                                                                                 |
| File detection/handling     | `engine/src/fileHandler.ts`                                                                                              |
| Webview UI                  | Svelte 5 component in `engine/src/components/` reading `engine/src/state/*.svelte.js` — never new HTML-string generators |
| Rendering helpers           | `engine/src/visualization/`                                                                                              |
| Themes                      | `engine/src/themes/`                                                                                                     |
| Utilities                   | `engine/src/utils/`                                                                                                      |
| `engine/src/main.ts`        | Last resort — core Three.js scene logic only                                                                             |

`main.ts` (~4,100 lines) once grew past 15,000 lines and was painfully clawed
back. Never add methods to the `PointCloudVisualizer` class or inline HTML
there; put code in the modules above.

## Conventions and gotchas

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
  STL, OFF, GLTF, GLB (meshes), TIFF, PNG, PFM, NPY, NPZ (depth), `.json`
  (poses, experimental). Gaussian splats: 3DGS PLY gets DC-colored points plus a
  per-file Spark splat-render toggle; SPZ/SPLAT/KSPLAT/SOG containers open
  through Spark with splat mode on by default
  (`engine/src/visualization/splatMode.ts`).
- Known issues: (The old "rotation inverted vs CloudCompare" complaint is
  resolved: the default Trackball scheme is now a CloudCompare-style virtual
  ball; the old delta trackball is "Legacy Trackball" (`I`) — see the resolved
  post-mortem in docs/BACKLOG.md.)
- I've got a tiff extension as well. Sometimes I add a prompt in the wrong
  window. Tell me.

## Refactoring rules

- **No big-bang refactors.** They failed repeatedly here; use the strangler-fig
  pattern — new code goes in modules, old code stays until naturally touched.
- Two items are **deliberately deferred** — don't tackle them casually:
  extracting `SceneManager`/`LightingManager` from `main.ts` (heavily
  state-entangled), and inverting `depth/panelState.ts`'s DOM-scrape design
  (thin test coverage, feeds the depth pipeline). Reasoning and full migration
  history: [docs/SVELTE_MIGRATION_PLAN.md](docs/SVELTE_MIGRATION_PLAN.md).
