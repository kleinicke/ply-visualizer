import * as THREE from 'three';
import { createCameraBodyGeometry, createCameraLabel } from '../cameraProfile';
import { unprojectCameraPixel } from '../depth/cameraModels';
import { initTiffWasm, projectCameraPointsWasmSync } from '../depth/readers/tiffWasm';
import type { E57EmbeddedImage, SpatialData } from '../interfaces';
import { filesState } from '../state/files.svelte';
import type { CameraFrameDetail, CameraFrameView } from './cameraFrames';
import {
  correctUnprojectedRay,
  correctionMatrixForProjection,
  describeE57ImageCorrection,
  DEFAULT_E57_IMAGE_CORRECTION,
  normalizeE57ImageCorrection,
  type E57ImageCorrection,
} from './e57ImageCorrection';

interface E57CameraHost {
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
  meshes: THREE.Object3D[];
  applyColorModeToGeometry(
    data: SpatialData,
    geometry: THREE.BufferGeometry,
    colorMode: string
  ): void;
  createMaterialForFile(data: SpatialData, fileIndex: number): THREE.Material;
  requestRender(): void;
}

const PREVIEW_SCALE = 0.5;
const SURFACE_DISTANCE = 3;

function createScannerMarker(data: SpatialData): THREE.Group {
  const marker = new THREE.Group();
  marker.name = 'stonexScannerMarker';
  const pose = (data.metadata?.pose as number[] | undefined) ?? [0, 0, 0, 1, 0, 0, 0];
  const origin = data.sourceOrigin ?? [0, 0, 0];
  marker.position.set(pose[0] - origin[0], pose[1] - origin[1], pose[2] - origin[2]);
  marker.quaternion.set(pose[4], pose[5], pose[6], pose[3]).normalize();
  marker.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd54f })
    )
  );
  marker.add(new THREE.AxesHelper(0.8));
  return marker;
}

function registerCameraGroup(host: E57CameraHost, profile: THREE.Group, name: string): void {
  host.scene.add(profile);
  host.cameraGroups.push(profile);
  host.cameraNames.push(name);
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
  filesState.visibility[unifiedIndex] = true;
  host.transformationMatrices.push(new THREE.Matrix4());
}

function imagePose(
  image: E57EmbeddedImage,
  origin: readonly number[]
): {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
} {
  const [tx, ty, tz, qw, qx, qy, qz] = image.pose;
  return {
    position: new THREE.Vector3(tx - origin[0], ty - origin[1], tz - origin[2]),
    quaternion: new THREE.Quaternion(qx, qy, qz, qw).normalize(),
  };
}

function localImagePoint(
  image: E57EmbeddedImage,
  u: number,
  v: number,
  correction: E57ImageCorrection = DEFAULT_E57_IMAGE_CORRECTION
): THREE.Vector3 | null {
  const result = unprojectCameraPixel(
    {
      cameraModel: image.cameraModel!,
      fx: image.fx!,
      fy: image.fy!,
      cx: image.cx!,
      cy: image.cy!,
      coefficients: [],
    },
    [u, v]
  );
  if (!result.valid || !result.converged) {
    return null;
  }
  const point = new THREE.Vector3(...result.value);
  correctUnprojectedRay(point, correction, image.representation);
  if (image.representation === 'pinhole') {
    if (point.z >= -1e-8) {
      return null;
    }
    point.multiplyScalar(SURFACE_DISTANCE / -point.z);
  } else if (image.representation === 'cylindrical') {
    const rho = Math.hypot(point.x, point.y);
    if (rho <= 1e-8) {
      return null;
    }
    point.multiplyScalar(SURFACE_DISTANCE / rho);
  } else {
    point.multiplyScalar(SURFACE_DISTANCE);
  }
  return point;
}

/**
 * Look-through basis, derived from the projection itself rather than assumed:
 * E57 pinhole images look along local -Z, and the panoramic representations
 * have no single forward axis of their own.
 */
function imageView(
  image: E57EmbeddedImage,
  correction: E57ImageCorrection
): CameraFrameView | undefined {
  const centre = localImagePoint(image, image.width / 2, image.height / 2, correction);
  const top = localImagePoint(image, image.width / 2, 0, correction);
  const bottom = localImagePoint(image, image.width / 2, image.height, correction);
  if (!centre || !top || !bottom) {
    return undefined;
  }
  const up = top.sub(bottom).normalize();
  // Only a pinhole frame has corners worth framing; a panorama wraps past the
  // viewport whatever the field of view.
  const corners =
    image.representation === 'pinhole'
      ? [
          [0, 0],
          [image.width, 0],
          [image.width, image.height],
          [0, image.height],
        ]
          .map(([u, v]) => localImagePoint(image, u, v, correction))
          .filter((point): point is THREE.Vector3 => !!point)
      : undefined;
  return {
    forward: centre,
    up: up.lengthSq() > 0 ? up : new THREE.Vector3(0, 1, 0),
    fovYDegrees:
      image.representation === 'pinhole' && image.fy
        ? 2 * Math.atan(image.height / (2 * image.fy)) * (180 / Math.PI)
        : undefined,
    corners: corners?.length === 4 ? corners : undefined,
  };
}

function createE57CameraBody(image: E57EmbeddedImage, correction: E57ImageCorrection): THREE.Mesh {
  const body = createCameraBodyGeometry();
  const imageCentre = localImagePoint(image, image.width / 2, image.height / 2, correction);
  if (imageCentre?.lengthSq()) {
    // The shared icon is authored looking along local +Z. E57 does not use a
    // single generic camera forward axis: pinhole looks along -Z, while the
    // centre of spherical/cylindrical images is azimuth 0 along +X. Point the
    // icon along the centre ray produced by the actual E57 projection.
    body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), imageCentre.normalize());
  }
  return body;
}

function imageDetails(
  image: E57EmbeddedImage,
  correction: E57ImageCorrection
): CameraFrameDetail[] {
  const details: CameraFrameDetail[] = [
    { label: 'Representation', value: image.representation },
    { label: 'Image', value: `${image.width} x ${image.height} px` },
  ];
  if (image.fx && image.fy) {
    details.push({
      label: 'Focal',
      value: `fx ${image.fx.toFixed(2)}, fy ${image.fy.toFixed(2)} px`,
    });
  }
  if (image.cx !== undefined && image.cy !== undefined) {
    details.push({
      label: 'Principal',
      value: `cx ${image.cx.toFixed(2)}, cy ${image.cy.toFixed(2)} px`,
    });
  }
  const [, , , qw, qx, qy, qz] = image.pose;
  details.push({
    label: 'Rotation',
    value: `w ${qw.toFixed(5)}, x ${qx.toFixed(5)}, y ${qy.toFixed(5)}, z ${qz.toFixed(5)}`,
  });
  details.push({
    label: 'Alignment correction',
    value: describeE57ImageCorrection(correction, image.representation),
  });
  if (image.sensorModel || image.sensorVendor) {
    details.push({
      label: 'Sensor',
      value: [image.sensorVendor, image.sensorModel].filter(Boolean).join(' '),
    });
  }
  return details;
}

function createProjectionGeometry(
  image: E57EmbeddedImage,
  correction: E57ImageCorrection
): {
  surface: THREE.BufferGeometry;
  frustum: THREE.BufferGeometry;
} {
  const columns = image.representation === 'pinhole' ? 1 : 32;
  const rows = image.representation === 'pinhole' ? 1 : 16;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const s = column / columns;
      const t = row / rows;
      const point =
        localImagePoint(image, s * image.width, t * image.height, correction) ??
        new THREE.Vector3();
      positions.push(point.x, point.y, point.z);
      uvs.push(s, 1 - t);
    }
  }
  const at = (row: number, column: number) => row * (columns + 1) + column;
  const indices: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = at(row, column);
      const b = at(row, column + 1);
      const c = at(row + 1, column + 1);
      const d = at(row + 1, column);
      indices.push(a, b, c, a, c, d);
    }
  }
  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  surface.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  surface.setIndex(indices);

  const borderIndices: number[] = [];
  for (let column = 0; column <= columns; column++) {
    borderIndices.push(at(0, column));
  }
  for (let row = 1; row <= rows; row++) {
    borderIndices.push(at(row, columns));
  }
  for (let column = columns - 1; column >= 0; column--) {
    borderIndices.push(at(rows, column));
  }
  for (let row = rows - 1; row >= 0; row--) {
    borderIndices.push(at(row, 0));
  }
  borderIndices.push(borderIndices[0]);
  const source = surface.getAttribute('position');
  const linePoints: THREE.Vector3[] = [];
  for (const corner of [at(0, 0), at(0, columns), at(rows, columns), at(rows, 0)]) {
    linePoints.push(new THREE.Vector3(), new THREE.Vector3().fromBufferAttribute(source, corner));
  }
  for (let index = 0; index + 1 < borderIndices.length; index++) {
    linePoints.push(
      new THREE.Vector3().fromBufferAttribute(source, borderIndices[index]),
      new THREE.Vector3().fromBufferAttribute(source, borderIndices[index + 1])
    );
  }
  return { surface, frustum: new THREE.BufferGeometry().setFromPoints(linePoints) };
}

async function decodeHalfResolutionTexture(image: E57EmbeddedImage): Promise<{
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
}> {
  const encoded = new Uint8Array(image.data.byteLength);
  encoded.set(image.data);
  const bitmap = await createImageBitmap(new Blob([encoded.buffer], { type: image.mimeType }));
  const width = Math.max(1, Math.round(bitmap.width * PREVIEW_SCALE));
  const height = Math.max(1, Math.round(bitmap.height * PREVIEW_SCALE));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: !!image.mask });
  if (!context) {
    throw new Error('Could not create E57 preview canvas');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  if (image.mask) {
    const encodedMask = new Uint8Array(image.mask.byteLength);
    encodedMask.set(image.mask);
    const maskBitmap = await createImageBitmap(
      new Blob([encodedMask.buffer], { type: 'image/png' })
    );
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
    maskContext?.drawImage(maskBitmap, 0, 0, width, height);
    maskBitmap.close();
    if (maskContext) {
      const rgba = context.getImageData(0, 0, width, height);
      const mask = maskContext.getImageData(0, 0, width, height).data;
      for (let offset = 0; offset < rgba.data.length; offset += 4) {
        rgba.data[offset + 3] = mask[offset] || mask[offset + 1] || mask[offset + 2] ? 255 : 0;
      }
      context.putImageData(rgba, 0, 0);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, canvas };
}

function viewerToImageTransform(
  image: E57EmbeddedImage,
  origin: readonly number[],
  correction: E57ImageCorrection
): number[] {
  const [tx, ty, tz, qw, qx, qy, qz] = image.pose;
  const imageToFile = new THREE.Matrix4().compose(
    new THREE.Vector3(tx, ty, tz),
    new THREE.Quaternion(qx, qy, qz, qw).normalize(),
    new THREE.Vector3(1, 1, 1)
  );
  // The same correction the drawn plane gets, so sampled colours and the
  // surface in the scene share one mapping. It applies after the pose, in the
  // projection direction (localImagePoint corrects the opposite way).
  const transform = correctionMatrixForProjection(correction, image.representation)
    .multiply(imageToFile.invert())
    .multiply(new THREE.Matrix4().makeTranslation(origin[0], origin[1], origin[2]));
  const e = transform.elements;
  return [
    e[0],
    e[4],
    e[8],
    e[12],
    e[1],
    e[5],
    e[9],
    e[13],
    e[2],
    e[6],
    e[10],
    e[14],
    e[3],
    e[7],
    e[11],
    e[15],
  ];
}

function sampleBilinear(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): number[] {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  const offsets = [
    (y0 * width + x0) * 4,
    (y0 * width + x1) * 4,
    (y1 * width + x0) * 4,
    (y1 * width + x1) * 4,
  ];
  const result = [0, 0, 0, 0];
  for (let sample = 0; sample < 4; sample++) {
    for (let channel = 0; channel < 4; channel++) {
      result[channel] += rgba[offsets[sample] + channel] * weights[sample];
    }
  }
  return result;
}

async function colorPointCloudFromImages(
  host: E57CameraHost,
  data: SpatialData,
  decoded: Array<{ image: E57EmbeddedImage; canvas: HTMLCanvasElement }>,
  correction: E57ImageCorrection
): Promise<void> {
  if (data.hasColors || !data.positionsArray || !decoded.length) {
    return;
  }
  const count = data.vertexCount;
  const colors = new Uint8Array(count * 3).fill(255);
  const bestWeights = new Float32Array(count);
  const chunkSize = 250_000;
  let coloredCount = 0;
  for (const { image, canvas } of decoded) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      continue;
    }
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const scaleX = canvas.width / image.width;
    const scaleY = canvas.height / image.height;
    const transform = viewerToImageTransform(image, data.sourceOrigin ?? [0, 0, 0], correction);
    for (let start = 0; start < count; start += chunkSize) {
      const end = Math.min(count, start + chunkSize);
      const indices = new Uint32Array(end - start);
      for (let index = 0; index < indices.length; index++) {
        indices[index] = start + index;
      }
      const projected = projectCameraPointsWasmSync({
        cameraModel: image.cameraModel!,
        fx: image.fx!,
        fy: image.fy!,
        cx: image.cx!,
        cy: image.cy!,
        coefficients: [],
        positions: data.positionsArray,
        indices,
        transform,
        maxNormalizedX: Number.POSITIVE_INFINITY,
        maxNormalizedY: Number.POSITIVE_INFINITY,
      });
      if (!projected) {
        throw new Error('Rust E57 batch projection is unavailable');
      }
      for (let local = 0; local < indices.length; local++) {
        const x = projected[local * 2] * scaleX;
        const y = projected[local * 2 + 1] * scaleY;
        if (
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          x < 1 ||
          y < 1 ||
          x >= canvas.width - 2 ||
          y >= canvas.height - 2
        ) {
          continue;
        }
        const sample = sampleBilinear(pixels, canvas.width, canvas.height, x, y);
        if (sample[3] < 250) {
          continue;
        }
        const edgeDistance =
          image.representation === 'spherical'
            ? Math.min(y, canvas.height - 1 - y)
            : Math.min(x, y, canvas.width - 1 - x, canvas.height - 1 - y);
        const edgeMargin = Math.min(canvas.width, canvas.height) * 0.08;
        const edgeT = Math.max(0, Math.min(1, edgeDistance / edgeMargin));
        const edgeWeight = edgeT * edgeT * (3 - 2 * edgeT);
        const centerY = (y - canvas.height * 0.5) / (canvas.height * 0.5);
        const centerX =
          image.representation === 'spherical'
            ? 0
            : (x - canvas.width * 0.5) / (canvas.width * 0.5);
        const weight = edgeWeight / (0.05 + centerX * centerX + centerY * centerY) ** 2;
        const pointIndex = indices[local];
        if (weight <= bestWeights[pointIndex]) {
          continue;
        }
        if (bestWeights[pointIndex] === 0) {
          coloredCount++;
        }
        bestWeights[pointIndex] = weight;
        const offset = pointIndex * 3;
        colors[offset] = Math.round(sample[0]);
        colors[offset + 1] = Math.round(sample[1]);
        colors[offset + 2] = Math.round(sample[2]);
      }
    }
  }
  if (!coloredCount) {
    return;
  }
  data.colorsArray = colors;
  data.hasColors = true;
  data.metadata = { ...data.metadata, e57PhotographicallyColoredPoints: coloredCount };
  const fileIndex = data.fileIndex!;
  host.individualColorModes[fileIndex] = 'original';
  filesState.colorModes[fileIndex] = 'original';
  const points = host.meshes[fileIndex] as THREE.Points | undefined;
  if (points?.geometry) {
    host.applyColorModeToGeometry(data, points.geometry, 'original');
    const previous = points.material as THREE.Material;
    points.material = host.createMaterialForFile(data, fileIndex) as THREE.PointsMaterial;
    previous.dispose();
  }
  // Colouring finishes after the file list has rendered, so nudge it to pick up
  // the new "Original" mode and the photo-provenance note.
  filesState.renderTick++;
  host.requestRender();
}

async function populateImages(
  host: E57CameraHost,
  profile: THREE.Group,
  images: E57EmbeddedImage[],
  origin: readonly number[],
  correction: E57ImageCorrection
): Promise<void> {
  if (!(await initTiffWasm())) {
    profile.userData.imageProjectionAvailable = false;
    return;
  }
  const decodedForColor: Array<{ image: E57EmbeddedImage; canvas: HTMLCanvasElement }> = [];
  for (const [index, image] of images.entries()) {
    try {
      const frame = new THREE.Group();
      frame.name = `camera_${image.name || image.guid || index + 1}`;
      const pose = imagePose(image, origin);
      frame.position.copy(pose.position);
      frame.quaternion.copy(pose.quaternion);
      (frame as any).originalPosition = {
        x: pose.position.x,
        y: pose.position.y,
        z: pose.position.z,
      };
      const { texture, canvas } = await decodeHalfResolutionTexture(image);
      frame.userData.view = imageView(image, correction);
      frame.userData.frameDetails = imageDetails(image, correction);
      frame.add(createE57CameraBody(image, correction));
      const geometry = createProjectionGeometry(image, correction);
      frame.add(
        new THREE.LineSegments(geometry.frustum, new THREE.LineBasicMaterial({ color: 0x42a5f5 }))
      );
      decodedForColor.push({ image, canvas });
      const surface = new THREE.Mesh(
        geometry.surface,
        new THREE.MeshBasicMaterial({
          map: texture,
          // An enclosing panorama cannot be drawn double-sided: when viewed
          // from outside, its near hemisphere represents the direction from
          // the scanner towards the viewer while the cloud behind the scanner
          // lies along the opposite ray. Showing only back faces selects the
          // far hemisphere outside the sphere and still shows the correct
          // interior surface when the viewer is placed at the scanner.
          side: image.representation === 'pinhole' ? THREE.DoubleSide : THREE.BackSide,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
          toneMapped: false,
        })
      );
      surface.name = 'stonexImagePlane';
      // Images decode asynchronously, so "Show images" may already have been
      // switched on before this frame existed. Adopt the profile's current
      // setting instead of always starting hidden.
      surface.visible = profile.userData.imagesVisible === true;
      frame.add(surface);
      const label = createCameraLabel(image.name || `${image.representation} ${index + 1}`);
      label.name = 'cameraLabel';
      label.visible = false;
      frame.add(label);
      profile.add(frame);
    } catch (error) {
      console.warn(`[E57] Could not visualize embedded image ${index + 1}:`, error);
    }
  }
  await colorPointCloudFromImages(
    host,
    profile.userData.spatialData as SpatialData,
    decodedForColor,
    correction
  );
  profile.userData.imageProjectionAvailable = true;
  host.requestRender();
}

export function addE57CameraVisualization(host: E57CameraHost, data: SpatialData): boolean {
  const images = ((data.metadata?.e57Images as E57EmbeddedImage[] | undefined) ?? []).filter(
    image => image.projectable && image.cameraModel
  );
  if (!images.length) {
    return false;
  }
  const profile = new THREE.Group();
  const name = `${data.fileName || 'E57'} images`;
  profile.name = `e57_cameras_${data.fileIndex ?? 0}`;
  profile.userData.hasImagePlanes = true;
  profile.userData.supportsDistortionToggle = false;
  profile.userData.hasScannerMarker = true;
  profile.userData.excludeFromFit = true;
  profile.userData.cameraCount = images.length;
  profile.userData.imagesVisible = false;
  profile.userData.imagesDistorted = true;
  profile.userData.imageDistortionAvailable = true;
  profile.userData.spatialData = data;
  profile.userData.scannerVisible = true;
  profile.userData.imageCorrectionAvailable = true;
  profile.userData.imageCorrection = { ...DEFAULT_E57_IMAGE_CORRECTION };
  profile.userData.imageRepresentations = [...new Set(images.map(image => image.representation))];
  profile.userData.e57Images = images;
  profile.add(createScannerMarker(data));
  registerCameraGroup(host, profile, name);
  void populateImages(
    host,
    profile,
    images,
    data.sourceOrigin ?? [0, 0, 0],
    profile.userData.imageCorrection as E57ImageCorrection
  );
  return true;
}

/**
 * Rebuilds a profile's imagery under a new correction.
 *
 * Both the drawn planes and any colours we sampled for the points have to be
 * redone, so this tears the frames down and re-runs the whole population pass,
 * re-decoding the JPEGs. That is slow and deliberately so: correctness across
 * display and colouring matters more here than interactivity.
 */
export async function setE57ImageCorrection(
  host: E57CameraHost,
  profile: THREE.Group,
  correction: E57ImageCorrection
): Promise<void> {
  const images = profile.userData.e57Images as E57EmbeddedImage[] | undefined;
  const data = profile.userData.spatialData as SpatialData | undefined;
  if (!images?.length || !data) {
    return;
  }
  profile.userData.imageCorrection = normalizeE57ImageCorrection(correction);

  for (const frame of [...profile.children]) {
    if (!frame.name.startsWith('camera_')) {
      continue;
    }
    frame.traverse(object => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      for (const entry of Array.isArray(material) ? material : material ? [material] : []) {
        (entry as any).map?.dispose?.();
        entry.dispose();
      }
    });
    profile.remove(frame);
  }

  // Colours sampled from the old mapping have to go, or the repaint below is
  // skipped and the points keep pointing at the previous alignment.
  if (data.metadata?.e57PhotographicallyColoredPoints != null) {
    data.hasColors = false;
    data.colorsArray = undefined;
    const { e57PhotographicallyColoredPoints: _dropped, ...rest } = data.metadata as Record<
      string,
      unknown
    >;
    data.metadata = rest;
  }

  await populateImages(
    host,
    profile,
    images,
    data.sourceOrigin ?? [0, 0, 0],
    profile.userData.imageCorrection as E57ImageCorrection
  );
}
