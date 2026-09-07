# Desktop preview validation

Date: 2026-09-07. Platform: macOS ARM64. Build: Tauri 2, version 0.1.0 debug
app.

## Passed

- Svelte/TypeScript check: no errors or warnings.
- Document routing/provider unit tests: 2 passed.
- Rust document-handle authorization and deduplication test: passed.
- Desktop Playwright checks: 4 passed, covering PLY rendering, normal image
  preview, scene retention across views, scalar depth preview, original-file
  handoff, cancelled depth conversion retry, actual depth-to-3D conversion,
  screenshot export and unsupported-file feedback.
- Native `.app` bundle built and launched directly in macOS WKWebView.
- Native PLY file load displayed the 40,256-point example; visually inspected
  the actual native window, not only a browser test screenshot.
- Native NumPy depth load opened in the image pane while retaining the 3D scene.
- Native Open dialog opened; a PNG selected through it displayed as an image.
- Native screenshot export wrote a 199,526-byte PNG to a temporary test
  location; inspected the exported image and confirmed the point cloud was
  rendered.
- Native Save cancellation exercised through the dialog's Cancel button.
- Corrected native CSP handling of inline style attributes. Rebuilt and visually
  checked the native window: FPS now sits beside File Management, matching the
  shared viewer. The targeted browser regression also passes with a
  nonce-bearing style policy, covering the difference missed by the original
  browser smoke test.
- Existing VS Code suite: 178 tests passed in the real extension host. Its
  pretest build, TypeScript checks, lint and engine Svelte checks also passed.

## Limits of these results

This is a local desktop preview, not a published or notarized desktop release.
Native overwrite confirmation, OS drag/drop, companion assets, very large files,
and Windows/Linux runtime checks are not established by the browser tests.
Scientific image preview is deliberately limited; see [README.md](README.md).
The macOS embedded webview still schedules animation near 60 FPS. This
validation does not claim 120 FPS support or apply private WebKit preferences.

The final app is at `src-tauri/target/debug/bundle/macos/Visualizer.app`.
Browser screenshots are under `test-results/`. Native test evidence was captured
from the app and its PNG export during the validation run.
