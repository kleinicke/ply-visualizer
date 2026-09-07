# Unified image and 3D visualizer plan

Recorded: 2026-09-07. Status: initial platform hosts implemented; full
unification remains future work.

Progress: this repository now contains a
[JetBrains signed preview](../jetbrains/README.md) and a
[Tauri desktop preview](../apps/desktop/README.md). The desktop host has
separate document routing, image-preview providers and an embedded 3D adapter.
Full TIFF integration and repository consolidation remain future work.

## Product direction

Build one coherent product for scientific images, point clouds, meshes, and
related data. Use the PLY viewer's compact, neutral, panel-based UI as the
design foundation. Bring TIFF's UI toward that foundation rather than carrying
its current website styling into the combined app.

The long-term target is one monorepo containing both viewer engines, shared
Svelte UI, Rust libraries, and the platform hosts. Continue shipping the two VS
Code extensions separately. The same repository can also produce JetBrains
plugins, browser viewers, and a combined Tauri desktop app. Repository
consolidation does not require synchronized product versions or releases.

JetBrains porting is currently underway in the TIFF repository; the user plans
to bring the relevant changes to PLY. Treat copying integration between repos as
a temporary bridge until consolidation gives shared code one home.

## UI and technology boundaries

Migrate TIFF's controls incrementally to Svelte 5, matching PLY's foundation.
Retain the existing image renderer, decoders, workers, and processing logic.
Svelte owns panels, menus, dialogs, controls, and their reactive presentation
state; rendering and decoding remain independent of the UI framework.

Share actual components and interaction conventions, not just a framework or
similar CSS. Shared UI should cover typography, spacing, themes, buttons,
panels, menus, dialogs, sliders, and progress presentation. Carry forward PLY's
documented conventions, including slider reset gestures and grouped visibility
behavior where applicable.

Keep specialized tools appropriate to each view:

- Images: channels, histograms, normalization, pixel inspection, layers, slices.
- 3D: camera controls, transforms, point appearance, alignment, geometry tools.

Preserve natural image and 3D navigation rather than forcing identical canvas
gestures. Reuse control placement and behavior where their meanings match.

The combined app should own file opening, recent files, settings, progress, and
document/view navigation. A depth image should be inspectable in 2D and opened
as a point cloud in the same workspace, preserving source identity, units, and
camera parameters. Formats such as TIFF and NPY need an explicit view choice
where their interpretation is ambiguous.

## Target repository structure

Illustrative boundaries; exact names and package granularity can evolve:

```text
visualizer/
  apps/
    vscode-ply/
    vscode-tiff/
    jetbrains/           # Combined plugin or separate plugin hosts
    desktop/             # Combined frontend and src-tauri/
    web/                 # One or more browser entry points

  packages/
    ui/                  # Shared Svelte components and themes
    viewer-image/        # Image rendering, tools, and viewer-specific UI
    viewer-3d/           # 3D rendering, tools, and viewer-specific UI
    host-api/            # File access, saving, dialogs, persistence contracts
    workspace/           # Combined document/view management and commands

  crates/
    image-decoders/
    pointcloud-core/
```

Hosts compose viewers and implement the host interfaces. Viewers consume those
interfaces and shared UI without importing VS Code, JetBrains, or Tauri APIs.
The workspace coordinates viewers; shared primitives do not depend on either
viewer. Each host supplies its platform's surrounding UI and capabilities.

Prefer Rust for byte parsing and substantial computation. Keep DOM, GPU API, and
IDE API integration in TypeScript or the host's appropriate language. Retain
working WASM paths initially. Native Rust decoding in Tauri can reuse the same
core crates through separate adapters when measurements justify it.

## Migration sequence

### 1. Establish the JetBrains host boundaries

- Finish the current ports and bring the relevant integration to PLY.
- Keep host messaging, resource access, commands, and IDE integration separate
  from viewer rendering and controls.
- Confirm the existing VS Code and browser hosts remain functional.

Completion criterion: both viewers work in their intended hosts with clear
integration boundaries that can be moved into the monorepo.

### 2. Start TIFF's Svelte UI migration

- Identify the first common controls and use PLY's visual conventions.
- Replace one UI section at a time while retaining existing processing paths.
- Keep one authoritative settings model during the transition; bridge it to
  reactive UI rather than creating competing state owners.
- Validate image behavior as well as appearance in the affected hosts.

Completion criterion: a representative TIFF workflow uses the new UI without
losing its existing behavior. Full migration is not a prerequisite for step 3.

### 3. Consolidate and extract shared packages

- Bring both projects into one repository with their histories preserved.
- Extract shared UI before substantial duplicated components accumulate.
- Move host integration into app boundaries and reusable logic into packages and
  crates incrementally.
- Preserve extension identities, packaging, and independent releases.
- Keep browser and IDE entry points usable during the move.

Completion criterion: shared UI and core fixes are made in one authoritative
location, and the existing products can still be built and released.

### 4. Prove Tauri compatibility and build the combined workspace

Run a small compatibility prototype before investing in the full desktop shell;
it can happen earlier alongside the UI migration if useful.

- Exercise representative large images, point clouds, and splats in the actual
  target platform webviews; Chromium browser tests alone are insufficient.
- Check rendering, worker/WASM loading, memory use, and large-file transfer.
- Retain existing WASM decoding first; avoid large numeric arrays serialized as
  JSON across native IPC. Measure binary transfer and native decode options.
- Build shared file routing, view navigation, and image-to-3D handoff.
- Add native file opening, file associations, session restoration, packaging,
  and distribution once the core workflows are sound.

Completion criterion: one desktop app opens both data families, exposes a
consistent UI, and connects image and 3D workflows without switching products.

Tauri reference:
[process model and platform webviews](https://v2.tauri.app/concept/process-model/)
and
[Rust commands and binary responses](https://v2.tauri.app/develop/calling-rust/).

## Decisions still open

- Final product/repository name; evolve the PLY repository or create a new home.
- One combined JetBrains plugin versus separate plugin distributions.
- One combined website versus multiple entry points using the same packages.
- Desktop document/tab/split-view layout and session format.
- Which native Rust paths provide measured benefits over the existing WASM
  paths.

These decisions do not block host separation or the incremental TIFF UI work.
Avoid coupling the migration to an unrelated build-tool rewrite.

## Related plans

- [PLY Svelte migration plan](SVELTE_MIGRATION_PLAN.md) records the earlier PLY
  migration and its implementation constraints.
- [Backlog](BACKLOG.md) includes existing image/volume bridges and other work to
  preserve when bringing the products together.
