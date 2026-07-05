# Svelte Migration Plan

Status: approved, Phases 0-6 complete (2026-07-05). See "Deferred follow-ups"
near the end: the loading overlay is now done too (2026-07-05 follow-up pass);
the panelState.ts DOM-scrape inversion was investigated but deliberately not
done, with a real bug found and fixed along the way.

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

1. **Svelte 5 with runes**, TypeScript. State in `.svelte.ts`/`.svelte.js`
   modules so plain TS engine code can read/write the same reactive objects.
   **Caveat discovered in Phase 1**: `svelte-loader` compiles these modules via
   Svelte's `compileModule`, which as of svelte@5.56 parses with TypeScript
   support hard-disabled (no `as` casts, type annotations, or interfaces) -
   unrelated to `.svelte` component files, which go through `svelte.compile` +
   `svelte-preprocess` and support TS normally. Store files therefore need to be
   plain JS (`.svelte.js`) with JSDoc `@type` casts for typed consumers, and
   `allowJs`/`checkJs` added to both `engine/tsconfig.json` and
   `engine/src/tsconfig.json` so tsc/svelte-check honor those JSDoc types (tsc
   only reads JSDoc types in files it treats as JS, not `.ts` files - a `.ts`
   extension with JSDoc-only casts silently infers `never[]` for empty arrays).
   Revisit if a future svelte-loader/svelte release adds TS support to
   `compileModule`.
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

### Phase 1 — State layer (the real prerequisite) — DONE

`engine/src/state/` now has four runes-based stores, write-through wired at
every existing mutation site with no behavior change. Three are `.svelte.js`
(see the TypeScript caveat under Key decisions above); `ui.svelte.ts` stayed
`.ts` since its fields are all string/boolean literals with no empty arrays, so
it never hit the `never[]` inference problem:

- `files.svelte.js` — mirrors the parallel per-file arrays in main.ts
  (`fileVisibility`, `individualColorModes`, `fileItemsCollapsed`,
  `pointSizes`), write-through at every set/push/splice site (~15 call sites).
- `ui.svelte.ts` — status/error message, error visibility, active tab; wired
  into `ui/status.ts`'s `showError`/`clearError`/`showStatus`/`switchTab`.
- `viewer.svelte.js` — control scheme, camera convention, EDL
  enabled/strength/radius, brightness, background brightness, lighting mode;
  wired into `controlSchemeSwitcher.ts`, `cameraConvention.ts`, `edl.ts`, and
  main.ts's slider/button handlers.
- `depthSettings.svelte.js` — starts with `liveUpdateFileIndices`, the one piece
  of depth-panel state that already lives in JS memory (`liveDepthUpdateFiles`)
  rather than being scraped from DOM inputs on demand; wired into
  `depth/liveDepthUpdate.ts`'s `setLiveDepthUpdateEnabled`. The full per-file
  fx/fy/cx/cy/distortion field inversion of `depth/panelState.ts` (DOM becomes a
  view instead of the source of truth) is Phase 3 work -
  `getDepthSettingsFromFileUI` still reads DOM inputs directly today.

Landed in 4 commits, same style as the extraction series. Verified at each
commit: `svelte-check`, both webpack builds (root + engine), the extension Mocha
suite (59 passing), and the engine Playwright suite (12 passing).

### Phase 2 — Leaf islands (low risk, proves the pattern) — DONE

Four islands landed, each as its own component + mount file + store fields, each
verified with the same four-gate check as Phase 1 (svelte-check, both webpack
builds, Mocha suite, Playwright suite) before commit:

- `ErrorOverlay.svelte` — `ui/status.ts`'s `showError`/`clearError` just set
  `uiState.errorMessage`/`isErrorVisible` now; the component owns the copy/close
  button handlers that used to be manually wired with `data-listener-added`
  guards.
- `WelcomeMessage.svelte` — driven by `uiState.showWelcomeMessage`;
  `updateWelcomeMessageVisibility` just sets the store field.
- `PerformanceStats.svelte` — `renderStats.ts`'s `updateFPSDisplay` writes
  `uiState.perfStatsText` at the existing 250ms throttle instead of touching
  `#performance-stats` directly.
- `SequenceControls.svelte` — also fixed a pre-existing bug found while
  migrating: `initializeSequence` tried to unhide a `#sequence-overlay` element
  that didn't exist in index.html, and the play/pause listener looked for
  `#seq-play`/`#seq-pause`/`#seq-stop` ids that were never in the markup (which
  only ever had one `#seq-play-pause` toggle button). The sequence bar was
  therefore always hidden and its toggle never worked for any user of the "Play
  Point Cloud Sequence (Wildcard)" command - now fixed via
  `uiState.sequenceMode`/`sequenceIndex`/`sequenceTotal`/`isSequencePlaying`.

**Deliberately not migrated in Phase 2**: the `#loading` overlay. Unlike the
other three, it's touched directly from ~10 places across 6 files (`main.ts`,
`cameraProfile.ts`, `largeFileChunking.ts`, `pose.ts`, `sequencePlayback.ts`,
`ui/status.ts`), and the call sites are inconsistent - some set the `<p>`
child's `textContent`, others overwrite the whole overlay div's `textContent`
(losing the spinner element). Migrating it safely means auditing and pinning
each call site's exact behavior first, closer to Phase 3's "pin behavior with
Playwright before touching it" discipline than a leaf-island-sized change. Left
as a follow-up.

### Phase 3 — The file list (the payoff) — DONE

Landed as planned: `FileList.svelte`, `FileItem.svelte`,
`DepthSettingsPanel.svelte`, `CalibrationSection.svelte`,
`TransformSection.svelte`. Playwright pinning coverage
(`file-list-interactions.spec.ts`) landed first, per plan.

`updateFileList()` is now three lines: bump `state/files.svelte.js`'s
`renderTick`, `flushSync()`, then the three trailing button-state sync calls
that still query the DOM directly (`updatePointsNormalsButtonStates`,
`updateUniversalRenderButtonStates`, `updateDefaultButtonState` - unchanged, out
of scope for this phase). Every `this.updateFileList()` call site elsewhere in
the codebase (main.ts, cameraProfile.ts, pose.ts, sequencePlayback.ts,
colorImageForDepth.ts, formatDataHandlers.ts) needed no changes - they all just
call the same method.

**Deliberate scope decision, differs from the original plan text above**: depth
"Live update" did _not_ get inverted to "component commits, pipeline reads the
store." `depth/panelState.ts`'s `getDepthSettingsFromFileUI` still scrapes DOM
inputs by id at commit time, and `depth/defaultSettings.ts` /
`depth/calibrationForm.ts` / `depth/liveDepthUpdate.ts` still read/write those
same DOM elements directly. This was intentional: every one of those modules
already treats "the DOM is the source of truth, read via `getElementById` at the
moment of commit" as its architecture, and the Svelte components render with the
_same_ ids/classes as the old HTML strings - so none of that DOM-scraping code
needed to change at all. Fully inverting it (store-first, DOM-as-view) would
have meant redesigning `CameraParams` state management across four modules for
no behavioral gain; the mechanical win (declarative rendering + bindings
replacing innerHTML + 70 manual `addEventListener` calls) was captured without
it. Revisit only if a future phase needs true field-level reactivity here.

**Full-remount model**: `FileList.svelte` wraps its content in
`{#key filesState.renderTick}`, forcing every `FileItem` (and nested
`DepthSettingsPanel`/`TransformSection`) to fully unmount/remount on every
`updateFileList()` call - deliberately matching the old "regenerate everything
from an HTML string" behavior, including resetting collapsed/section-open local
state each time. This was a considered choice over Svelte's normal keyed-diffing
(which would have _improved_ behavior by preserving open panels across rebuilds)
because `captureDepthPanelStates()`/`restoreDepthPanelStates()` already exist as
the codebase's answer to that exact problem, and duplicating that fix via
Svelte's diffing would have created two competing mechanisms for the same thing.

### Phase 4 — Controls / Camera / Info tabs — DONE

`ControlsTabTop.svelte`/`ControlsTabBottom.svelte` (button grids),
`CameraControlsPanel.svelte` (FOV + position/rotation/target readout, replacing
transformationMatrix.ts's patch-vs-rebuild branching), and `Stats.svelte`
(`updateFileStats()` → 2-line store bump). Active-state highlighting reads
directly from `viewer.svelte.js` fields Phases 1-2 already wired through; a few
toggles with no prior store field (axes/cameras visibility, gamma,
rotation-center mode, screen-space scaling, transparency) use local
component-level mirrors updated on click instead, since main.ts's own fields for
these aren't reactive. The Theme section stays static HTML, deliberately not
folded in - `setupThemeSwitcher()` wires its listener before
`PointCloudVisualizer` exists, so mounting it inside a Phase-4-mounted component
would race that setup and silently lose the listener. Added
`controls-camera-tabs.spec.ts`.

### Phase 5 — Dialogs — DONE

`transformDialogs.ts` and `depthCameraParamsPrompt.ts`'s raw
`document.createElement`/innerHTML modal building, plus `ui/dialogs.ts`'s
`createModalDialog` shell, became `Modal.svelte` (shared overlay/box/
Escape/backdrop-click) + `VectorInputDialog.svelte` (translation/quaternion/
angle-axis - one generic component, they only differ in title/label/help
text/expected value count) + `CameraVectorDialog.svelte` (camera position/
rotation/rotation-center - textarea + constraint-radio + reset button) +
`DepthCameraParamsDialog.svelte` (the fx/fy/cx/cy/depth-type/camera-model form,
pinned by `file-list-interactions.spec.ts`'s depth-settings test). Each mounts
on demand via Svelte's `mount()`/`unmount()`, matching the original one-shot
show/resolve/close lifecycle rather than a persistently- mounted component.
`ui/dialogs.ts` now only has `escapeHtml`/`addTooltipsToTruncatedFilenames`.

**Deliberately left untouched**: `depth/calibrationForm.ts` isn't a modal
dialog - it's DOM-populate logic for the calibration section that Phase 3's
`CalibrationSection.svelte`/`DepthSettingsPanel.svelte` already render with the
same ids, so it already worked unchanged and needed no Phase 5 work. Added
`transform-dialogs-check.spec.ts`.

### Phase 6 — Consolidate shell — DONE

`TabNav.svelte` replaced the last static, interactive shell piece (the
`.tab-navigation` button row), reading `uiState.activeTab` for active-state
highlighting instead of `switchTab()`'s manual `classList` queries. Found and
fixed a real bug in the process: `uiState.activeTab`'s initial value was
`'controls'`, but the actual default tab is `'files'` - harmless before since
nothing read the field reactively, but would have highlighted the wrong button
on every page load once `TabNav.svelte` started reading it. Deleted dead CSS
(`.sequence-overlay`/`.seq-row`/`.seq-wildcard`/`.seq-btn`) left over from
before the Phase 2 `SequenceControls.svelte` rewrite.

**A single all-encompassing `<App />` mount replacing every remaining static
element in index.html was not pursued** - it hits the same Theme-section timing
constraint as Phase 4 (see above), and the `#loading` overlay is still
deliberately deferred per Phase 2's notes (inconsistent DOM-mutation call sites
across 6 files need auditing/pinning first, closer to a Phase-3-style effort
than a leaf conversion). `index.html` is substantially smaller than at Phase 0
start, but not literally just "canvas + script tags" - the remaining static
pieces (hidden file input, `#loading`, Theme section, static shortcut lists) are
either out of scope or deliberately deferred, documented above and in Phase 2's
notes. Added `tabnav-default-check.spec.ts` and `theme-selector-check.spec.ts`.

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

## Deferred follow-ups

Two things were deliberately left out of Phases 0-6, both already noted inline
where they came up. Status as of the follow-up pass (2026-07-05):

1. **The `#loading` overlay** — DONE. Converted to
   `components/LoadingOverlay.svelte` reading `state/ui.svelte.js`'s
   `loadingVisible`/`loadingTitle`/`loadingDetail` fields, mounted via
   `loadingOverlayMount.ts` at `#loading-mount`. All prior direct DOM touch
   points in `main.ts` (`showLoading`, `showImmediateLoading`,
   `setLoadingDetail`, the sequence-mode hide) and `ui/status.ts`'s `showError`
   now write through the store instead. Verified against the existing
   `ply-loading.spec.ts` assertions (which already exercise `#loading`
   visibility directly) plus a full Playwright/Mocha/tsc/ svelte-check pass.
2. **`depth/panelState.ts`'s DOM-scrape architecture** — investigated, **not**
   inverted. `getDepthSettingsFromFileUI` and the capture/restore dance
   (`captureDepthPanelStates`/`restoreDepthPanelStates`) still read/write ~20
   form inputs by id rather than a reactive store. A full inversion was judged
   too risky for this pass: thin existing test coverage for the exact behavior
   being changed, direct feed into the depth-to-point-cloud pipeline (a
   must-keep-working feature), and no F5 Extension Development Host available in
   the environment doing the work to manually verify against. Along the way a
   real bug was found and fixed: `showImmediateLoading()`'s "additional load"
   fast path called `updateFileList()` directly, unlike every other call site,
   silently discarding an open/edited depth panel the moment a second file
   started loading - now wrapped in capture/restore like the rest. That fix does
   not fully close the race (loading a second file still fires two remounts in
   quick succession, and `restoreDepthPanelStates`'s `setTimeout(10)` can let
   the second capture run before the first restore commits) -
   `test/depth-panel-state-persistence.spec.ts` pins today's actual,
   improved-but-not-fully-fixed behavior in detail, including the residual race,
   for whoever attempts the full store-based inversion next.

## Other refactoring worth doing (independent of Svelte)

1. **`src/pointCloudEditorProvider.ts`** — DONE (2026-07-05 follow-up pass).
   Extracted into `src/providerHandlers/` (binary transfer, camera-param
   dialogs, add/drop-file handling, the per-format initial document loader),
   following the same host-interface + thin-delegating-wrapper pattern as
   main.ts's earlier pass. 3,498 → 1,245 lines; the remainder is
   calibration/dataset/mtl handling tightly coupled to `DatasetManager` and
   `globalState`, not mechanically extractable the same way.
2. **Remaining main.ts scene logic** — partially started (2026-07-05 follow-up
   pass): `visualization/PointCloudRenderer.ts` (round-point-texture cache,
   point material optimization, optimized-point-cloud creation) and
   `visualization/MeshBuilder.ts` (`createGeometryFromSpatialData`) are
   extracted; main.ts is 4,351 → 4,128 lines from this alone. The bulk of what's
   left (scene/renderer lifecycle: `initThreeJS`, `animate`, `dispose`,
   context-loss handling, lighting setup) is far more state-entangled and
   higher-risk to move without a dedicated pass - proposed
   `SceneManager`/`LightingManager` modules still not started.
3. **Do NOT pre-extract `updateFileList` (or `setupEventListeners`) into plain
   `ui/` modules** — they get deleted/rewritten in Phase 3; extracting them
   first with a Host-interface is double work that gets thrown away.
4. **CLAUDE.md line counts**: keep the file structure section in sync as phases
   land (this was stale before this plan; fixed 2026-07-05).
