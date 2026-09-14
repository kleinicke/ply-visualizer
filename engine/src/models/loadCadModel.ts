import * as THREE from 'three';
import { decodeCad } from './cadDecoder';
import type { CadMesh, CadNode, CadDecoder, CadFormat } from './cadTypes';

function materialFor(color?: number[]): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: color
      ? new THREE.Color().setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace)
      : 0xb8bec8,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
}

function createMesh(source: CadMesh): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(source.attributes.position.array, 3));
  geometry.setIndex(new THREE.BufferAttribute(source.index.array, 1));
  if (source.attributes.normal) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(source.attributes.normal.array, 3));
  } else {
    geometry.computeVertexNormals();
  }
  const materials = [materialFor(source.color)];
  let cursor = 0;
  // Face colours override the body colour. Fill gaps with the default material
  // so uncoloured CAD faces never disappear from an otherwise coloured part.
  for (const face of (source.brep_faces || [])
    .filter(face => face.color)
    .sort((a, b) => a.first - b.first)) {
    const start = face.first * 3;
    const end = (face.last + 1) * 3;
    if (start > cursor) {
      geometry.addGroup(cursor, start - cursor, 0);
    }
    materials.push(materialFor(face.color!));
    geometry.addGroup(start, end - start, materials.length - 1);
    cursor = end;
  }
  if (cursor < source.index.array.length) {
    geometry.addGroup(cursor, source.index.array.length - cursor, 0);
  }
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.name = source.name;
  return mesh;
}

export async function loadCadModel(
  bytes: Uint8Array<ArrayBuffer>,
  format: CadFormat,
  decoder: CadDecoder = decodeCad
): Promise<THREE.Group> {
  const result = await decoder(bytes, format);
  const meshes = result.meshes.map(createMesh);
  const build = (node: CadNode): THREE.Group => {
    const group = new THREE.Group();
    group.name = node.name;
    for (const index of node.meshes) {
      group.add(meshes[index].clone());
    }
    for (const child of node.children) {
      group.add(build(child));
    }
    return group;
  };
  const root = build(result.root);
  root.userData.units = format === 'brep' ? 'unspecified' : 'millimeter';
  root.userData.sourceFormat = format.toUpperCase();
  return root;
}
