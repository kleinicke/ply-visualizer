/* eslint-disable @typescript-eslint/naming-convention -- MCP wire keys */
/** Explicit view conventions and reproducible presentation facts for agents. */
import * as THREE from 'three';
import type { ControlHost } from './agentControls';
import { currentAgentSelection } from './agentInspection';
import { viewerState } from '../state/viewer.svelte';

export function objectPresentation(host: ControlHost, index: number) {
  const materials = new Set<THREE.Material>();
  host.meshes[index]?.traverse(object => {
    const material = (object as THREE.Mesh).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      materials.add(m);
    }
  });
  const opacities = [...new Set([...materials].map(m => m.opacity))];
  const colors = [
    ...new Set(
      [...materials].flatMap(m => {
        const color = (m as THREE.PointsMaterial).color;
        return color ? ['#' + color.getHexString()] : [];
      })
    ),
  ];
  host.meshes[index]?.updateWorldMatrix(true, false);
  return {
    opacity: opacities.length === 1 ? opacities[0] : null,
    material_opacities: opacities,
    material_colors: colors,
    local_to_world: host.meshes[index]?.matrixWorld.toArray() ?? null,
    source_origin: host.spatialFiles[index].sourceOrigin ?? null,
  };
}

export function agentViewState(host: ControlHost) {
  host.camera.updateMatrixWorld(true);
  const direction = host.camera.getWorldDirection(new THREE.Vector3());
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(host.camera.quaternion);
  const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(host.camera.quaternion);
  const target = host.controls.target;
  const canvas = host.renderer.domElement;
  const visible = new THREE.Box3();
  host.meshes.forEach((mesh, index) => {
    if (mesh?.visible && host.fileVisibility[index]) {
      visible.expandByObject(mesh);
    }
  });
  const sceneBackground = host.scene.background;
  const background =
    sceneBackground instanceof THREE.Color
      ? '#' + sceneBackground.getHexString()
      : sceneBackground
        ? null
        : getComputedStyle(canvas).backgroundColor;
  return {
    coordinate_system: {
      handedness: 'right-handed',
      camera_convention: viewerState.cameraConvention,
      default_view: { up_axis: '+Y', camera_forward_axis: '-Z', screen_right_axis: '+X' },
      world_origin: [0, 0, 0],
      world_axes: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
      units: 'source scene units; physical scale is unspecified',
      meters_per_unit: null as number | null,
      matrix_layout: 'column-major; matrices multiply column vectors',
      screen_coordinates: 'normalized canvas XY: top-left [0,0], bottom-right [1,1]',
      note: 'The OpenGL default is Y-up, unlike Blender world Z-up. Source data is not automatically reoriented or scaled. Camera axes below are in world coordinates; object local_to_world includes applied transforms.',
    },
    camera: {
      position: host.camera.position.toArray(),
      target: target.toArray(),
      rotation_center: target.toArray(),
      up: host.camera.up.toArray(),
      view_direction: direction.toArray(),
      screen_right: right.toArray(),
      screen_up: screenUp.toArray(),
      distance_to_rotation_center: host.camera.position.distanceTo(target),
      target_direction: target.clone().sub(host.camera.position).normalize().toArray(),
      projection: 'perspective',
      vertical_fov_degrees: host.camera.fov,
      aspect: host.camera.aspect,
      near: host.camera.near,
      far: host.camera.far,
      zoom: host.camera.zoom,
      world_to_camera: host.camera.matrixWorldInverse.toArray(),
      projection_matrix: host.camera.projectionMatrix.toArray(),
      viewport: {
        css_width: canvas.clientWidth,
        css_height: canvas.clientHeight,
        pixel_width: canvas.width,
        pixel_height: canvas.height,
      },
    },
    presentation: {
      background,
      background_kind:
        sceneBackground && !(sceneBackground instanceof THREE.Color) ? 'texture' : 'color',
      brightness_stops: host.brightnessStops,
      exposure_multiplier: host.renderer.toneMappingExposure,
      settings_ui: document.documentElement.dataset.sessionUi,
    },
    selection: currentAgentSelection(host),
    visible_bounds: visible.isEmpty()
      ? null
      : { min: visible.min.toArray(), max: visible.max.toArray() },
  };
}
