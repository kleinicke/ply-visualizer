import * as THREE from 'three';
import { createCameraBodyGeometry, createCameraLabel } from '../cameraProfile';
import { unprojectCameraPixel } from '../depth/cameraModels';
import { initTiffWasm, projectCameraPointsWasmSync } from '../depth/readers/tiffWasm';
import type { E57EmbeddedImage, SpatialData } from '../interfaces';
import { filesState } from '../state/files.svelte';
import type { CameraFrameDetail, CameraFrameView } from './cameraFrames';

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
  azimuthCorrection = 0
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
  if (image.representation !== 'pinhole' && azimuthCorrection !== 0) {
    // A few exporters store a spherical JPEG whose azimuth zero is shifted
    // relative to its declared E57 pose. Rotate the unprojected footprint by
    // the independently measured image-to-point-colour correction.
    point.applyAxisAngle(new THREE.Vector3(0, 0, 1), -azimuthCorrection);
  }
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
function imageView(image: E57EmbeddedImage, azimuthCorrection = 0): CameraFrameView | undefined {
  const centre = localImagePoint(image, image.width / 2, image.height / 2, azimuthCorrection);
  const top = localImagePoint(image, image.width / 2, 0, azimuthCorrection);
  const bottom = localImagePoint(image, image.width / 2, image.height, azimuthCorrection);
  if (!centre || !top || !bottom) {
    return undefined;
  }
  const up = top.sub(bottom).normalize();
  return {
    forward: centre,
    up: up.lengthSq() > 0 ? up : new THREE.Vector3(0, 1, 0),
    fovYDegrees:
      image.representation === 'pinhole' && image.fy
        ? 2 * Math.atan(image.height / (2 * image.fy)) * (180 / Math.PI)
        : undefined,
  };
}

function imageDetails(image: E57EmbeddedImage, azimuthCorrection = 0): CameraFrameDetail[] {
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
  if (azimuthCorrection !== 0) {
    details.push({
      label: 'RGB azimuth correction',
      value: `${THREE.MathUtils.radToDeg(azimuthCorrection).toFixed(1)}°`,
    });
  }
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
  azimuthCorrection = 0
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
        localImagePoint(image, s * image.width, t * image.height, azimuthCorrection) ??
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

function estimatePanoramaAzimuthCorrection(
  data: SpatialData,
  image: E57EmbeddedImage,
  canvas: HTMLCanvasElement
): number {
  if (
    image.representation === 'pinhole' ||
    !data.hasColors ||
    !data.positionsArray ||
    !data.colorsArray ||
    data.vertexCount < 500
  ) {
    return 0;
  }
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return 0;
  }
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const transform = viewerToImageTransform(image, data.sourceOrigin ?? [0, 0, 0]);
  const positions = data.positionsArray;
  const colors = data.colorsArray;
  const scaleX = canvas.width / image.width;
  const scaleY = canvas.height / image.height;
  const wrapsHorizontally = image.width / image.fx! >= Math.PI * 2 - 0.02;
  const stride = Math.max(1, Math.floor(data.vertexCount / 10_000));
  const candidates = Array.from({ length: 24 }, (_, index) => (index - 12) * (Math.PI / 12));

  const score = (correction: number): { error: number; count: number } => {
    let error = 0;
    let count = 0;
    for (let index = 0; index < data.vertexCount; index += stride) {
      const offset = index * 3;
      const red = colors[offset];
      const green = colors[offset + 1];
      const blue = colors[offset + 2];
      const sum = red + green + blue;
      // Almost-black/white samples provide little alignment information and
      // otherwise let sky or invalid fill dominate the score.
      if (sum < 20 || sum > 745) {
        continue;
      }
      const px = positions[offset];
      const py = positions[offset + 1];
      const pz = positions[offset + 2];
      const x = transform[0] * px + transform[1] * py + transform[2] * pz + transform[3];
      const y = transform[4] * px + transform[5] * py + transform[6] * pz + transform[7];
      const z = transform[8] * px + transform[9] * py + transform[10] * pz + transform[11];
      const rho = Math.hypot(x, y);
      if (rho < 1e-8) {
        continue;
      }
      let imageX = image.cx! - image.fx! * (Math.atan2(y, x) + correction);
      if (wrapsHorizontally) {
        imageX = ((imageX % image.width) + image.width) % image.width;
      }
      const vertical = image.representation === 'spherical' ? Math.atan2(z, rho) : z / rho;
      const imageY = image.cy! - image.fy! * vertical;
      const sampleX = Math.floor(imageX * scaleX);
      const sampleY = Math.floor(imageY * scaleY);
      if (sampleX < 0 || sampleY < 0 || sampleX >= canvas.width || sampleY >= canvas.height) {
        continue;
      }
      const sampleOffset = (sampleY * canvas.width + sampleX) * 4;
      if (pixels[sampleOffset + 3] < 250) {
        continue;
      }
      const dr = pixels[sampleOffset] - red;
      const dg = pixels[sampleOffset + 1] - green;
      const db = pixels[sampleOffset + 2] - blue;
      error += dr * dr + dg * dg + db * db;
      count++;
    }
    return { error: error / Math.max(1, count), count };
  };

  const baseline = score(0);
  let best = { correction: 0, ...baseline };
  for (const correction of candidates) {
    const candidate = score(correction);
    if (candidate.count >= 500 && candidate.error < best.error) {
      best = { correction, ...candidate };
    }
  }
  // Only override standard E57 pose/projection data when native RGB provides
  // strong evidence. This preserves conforming files and fixes exporters that
  // shifted the panorama pixels without updating the image pose.
  return best.correction !== 0 && best.error < baseline.error * 0.6 ? best.correction : 0;
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
      const { texture, canvas } = await decodeHalfResolutionTexture(image);
      const azimuthCorrection = estimatePanoramaAzimuthCorrection(
        profile.userData.spatialData as SpatialData,
        image,
        canvas
      );
      frame.userData.e57AzimuthCorrectionDegrees = THREE.MathUtils.radToDeg(azimuthCorrection);
      frame.userData.view = imageView(image, azimuthCorrection);
      frame.userData.frameDetails = imageDetails(image, azimuthCorrection);
      if (azimuthCorrection !== 0) {
        console.info(
          `[E57] Corrected ${image.name || image.guid || `image ${index + 1}`} panorama azimuth by ${frame.userData.e57AzimuthCorrectionDegrees.toFixed(1)}° from native point colours`
        );
      }
      const geometry = createProjectionGeometry(image, azimuthCorrection);
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
