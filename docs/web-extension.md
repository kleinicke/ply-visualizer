# VS Code for the Web

The extension has separate Node (`out/extension.js`) and browser
(`out/web/extension.js`) entry points. Both use the same webview bundle and HTML
renderer. The browser host uses `workspace.fs` and preserves URI schemes; files
may live in a local browser workspace, github.dev, or another filesystem
provider. The shared browser loaders handle decoding, depth projection, and
registration with the existing Rust/WASM kernels. The desktop host retains its
Node worker pool and streaming paths.

Web support includes opening files, opening multiple files together, depth
conversion, ordinary point-cloud alignment, model companion resources, workspace
sequences, settings, and save dialogs. COLMAP folder opening looks in the
selected directory, `sparse`, and numbered subdirectories. HTTP downloads
require a server that permits browser access through CORS. For models with
separate buffers or textures, open the model and its companion files from a
workspace; URL downloads retrieve only the selected file.

Browser limitations:

- Native dataset downloading/extraction and DICOM folder assembly remain desktop
  commands. Open individual supported files or prebuilt volumes in web VS Code.
- CAD conversion (STEP, IGES, BREP) requires desktop VS Code. The upstream
  decoder generates JavaScript bindings at runtime, which the webview CSP does
  not allow. GLB, OBJ, and STL exports work in the browser.
- Native language-model tools and the archive station recoloring pipeline remain
  desktop integrations. Ordinary point-cloud registration runs in the browser.
- Browser memory limits apply: the web host transfers whole files, unlike the
  desktop's optimized streaming paths. Very large scans are better opened on
  desktop.
- Save destinations and folder access depend on the browser and workspace
  filesystem provider. The extension does not bypass provider permissions.

## Verification

Run `npm run compile`, then `npm run test:web`. Microsoft's `@vscode/test-web`
launches Chromium and a real VS Code web extension host. The test workspace uses
`vscode-test-web:` URIs; writes are held in memory, not written to fixture
files. The tests open generated PLY, XYZ, STL, and depth data through actual
extension commands, inspect decoded geometry, capture a rendered frame, resolve
GLTF companion files, and run WASM alignment in a browser worker. Browser
security remains enabled.

`npm run test:web` builds the test entry point, but intentionally does not
rebuild the product bundle. Run `npm run compile` after product changes. Test
bundles are excluded from the VSIX. Publishing a new extension version is
required before these changes become available from the vscode.dev Marketplace.
