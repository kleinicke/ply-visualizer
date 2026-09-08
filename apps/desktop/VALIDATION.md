# Unified desktop validation

Date: 2026-09-08. Platform: macOS ARM64. Tauri 2, version 0.1.0 debug app.

## Automated checks

- Svelte/TypeScript: zero errors and warnings.
- Document routing/filter/text unit tests: 3 passed.
- Rust native file handles and workspace grants: 2 passed, including parent
  traversal, ungranted roots and escaping symlinks.
- Playwright desktop suite: 11 scenarios covering scientific NPY rendering and
  original samples, image display range/histogram, replacement versus explicit
  scene composition, escaped text and binary feedback, collection navigation,
  raw image layers and PNG export, independent comparison panes and sequence
  playback, nested folder browsing/filtering/pinning, original-file depth
  conversion with cancel/retry, pinned scene appearance, TIFF page controls, and
  synthetic DICOM decoding.
- PNG checks verify original 16-bit values exceed 255, OpenRaster embedded
  layers decode natively, and no UPNG asset is requested or global installed.
- Composition controls exercise opacity reset and Shift-click isolation/restore.
- Production frontend bundles and native debug app compile. The existing 4.84
  MiB optional 3D chunk still produces Webpack's asset-size warning.

## Native checks

- Launched the actual bundled app in macOS WKWebView and visually checked the
  40,256-point example with the new 3D inspector.
- Opened a scientific NumPy file from an executable argument; visually checked
  its rendered image and the new Contents/Appearance/Tools inspector.
- Opened a native folder picker with Command-Shift-O and selected the NumPy
  fixture folder. Confirmed the granted folder's files appear in the browser.
- Captured the native window, not just a Chromium screenshot. The native
  style-attribute CSP and the image worker/WASM loading were exercised.

Browser checks establish functional UI behavior, not complete native/platform
coverage. Earlier native export and VS Code validation in repository history
predate this unified UI; they are not counted as a fresh extension test run.

## Scope

This is a local review build, not a published/notarized release. Full format
parity, multi-file DICOM/OME grouping, external companion assets, very large
file stress tests, native drag/drop/overwrite combinations and Windows/Linux
runtime behavior are not established by these checks. See [README.md](README.md)
for the feature ledger. The macOS webview still runs near 60 FPS on this
machine.

Artifact: `src-tauri/target/debug/bundle/macos/Visualizer.app`. Browser
screenshots: `test-results/unified-image.png` and `unified-scene.png`.
