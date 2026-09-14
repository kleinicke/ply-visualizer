# Additional mesh and CAD imports

The shared scene loader accepts 3MF, AMF, WRL, STEP/STP, IGES/IGS and BREP in
addition to its existing formats. VS Code file associations and
browser/local-session routing use the same scene path.

- **3MF:** Three.js mesh/component import, including supported colours and
  textures. Its material/property extension support is partial; this is a model
  preview, not a slicer-project editor.
- **AMF:** plain XML and ZIP-compressed AMF. Colours and materials are retained.
  Constellations are not implemented by Three.js; files containing them show a
  warning that object arrangements are not supported.
- **WRL:** Three.js VRML 2.0 geometry, including meshes, lines, points and
  external textures selected alongside the model. World background spheres are
  omitted so they cannot distort model bounds. Interactive world behavior is not
  supported.
- **STEP/STP:** OpenCascade triangulation of solids and surfaces. Assembly
  grouping, body colours and face colours are retained. Output coordinates are
  in millimetres, with no automatic axis rotation. This is a mesh preview, not
  parametric CAD editing. Wire-only STEP files are not supported.
- **IGES/IGS:** OpenCascade triangulation of solids and surfaces, with available
  colours retained and coordinates normalized to millimetres. Curve-only files
  are not supported.
- **BREP:** OpenCascade boundary-representation files containing solids or
  surfaces. Source coordinates are preserved; units are unspecified because this
  format does not provide the unit conversion supported by STEP/IGES. Wire-only
  files are not supported.

All three CAD formats share the pinned `occt-import-js` package. The
approximately 7.3 MiB WASM decoder is fetched only for CAD imports. It runs in a
disposable browser worker on the website and a Node worker in the VS Code
extension host, with a two-minute conversion limit. Its CAD heap is released
after each import. The host worker avoids relaxing the webview CSP for the
upstream decoder’s dynamically generated JavaScript bindings. License notices
are shipped under `engine/media/licenses/`.

## Example files and verification

Run `node scripts/download-additional-model-fixtures.mjs` at the repository
root. It downloads versioned Three.js and FreeCAD examples into
`testfiles/scene-models/{3mf,amf,vrml,step,iges,brep}` and records source URLs
in `ADDITIONAL-SOURCES.md`. Like the existing model fixtures, these are ignored
local test data and are not packaged with the extension.

After building the engine, run:

```sh
cd engine
SAVE_MODEL_PREVIEWS=1 npx playwright test additional-models --workers=1
```

This saves `.png` previews beside the corresponding models and checks geometry,
textures, visibility, removal, bounds, units and recovery from invalid CAD
input.
