import * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import type { FileEntry } from '../state/fileEntries';
import type { ObjData, ObjLine } from '../parsers/objParser';

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
    objLines?: ObjLine[];
    objData?: ObjData;
  };
  const tag = (object: THREE.Object3D, materialName?: string) =>
    Object.assign(object, { isObjMesh: true, materialName });
  const lines = (items: ObjLine[]) => {
    const positions = new Float32Array(items.length * 6);
    items.forEach((line, i) => {
      const a = data.vertices[line.start],
        b = data.vertices[line.end];
      positions.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    });
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
      if ((obj.objData?.materialGroups.length ?? 0) > 1) {
        // A hidden wrapper supplies the geometry/transform contract used by selection.
        material.visible = false;
        root = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        for (const part of obj.objData!.materialGroups) {
          if (part.faces.length) {
            const positions: number[] = [],
              indices: number[] = [];
            for (const face of part.faces) {
              if (face.indices.length < 3) {
                continue;
              }
              const offset = positions.length / 3;
              for (const i of face.indices) {
                const v = data.vertices[i];
                positions.push(v.x, v.y, v.z);
              }
              for (let i = 1; i < face.indices.length - 1; i++) {
                indices.push(offset, offset + i, offset + i + 1);
              }
            }
            if (positions.length) {
              const g = own(new THREE.BufferGeometry());
              g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
              g.setIndex(indices);
              g.computeVertexNormals();
              const m = own(
                new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.DoubleSide })
              );
              group.add(tag(new THREE.Mesh(g, m), part.material));
            }
          }
          if (part.lines.length) {
            group.add(tag(lines(part.lines), part.material));
          }
          if (part.points.length) {
            const positions = part.points.flatMap(point => {
              const v = data.vertices[point.index];
              return [v.x, v.y, v.z];
            });
            const g = own(new THREE.BufferGeometry());
            g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
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
        if (obj.objData?.hasNormals) {
          const normals = new Float32Array(data.vertexCount * 3);
          obj.objData.normals
            .slice(0, data.vertexCount)
            .forEach((n, i) => normals.set([n.nx, n.ny, n.nz], i * 3));
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
