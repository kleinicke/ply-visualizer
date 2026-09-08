/** Shared transform setters keep geometry and auxiliary render objects in sync. */
import * as THREE from 'three';
import type { ControlHost } from './agentControls';

export function transformAgentObject(host: ControlHost, a: Record<string, any>) {
  const i = a.object_index;
  if (!host.spatialFiles[i]) {
    throw new Error('Unknown object_index; inspect the scene first');
  }
  const current = host.transformationMatrices[i].clone();
  let delta = new THREE.Matrix4();
  if (a.action === 'reset') {
    // Identity is an absolute reset.
  } else if (a.action === 'invert') {
    if (Math.abs(current.determinant()) < 1e-15) {
      throw new Error('Current transform is singular and cannot be inverted');
    }
    delta.copy(current).invert();
  } else {
    if (a.action === 'matrix') {
      delta.fromArray(a.matrix);
    } else if (a.action === 'translate') {
      delta.makeTranslation(...(a.vector as [number, number, number]));
    } else if (a.action === 'scale') {
      delta.makeScale(...(a.vector as [number, number, number]));
    } else if (a.action === 'rotate') {
      delta.makeRotationAxis(
        new THREE.Vector3().fromArray(a.vector).normalize(),
        THREE.MathUtils.degToRad(a.angle)
      );
    } else if (a.action === 'quaternion') {
      delta.makeRotationFromQuaternion(new THREE.Quaternion().fromArray(a.quaternion).normalize());
    } else {
      throw new Error('Unsupported transform action');
    }
    if (!a.replace) {
      delta = a.space === 'world' ? delta.multiply(current) : current.multiply(delta);
    }
  }
  if (!delta.elements.every(Number.isFinite)) {
    throw new Error('Transform produced non-finite values');
  }
  host.setTransformationMatrix(i, delta);
  host.updateMatrixTextarea(i);
  host.requestRender();
}

export function setAgentCamera(host: ControlHost, a: Record<string, any>) {
  const position = a.position
    ? new THREE.Vector3().fromArray(a.position)
    : host.camera.position.clone();
  const target = a.target ? new THREE.Vector3().fromArray(a.target) : host.controls.target.clone();
  const up = a.up ? new THREE.Vector3().fromArray(a.up).normalize() : host.camera.up.clone();
  if (a.rotation) {
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        ...(a.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
        'XYZ'
      )
    );
    const distance = host.camera.position.distanceTo(host.controls.target);
    target
      .copy(position)
      .add(new THREE.Vector3(0, 0, -Math.max(distance, 0.001)).applyQuaternion(q));
    up.set(0, 1, 0).applyQuaternion(q);
  }
  const direction = target.clone().sub(position);
  if (
    !a.fit &&
    (direction.lengthSq() === 0 ||
      new THREE.Vector3().crossVectors(direction.clone().normalize(), up).lengthSq() < 1e-12)
  ) {
    throw new Error(
      'Camera position and target must differ, and up must not be parallel to the viewing direction'
    );
  }
  host.camera.position.copy(position);
  host.controls.target.copy(target);
  host.camera.up.copy(up);
  if (a.fov !== undefined) {
    host.camera.fov = a.fov;
    host.camera.updateProjectionMatrix();
  }
  host.controls.update();
}
