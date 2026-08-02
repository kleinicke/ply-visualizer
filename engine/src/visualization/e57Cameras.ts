import * as THREE from 'three';
import { createCameraBodyGeometry, createCameraLabel } from '../cameraProfile';
import { unprojectCameraPixel } from '../depth/cameraModels';
import { initTiffWasm, projectCameraPointsWasmSync } from '../depth/readers/tiffWasm';
import type { E57EmbeddedImage, SpatialData } from '../interfaces';
import { filesState } from '../state/files.svelte';

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

function localImagePoint(image: E57EmbeddedImage, u: number, v: number): THREE.Vector3 | null {
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

function createProjectionGeometry(image: E57EmbeddedImage): {
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
        localImagePoint(image, s * image.width, t * image.height) ?? new THREE.Vector3();
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

function viewerToImageTransform(image: E57EmbeddedImage, origin: readonly number[]): number[] {
  const [tx, ty, tz, qw, qx, qy, qz] = image.pose;
  const imageToFile = new THREE.Matrix4().compose(
    new THREE.Vector3(tx, ty, tz),
    new THREE.Quaternion(qx, qy, qz, qw).normalize(),
    new THREE.Vector3(1, 1, 1)
  );
  const transform = imageToFile
    .invert()
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
  decoded: Array<{ image: E57EmbeddedImage; canvas: HTMLCanvasElement }>
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
    const transform = viewerToImageTransform(image, data.sourceOrigin ?? [0, 0, 0]);
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
  host.requestRender();
}

async function populateImages(
  host: E57CameraHost,
  profile: THREE.Group,
  images: E57EmbeddedImage[],
  origin: readonly number[]
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
      frame.add(createCameraBodyGeometry());
      const geometry = createProjectionGeometry(image);
      frame.add(
        new THREE.LineSegments(geometry.frustum, new THREE.LineBasicMaterial({ color: 0x42a5f5 }))
      );
      const { texture, canvas } = await decodeHalfResolutionTexture(image);
      decodedForColor.push({ image, canvas });
      const surface = new THREE.Mesh(
        geometry.surface,
        new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.88,
          depthWrite: false,
          toneMapped: false,
        })
      );
      surface.name = 'stonexImagePlane';
      surface.visible = false;
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
    decodedForColor
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
  profile.add(createScannerMarker(data));
  registerCameraGroup(host, profile, name);
  void populateImages(host, profile, images, data.sourceOrigin ?? [0, 0, 0]);
  return true;
}
