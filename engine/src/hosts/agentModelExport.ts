/* eslint-disable @typescript-eslint/naming-convention -- MCP wire keys */
import * as THREE from 'three';
import type { ControlHost } from './agentControls';

/** Export native scene models with their skins/clips and ordinary rendered geometry. */
export async function exportAgentModels(host: ControlHost) {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const { clone } = await import('three/examples/jsm/utils/SkeletonUtils.js');
  const scene = new THREE.Scene();
  const animations: THREE.AnimationClip[] = [];
  const names: string[] = [];
  for (const [i, file] of host.spatialFiles.entries()) {
    const object = host.meshes[i];
    if (!object || !host.fileVisibility[i]) {
      continue;
    }
    if (file.isGaussianSplat) {
      throw new Error('GLB export does not support Gaussian splats; hide them first');
    }
    object.updateWorldMatrix(true, true);
    const wrapper = new THREE.Group();
    wrapper.name = file.fileName ?? `Object ${i}`;
    wrapper.matrixAutoUpdate = false;
    wrapper.matrix.copy(object.matrixWorld);
    wrapper.matrix.decompose(wrapper.position, wrapper.quaternion, wrapper.scale);
    if (file.sceneModel) {
      const root = clone(file.sceneModel.root);
      // Animation tracks may address UUIDs. Keep the original identifiers in the
      // detached export tree; the live scene is never reparented or mutated.
      const originals: THREE.Object3D[] = [];
      file.sceneModel.root.traverse(node => originals.push(node));
      let index = 0;
      root.traverse(node => {
        node.uuid = originals[index++].uuid;
      });
      wrapper.add(root);
      for (const original of file.sceneModel.clips) {
        const clip = original.clone();
        for (const track of clip.tracks) {
          const parsed = THREE.PropertyBinding.parseTrackName(track.name);
          const target = THREE.PropertyBinding.findNode(file.sceneModel.root, parsed.nodeName);
          if (
            target instanceof THREE.Object3D &&
            parsed.nodeName &&
            track.name.startsWith(parsed.nodeName)
          ) {
            track.name = target.uuid + track.name.slice(parsed.nodeName.length);
          }
        }
        animations.push(clip);
      }
    } else {
      // Point/mesh children include auxiliary depth, round-point and wireframe
      // passes over the same vertices. Export the geometry once, retaining
      // children only for genuine multi-material groups.
      const geometry = object.clone(object instanceof THREE.Group);
      geometry.matrixAutoUpdate = false;
      geometry.matrix.identity();
      geometry.position.set(0, 0, 0);
      geometry.quaternion.identity();
      geometry.scale.set(1, 1, 1);
      wrapper.add(geometry);
    }
    scene.add(wrapper);
    names.push(wrapper.name);
  }
  if (!names.length) {
    throw new Error('No visible models to export');
  }
  if (animations.length) {
    for (const wrapper of scene.children) {
      const composed = new THREE.Matrix4().compose(
        wrapper.position,
        wrapper.quaternion,
        wrapper.scale
      );
      if (composed.elements.some((v, i) => Math.abs(v - wrapper.matrix.elements[i]) > 1e-6)) {
        throw new Error(
          'Animated GLB cannot represent a sheared object transform; undo the shear before exporting'
        );
      }
    }
  }
  scene.updateMatrixWorld(true);
  const output = await new GLTFExporter().parseAsync(scene, {
    binary: true,
    onlyVisible: true,
    animations,
  });
  if (!(output instanceof ArrayBuffer)) {
    throw new Error('Expected binary GLB export');
  }
  return { bytes: new Uint8Array(output), models: names, animations: animations.length };
}
