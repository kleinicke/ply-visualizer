/** Agent operations call the same renderer/managers as the interactive UI. */
import * as THREE from 'three';
import type Viewer from '../main';
import type { MeasurementManager } from '../MeasurementManager';
import type { SelectionManager } from '../SelectionManager';
import { viewerState } from '../state/viewer.svelte';
import { setRotationCenter, setRotationCenterToOrigin } from '../rotationCenterFeature';
import { updateMeshVisibilityAndMaterial, type RenderModeHost } from '../renderModeToggles';
import { filmState } from '../state/film.svelte';

export type ControlHost = Viewer;
export function fitAgentView(
  host: {
    camera: THREE.PerspectiveCamera;
    controls: { target: THREE.Vector3; update(): void };
    meshes: (THREE.Object3D | null)[];
  },
  preset?: string
) {
  const box = new THREE.Box3();
  host.meshes.forEach(mesh => {
    if (mesh?.visible) {
      box.expandByObject(mesh);
    }
  });
  if (box.isEmpty()) {
    throw new Error('No visible geometry to fit');
  }
  const center = box.getCenter(new THREE.Vector3());
  const directions: Record<string, number[]> = {
    front: [0, 0, 1],
    back: [0, 0, -1],
    top: [0, 1, 0],
    bottom: [0, -1, 0],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    isometric: [1, 1, 1],
  };
  const direction = preset
    ? new THREE.Vector3().fromArray(directions[preset])
    : host.camera.position.clone().sub(host.controls.target).normalize();
  if (direction.lengthSq() === 0) {
    direction.set(0, 0, 1);
  }
  if (preset) {
    host.camera.up.set(
      0,
      preset === 'top' || preset === 'bottom' ? 0 : 1,
      preset === 'top' ? -1 : preset === 'bottom' ? 1 : 0
    );
  }
  host.camera.position.copy(center).add(direction);
  host.camera.lookAt(center);
  const inverse = host.camera.quaternion.clone().invert();
  const tanV = Math.tan(THREE.MathUtils.degToRad(host.camera.fov / 2));
  const tanH = tanV * host.camera.aspect;
  let distance = 0;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, y, z).sub(center).applyQuaternion(inverse);
        distance = Math.max(distance, p.z + Math.abs(p.x) / tanH, p.z + Math.abs(p.y) / tanV);
      }
    }
  }
  distance = Math.max(distance * 1.1, 0.01);
  host.camera.position.copy(center).addScaledVector(direction.normalize(), distance);
  host.controls.target.copy(center);
  host.camera.near = Math.max(distance / 10000, 0.000001);
  host.camera.far = Math.max(distance * 100, 1);
  host.camera.updateProjectionMatrix();
  host.controls.update();
}

export async function applyAgentControl(
  host: ControlHost,
  operation: string,
  a: Record<string, any>
) {
  if (operation === 'navigate') {
    if (a.action === 'fit' || a.action === 'preset') {
      fitAgentView(host, a.preset);
    } else if (a.action === 'orbit') {
      const delta = host.camera.position.clone().sub(host.controls.target);
      delta.applyAxisAngle(
        host.camera.up.clone().normalize(),
        THREE.MathUtils.degToRad(a.yaw ?? 0)
      );
      const right = new THREE.Vector3().crossVectors(host.camera.up, delta).normalize();
      delta.applyAxisAngle(right, THREE.MathUtils.degToRad(a.pitch ?? 0));
      host.camera.position.copy(host.controls.target).add(delta);
    } else if (a.action === 'pan') {
      const delta = new THREE.Vector3().fromArray(a.vector);
      host.camera.position.add(delta);
      host.controls.target.add(delta);
    } else if (a.action === 'zoom') {
      host.camera.position
        .sub(host.controls.target)
        .multiplyScalar(a.factor)
        .add(host.controls.target);
    } else if (a.action === 'origin') {
      setRotationCenterToOrigin(host);
    } else if (a.action === 'pivot') {
      setRotationCenter(host, new THREE.Vector3().fromArray(a.vector));
    } else if (a.action === 'pick') {
      const picker = host as unknown as {
        selectionManager: SelectionManager;
        getSelectionContext(): any;
      };
      picker.selectionManager.updateContext(picker.getSelectionContext());
      const canvas = host.renderer.domElement;
      const point = await picker.selectionManager.selectPointWithLoggingAsync(
        a.screen[0] * canvas.clientWidth,
        a.screen[1] * canvas.clientHeight,
        canvas
      );
      if (!point) {
        throw new Error('No geometry at that screen position');
      }
      setRotationCenter(host, point.point);
    }
    host.controls.update();
  } else if (operation === 'appearance') {
    if (a.brightness !== undefined) {
      host.brightnessStops = a.brightness;
      viewerState.brightnessStops = a.brightness;
      host.renderer.toneMapping = THREE.LinearToneMapping;
      host.renderer.toneMappingExposure = 2 ** a.brightness;
    }
    if (a.background !== undefined) {
      host.scene.background = null;
      host.renderer.setClearColor(0, 0);
      host.renderer.domElement.style.backgroundColor = a.background;
    }
  } else if (operation === 'object') {
    const i = a.object_index,
      data = host.spatialFiles[i];
    if (!data) {
      throw new Error('Unknown object_index; inspect the scene first');
    }
    if (a.mode === 'mesh' && !data.faceCount) {
      throw new Error('This object has no mesh faces');
    }
    if (a.color_mode === 'original' && !data.hasColors) {
      throw new Error('Object has no original RGB colors');
    }
    if (a.color_mode?.startsWith('scalar:') && !data.scalarFields?.[a.color_mode.split(':')[1]]) {
      throw new Error('Unknown scalar field');
    }
    if (a.point_size !== undefined) {
      host.updatePointSize(i, a.point_size);
    }
    if (a.visible !== undefined) {
      host.setFileEntryVisibility(i, a.visible);
    }
    if (a.mode !== undefined) {
      host.solidVisible[i] = a.mode === 'mesh';
      host.wireframeVisible[i] = false;
      host.pointsVisible[i] = a.mode === 'points';
    }
    if (a.color !== undefined) {
      const c = new THREE.Color(a.color);
      const index = host.fileColors.push([c.r, c.g, c.b]) - 1;
      host.onFileColorModeChange(i, String(index));
    } else if (a.color_mode !== undefined) {
      host.onFileColorModeChange(i, a.color_mode);
    }
    updateMeshVisibilityAndMaterial(host as unknown as RenderModeHost, i);
    host.updateFileList();
  } else if (operation === 'measure') {
    const manager = (host as unknown as { measurementManager: MeasurementManager })
      .measurementManager;
    if (a.action === 'distance') {
      manager.addMeasurement(
        new THREE.Vector3().fromArray(a.start),
        new THREE.Vector3().fromArray(a.end)
      );
    }
    if (a.action === 'path_point') {
      manager.addPathPoint(new THREE.Vector3().fromArray(a.end));
    }
    if (a.action === 'clear') {
      manager.clearAll();
      manager.clearAllPaths();
    }
    if (a.action === 'undo') {
      manager.undoLastPathPoint();
    }
    if (a.action === 'close_path') {
      manager.togglePathClosed();
    }
    host.requestRender();
    return {
      distances: manager.getMeasurements().map(m => ({
        start: m.startPoint.toArray(),
        end: m.endPoint.toArray(),
        distance: m.distance,
      })),
      paths: JSON.parse(manager.buildPathProjectJson()),
      units: 'scene units',
    };
  } else if (operation === 'video') {
    const film = host.filmManager;
    if (!film) {
      throw new Error('Video manager unavailable');
    }
    if (a.action === 'add') {
      film.addKeyframeFromCamera();
    }
    if (a.action === 'remove' || a.action === 'goto' || a.action === 'update') {
      if (!film.getKeyframes()[a.index]) {
        throw new Error('Unknown keyframe index');
      }
      if (a.action === 'remove') {
        film.removeKeyframe(a.index);
      }
      if (a.action === 'goto') {
        film.goToKeyframe(a.index);
      }
      if (a.action === 'update') {
        film.updateKeyframe(a.index, {
          ...(a.duration !== undefined ? { duration: a.duration } : {}),
          ...(a.dwell !== undefined ? { dwell: a.dwell } : {}),
        });
      }
    }
    if (a.action === 'loop' && a.enabled !== filmState.loop) {
      film.toggleLoop();
    }
    if (a.action === 'play') {
      if (film.getKeyframes().length < 2) {
        throw new Error('Add at least two keyframes');
      }
      film.play();
    }
    if (a.action === 'stop') {
      film.stop();
    }
    return { keyframes: film.getKeyframes(), playing: film.isPlaying(), loop: filmState.loop };
  } else {
    throw new Error('Unsupported agent operation');
  }
  host.requestRender();
}
