import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plyRoot = path.resolve(root, '..');
function extensions(pkg) {
  return [...new Set(pkg.contributes.customEditors.flatMap(editor => editor.selector.flatMap(({filenamePattern: p}) => {
    if (!/^\*\.(?:\{[\w,]+\}|\w+)$/.test(p)) throw new Error(`Unsupported selector ${p}`);
    return p.slice(2).replace(/[{}]/g, '').toLowerCase().split(',');
  })))].sort();
}
const allPly = extensions(JSON.parse(await readFile(path.join(plyRoot, 'package.json'), 'utf8')));
// Detached NRRD needs companion-file resolution; BIN is not unambiguously KITTI.
const deferred = {bin: 'Ambiguous generic binary extension; needs an explicit Open as KITTI action.', nhdr: 'Detached volume requires companion-file resolution.'};
const ply = allPly.filter(ext => !deferred[ext]);
const data = `ply=${ply.join(',')}\n`;
const target = path.join(root, 'src/main/resources/formats.properties');
const xmlPath = path.join(root, 'src/main/resources/META-INF/plugin.xml');
let xml = await readFile(xmlPath, 'utf8');
// Common IDE types retain their identity and original editor. Our provider still accepts them.
const registrations = `<!-- generated file types -->\n    <fileType name="Scientific 3D" implementationClass="de.kleinicke.plyvisualizer.PlyFileType" fieldName="INSTANCE" extensions="${ply.join(';')}"/>\n    <!-- end generated file types -->`;
xml = xml.replace(/<!-- generated file types -->[\s\S]*?<!-- end generated file types -->|<fileType name="PLY"[^>]*\/>/, registrations);
const manifest = JSON.stringify({ply, deferred}, null, 2) + '\n';
for (const [file, value] of [[target, data], [xmlPath, xml], [path.join(root,'formats.json'), manifest]]) {
  if (process.argv.includes('--check')) {
    if (await readFile(file,'utf8') !== value) throw new Error(`Stale format registration: ${file}`);
  } else await writeFile(file, value);
}
console.log(`Registered ${ply.length} 3D suffixes; ${Object.keys(deferred).length} deferred.`);
