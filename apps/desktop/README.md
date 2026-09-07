# Visualizer desktop preview

Tauri 2 host for this repository's PLY engine, with a Svelte workspace and a
replaceable image preview. No TIFF repository dependency is required.

## Build and run

Use Node 24, root npm dependencies, Rust, and the platform's Tauri prerequisites
(Xcode command-line tools on macOS).

```sh
npm install
npm run desktop:dev
# Local macOS app bundle, without a distribution installer:
npm run build --workspace=visualizer-desktop -- --debug --bundles app
```

The macOS debug app is
`apps/desktop/src-tauri/target/debug/bundle/macos/Visualizer.app`. Open it
directly, or pass absolute file paths to its executable:

```sh
apps/desktop/src-tauri/target/debug/bundle/macos/Visualizer.app/Contents/MacOS/visualizer-desktop /absolute/path/cloud.ply
```

`npm run desktop:build` produces a release build and platform bundles. Public
desktop distribution still needs platform signing/notarization and platform
validation. The tested local artifact is a macOS ARM64 debug app.

## Behavior

- PLY and other supported geometry open in the shared 3D scene.
- Browser images open in an image pane with fit/zoom controls.
- TIFF, EXR, PFM and NumPy have a basic normalized image preview using the
  existing PLY-side readers. They open in 2D first and offer **View in 3D**.
- PNG also offers explicit depth interpretation; a filename alone cannot
  distinguish an ordinary photograph from encoded depth.
- Depth-to-3D uses the original source bytes and the engine's
  camera/interpretation dialog. Cancelling can be retried. Display normalization
  never changes source data.
- The shared 3D scene stays mounted when switching to an image. Document buttons
  return to that scene; they are not separate isolated 3D scenes.
- Native file picking, native drag/drop, command-line paths and macOS open-file
  events enter the same document routing flow.
- Screenshot, measurement-path, camera-path, video and PLY exports use a host
  saving interface. Native input/output buffers use binary IPC; a native Save
  dialog chooses the destination and owns cancellation/overwrite confirmation.

## Extension boundary for the image viewer

`src/documents.ts` owns the document model, view choices and routing providers.
`src/imageProvider.ts` owns replaceable image preview providers. The Svelte
shell composes these with the image pane and the persistent embedded 3D view.

`engine/src/hosts/embeddedViewer.ts` exposes the existing engine through a
framework-neutral embedding API. It imports no Tauri API. The iframe preserves
the existing engine's DOM/CSS isolation and avoids duplicating
`engine/index.html`. `engine/src/hosts/exportFile.ts` supplies an optional host
export service while keeping browser/JCEF downloads and existing VS Code message
paths working.

`src/host.ts` and `src-tauri/` own native integration. Native reads accept
opaque handles for files previously selected by the user, not arbitrary frontend
paths.

When the image repository is ready, bring its shared viewer package into the
workspace, replace the basic image provider/pane with its Svelte viewer, and
extend the routing provider. Keep the document's source and identity shared
between image and 3D views. Do not move TIFF decoding or image tools into the
Tauri host. A later monorepo move can extract these boundaries into the packages
described in [the unified product plan](../../docs/UNIFIED_PRODUCT_PLAN.md).

## Current limits

- macOS WKWebView currently schedules script animation near 60 FPS, including on
  a 120 Hz display. The engine follows `requestAnimationFrame`; it does not
  impose a 60 FPS cap. Higher refresh rates currently require a private WebKit
  preference, which this preview does not use. Track the
  [WebKit public-API request](https://bugs.webkit.org/show_bug.cgi?id=294338).
- This is a desktop preview, not the full scientific image viewer. Scientific
  previews show a single plane (channel 0 for scalar arrays); TIFF RGB previews
  normalize sample values and currently ignore alpha. There are no histogram,
  layer, channel-selection, measurement or full-resolution scientific image
  tools.
- Files are read into memory. Streaming/range reads and bounded document caches
  remain future work; large native transfers are binary but not zero-copy.
- Companion-file resolution for external glTF/OBJ resources is not provided.
- Documents/view state are session-only. There is no session restoration or
  desktop updater yet. The current document strip has no close control.
- Windows and Linux runtime behavior has not been validated.

## Checks

The native CSP explicitly permits style attributes through `style-src-attr`.
Tauri adds nonces to `style-src`, which otherwise disables `unsafe-inline` for
the shared engine's layout attributes (including the heading/FPS row).

```sh
npm run desktop:check
npm run desktop:test
npm run build:web --workspace=visualizer-desktop
npm run test:ui --workspace=visualizer-desktop
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

Browser tests cover geometry/image routing, retained scenes, scalar preview,
cancel/retry of depth conversion, original-file handoff, screenshot export and
unsupported-file feedback. They complement the actual macOS app checks recorded
in [validation](VALIDATION.md), rather than establishing native compatibility.
