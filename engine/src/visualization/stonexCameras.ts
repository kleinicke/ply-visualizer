import * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import type { StonexCameraFrameMetadata } from '../parsers/stonexX3aParser';
import { createCameraLabel } from '../cameraProfile';
import { filesState } from '../state/files.svelte';

interface StonexCameraHost {
  scene: THREE.Scene;
  spatialFiles: SpatialData[];
  poseGroups: THREE.Group[];
  cameraGroups: THREE.Group[];
  cameraNames: string[];
  cameraShowLabels: boolean[];
  cameraShowCoords: boolean[];
  fileVisibility: boolean[];
  pointSizes: number[];
  individualColorModes: string[];
  transformationMatrices: THREE.Matrix4[];
}

const FRUSTUM_DEPTH_METRES = 5;

function modelToViewer(point: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(point.y, point.x, point.z);
}

function rowMajorMatrix(values: number[]): THREE.Matrix4 {
  const matrix = new THREE.Matrix4();
  matrix.set(
    values[0],
    values[1],
    values[2],
    values[3],
    values[4],
    values[5],
    values[6],
    values[7],
    values[8],
    values[9],
    values[10],
    values[11],
    values[12],
    values[13],
    values[14],
    values[15]
  );
  return matrix;
}

function cameraToViewer(frame: StonexCameraFrameMetadata): THREE.Matrix4 {
  const pan = new THREE.Matrix4().makeRotationZ(frame.panDegrees * (Math.PI / 180));
  // Projection uses cameraPoint = Model2Camera * Pan * modelPoint.
  return rowMajorMatrix(frame.modelToCamera).multiply(pan).invert();
}

function transformCameraPoint(
  cameraPoint: THREE.Vector3,
  cameraToModel: THREE.Matrix4
): THREE.Vector3 {
  return modelToViewer(cameraPoint.clone().applyMatrix4(cameraToModel));
}

function createScannerMarker(): THREE.Group {
  const marker = new THREE.Group();
  marker.name = 'stonexScannerMarker';

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd54f })
  );
  marker.add(sphere);

  // Model axes after the viewer's X/Y display swap: X->viewer Y,
  // Y->viewer X, Z->viewer Z.
  const positions = new Float32Array([0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 2]);
  const colors = new Float32Array([
    1, 0.2, 0.2, 1, 0.2, 0.2, 0.2, 1, 0.2, 0.2, 1, 0.2, 0.2, 0.4, 1, 0.2, 0.4, 1,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  marker.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true })));
  return marker;
}

function imageCorners(frame: StonexCameraFrameMetadata, depth: number): THREE.Vector3[] {
  return [
    [0, 0],
    [frame.imageWidth, 0],
    [frame.imageWidth, frame.imageHeight],
    [0, frame.imageHeight],
  ].map(
    ([u, v]) =>
      new THREE.Vector3(
        ((u - frame.cx) / frame.fx) * depth,
        ((v - frame.cy) / frame.fy) * depth,
        depth
      )
  );
}

function createFrameVisualization(frame: StonexCameraFrameMetadata): THREE.Group {
  const cameraToModel = cameraToViewer(frame);
  const origin = transformCameraPoint(new THREE.Vector3(), cameraToModel);
  const corners = imageCorners(frame, FRUSTUM_DEPTH_METRES).map(point =>
    transformCameraPoint(point, cameraToModel).sub(origin)
  );

  const group = new THREE.Group();
  group.name = `camera_${frame.name}`;
  group.position.copy(origin);
  (group as any).originalPosition = { x: origin.x, y: origin.y, z: origin.z };

  const linePoints = [
    new THREE.Vector3(),
    corners[0],
    new THREE.Vector3(),
    corners[1],
    new THREE.Vector3(),
    corners[2],
    new THREE.Vector3(),
    corners[3],
    corners[0],
    corners[1],
    corners[1],
    corners[2],
    corners[2],
    corners[3],
    corners[3],
    corners[0],
  ];
  const helperGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
  const helper = new THREE.LineSegments(
    helperGeometry,
    new THREE.LineBasicMaterial({ color: frame.type === 'U' ? 0x42a5f5 : 0xffa726 })
  );
  helper.name = 'cameraFrustum';
  group.add(helper);

  const rgba =
    frame.previewRgba instanceof Uint8Array
      ? frame.previewRgba
      : new Uint8Array(frame.previewRgba as unknown as ArrayBuffer);
  const texture = new THREE.DataTexture(
    rgba,
    frame.previewWidth,
    frame.previewHeight,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const planeGeometry = new THREE.BufferGeometry();
  planeGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      corners.flatMap(corner => corner.toArray()),
      3
    )
  );
  // DataTexture row zero is the image's top row, so map it to the top edge.
  planeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  planeGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  const plane = new THREE.Mesh(
    planeGeometry,
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      // Camera previews are reference imagery. Keep their decoded sRGB values
      // independent of the renderer exposure used by the geometry brightness control.
      toneMapped: false,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    })
  );
  plane.name = 'stonexImagePlane';
  plane.visible = false;
  plane.renderOrder = 2;
  group.add(plane);

  const label = createCameraLabel(frame.name.replace(/\.x3i$/i, ''));
  label.name = 'cameraLabel';
  label.visible = false;
  group.add(label);
  return group;
}

export function addStonexCameraVisualization(host: StonexCameraHost, data: SpatialData): boolean {
  const frames = data.metadata?.stonexCameraFrames as StonexCameraFrameMetadata[] | undefined;
  if (!frames?.length) {
    return false;
  }

  const profileName =
    (data.metadata?.stonexCameraProfileName as string | undefined) || data.fileName || 'X3A';

  const profile = new THREE.Group();
  profile.name = `stonex_cameras_${profileName}`;
  profile.userData.hasImagePlanes = true;
  profile.userData.hasScannerMarker = true;
  profile.userData.excludeFromFit = true;
  profile.userData.cameraCount = frames.length;
  profile.userData.imagesVisible = false;
  profile.userData.scannerVisible = true;
  profile.add(createScannerMarker());
  for (const frame of frames) {
    profile.add(createFrameVisualization(frame));
  }

  host.scene.add(profile);
  host.cameraGroups.push(profile);
  host.cameraNames.push(`${profileName} cameras`);
  host.cameraShowLabels.push(false);
  host.cameraShowCoords.push(false);

  const cameraIndex = host.cameraGroups.length - 1;
  const unifiedIndex = host.spatialFiles.length + host.poseGroups.length + cameraIndex;
  while (host.fileVisibility.length <= unifiedIndex) {
    host.fileVisibility.push(false);
  }
  while (host.pointSizes.length <= unifiedIndex) {
    host.pointSizes.push(1);
  }
  while (host.individualColorModes.length <= unifiedIndex) {
    host.individualColorModes.push('assigned');
  }
  while (filesState.visibility.length <= unifiedIndex) {
    filesState.visibility.push(false);
  }
  while (filesState.pointSizes.length <= unifiedIndex) {
    filesState.pointSizes.push(1);
  }
  while (filesState.colorModes.length <= unifiedIndex) {
    filesState.colorModes.push('assigned');
  }
  host.fileVisibility[unifiedIndex] = true;
  host.pointSizes[unifiedIndex] = 1;
  filesState.visibility[unifiedIndex] = true;
  filesState.pointSizes[unifiedIndex] = 1;
  host.transformationMatrices.push(new THREE.Matrix4());
  return true;
}

export function setStonexImagesVisible(group: THREE.Group, visible: boolean): void {
  group.userData.imagesVisible = visible;
  group.traverse(object => {
    if (object.name === 'stonexImagePlane') {
      object.visible = visible;
    }
  });
}

export function setStonexScannerVisible(group: THREE.Group, visible: boolean): void {
  group.userData.scannerVisible = visible;
  const marker = group.getObjectByName('stonexScannerMarker');
  if (marker) {
    marker.visible = visible;
  }
}
