# Svelte Migration Plan

Status: approved, Phase 0 and Phase 1 complete (2026-07-05)

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
