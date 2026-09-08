/* eslint-disable @typescript-eslint/naming-convention -- MCP wire keys */
import * as THREE from 'three';
import type { ControlHost } from './agentControls';
import type { SpatialData } from '../interfaces';
import { worldPoints, type RegistrationHost } from '../registrationFeature';
import { loadRegistrationWasm } from '../registration/wasmLoader';
import { invalidateAgentAttributes } from './agentInspection';

type Comparison = { left: SpatialData; right: SpatialData };
const comparisons = new WeakMap<ControlHost, Comparison>();
export function comparisonState(host: ControlHost) {
  const value = comparisons.get(host);
  if (
    !value ||
    !host.spatialFiles.includes(value.left) ||
    !host.spatialFiles.includes(value.right)
  ) {
    comparisons.delete(host);
    return null;
  }
  return {
    left: host.spatialFiles.indexOf(value.left),
    right: host.spatialFiles.indexOf(value.right),
    linked_camera: true,
    rendering: 'WebGL direct (EDL disabled in split mode)',
  };
}
export function renderAgentComparison(host: ControlHost): boolean {
  const value = comparisonState(host);
  if (!value) {
    return false;
  }
  const renderer = host.renderer as THREE.WebGLRenderer;
  const viewport = renderer.getViewport(new THREE.Vector4());
  const scissor = renderer.getScissor(new THREE.Vector4());
  const scissorTest = renderer.getScissorTest();
  const size = renderer.getSize(new THREE.Vector2());
  const camera = host.camera.clone();
  camera.aspect = host.camera.aspect / 2;
  camera.updateProjectionMatrix();
  const visible = host.meshes.map(mesh => mesh?.visible);
  try {
    renderer.setScissorTest(true);
    for (const [side, index] of [value.left, value.right].entries()) {
      host.meshes.forEach((mesh, i) => {
        if (mesh) {
          mesh.visible = i === index;
        }
      });
      renderer.setViewport((side * size.x) / 2, 0, size.x / 2, size.y);
      renderer.setScissor((side * size.x) / 2, 0, size.x / 2, size.y);
      renderer.render(host.scene, camera);
    }
  } finally {
    host.meshes.forEach((mesh, i) => {
      if (mesh) {
        mesh.visible = visible[i]!;
      }
    });
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
  }
  return true;
}
export async function agentComparison(host: ControlHost, a: Record<string, any>) {
  if (a.action === 'disable') {
    comparisons.delete(host);
    host.requestRender();
    return { comparison: null };
  }
  if (a.action === 'status') {
    return { comparison: comparisonState(host) };
  }
  const left = host.spatialFiles[a.left],
    right = host.spatialFiles[a.right];
  if (!left || !right || left === right) {
    throw new Error('Choose two different loaded object indices');
  }
  if (a.action === 'enable') {
    if (host.rendererBackend !== 'webgl' || left.isGaussianSplat || right.isGaussianSplat) {
      throw new Error(
        'Linked split views currently require WebGL point clouds or meshes, not Gaussian splats'
      );
    }
    comparisons.set(host, { left, right });
    host.requestRender();
    return { comparison: comparisonState(host) };
  }
  if (a.action === 'distance') {
    if (left.faceCount || right.faceCount || left.vertexCount + right.vertexCount > 1000000) {
      throw new Error(
        'Distance coloring supports point clouds with at most 1,000,000 combined points'
      );
    }
    if (a.method === 'paired' && left.vertexCount !== right.vertexCount) {
      throw new Error(
        'Paired error requires equal point counts and corresponding decoded point order'
      );
    }
    const source = worldPoints(host as unknown as RegistrationHost, a.left),
      target = worldPoints(host as unknown as RegistrationHost, a.right);
    if (!source || !target) {
      throw new Error('Comparison requires decoded point geometry');
    }
    const wasm = (await loadRegistrationWasm()) as unknown as {
      point_distances(s: Float32Array, t: Float32Array, r: number, p: boolean): Float32Array;
      scalar_summary(v: Float32Array): string;
    };
    const values = wasm.point_distances(source, target, a.max_distance, a.method === 'paired');
    if (values.length !== left.vertexCount) {
      throw new Error('Could not compute point distances');
    }
    const name = 'agent_distance';
    if (left.scalarFields?.[name] && !left.metadata?.agentDistance) {
      throw new Error('Source already contains agent_distance; refusing to overwrite it');
    }
    left.scalarFields = { ...left.scalarFields, [name]: values };
    left.metadata = { ...left.metadata, agentDistance: true };
    invalidateAgentAttributes(left);
    host.onFileColorModeChange(a.left, `scalar:${name}:viridis`);
    host.updateFileList();
    host.requestRender();
    return {
      field: name,
      object_index: a.left,
      method: a.method,
      units: 'scene world units',
      max_distance: a.method === 'paired' ? null : a.max_distance,
      summary: JSON.parse(wasm.scalar_summary(values)),
      note: 'Nearest-neighbor matches outside max_distance are NaN, not zero. Recompute after transforms or geometry changes.',
    };
  }
  throw new Error('Unknown comparison action');
}
