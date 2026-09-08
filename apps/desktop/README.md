# Visualizer desktop workspace

Tauri 2 and Svelte 5 workspace combining the PLY rendering engine and the real
scientific image engine from `tiff-visualizer`. The desktop owns its browser,
document tabs and inspector. These changes do not alter either extension or the
public website UI.

## Try the review build

Open `src-tauri/target/debug/bundle/macos/Visualizer.app`. Choose **Open
folder…**, expand folders and click a file to preview it. Double-click a file or
choose **Keep open** to pin the document. Select file checkboxes to use
**Compare**, **Combine**, **Collection**, or **Sequence**.

- Images and point clouds use the same **Contents / Appearance / Tools** panel.
  Technical metadata is collapsed under Details.
- Contents contains scene objects or image layers. Appearance exposes point size
  and colour, or image range, gamma/exposure, colormap, channels and a sampled
  histogram. Image compositions support visibility, opacity and blend modes.
- Supported depth sources open as images. **Tools → Create 3D view…** hands the
  original samples to the PLY engine's camera/interpretation dialog.
- Compare shows up to four independent image/3D panes. Select a pane's heading
  to direct the inspector to it. Collections navigate separate sources; Combine
  explicitly puts sources in one scene or image composition.
- Sequence provides ordered frames, scrubbing, looping and a playback rate. It
  waits for decoding, so slow sources play below the requested rate. PLY
  sequences retain the camera. GIF animates through the system image element;
  ordinary videos use the system webview's available codecs.
- Text uses an escaped, read-only preview, limited to 2 MiB. Binary content
  produces an explanation. JSON is text by default.
- Files open through native picking, drag/drop, macOS open events or executable
  arguments. Export uses a native save dialog for rendered PNGs.

## Build and validate

Use Node 24, the root npm dependencies, Rust, and the platform's Tauri
prerequisites.

```sh
npm install
npm run desktop:dev
npm run desktop:check
npm run desktop:test
npm run build:web --workspace=visualizer-desktop
npm run test:ui --workspace=visualizer-desktop
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
npm run build --workspace=visualizer-desktop -- --debug --bundles app
```

The tested artifact is a local macOS ARM64 debug app, not a notarized public
release. `npm run desktop:build` creates release bundles; public distribution
still needs signing/notarization and platform validation.

## Integration boundaries

`src/documents.ts` contains provider routing and the source/document model. A
source can have both an image and a 3D interpretation. Composition, collection,
comparison and sequence are document modes, independent of filename extensions.
This keeps future temporal decoders (including FBX) and grouped scientific
datasets possible without adding another application shell.

`src/components/ViewerPane.svelte` hosts isolated rendering surfaces and owns
loading, cancellation and exports. `src/adapters/scene-entry.ts` connects the
new inspector to existing PLY operations and is bundled only in the desktop
build. The shared engine's floating panel is hidden only in that artifact.

`vendor/image-engine/` is a pinned, self-contained build of the sibling image
repository's decoder, renderer and operations. Its original Svelte inspector
entry is replaced with an empty mount; our inspector is entirely new.
`image-engine/hook.ts` provides the scoped adapter inside that engine. Runtime
workers, WASM, license, third-party notices and source provenance are included.
Regular builds do **not** require a sibling checkout.

UPNG is excluded from the desktop artifact, with a build guard against importing
it. Precise 16-bit PNGs use the existing Rust decoder; ordinary PNGs and
embedded RGBA8 layered-document previews use native decoding. A failed precise
decode reports an error rather than silently reducing sample precision.
Layered-document writing is not bundled yet; the exposed rendered-PNG export
uses canvas encoding.

Refresh the pinned artifact explicitly after changing the adapter or updating
the image engine (the source checkout must have its build dependencies/assets):

```sh
node apps/desktop/scripts/build-image.mjs
# Or specify a different checkout:
IMAGE_ENGINE_SOURCE=/path/to/tiff-visualizer node apps/desktop/scripts/build-image.mjs
```

The script checks the upstream injection boundary and records its commit and
adapter hash. A future monorepo extraction can replace this artifact with a
workspace package; do not copy image decoding into the Tauri host.

`src/host.ts` and `src-tauri/` handle native integration. The frontend reads
opaque handles for user-selected files, and folder enumeration stays inside
granted roots. Directory loading is lazy. Native source bytes use a 128 MiB LRU
cache; replaced geometry is removed instead of accumulating in the embedding
cache.

## Current scope and remaining work

This is the first unified UI review build, not full parity with every tool in
the feature-rich image extension. See [DESIGN.md](DESIGN.md) for the target.

| Area              | Review build                                                                                                        | Follow-up                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Scientific images | Original engine decoding/rendering; range, colour, channels, histogram; TIFF page/axis and supported plane controls | Broader format matrix and specialized interpretation controls                                  |
| Layers            | Combine sources, visibility, opacity, blend, undo/redo; expose decoded layered-file pixels                          | Reorder, masks, filters, registration and complete layered-file editing                        |
| Datasets          | Single-file decoder and plane/frame navigation                                                                      | Multi-file DICOM/OME discovery, grouping and companion-file resolution                         |
| Collections       | Natural source order, wildcard selection, filmstrip navigation, comparison                                          | Thumbnails, linked views, recursive search and richer collection layout                        |
| Time              | Image/PLY file sequences, GIF, system video                                                                         | Embedded 3D animation/FBX decoder, timestamps and realtime playback policy                     |
| State             | Session document tabs, saved image display settings, basic pinned object/layer appearance and scene camera          | Disk session restore; complete measurements, transforms, image zoom and edit-history retention |
| Image tools       | Original-value pixel reporting and sampled histogram                                                                | ROI/annotation editing, profiles, calibration, debayer and remaining advanced tools            |

Folder filtering applies to the loaded tree, not a background recursive disk
index. Source caching is bounded but full decoder/GPU allocations are not yet a
strict application-wide memory budget. Name-based restoration of object/layer
appearance is provisional when a document contains duplicate names. No desktop
updater is provided. External glTF/OBJ companion assets need a resolver.

macOS WKWebView still schedules animation around 60 FPS on this machine; the
engine follows requestAnimationFrame. This build does not use private WebKit
preferences. Windows and Linux runtime behavior remains unvalidated.

See [VALIDATION.md](VALIDATION.md) for checks performed on this build.
