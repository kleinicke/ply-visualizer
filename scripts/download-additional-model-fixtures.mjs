// Public examples for the additional mesh/CAD importers. Local test data only.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const threeBase = 'https://raw.githubusercontent.com/mrdoob/three.js/r185/examples/models/';
const freecadBase = 'https://raw.githubusercontent.com/FreeCAD/FreeCAD/1.0.2/';
const files = [
  ['3mf/cube_gears.3mf', threeBase + '3mf/cube_gears.3mf'],
  ['3mf/multipletextures.3mf', threeBase + '3mf/multipletextures.3mf'],
  ['3mf/README.md', threeBase + '3mf/README.md'],
  ['amf/rook.amf', threeBase + 'amf/rook.amf'],
  ['vrml/house.wrl', threeBase + 'vrml/house.wrl'],
  ['vrml/meshWithTexture.wrl', threeBase + 'vrml/meshWithTexture.wrl'],
  ['vrml/map.gif', threeBase + 'vrml/map.gif'],
  ['vrml/points.wrl', threeBase + 'vrml/points.wrl'],
  ['vrml/lines.wrl', threeBase + 'vrml/lines.wrl'],
  ['step/Schenkel.step', freecadBase + 'data/examples/Schenkel.stp'],
  ['step/as1-ac-214.stp', freecadBase + 'data/tests/Step/as1-ac-214.stp'],
  ['iges/RLF_12545.iges', freecadBase + 'src/Mod/Idf/Idflibs/RLF_12545.igs'],
  ['iges/SOD_323.igs', freecadBase + 'src/Mod/Idf/Idflibs/SOD_323.igs'],
  ['brep/filletBox.brep', freecadBase + 'data/tests/ModelRefineTests/filletBox.brep'],
  ['brep/Y_Rod_Mount.brep', freecadBase + 'data/tests/ModelRefineTests/Y_Rod_Mount.brep'],
];
const root = path.resolve('testfiles/scene-models');
await Promise.all(
  files.map(async ([file, url]) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    const destination = path.join(root, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
    console.log(file);
  })
);
await writeFile(
  path.join(root, 'ADDITIONAL-SOURCES.md'),
  `# Additional model fixtures

Downloaded from Three.js r185 and FreeCAD 1.0.2. These examples belong to their
respective authors and are local test assets, excluded from the VSIX. Preserve
the upstream attribution in 3mf/README.md. Schenkel.stp is saved as Schenkel.step
to exercise both STEP filename extensions; RLF_12545.igs is saved as
RLF_12545.iges to exercise both IGES extensions. Their contents are unchanged.

${files.map(([file, url]) => `- [${file}](${url})`).join('\n')}

Generate viewer screenshots alongside these files with:

    cd engine
    SAVE_MODEL_PREVIEWS=1 npx playwright test additional-models --workers=1

Import limitations:
- 3MF: mesh preview; material/property extensions are only partially supported.
- AMF: constellations (object arrangements) are not supported by Three.js.
- WRL: VRML 2.0 static geometry; no interactive world behavior.
- STEP/STP: triangulated solids/surfaces, assembly grouping and colours;
  coordinates are normalized to millimetres. No parametric CAD editing.
- IGES/IGS: triangulated solids/surfaces with coordinates normalized to millimetres.
  Curve-only files are not supported.
- BREP: OpenCascade solids/surfaces; source coordinates are preserved and units
  remain unspecified. Wire-only files are not supported.
`
);
