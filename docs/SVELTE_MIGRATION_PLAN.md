# Svelte Migration Plan

Status: approved, Phase 0 in progress (2026-07-05)

## Priority

**The VS Code extension is the primary product and must keep working perfectly
at every step of this migration.** The standalone page (`engine/` at
https://f-kleinicke.de) is the secondary target — valuable as a fast Playwright
test surface and public demo, but never at the expense of the extension. Every
phase below ends with an F5 Extension Development Host check as the real gate;
the standalone page is a faster way to iterate, not the target itself.

## Verdict

Yes — a Svelte migration is a good idea **for the UI panel layer only**, and the
codebase is now in good enough shape to start. The extraction work done so far
(main.ts: 15,576 → 6,347 lines) removed the biggest blocker. One structural
prerequisite remains: a **state layer**. Today, application state lives in
`PointCloudVisualizer` class fields _and_ in the DOM (modules like
`depth/panelState.ts` read current settings back out of `<input>` elements).
Svelte needs a single source of truth to react to, so extracting stores is Phase
1 of the migration itself — no separate refactoring round is needed first.

## What Svelte replaces (the pain today)

| Pain point                                                   | Evidence                                                                                                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full innerHTML regeneration of the file list on every change | `updateFileList()` block, main.ts ~3085–4677 (~1,600 lines)                                                                                                           |
| Manual listener re-attachment after each regeneration        | 70 `addEventListener` calls inside that block                                                                                                                         |
| State scattered between class fields and DOM                 | 170 DOM queries in main.ts; `panelState.ts` (37), `transformDialogs.ts` (27), `calibrationForm.ts` (19), `depthCameraParamsPrompt.ts` (13), `defaultSettings.ts` (10) |
| HTML-in-template-strings with inline styles                  | file list, depth settings panel, calibration UI                                                                                                                       |

(All counts above verified directly against the code as of 2026-07-05.)

## What Svelte does NOT touch

- Three.js scene, renderer, materials, EDL, controls (`controls.ts`,
  `postprocessing/`, render loop) — stays plain TS.
- Parsers (`parsers/`), depth pipeline (`depth/` readers, projector, worker) —
  stays plain TS.
- Extension host (`src/`) — unchanged; it keeps injecting the same
  `engine/index.html` + `bundle.js`.

The engine/UI boundary becomes: **engine mutates stores → Svelte components
render; components call engine commands → engine acts**. No framework code in
the engine core.

## Key decisions

1. **Svelte 5 with runes**, TypeScript. State in `.svelte.ts` modules so plain
   TS engine code can read/write the same reactive objects.
2. **Keep webpack** initially (`svelte-loader` ≥3.2 supports Svelte 5, plus
   `emitCss` + `mini-css-extract-plugin`). Changes one variable at a time; a
   Vite switch can happen later as an independent step if dev-server speed
   matters. Constraint either way: **output names must stay stable**
   (`bundle.js`, `media/style.css` or an added `bundle.css`), because
   `pointCloudEditorProvider.getHtmlForWebview()` rewrites those paths by regex
   (src/pointCloudEditorProvider.ts, around line 1157 onward). No content-hashed
   filenames.
3. **CSP compatibility is fine**: Svelte compiles to plain JS inside `bundle.js`
   (no `eval`), so the nonce-based `script-src` works untouched. `style-src`
   already allows `'unsafe-inline'`, but prefer `emitCss` → a `bundle.css`
   linked from index.html (add one more rewrite line in the provider).
4. **Island architecture, strangler-fig style** (matches CLAUDE.md policy):
   `index.html` keeps its shell; each panel becomes a Svelte component mounted
   into its existing container (`mount(FileList, { target: … })`). No big-bang
   rewrite of index.html until the end.

## Phases

### Phase 0 — Tooling (small, reversible)

- Add `svelte`, `svelte-loader`, `svelte-check`, `mini-css-extract-plugin` to
  `engine/package.json`; wire `.svelte` rule into `engine/webpack.config.js` and
  the root webpack config (webview bundle only — the extension-host bundle is
  untouched).
- Add `svelte-check` to `npm run lint`/CI.
- Smoke test: mount a trivial component into an empty div, build, run
  Playwright, then F5 into the Extension Development Host and confirm CSP is
  clean. **This F5 check is the go/no-go gate for the whole plan.**

### Phase 1 — State layer (the real prerequisite)

Create `engine/src/state/` with runes-based stores:

- `files.svelte.ts` — file entries: name, shortPath, vertex/face counts,
  visibility, color mode, collapsed state, per-file point size / render mode.
  Replaces the parallel arrays in main.ts (`fileVisibility`,
  `individualColorModes`, `fileItemsCollapsed`, `fileColors`, …).
- `depthSettings.svelte.ts` — per-file depth/calibration settings. This inverts
  `depth/panelState.ts`: settings live in the store, the DOM is just a view.
  `getDepthSettingsFromFileUI` reads the store instead of inputs.
- `ui.svelte.ts` — loading/error/status, active tab, sequence-mode state, FPS
  display value.
- `viewer.svelte.ts` — control scheme, camera convention, EDL params,
  brightness, gamma, lighting mode, rotation-center behavior.

Engine code mutates stores directly (plain property writes — runes make that
reactive). During Phase 1, keep the old DOM code running: write-through both
paths, so nothing changes visually yet. This phase can land in many small
commits, same style as the recent extraction series.

### Phase 2 — Leaf islands (low risk, proves the pattern)

Migrate small, self-contained UI first:

- status/loading/error overlays (`ui/status.ts`), welcome message
- performance-stats readout (stop touching DOM from the render loop; write a
  store value at the existing throttle interval instead)
- sequence playback bar (`sequencePlayback.ts` DOM parts)

### Phase 3 — The file list (the payoff)

- `FileList.svelte`, `FileItem.svelte`, `DepthSettingsPanel.svelte`,
  `CalibrationSection.svelte`, `TransformSection.svelte`.
- Deletes the ~1,600-line `updateFileList()` block and its 70 listener hookups;
  every `this.updateFileList()` call site becomes a store mutation that's
  already happening anyway.
- Depth "Live update" flow: component commits a settings change → calls the
  existing `liveDepthUpdate` pipeline. The pipeline no longer scrapes inputs.
- Write Playwright coverage for file-list interactions **before** this phase
  (toggle visibility, remove file, collapse, change color mode, edit depth
  setting) so behavior is pinned.

### Phase 4 — Controls / Camera / Info tabs

- Mostly static button grids → thin components dispatching engine commands;
  active-state highlighting comes free from `viewer.svelte.ts`.
- `updateFileStats()` → `Stats.svelte` reading the files store.

### Phase 5 — Dialogs

- `transformDialogs.ts`, `depthCameraParamsPrompt.ts`, `calibrationForm.ts`,
  `ui/dialogs.ts` modal shell → `Dialog.svelte` + per-dialog components. These
  are the heaviest remaining DOM-string code outside main.ts.

### Phase 6 — Consolidate shell

- Replace the static panel markup in `index.html` with one `<App />` mount;
  index.html shrinks to canvas + script tags + analytics. The provider's regex
  rewrites keep working because the tags it touches remain.
- Delete dead CSS from `media/style.css` for markup that no longer exists.

### Per-phase exit criteria

1. `cd engine && npm test` (Playwright) green.
2. F5 Extension Development Host: load a PLY, a depth TIF with calibration, an
   STL; check the migrated panel in the VS Code theme.
3. Bundle size delta noted (Svelte runtime is ~10–15 KB; should be offset by
   deleted template strings well before Phase 3 ends).

## Risks

- **Two UIs during migration**: write-through in Phase 1 means brief
  duplication. Keep phases short; delete old paths the moment an island lands.
- **Provider regex fragility**: any change to `index.html` script/link tags must
  be checked against the rewrite regexes in `getHtmlForWebview`. A grep-able
  comment now exists in index.html; keep it.
- **Focus/selection loss**: today's full innerHTML regeneration already resets
  focus, so Svelte's keyed updates can only improve this — but verify text
  inputs in the depth panel don't lose focus mid-edit under live update.
- **Playwright selectors**: tests select by id/class; keep the same ids on
  migrated components to avoid rewriting tests during migration.

## Other refactoring worth doing (independent of Svelte)

1. **`src/pointCloudEditorProvider.ts` is 3,498 lines** — the "thin host" is the
   second-fattest file in the repo. Audit it the same way main.ts was treated:
   message routing, file-type dispatch, and HTML handling can split into modules
   under `src/`. Not a Svelte prerequisite, but same hygiene.
2. **Remaining main.ts scene logic** (~4,700 lines after the UI block is gone):
   the proposed `visualization/` split (SceneManager, PointCloudRenderer,
   LightingManager) can proceed in parallel — it does not conflict with the UI
   migration since it's the other side of the store boundary.
3. **Do NOT pre-extract `updateFileList` (or `setupEventListeners`) into plain
   `ui/` modules** — they get deleted/rewritten in Phase 3; extracting them
   first with a Host-interface is double work that gets thrown away.
4. **CLAUDE.md line counts**: keep the file structure section in sync as phases
   land (this was stale before this plan; fixed 2026-07-05).
