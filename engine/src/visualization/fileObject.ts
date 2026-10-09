import * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import type { FileEntry } from '../state/fileEntries';
import { objFaceCorners, objTriangleStarts, type ObjFileData } from '../formats/meshSpatialData';

import { createOptimizedPointCloud } from './PointCloudRenderer';

export type FileObject = THREE.Mesh | THREE.Points | THREE.LineSegments;
export interface FileObjectHost {
  allowTransparency: boolean;
  createGeometryFromSpatialData(data: SpatialData, colorMode?: string): THREE.BufferGeometry;
  createMaterialForFile(
    data: SpatialData,
    index: number,
    state?: FileEntry['state']
  ): THREE.Material;
}

/** One traversal per removal; auxiliary views can share geometry/materials. */
export function disposeObjects(objects: (THREE.Object3D | null | undefined)[]): void {
  const resources = new Set<{ dispose(): void }>();
  for (const root of objects) {
    root?.removeFromParent();
    root?.traverse(object => {
      if (!(
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.Line ||
        object instanceof THREE.Sprite
      )) {
        return;
      }
      if (!(object instanceof THREE.Sprite)) {
        resources.add(object.geometry);
      }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(material);
        // alphaMap is the renderer's shared round-point mask, not entry-owned.
        const map = (material as THREE.MeshBasicMaterial).map;
        if (map) {
          resources.add(map);
        }
      }
    });
  }
  for (const resource of resources) {
    resource.dispose();
  }
}

export function disposeFileResources(
  entry: FileEntry,
  object: THREE.Object3D | undefined,
  data?: SpatialData
): void {
  // Native scenes own their textures and animation resources separately.
  data?.sceneModel?.dispose();
  data?.sceneModel?.root.removeFromParent();
  const { normals, vertexPoints, materialGroup } = entry.resources;
  disposeObjects([object, normals, vertexPoints, materialGroup]);
}

/** Builds off-scene. Every allocation is owned here until the caller commits it. */
export function buildFileObject(
  host: FileObjectHost,
  data: SpatialData,
  index: number,
  entry: FileEntry
): FileObject {
  const allocated = new Set<THREE.BufferGeometry | THREE.Material>();
  const own = <T extends THREE.BufferGeometry | THREE.Material>(value: T): T => {
    allocated.add(value);
    return value;
  };
  const obj = data as SpatialData & {
    isObjFile?: boolean;
    isObjWireframe?: boolean;
    objRenderType?: string;
    objLines?: Uint32Array;
    objData?: ObjFileData;
  };
  const tag = (object: THREE.Object3D, materialName?: string) =>
    Object.assign(object, { isObjMesh: true, materialName });
  const source = data.positionsArray!;
  // Segment ids index pairs in `pairs` (the OBJ's line list).
  const lines = (pairs: Uint32Array, segments?: Uint32Array) => {
    const count = segments ? segments.length : pairs.length / 2;
    const positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const segment = segments ? segments[i] : i;
      const a = pairs[segment * 2] * 3;
      const b = pairs[segment * 2 + 1] * 3;
      positions.set(source.subarray(a, a + 3), i * 6);
      positions.set(source.subarray(b, b + 3), i * 6 + 3);
    }
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.LineSegments(geometry, own(new THREE.LineBasicMaterial({ color: 0xff0000 })));
  };
  try {
    const geometry = own(host.createGeometryFromSpatialData(data, entry.state.colorMode));
    const material = own(host.createMaterialForFile(data, index, entry.state));
    let root: FileObject;
    if (data.sceneModel) {
      root = createModelObject(data, geometry, material);
    } else if ((obj.isObjWireframe || obj.objRenderType === 'wireframe') && obj.objLines) {
      root = lines(obj.objLines);
    } else if (obj.isObjFile && obj.objRenderType === 'mesh' && data.faceCount > 0) {
      const objData = obj.objData!;
      if (objData.materialGroups.length > 1) {
        // A hidden wrapper supplies the geometry/transform contract used by selection.
        material.visible = false;
        root = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        const triangleStarts = objTriangleStarts(objData);
        for (const part of objData.materialGroups) {
          if (part.faces.length) {
            // Each polygon gets its own corners, fanned as in the file.
            const positions: number[] = [],
              indices: number[] = [];
            for (const face of part.faces) {
              const corners = objFaceCorners(objData, triangleStarts, face);
              const offset = positions.length / 3;
              for (const i of corners) {
                positions.push(source[i * 3], source[i * 3 + 1], source[i * 3 + 2]);
              }
              for (let i = 1; i < corners.length - 1; i++) {
                indices.push(offset, offset + i, offset + i + 1);
              }
            }
            const g = own(new THREE.BufferGeometry());
            g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            g.setIndex(indices);
            g.computeVertexNormals();
            const m = own(new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.DoubleSide }));
            group.add(tag(new THREE.Mesh(g, m), part.material));
          }
          if (part.lines.length) {
            group.add(tag(lines(objData.lineIndices, part.lines), part.material));
          }
          if (part.points.length) {
            const positions = new Float32Array(part.points.length * 3);
            part.points.forEach((point, i) => {
              const v = objData.pointIndices[point] * 3;
              positions.set(source.subarray(v, v + 3), i * 3);
            });
            const g = own(new THREE.BufferGeometry());
            g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const m = own(
              new THREE.PointsMaterial({
                color: 0xff0000,
                size: entry.state.pointSize,
                sizeAttenuation: true,
                transparent: host.allowTransparency,
                alphaTest: host.allowTransparency ? 0.1 : 0,
                side: THREE.DoubleSide,
              })
            );
            group.add(tag(new THREE.Points(g, m), part.material));
          }
        }
        Object.assign(group, { isObjMesh: true, isMultiMaterial: true });
        root.add(group);
        entry.resources.materialGroup = group;
        entry.resources.materialMeshes = [...group.children];
      } else {
        const m = own(
          new THREE.MeshBasicMaterial({
            color: 0x808080,
            side: THREE.DoubleSide,
            vertexColors: data.hasColors,
          })
        );
        if (objData.normalsArray) {
          // The viewer has always paired the n-th `vn` with the n-th vertex.
          const normals = new Float32Array(data.vertexCount * 3);
          normals.set(objData.normalsArray.subarray(0, normals.length));
          geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        }
        root = new THREE.Mesh(geometry, m);
        tag(root);
      }
    } else {
      root =
        data.faceCount > 0
          ? new THREE.Mesh(geometry, material)
          : createOptimizedPointCloud(geometry, material as THREE.PointsMaterial);
    }
    // Discard allocations superseded by a specialized OBJ representation.
    root.traverse(object => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.Line
      ) {
        allocated.delete(object.geometry);
        for (const m of Array.isArray(object.material) ? object.material : [object.material]) {
          allocated.delete(m);
        }
      }
    });
    for (const resource of allocated) {
      resource.dispose();
    }
    return root;
  } catch (error) {
    for (const resource of allocated) {
      resource.dispose();
    }
    data.sceneModel?.dispose();
    throw error;
  }
}

export function createModelObject(
  data: SpatialData,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[]
): THREE.Mesh {
  // An invisible Mesh parent keeps the established geometry/bounds/transform
  // interface; its native scene children retain their own materials and skins.
  for (const entry of Array.isArray(material) ? material : [material]) {
    entry.visible = false;
  }
  const wrapper = new THREE.Mesh(geometry, material);
  wrapper.raycast = () => {};
  wrapper.userData.sceneModel = true;
  wrapper.add(data.sceneModel!.root);
  return wrapper;
}
