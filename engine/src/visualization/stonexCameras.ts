import * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import type { StonexCameraFrameMetadata } from '../parsers/stonexX3aParser';
import { createCameraLabel } from '../cameraProfile';
import { unprojectCameraPixel } from '../depth/cameraModels';
import type { CameraFrameDetail, CameraFrameView } from './cameraFrames';
import { initTiffWasm } from '../depth/readers/tiffWasm';
import { filesState } from '../state/files.svelte';
import {
  applyStonexColorCorrectionToPoints,
  applyStonexColorCorrectionToPreview,
  computeStonexFrameMultipliers,
  normalizeStonexColorCorrection,
  type StonexColorCalibration,
  type StonexColorCorrection,
} from './stonexColorCorrection';

interface StonexCameraHost {
  scene: THREE.Scene;
  spatialFiles: SpatialData[];
  meshes: THREE.Object3D[];
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
// Segments per image axis for the distorted preview. The X300's k1 is around
// -0.485, so the corner rays leave the pinhole model by ~200 px; 16 segments
// keep the residual between grid vertices well under a pixel.
const IMAGE_GRID_SEGMENTS = 16;

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

function pinholePoint(frame: StonexCameraFrameMetadata, u: number, v: number, depth: number) {
  return new THREE.Vector3(
    ((u - frame.cx) / frame.fx) * depth,
    ((v - frame.cy) / frame.fy) * depth,
    depth
  );
}

/**
 * Camera-space position of image pixel (u, v) on the plane z = depth.
 *
 * The distorted variant unprojects through the same OpenCV model the point
 * colouring uses, so the preview covers the pixels the colours actually came
 * from. Rays stay on the constant-z plane: the surface is still flat, only its
 * outline and texture mapping bend.
 */
function imagePoint(
  frame: StonexCameraFrameMetadata,
  u: number,
  v: number,
  depth: number,
  distorted: boolean
): THREE.Vector3 {
  if (!distorted) {
    return pinholePoint(frame, u, v, depth);
  }
  const result = unprojectCameraPixel(
    {
      cameraModel: 'pinhole-opencv',
      fx: frame.fx,
      fy: frame.fy,
      cx: frame.cx,
      cy: frame.cy,
      coefficients: frame.distortionCoefficients,
    },
    [u, v]
  );
  const [x, y, z] = result.value;
  if (!result.valid || !result.converged || !(z > 1e-6)) {
    // Strong polynomials can fail to invert near the corners; the pinhole ray
    // keeps the mesh well-formed instead of folding it through the origin.
    return pinholePoint(frame, u, v, depth);
  }
  const scale = depth / z;
  return new THREE.Vector3(x * scale, y * scale, depth);
}

interface ImageGrid {
  /** (segments + 1)^2 camera-space vertices, row-major from the image's top-left. */
  points: THREE.Vector3[];
  uvs: number[];
  triangles: number[];
  /** Vertex indices tracing the image border, closed back to the first corner. */
  border: number[];
  /** Border indices of the four image corners, top-left first, clockwise. */
  corners: number[];
}

function imageGrid(frame: StonexCameraFrameMetadata, depth: number, distorted: boolean): ImageGrid {
  const segments = distorted ? IMAGE_GRID_SEGMENTS : 1;
  const points: THREE.Vector3[] = [];
  const uvs: number[] = [];
  for (let row = 0; row <= segments; row++) {
    const t = row / segments;
    for (let column = 0; column <= segments; column++) {
      const s = column / segments;
      points.push(imagePoint(frame, s * frame.imageWidth, t * frame.imageHeight, depth, distorted));
      uvs.push(s, t);
    }
  }

  const triangles: number[] = [];
  const index = (row: number, column: number) => row * (segments + 1) + column;
  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
      const a = index(row, column);
      const b = index(row, column + 1);
      const c = index(row + 1, column + 1);
      const d = index(row + 1, column);
      triangles.push(a, b, c, a, c, d);
    }
  }

  const border: number[] = [];
  for (let column = 0; column <= segments; column++) {
    border.push(index(0, column));
  }
  for (let row = 1; row <= segments; row++) {
    border.push(index(row, segments));
  }
  for (let column = segments - 1; column >= 0; column--) {
    border.push(index(segments, column));
  }
  for (let row = segments - 1; row >= 0; row--) {
    border.push(index(row, 0));
  }
  border.push(border[0]);

  return {
    points,
    uvs,
    triangles,
    border,
    corners: [index(0, 0), index(0, segments), index(segments, segments), index(segments, 0)],
  };
}

interface FrameGeometries {
  plane: THREE.BufferGeometry;
  frustum: THREE.BufferGeometry;
}

function createFrameGeometries(
  frame: StonexCameraFrameMetadata,
  distorted: boolean
): FrameGeometries {
  const cameraToModel = cameraToViewer(frame);
  const origin = transformCameraPoint(new THREE.Vector3(), cameraToModel);
  const grid = imageGrid(frame, FRUSTUM_DEPTH_METRES, distorted);
  const vertices = grid.points.map(point => transformCameraPoint(point, cameraToModel).sub(origin));

  const plane = new THREE.BufferGeometry();
  plane.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      vertices.flatMap(vertex => vertex.toArray()),
      3
    )
  );
  // DataTexture row zero is the image's top row, so map it to the top edge.
  plane.setAttribute('uv', new THREE.Float32BufferAttribute(grid.uvs, 2));
  plane.setIndex(grid.triangles);

  const linePoints: THREE.Vector3[] = [];
  for (const corner of grid.corners) {
    linePoints.push(new THREE.Vector3(), vertices[corner]);
  }
  for (let i = 0; i + 1 < grid.border.length; i++) {
    linePoints.push(vertices[grid.border[i]], vertices[grid.border[i + 1]]);
  }
  const frustum = new THREE.BufferGeometry().setFromPoints(linePoints);

  return { plane, frustum };
}

/**
 * Look-through basis for a frame.
 *
 * modelToViewer swaps X and Y, which is a reflection, so the frame's rotation
 * matrix cannot be handed to the viewer camera as-is. Transforming points and
 * deriving the basis from them keeps the result consistent with the geometry
 * that is actually drawn, whatever the handedness.
 */
function frameView(
  frame: StonexCameraFrameMetadata,
  cameraToModel: THREE.Matrix4,
  origin: THREE.Vector3
): CameraFrameView {
  const atPixel = (u: number, v: number) =>
    transformCameraPoint(pinholePoint(frame, u, v, FRUSTUM_DEPTH_METRES), cameraToModel).sub(
      origin
    );
  const topCentre = atPixel(frame.imageWidth / 2, 0);
  const bottomCentre = atPixel(frame.imageWidth / 2, frame.imageHeight);
  return {
    forward: atPixel(frame.imageWidth / 2, frame.imageHeight / 2),
    up: topCentre.sub(bottomCentre).normalize(),
    fovYDegrees: 2 * Math.atan(frame.imageHeight / (2 * frame.fy)) * (180 / Math.PI),
  };
}

function frameDetails(frame: StonexCameraFrameMetadata): CameraFrameDetail[] {
  const coefficients = frame.distortionCoefficients;
  // OpenCV pads to a fixed layout; trailing zeros carry no information.
  const lastSet = coefficients.reduce((last, value, i) => (value !== 0 ? i : last), -1);
  return [
    { label: 'Family', value: frame.type === 'U' ? 'U (upper)' : 'D (lower)' },
    { label: 'Pan', value: `${frame.panDegrees.toFixed(3)}°` },
    { label: 'Image', value: `${frame.imageWidth} x ${frame.imageHeight} px` },
    { label: 'Focal', value: `fx ${frame.fx.toFixed(2)}, fy ${frame.fy.toFixed(2)} px` },
    { label: 'Principal', value: `cx ${frame.cx.toFixed(2)}, cy ${frame.cy.toFixed(2)} px` },
    {
      label: 'Distortion',
      value: coefficients
        .slice(0, Math.max(lastSet + 1, 5))
        .map(value => value.toFixed(6))
        .join(', '),
    },
  ];
}

function createFrameVisualization(
  frame: StonexCameraFrameMetadata,
  frameNumber: number,
  multipliers: Float32Array,
  settings: StonexColorCorrection
): THREE.Group {
  const cameraToModel = cameraToViewer(frame);
  const origin = transformCameraPoint(new THREE.Vector3(), cameraToModel);
  const geometries = createFrameGeometries(frame, false);

  const group = new THREE.Group();
  group.name = `camera_${frame.name}`;
  group.position.copy(origin);
  (group as any).originalPosition = { x: origin.x, y: origin.y, z: origin.z };
  group.userData.frame = frame;
  group.userData.geometries = { pinhole: geometries } as Record<string, FrameGeometries>;
  group.userData.view = frameView(frame, cameraToModel, origin);
  group.userData.frameDetails = frameDetails(frame);

  const helper = new THREE.LineSegments(
    geometries.frustum,
    new THREE.LineBasicMaterial({ color: frame.type === 'U' ? 0x42a5f5 : 0xffa726 })
  );
  helper.name = 'cameraFrustum';
  group.add(helper);

  // previewRgba is raw sensor data; the texture holds the corrected copy so
  // switching modes only rewrites this buffer.
  const rawRgba =
    frame.previewRgba instanceof Uint8Array
      ? frame.previewRgba
      : new Uint8Array(frame.previewRgba as unknown as ArrayBuffer);
  const rgba = new Uint8Array(rawRgba.length);
  applyStonexColorCorrectionToPreview(rawRgba, multipliers, frameNumber, settings, rgba);
  const texture = new THREE.DataTexture(
    rgba,
    frame.previewWidth,
    frame.previewHeight,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  group.userData.frameNumber = frameNumber;
  group.userData.rawPreviewRgba = rawRgba;
  group.userData.previewTexture = texture;

  const plane = new THREE.Mesh(
    geometries.plane,
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
  profile.userData.supportsDistortionToggle = true;
  profile.userData.hasScannerMarker = true;
  profile.userData.excludeFromFit = true;
  profile.userData.cameraCount = frames.length;
  profile.userData.imagesVisible = false;
  // Distortion is the physically correct footprint, so it is the default; the
  // geometry is built on the first setStonexImageDistortion call.
  profile.userData.imagesDistorted = true;
  profile.userData.imageDistortionAvailable = true;
  profile.userData.scannerVisible = true;

  const calibration = data.metadata?.stonexColorCalibration as StonexColorCalibration | undefined;
  const settings = normalizeStonexColorCorrection(
    data.metadata?.stonexColorCorrection as Partial<StonexColorCorrection> | undefined
  );
  profile.userData.colorCalibration = calibration ?? null;
  profile.userData.colorCorrection = settings;
  profile.userData.colorCorrectionAvailable = !!calibration;
  profile.userData.profileName = profileName;
  const multipliers = calibration
    ? computeStonexFrameMultipliers(calibration, settings)
    : new Float32Array(frames.length * 3).fill(1);

  profile.add(createScannerMarker());
  frames.forEach((frame, frameNumber) => {
    profile.add(createFrameVisualization(frame, frameNumber, multipliers, settings));
  });

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

/**
 * Swaps every frame in the profile between the pinhole quad and the mesh
 * unprojected through the calibrated distortion.
 *
 * The distorted geometry needs the Rust/WASM camera kernel, which the webview
 * only initialises on demand, so this is async and caches per frame group.
 * Resolves to the mode actually applied — callers should re-render afterwards
 * and read `userData.imageDistortionAvailable` to reflect a failed kernel.
 */
export async function setStonexImageDistortion(
  group: THREE.Group,
  distorted: boolean
): Promise<boolean> {
  if (distorted && !(await initTiffWasm())) {
    group.userData.imageDistortionAvailable = false;
    group.userData.imagesDistorted = false;
    return false;
  }
  group.userData.imageDistortionAvailable = true;

  for (const child of group.children) {
    const frame = child.userData?.frame as StonexCameraFrameMetadata | undefined;
    if (!frame) {
      continue;
    }
    const cache = (child.userData.geometries ??= {}) as Record<string, FrameGeometries>;
    const key = distorted ? 'distorted' : 'pinhole';
    const geometries = (cache[key] ??= createFrameGeometries(frame, distorted));
    const plane = child.getObjectByName('stonexImagePlane') as THREE.Mesh | undefined;
    const frustum = child.getObjectByName('cameraFrustum') as THREE.LineSegments | undefined;
    if (plane) {
      plane.geometry = geometries.plane;
    }
    if (frustum) {
      frustum.geometry = geometries.frustum;
    }
  }
  group.userData.imagesDistorted = distorted;
  return distorted;
}

/**
 * Re-derives photographic colour for a Stonex profile: the preview thumbnails
 * on the image planes and every point cloud decoded from the same archive.
 *
 * This is a pure channel multiply over the raw arrays the parser retained, so
 * it costs one O(points) pass instead of the ~5 s a re-parse would take. Point
 * colours are mutated in place because `buildOriginalColorArray` shares the
 * parser's `colorsArray` with the GPU attribute zero-copy.
 */
export function setStonexColorCorrection(
  host: StonexCameraHost,
  group: THREE.Group,
  settings: StonexColorCorrection
): void {
  const calibration = group.userData.colorCalibration as StonexColorCalibration | null;
  if (!calibration) {
    return;
  }
  const resolved = normalizeStonexColorCorrection(settings);
  group.userData.colorCorrection = resolved;
  const multipliers = computeStonexFrameMultipliers(calibration, resolved);

  for (const child of group.children) {
    const rawRgba = child.userData?.rawPreviewRgba as Uint8Array | undefined;
    const texture = child.userData?.previewTexture as THREE.DataTexture | undefined;
    if (!rawRgba || !texture) {
      continue;
    }
    applyStonexColorCorrectionToPreview(
      rawRgba,
      multipliers,
      child.userData.frameNumber as number,
      resolved,
      texture.image.data as Uint8Array
    );
    texture.needsUpdate = true;
  }

  const profileName = group.userData.profileName as string | undefined;
  for (let index = 0; index < host.spatialFiles.length; index++) {
    const data = host.spatialFiles[index];
    if (data?.metadata?.stonexCameraProfileName !== profileName) {
      continue;
    }
    const rawColors = data.metadata?.stonexRawColors as Uint8Array | null | undefined;
    const frameIndices = data.metadata?.stonexFrameIndices as Uint16Array | null | undefined;
    if (!rawColors || !frameIndices || !data.colorsArray) {
      continue;
    }
    applyStonexColorCorrectionToPoints(
      rawColors,
      frameIndices,
      multipliers,
      resolved,
      data.colorsArray
    );
    (data.metadata ??= {}).stonexColorCorrection = resolved;

    // Only flag the attribute when it is the shared colorsArray; other colour
    // modes rebuild from it when the user switches back to "original".
    const geometry = (host.meshes[index] as THREE.Mesh | undefined)?.geometry;
    const attribute = geometry?.getAttribute('color');
    if (attribute && (attribute.array as unknown) === data.colorsArray) {
      attribute.needsUpdate = true;
    }
  }
}

export function setStonexScannerVisible(group: THREE.Group, visible: boolean): void {
  group.userData.scannerVisible = visible;
  const marker = group.getObjectByName('stonexScannerMarker');
  if (marker) {
    marker.visible = visible;
  }
}
