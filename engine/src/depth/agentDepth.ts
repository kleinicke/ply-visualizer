/* eslint-disable @typescript-eslint/naming-convention -- Explicit Python/MCP wire schema. */
/** Thin depth-job adapter. Decoding/projection use the shared Rust kernels. */
import * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import { inspectNpyWasm, readNpyWasm } from '../parsers/pointcloudWasm';
import {
  decodeDepthPfmWasm,
  decodeColmapDepthWasm,
  decodeExrWasm,
  decodePng16Wasm,
  decodeTiffWasm,
  initTiffWasm,
  normalizeDepthWasmSync,
  projectDepthWasmSync,
} from './readers/tiffWasm';
import {
  parseCamerasBinary,
  parseCamerasText,
  parseImagesBinary,
  parseImagesText,
} from '../formats/colmap/colmapModel';
import { placementFor } from '../formats/colmap/colmapPose';

export interface DepthCalibration {
  width: number;
  height: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  kind: string;
  camera_model: string;
  coefficients: number[];
  convention: string;
  image_rectified: boolean;
  value_scale: number;
  value_offset: number;
  baseline?: number;
  disparity_offset?: number;
  invalid_values: number[];
  min_depth?: number;
  max_depth?: number;
  min_confidence?: number;
  array_key?: string;
  channel?: number;
  camera_to_world?: number[];
  sources: Record<string, string>;
}
interface Raster {
  width: number;
  height: number;
  channels: number;
  data: Float32Array | Uint16Array;
}
export interface DepthJob {
  version: number;
  asset_count: number;
  roles: Record<string, number>;
  calibration?: DepthCalibration;
  colmap_image?: string;
}

export async function readAgentRaster(file: File, arrayKey?: string): Promise<Raster> {
  const bytes = await file.arrayBuffer();
  if (/\.np[yz]$/i.test(file.name)) {
    const arrays = await inspectNpyWasm(new Uint8Array(bytes));
    if ((arrayKey === undefined || arrayKey === null) && arrays.length !== 1) {
      throw new Error(
        `Choose array_key explicitly; available arrays: ${arrays.map(a => a.name).join(', ')}`
      );
    }
    const array = await readNpyWasm(new Uint8Array(bytes), arrayKey ?? arrays[0].name);
    if (array.shape.length < 2 || array.shape.length > 3) {
      throw new Error('Expected raster shape HxW or HxWxC');
    }
    return {
      width: array.shape[1],
      height: array.shape[0],
      channels: array.shape[2] ?? 1,
      data: array.values,
    };
  }
  if (/\.bin$/i.test(file.name)) {
    const header = new TextDecoder().decode(bytes.slice(0, 75)).match(/^(\d+)&(\d+)&(\d+)&/);
    if (!header) {
      throw new Error('Not a COLMAP dense array');
    }
    return {
      width: +header[1],
      height: +header[2],
      channels: +header[3],
      data: await decodeColmapDepthWasm(new Uint8Array(bytes)),
    };
  }
  if (/\.pfm$/i.test(file.name)) {
    return decodeDepthPfmWasm(new Uint8Array(bytes));
  }
  const decoded = /\.tiff?$/i.test(file.name)
    ? await decodeTiffWasm(bytes)
    : /\.exr$/i.test(file.name)
      ? await decodeExrWasm(bytes)
      : /\.png$/i.test(file.name)
        ? await decodePng16Wasm(bytes, true)
        : null;
  if (!decoded) {
    throw new Error(
      `Unsupported depth raster: ${file.name}; use NPY, NPZ, TIFF, PNG8/16, EXR, PFM or COLMAP dense .bin`
    );
  }
  return decoded;
}

function channel(raster: Raster, selected?: number): Float32Array {
  if ((selected === undefined || selected === null) && raster.channels !== 1) {
    throw new Error(`Choose channel explicitly for a ${raster.channels}-channel raster`);
  }
  const c = selected ?? 0;
  if (!Number.isInteger(c) || c < 0 || c >= raster.channels) {
    throw new Error('Raster channel out of range');
  }
  return Float32Array.from(
    { length: raster.width * raster.height },
    (_, i) => raster.data[i * raster.channels + c]
  );
}

async function colmapCalibration(
  job: DepthJob,
  files: File[],
  raster: Raster
): Promise<DepthCalibration> {
  const camerasFile = files[job.roles.cameras],
    imagesFile = files[job.roles.images];
  const cameras = camerasFile.name.endsWith('.bin')
    ? parseCamerasBinary(new Uint8Array(await camerasFile.arrayBuffer()))
    : parseCamerasText(await camerasFile.text());
  const images = imagesFile.name.endsWith('.bin')
    ? parseImagesBinary(new Uint8Array(await imagesFile.arrayBuffer()))
    : parseImagesText(await imagesFile.text());
  const image = images.find(image => image.name === job.colmap_image);
  if (!image) {
    throw new Error(`COLMAP image name not found: ${job.colmap_image}`);
  }
  const camera = cameras.get(image.cameraId);
  if (!camera || !['PINHOLE', 'SIMPLE_PINHOLE'].includes(camera.model)) {
    throw new Error(
      'COLMAP dense loading requires the undistorted PINHOLE/SIMPLE_PINHOLE camera from the dense workspace'
    );
  }
  const [fx, fy, cx, cy] =
    camera.model === 'PINHOLE'
      ? camera.params
      : [camera.params[0], camera.params[0], camera.params[1], camera.params[2]];
  const sx = raster.width / camera.width,
    sy = raster.height / camera.height;
  const pose = placementFor(image);
  return {
    width: raster.width,
    height: raster.height,
    fx: fx * sx,
    fy: fy * sy,
    cx: cx * sx,
    cy: cy * sy,
    kind: 'z',
    camera_model: 'pinhole-ideal',
    coefficients: [],
    convention: 'opencv',
    image_rectified: true,
    value_scale: 1,
    value_offset: 0,
    invalid_values: [0],
    camera_to_world: new THREE.Matrix4()
      .compose(pose.position, pose.quaternion, new THREE.Vector3(1, 1, 1))
      .toArray(),
    sources: {
      intrinsics: `${camerasFile.name}: camera ${camera.id}; resized ${camera.width}x${camera.height} to ${raster.width}x${raster.height}`,
      pose: `${imagesFile.name}: image ${image.id}; inverse world-to-camera`,
      units: 'COLMAP reconstruction units; metric scale not inferred',
    },
  };
}

export async function projectAgentDepth(job: DepthJob, files: File[]): Promise<SpatialData> {
  if (
    job.version !== 1 ||
    job.asset_count !== files.length ||
    Object.values(job.roles).some(i => !Number.isInteger(i) || !files[i])
  ) {
    throw new Error('Invalid depth job asset references');
  }
  if (!(await initTiffWasm())) {
    throw new Error('Depth projection WASM is unavailable');
  }
  const source = files[job.roles.depth];
  const raster = await readAgentRaster(source, job.calibration?.array_key);
  const c = job.colmap_image ? await colmapCalibration(job, files, raster) : job.calibration;
  if (!c) {
    throw new Error(
      'Explicit calibration is required; read surrounding parameter files, not image pixels'
    );
  }
  if (c.width !== raster.width || c.height !== raster.height) {
    throw new Error(
      `Calibration ${c.width}x${c.height} does not match raster ${raster.width}x${raster.height}; explicitly adjust intrinsics for resize/crop`
    );
  }
  if (
    !['z', 'depth', 'disparity', 'inverse_depth'].includes(c.kind) ||
    !['opencv', 'opengl'].includes(c.convention)
  ) {
    throw new Error('Unsupported depth kind or coordinate convention');
  }
  if (c.image_rectified && c.coefficients.some(v => v !== 0)) {
    throw new Error('Rectified input must not be undistorted again');
  }
  if (
    c.kind === 'disparity' &&
    (!c.image_rectified || c.camera_model !== 'pinhole-ideal' || !(c.baseline! > 0))
  ) {
    throw new Error('Disparity requires rectified pinhole intrinsics and positive baseline');
  }
  const raw = channel(raster, c.channel);
  const filtered = raw.slice();
  const companions: Record<string, Raster> = {};
  for (const role of ['mask', 'confidence', 'rgb']) {
    if (job.roles[role] !== undefined) {
      const companion = await readAgentRaster(files[job.roles[role]]);
      if (companion.width !== c.width || companion.height !== c.height) {
        throw new Error(`${role} must be aligned and match depth dimensions`);
      }
      companions[role] = companion;
    }
  }
  const mask = companions.mask ? channel(companions.mask) : undefined;
  const confidence = companions.confidence ? channel(companions.confidence) : undefined;
  if (c.min_confidence !== undefined && c.min_confidence !== null && !confidence) {
    throw new Error('min_confidence requires a confidence raster');
  }
  for (let i = 0; i < filtered.length; i++) {
    if (
      !Number.isFinite(raw[i]) ||
      c.invalid_values.includes(raw[i]) ||
      (mask && (!Number.isFinite(mask[i]) || mask[i] === 0)) ||
      (confidence &&
        (!Number.isFinite(confidence[i]) ||
          (c.min_confidence !== undefined &&
            c.min_confidence !== null &&
            confidence[i] < c.min_confidence)))
    ) {
      filtered[i] = NaN;
    }
  }
  const normalized = normalizeDepthWasmSync(filtered, c.width, c.height, {
    kind: c.kind,
    unit: 'meter',
    scale: 1,
    depthScale: c.value_scale,
    depthBias: c.value_offset,
    fx: c.fx,
    baseline: c.baseline,
    disparityOffset: c.disparity_offset,
    depthClamp: { min: c.min_depth ?? undefined, max: c.max_depth ?? undefined },
  });
  if (!normalized) {
    throw new Error('Depth normalization failed');
  }
  const projected = projectDepthWasmSync(normalized.data, c.width, c.height, {
    kind: ['disparity', 'inverse_depth'].includes(c.kind) ? 'z' : normalized.kind,
    cameraModel: c.camera_model,
    coefficients: c.coefficients,
    convention: c.convention,
    fx: c.fx,
    fy: c.fy,
    cx: c.cx,
    cy: c.cy,
    retainIndices: true,
  });
  if (!projected?.sourceIndices) {
    throw new Error('Depth projection requires updated renderer WASM');
  }
  if (!projected.pointCount) {
    throw new Error(
      'No valid points remain after depth filtering/projection; check encoding, units, masks and calibration'
    );
  }
  const indices = projected.sourceIndices;
  const scalarFields: Record<string, Float32Array> = {
    pixel_u: Float32Array.from(indices, i => i % c.width),
    pixel_v: Float32Array.from(indices, i => Math.floor(i / c.width)),
    raw_depth_value: Float32Array.from(indices, i => raw[i]),
    depth_value: Float32Array.from(indices, i => normalized.data[i]),
  };
  if (confidence) {
    scalarFields.confidence = Float32Array.from(indices, i => confidence[i]);
  }
  let colors = projected.colors;
  if (companions.rgb) {
    const rgb = companions.rgb;
    if (rgb.channels !== 3 || rgb.data.some(v => !Number.isInteger(v) || v < 0 || v > 255)) {
      throw new Error('RGB must contain three aligned channels, integer samples 0..255');
    }
    colors = new Uint8Array(indices.length * 3);
    indices.forEach((pixel, i) => colors.set(rgb.data.subarray(pixel * 3, pixel * 3 + 3), i * 3));
  }
  if (c.camera_to_world) {
    if (
      c.camera_to_world.length !== 16 ||
      !c.camera_to_world.every(Number.isFinite) ||
      [3, 7, 11, 15].some((i, j) => c.camera_to_world![i] !== (j === 3 ? 1 : 0))
    ) {
      throw new Error('camera_to_world must be a finite column-major affine matrix');
    }
    const matrix = new THREE.Matrix4().fromArray(c.camera_to_world);
    const point = new THREE.Vector3();
    for (let i = 0; i < projected.vertices.length; i += 3) {
      point.fromArray(projected.vertices, i).applyMatrix4(matrix).toArray(projected.vertices, i);
    }
  }
  return {
    vertices: [],
    faces: [],
    format: 'binary_little_endian',
    version: '1.0',
    comments: [],
    vertexCount: indices.length,
    faceCount: 0,
    hasColors: true,
    hasNormals: false,
    useTypedArrays: true,
    fileName: source.name + ' (depth)',
    positionsArray: projected.vertices,
    colorsArray: colors,
    sourcePointCount: raw.length,
    sourcePointIndices: indices,
    scalarFields,
    metadata: {
      depth: {
        calibration: c,
        source: source.name,
        units: job.colmap_image ? 'COLMAP reconstruction units' : 'meters',
        source_pixels: raw.length,
        output_points: indices.length,
        filtered_pixels: raw.length - indices.length,
        rejected_projection: projected.rejectedCount,
        nonconverged_projection: projected.nonConvergedCount,
        index_space: 'source_row = pixel_v * width + pixel_u; zero-based original raster pixels',
      },
    },
  };
}
