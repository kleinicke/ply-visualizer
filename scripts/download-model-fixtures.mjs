// Public upstream examples are downloaded on demand, not shipped in the VSIX.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const revision = 'r185';
const files = [
  'gltf/RobotExpressive/RobotExpressive.glb',
  'gltf/RobotExpressive/README.md',
  'gltf/AnimatedMorphSphere/glTF/AnimatedMorphSphere.gltf',
  'gltf/AnimatedMorphSphere/glTF/AnimatedMorphSphere.bin',
  'gltf/AnimatedMorphSphere/README.md',
  'fbx/Samba Dancing.fbx',
  'fbx/monkey_embedded_texture.fbx',
  'collada/pump/pump.dae',
  'collada/pump/pump_body.jpg',
  'collada/pump/pump_gears.jpg',
  'collada/pump/pump_metalreflect.jpg',
  'collada/stormtrooper/stormtrooper.dae',
  'collada/stormtrooper/Stormtrooper_D.jpg',
  '3ds/portalgun/portalgun.3ds',
  '3ds/portalgun/textures/color.jpg',
  '3ds/portalgun/textures/normal.jpg',
  'obj/male02/male02.obj',
  'obj/male02/male02.mtl',
  'obj/male02/01_-_Default1noCulling.JPG',
  'obj/male02/male-02-1noCulling.JPG',
  'obj/male02/orig_02_-_Defaul1noCulling.JPG',
  'obj/male02/readme.txt',
  'stl/ascii/slotted_disk.stl',
  'stl/binary/pr2_head_pan.stl',
];
const root = path.resolve('testfiles/scene-models');
await Promise.all(
  files.map(async file => {
    const url = `https://raw.githubusercontent.com/mrdoob/three.js/${revision}/examples/models/${file.split('/').map(encodeURIComponent).join('/')}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status}: ${url}`);
    }
    const destination = path.join(root, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, new Uint8Array(await response.arrayBuffer()));
    console.log(file);
  })
);
await writeFile(
  path.join(root, 'SOURCES.md'),
  `# Downloaded model fixtures\n\nSource: https://github.com/mrdoob/three.js/tree/${revision}/examples/models\n\nThese public demonstration assets belong to their respective creators. Preserve\nthe upstream READMEs/attributions; they are local test data, not VSIX contents.\n\n${files.map(file => `- ${file}`).join('\n')}\n`
);
