import * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import { createModelPlayback } from '../state/modelPlayback.svelte';

export class SceneModel {
  readonly ui = createModelPlayback();
  readonly mixer: THREE.AnimationMixer;
  private action?: THREE.AnimationAction;
  private lastUiUpdate = 0;
  constructor(
    readonly root: THREE.Object3D,
    readonly clips: THREE.AnimationClip[],
    readonly warnings: string[],
    private releaseResources: () => void
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    this.selectClip(0);
  }
  selectClip(index: number): void {
    this.mixer.stopAllAction();
    this.ui.clip = index;
    this.ui.time = 0;
    const clip = this.clips[index];
    this.ui.duration = clip?.duration || 0;
    this.action = clip ? this.mixer.clipAction(clip) : undefined;
    this.action?.reset().play();
    this.mixer.setTime(0);
    this.root.updateMatrixWorld(true);
  }
  seek(time: number): void {
    this.ui.time = Math.max(0, Math.min(time, this.ui.duration));
    if (this.action) {
      this.action.paused = false;
      this.action.time = this.ui.time;
    }
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
  }
  update(delta: number): boolean {
    if (!this.ui.playing || !this.action) {
      return false;
    }
    this.action.setLoop(
      this.ui.loop ? THREE.LoopRepeat : THREE.LoopOnce,
      this.ui.loop ? Infinity : 1
    );
    this.action.clampWhenFinished = true;
    this.action.paused = false;
    this.mixer.update(delta * this.ui.speed);
    this.root.updateMatrixWorld(true);
    this.root.traverse(object => {
      if (object instanceof THREE.SkinnedMesh) {
        object.computeBoundingSphere();
      }
    });
    const now = performance.now();
    if (now - this.lastUiUpdate > 60 || this.action.paused) {
      this.ui.time = this.action.time;
      this.lastUiUpdate = now;
    }
    if (!this.ui.loop && this.action.paused) {
      this.ui.playing = false;
    }
    return true;
  }
  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    this.root.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) {
        geometries.add(mesh.geometry);
      }
      for (const material of mesh.material
        ? Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]
        : []) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) {
            textures.add(value);
          }
        }
      }
      if (object instanceof THREE.SkinnedMesh) {
        object.skeleton.dispose();
      }
    });
    for (const texture of textures) {
      texture.dispose();
      const bitmap = texture.source.data;
      if (typeof ImageBitmap !== 'undefined' && bitmap instanceof ImageBitmap) {
        bitmap.close();
      }
    }
    for (const material of materials) {
      material.dispose();
    }
    for (const geometry of geometries) {
      geometry.dispose();
    }
    this.releaseResources();
  }
}

/** Snapshot geometry supplies existing statistics and initial bounds. The original
 * scene remains intact and is the only visible/raycastable representation. */
export function modelSpatialData(model: SceneModel, fileName: string, size: number): SpatialData {
  const positions: number[] = [];
  let faces = 0;
  const point = new THREE.Vector3();
  model.root.updateMatrixWorld(true);
  model.root.traverse(object => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Points)) {
      return;
    }
    const attribute = object.geometry.getAttribute('position');
    if (!attribute) {
      return;
    }
    for (let i = 0; i < attribute.count; i++) {
      if (object instanceof THREE.Mesh) {
        object.getVertexPosition(i, point);
      } else {
        point.fromBufferAttribute(attribute, i);
      }
      point.applyMatrix4(object.matrixWorld);
      positions.push(point.x, point.y, point.z);
    }
    if (object instanceof THREE.Mesh) {
      faces += (object.geometry.index?.count || attribute.count) / 3;
    }
  });
  if (!positions.length) {
    model.dispose();
    throw new Error('The model contains no mesh or point geometry.');
  }
  return {
    vertices: [],
    faces: [],
    positionsArray: new Float32Array(positions),
    useTypedArrays: true,
    vertexCount: positions.length / 3,
    faceCount: Math.floor(faces),
    hasColors: false,
    hasNormals: false,
    format: 'binary_little_endian',
    version: '1.0',
    comments: [],
    fileName,
    fileSizeInBytes: size,
    sceneModel: model,
  };
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

export function updateModelPlayback(
  host: { spatialFiles: SpatialData[]; fileVisibility: boolean[]; requestRender(): void },
  delta: number
): void {
  host.spatialFiles.forEach((data, index) => {
    if (host.fileVisibility[index] && data.sceneModel?.update(delta)) {
      host.requestRender();
    }
  });
}
