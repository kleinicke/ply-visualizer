import * as THREE from 'three';
import type { ControlHost } from './agentControls';
import type { SpatialData } from '../interfaces';
const targets = new WeakMap<SpatialData, number>();
export function agentPointSizePixels(file: SpatialData) {
  return targets.get(file) ?? (file.vertexCount < 100 ? 8 : file.vertexCount < 10000 ? 4 : 2);
}
const adaptive = new WeakSet<SpatialData>();
export function agentPointSizeMode(file: SpatialData) {
  return adaptive.has(file) ? 'adaptive' : 'fixed';
}
export function setAgentPointSizeMode(
  host: ControlHost,
  index: number,
  enabled: boolean,
  pixels?: number
) {
  const file = host.spatialFiles[index];
  if (enabled && file.faceCount) {
    throw new Error('Adaptive point sizing requires a point cloud');
  }
  if (pixels !== undefined) {
    targets.set(file, pixels);
  }
  if (enabled) {
    adaptive.add(file);
  } else {
    adaptive.delete(file);
  }
  updateAgentPointSizes(host);
}
export function updateAgentPointSizes(host: ControlHost) {
  host.spatialFiles.forEach((file, i) => {
    const mesh = host.meshes[i];
    if (!adaptive.has(file) || !mesh) {
      return;
    }
    const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    host.camera.updateMatrixWorld(true);
    const distance = Math.max(
      -center.applyMatrix4(host.camera.matrixWorldInverse).z,
      host.camera.near
    );
    const pixels = agentPointSizePixels(file);
    // Three.js PointsMaterial uses viewport height / 2, independent of camera FOV.
    const size = Math.max(
      1e-8,
      (pixels * 2 * distance) / Math.max(1, host.renderer.domElement.clientHeight)
    );
    if (Math.abs(host.pointSizes[i] - size) > Math.max(1e-10, size * 0.01)) {
      host.updatePointSize(i, size);
    }
  });
}
