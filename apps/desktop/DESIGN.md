# Unified desktop workspace

Design direction recorded 2026-09-07, following the user's request to integrate
the image engine while redesigning the desktop UI. This is an implementation
plan, not a claim that these features have shipped.

## Scope

All new presentation and workspace behavior belongs to the Tauri app. Preserve
the VS Code extensions, JetBrains plugins, and standalone websites. Consume
their decoding, rendering and processing code through adapters; do not embed
either product's existing menus as the new desktop UI. Do not require the image
extension's own redesign to finish first. Repository consolidation is a separate
decision, not a prerequisite for this integration.

## One workspace, three jobs

The organizing principle is **browse → inspect → compare or combine**.

- Browse: a folder tree with single-click preview, arrow-key navigation, a
  filename/glob filter, and explicit selection of multiple files.
- Inspect: a large central canvas and one consistent contextual inspector.
- Compare or combine: explicit actions on selected sources. Browsing a folder
  never implicitly appends every visited file to a scene or layer stack.

Default layout: collapsible folder browser on the left, document/view area in
the centre, one docked inspector on the right, and a compact status strip below.
Use the PLY viewer's neutral typography and compact controls. Docking avoids
covering image pixels or 3D content; an optional floating inspector can come
later without changing the organization of its controls.

Single click replaces a temporary preview. Double click or an explicit Keep
action pins a document. Returning to a pinned document restores its current view
and adjustments. Previous/next preview can prefetch nearby files within a
bounded memory budget. Cold decoding of large files is not guaranteed instant:
show progress promptly, cancel obsolete work, and never display an old result as
if it belonged to the newly selected file.

## Inspector organization

Use **Contents**, **Appearance**, and **Tools**, with the same placement and
interaction rules for both visual engines. Simple files should need few
controls.

| Area       | Image                                                               | 3D                                                         |
| ---------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Contents   | Layers, groups, visibility, opacity, blend mode                     | Objects, groups, visibility, selection                     |
| Appearance | Range/normalization, exposure, gamma, channels, colormap, histogram | Colour source, point size, splat/mesh appearance, lighting |
| Tools      | Pixel/region inspection, measurements, calibration, processing      | Point inspection, measurements, transforms, alignment      |

Keep Fit, zoom/orientation, and current navigation tools close to the canvas.
Camera projection and presets belong to 3D view controls, not a generic tab of
unrelated settings. Export is a document action with explicit output choices:
original data, derived data, or rendered view where supported.

Remove the prominent Info tab. Put dimensions, cursor samples/coordinates,
units, zoom and optional FPS in the status strip. Detailed metadata belongs in a
collapsed Details section or document action; it is still available when needed
for scientific interpretation. Technical diagnostics belong in Help.

Each setting has one authoritative editor. Searchable actions, keyboard
shortcuts and context menus invoke the same typed commands. Advanced operations
are discoverable by name; fewer visible controls must not mean lost features.
Preserve reset gestures, undo where supported, and visibility/isolation
behavior.

## Similar controls, different data models

Multiple point clouds and image layers share selection, grouping, visibility,
names, and contextual actions. Reuse their list presentation and interaction
rules, while preserving their different semantics:

- Scene: objects share a 3D coordinate system. Their list order usually does not
  determine occlusion; transforms and coordinate compatibility matter.
- Composition: image layers combine in a meaningful order, with blending,
  opacity, masks and clipping. Dimensions and registration may differ.
- Collection: independent documents to browse or compare. They are neither
  layers nor slices simply because they were selected together.
- Dataset: one logical acquisition with axes such as page, channel, Z, time,
  frame or series, backed by one or many files.

The UI may show a one-item Contents list for a single image or point cloud, but
must not invent blend modes for point clouds or treat a DICOM slice as a layer.

## Collections and datasets

Selecting multiple files offers **Compare**, **Create collection**, and the
applicable **Add to scene / Add as layers** action. A collection has one
document identity, a thumbnail strip and previous/next navigation. Compare can
show a row or grid of live views; one inspector acts on the selected view. Link
navigation and display ranges explicitly, so changing one image does not
silently change another. Keep comparison limits and lazy rendering visible for
large selections. A glob is a source-selection filter whose matched files can be
reviewed before creating the collection, not a separate viewer mode.

Datasets get a compact navigator adjacent to the canvas: Series, Z, Time,
Channel or Frame only when present. Opening a multi-frame file stays in one
document. For multi-file DICOM, offer Open as dataset on the folder/selection;
reuse technical-header grouping, instance deduplication and spatial ordering. Do
not assemble a volume by lexicographic filename order. Extensionless DICOM needs
format detection; unknown extension must not automatically mean text. OME
companion files resolve within the granted workspace; missing sources or
ambiguous groups are reported instead of silently producing an incomplete stack.

## Depth and text

Images open in 2D. Point clouds open in 3D. Supported scalar/depth inputs offer
**Create 3D view…** in their contextual actions. Ask for interpretation and
calibration where metadata is insufficient; do not infer metric depth from the
filename or single-channel shape alone. The resulting view references the
original samples and calibration, never a normalized screenshot. Once created,
its source image and derived 3D view can be revisited without a global mode
switch.

Text uses a simple read-only, escaped monospace view with wrapping, selection
and copy. No editor framework is needed. Detect binary content, bound text
preview size, and explain truncation. A JSON file previews as text by default;
Import camera/pose data is an explicit 3D operation where applicable.

## Engine integration

The local image checkout is `../tiff-visualizer`. Initial inspection found:

- Rust decoders, worker entry points and format routing in `media/` and
  `crates/image-decoders/`.
- Shared image display edits in `shared/display-settings.ts`.
- An existing `web/embedded-host.ts` interface, but its implementation in
  `web/browser-host.ts` still reads UI elements and invokes old popovers.
- Dataset/collection orchestration partly resides in platform hosts; importing
  the image web bundle alone will not deliver all multi-file dataset behavior.
- The existing desktop PLY adapter exposes open/preview/export, but not yet the
  object selection and appearance operations needed by a replacement inspector.

Therefore build explicit desktop adapters and a capability inventory before
replacing controls. Neither a hidden old website nor a second independent copy
of engine settings is the long-term integration boundary.

Adapters should expose mount/dispose, open/cancel, capabilities, state
subscription, selection, commands, and export. Engine state owns rendering and
processing parameters; Svelte owns workspace layout and presentation state.
Large buffers stay outside reactive snapshots. Desktop-created entry points may
assemble existing modules differently without changing existing host entries.

The workspace owns native folder grants, lazy directory enumeration, document
identity, source access, companion resolution, caches and save dialogs. Native
reads remain scoped to user-granted roots/files, with canonical-path checks
including symlinks. Keep source identity distinct from file paths and derived
views so multi-file datasets and one-file/multiple-view documents both work.

During development an explicit local image-source path can be supported, but
reproducible builds must consume a pinned source/package artifact and include
its notices. Do not make production builds silently depend on a sibling
checkout's uncommitted state. No edits to the sibling repository are needed for
the design.

## Implementation sequence and acceptance checks

1. Workspace and document model: native folder tree, lazy reads, text preview,
   transient vs pinned documents, cancellation and bounded cache. Verify rapid
   selection, Unicode paths, permission boundaries, binary and large text files.
2. Image engine adapter: integrate real scientific decoding/rendering with a new
   desktop canvas surface and basic Appearance controls. Verify integer/HDR
   sample values, normalization, channel handling, errors and export against the
   existing image engine; a thumbnail-only preview is not completion.
3. Unified inspector: replace the PLY floating menus only in desktop, connect
   both adapters to Contents/Appearance/Tools, remove the global 2D/3D switch.
   Verify multi-object operations and depth source/calibration preservation.
4. Collections and datasets: comparison/thumbnail navigation, glob selection,
   TIFF pages, array axes, then multi-file DICOM and OME. Verify ordering,
   incomplete companions, linked vs independent display settings and memory use.
5. Advanced feature migration: maintain a feature-by-feature ledger covering
   measurements, ROIs, layered formats, blend modes, processing, calibration,
   export and shortcuts. Do not claim image-extension parity until verified.

Run native Tauri checks as well as browser tests. Confirm both existing
extension and website bundles remain unaffected by desktop-only changes.
