import type { SpatialData } from '../../interfaces';
import {
  looksLikeBinary,
  parseCamerasBinary,
  parseCamerasText,
  parseImagesBinary,
  parseImagesText,
  parsePoints3DBinary,
  parsePoints3DText,
  type ColmapCamera,
  type ColmapModel,
} from './colmapModel';

/**
 * Recognising a COLMAP sparse model in a set of files, and turning its points
 * into a point cloud.
 *
 * Deliberately free of Three.js: the VS Code extension host imports
 * `isColmapModelFile` to spot a model before it parses files individually, and
 * it cannot pull in the webview's scene or Svelte state modules.
 * Scene building lives in colmapReconstruction.ts.
 */

/** Files that make up a sparse model, keyed by their COLMAP base name. */
export interface ColmapModelFiles {
  cameras?: Uint8Array;
  images?: Uint8Array;
  points3D?: Uint8Array;
}

const MODEL_FILE_PATTERN = /(?:^|[\\/])(cameras|images|points3D)\.(bin|txt)$/i;

/** True when a file is part of a COLMAP sparse model, by COLMAP's own naming. */
export function isColmapModelFile(fileName: string): boolean {
  return MODEL_FILE_PATTERN.test(fileName);
}

function modelFileKey(fileName: string): keyof ColmapModelFiles | null {
  const match = MODEL_FILE_PATTERN.exec(fileName);
  if (!match) {
    return null;
  }
  const base = match[1].toLowerCase();
  if (base === 'cameras') {
    return 'cameras';
  }
  if (base === 'images') {
    return 'images';
  }
  return 'points3D';
}

/**
 * Groups a batch of dropped/selected files into model files.
 *
 * `cameras` and `images` are the minimum: without them there are no poses and
 * nothing COLMAP-specific to show. `points3D` is optional - a reconstruction
 * whose cameras are wanted but whose sparse cloud is not still opens.
 */
export function collectColmapModelFiles(
  files: ReadonlyArray<{ name: string; data: Uint8Array }>
): { model: ColmapModelFiles; consumed: Set<string> } | null {
  const model: ColmapModelFiles = {};
  const consumed = new Set<string>();
  for (const file of files) {
    const key = modelFileKey(file.name);
    if (!key || model[key]) {
      continue;
    }
    model[key] = file.data;
    consumed.add(file.name);
  }
  if (!model.cameras || !model.images) {
    return null;
  }
  return { model, consumed };
}

/**
 * Display name for the reconstruction.
 *
 * The model files are all called the same thing in every reconstruction, so the
 * useful name is the folder holding them - typically `0` under `sparse/`, in
 * which case the grandparent is more informative. Falls back to "COLMAP" when
 * the picker gave bare names with no path.
 */
export function colmapReconstructionName(
  files: ReadonlyArray<{ name: string; data: Uint8Array }>
): string {
  const modelFile = files.find(file => isColmapModelFile(file.name));
  const segments = (modelFile?.name ?? '').split(/[\\/]/).slice(0, -1);
  if (segments.length === 0) {
    return 'COLMAP';
  }
  const parent = segments[segments.length - 1];
  const grandparent = segments[segments.length - 2];
  return grandparent ? `${grandparent}/${parent}` : parent;
}

export function parseColmapModel(files: ColmapModelFiles): ColmapModel {
  // Encoding is decided by content, so a `.bin` that is actually text (or a
  // model exported without extensions) still reads correctly.
  const cameras = files.cameras
    ? looksLikeBinary(files.cameras)
      ? parseCamerasBinary(files.cameras)
      : parseCamerasText(new TextDecoder().decode(files.cameras))
    : new Map<number, ColmapCamera>();

  const images = files.images
    ? looksLikeBinary(files.images)
      ? parseImagesBinary(files.images)
      : parseImagesText(new TextDecoder().decode(files.images))
    : [];

  const points = files.points3D
    ? looksLikeBinary(files.points3D)
      ? parsePoints3DBinary(files.points3D)
      : parsePoints3DText(new TextDecoder().decode(files.points3D))
    : [];

  return { cameras, images, points };
}

/**
 * Sparse cloud as a point-cloud entry.
 *
 * Reprojection error rides along as a scalar field, so the existing colour-by
 * -scalar UI can show reconstruction quality without any COLMAP-specific code.
 */
export function buildSparseCloud(model: ColmapModel, fileName: string): SpatialData | null {
  if (model.points.length === 0) {
    return null;
  }
  const count = model.points.length;
  const positions = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 3);
  const error = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const point = model.points[i];
    positions[i * 3] = point.xyz[0];
    positions[i * 3 + 1] = point.xyz[1];
    positions[i * 3 + 2] = point.xyz[2];
    colors[i * 3] = point.rgb[0];
    colors[i * 3 + 1] = point.rgb[1];
    colors[i * 3 + 2] = point.rgb[2];
    error[i] = point.error;
  }

  return {
    vertices: [],
    faces: [],
    format: 'binary_little_endian',
    version: '1.0',
    comments: [],
    vertexCount: count,
    faceCount: 0,
    hasColors: true,
    hasNormals: false,
    fileName,
    useTypedArrays: true,
    positionsArray: positions,
    colorsArray: colors,
    normalsArray: null,
    intensityArray: null,
    scalarFields: { reprojection_error: error },
    metadata: {
      format: 'COLMAP',
      colmapImageCount: model.images.length,
      colmapCameraCount: model.cameras.size,
    },
  };
}
