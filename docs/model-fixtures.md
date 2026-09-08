# Model fixtures

Download real examples from the pinned Three.js r185 example collection:

```sh
node scripts/download-model-fixtures.mjs
npm run build --workspace=engine
cd engine && npx playwright test scene-models.spec.ts
```

Files are stored under `testfiles/scene-models/` (ignored by Git and excluded
from extension packages). The downloader also writes `SOURCES.md` and preserves
available upstream attribution files. Assets belong to their respective
creators.

| Format | Example                                | Coverage                                                           |
| ------ | -------------------------------------- | ------------------------------------------------------------------ |
| GLB    | RobotExpressive                        | Scene hierarchy and skeletal animation clips                       |
| GLTF   | AnimatedMorphSphere                    | External binary buffer and morph animation                         |
| FBX    | Samba Dancing; monkey_embedded_texture | Skeleton animation; embedded textures                              |
| DAE    | stormtrooper; pump                     | External texture; animation                                        |
| 3DS    | portalgun                              | Materials and external textures                                    |
| OBJ    | male02                                 | Existing mesh loader; MTL and textures provided for manual testing |
| STL    | slotted_disk; pr2_head_pan             | ASCII and binary meshes                                            |

Upstream: https://github.com/mrdoob/three.js/tree/r185/examples/models

Browser tests load the actual downloaded bytes, check rendered scene contents,
exercise animation playback and timeline reset, toggle visibility, and remove
files. They save a screenshot for each format in `engine/test-results/`.
