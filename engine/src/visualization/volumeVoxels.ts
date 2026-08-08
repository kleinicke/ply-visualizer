import type { SpatialData } from '../interfaces';
import type { VolumeData } from '../parsers/nrrdParser';
import { volumeGreyByte } from './volumePresentation';

export interface VolumeVoxelsRequest {
  threshold: number;
  step?: readonly [number, number, number];
  /** Upper bound on emitted quads; the stride grows until the build fits. */
  maxFaces?: number;
  /**
   * Inclusive visible index range per axis. Unlike the other modes, voxel
   * clipping has to happen here rather than with clipping planes: only the
   * shell of the retained block is built, so a plane cutting through it would
   * expose a hollow interior. Rebuilding caps the cut with real voxel faces.
   */
  clip?: readonly (readonly [number, number])[];
  windowCenter?: number;
  windowWidth?: number;
  onProgress?: (fraction: number) => void;
}

export interface VolumeVoxelsResult {
  data: SpatialData;
  step: [number, number, number];
  /** World-space edge lengths of one emitted box, along i/j/k. */
  voxelSize: [number, number, number];
}

const DEFAULT_MAX_FACES = 1_000_000;

/**
 * Symmetric per-axis tint baked into the vertex colours. The scene's single
 * directional light would leave whole sides of the block near-black, which is
 * unusable for greyscale medical data, so voxels render unlit like the slice
 * mode and get this fixed shading instead. Opposite faces share a factor, so
 * the mapping from sample value to displayed grey stays the same whichever way
 * the camera looks at a face.
 */
const AXIS_SHADE: readonly [number, number, number] = [0.78, 0.89, 1.0];

/** Corner sign patterns per face: [axis, direction, then four (u,v) sign pairs]. */
const FACES: ReadonlyArray<{
  axis: 0 | 1 | 2;
  dir: 1 | -1;
  corners: ReadonlyArray<readonly [number, number]>;
}> = [
  {
    axis: 0,
    dir: 1,
    corners: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
  {
    axis: 0,
    dir: -1,
    corners: [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ],
  },
  {
    axis: 1,
    dir: 1,
    corners: [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ],
  },
  {
    axis: 1,
    dir: -1,
    corners: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
  {
    axis: 2,
    dir: 1,
    corners: [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ],
  },
  {
    axis: 2,
    dir: -1,
    corners: [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ],
  },
];

/**
 * Emits one solid box per retained voxel. Each box spans exactly the sampled
 * cell in ijk space, so neighbouring voxels touch without gaps or overlap in
 * every direction — including between slices, whose spacing is usually much
 * larger than the in-plane pixel pitch. Faces shared with another retained
 * voxel are dropped, so only the outer shell is built.
 */
export async function buildVolumeVoxelsAsync(
  volume: VolumeData,
  request: VolumeVoxelsRequest,
  isCancelled: () => boolean
): Promise<VolumeVoxelsResult | null> {
  const base = request.step ?? [1, 1, 1];
  const maxFaces =
    request.maxFaces === undefined ? DEFAULT_MAX_FACES : Math.max(1, request.maxFaces);
  const clip = resolveClip(volume, request.clip);
  let multiplier = 1;
  let faces: number | null = 0;
  let step: [number, number, number] = [...base] as [number, number, number];

  // Count exposed faces first: a low threshold on a large volume would
  // otherwise allocate hundreds of megabytes of geometry. Growing the stride
  // keeps the boxes gap-free because their extent scales with it.
  do {
    step = base.map(value => Math.max(1, Math.round(value * multiplier))) as [
      number,
      number,
      number,
    ];
    faces = await countFacesAsync(volume, request.threshold, step, clip, maxFaces + 1, isCancelled);
    if (faces === null) {
      return null;
    }
    multiplier++;
  } while (faces > maxFaces);

  const vertexCount = faces * 4;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Uint8Array(vertexCount * 3);
  const intensity = new Float32Array(vertexCount);
  const indices = new Uint32Array(faces * 6);
  const m = volume.ijkToWorld;
  const [nx, ny, nz] = volume.sizes;
  const [sx, sy, sz] = step;

  // Half-extent vectors of one box, computed once and reused for every voxel.
  const half: Array<[number, number, number]> = [
    [(m[0] * sx) / 2, (m[4] * sx) / 2, (m[8] * sx) / 2],
    [(m[1] * sy) / 2, (m[5] * sy) / 2, (m[9] * sy) / 2],
    [(m[2] * sz) / 2, (m[6] * sz) / 2, (m[10] * sz) / 2],
  ];
  // The sampled voxel represents the cell [i, i+step), so the box centre sits
  // half a stride past the sample it was taken from.
  const centreShift: [number, number, number] = [(sx - 1) / 2, (sy - 1) / 2, (sz - 1) / 2];
  const photometric = volume.header['photometric interpretation'];
  const windowCenter = request.windowCenter ?? 0;
  const windowWidth = request.windowWidth ?? 1;

  let vertex = 0;
  let index = 0;
  let voxels = 0;
  for (let k = clipStart(clip, 2, sz); k <= clip[2][1] && k < nz; k += sz) {
    for (let j = clipStart(clip, 1, sy); j <= clip[1][1] && j < ny; j += sy) {
      for (let i = clipStart(clip, 0, sx); i <= clip[0][1] && i < nx; i += sx) {
        const value = volume.samples[i + j * nx + k * nx * ny];
        if (value < request.threshold) {
          continue;
        }
        voxels++;
        const ci = i + centreShift[0];
        const cj = j + centreShift[1];
        const ck = k + centreShift[2];
        const cx = m[0] * ci + m[1] * cj + m[2] * ck + m[3];
        const cy = m[4] * ci + m[5] * cj + m[6] * ck + m[7];
        const cz = m[8] * ci + m[9] * cj + m[10] * ck + m[11];
        const grey = volumeGreyByte(value, windowCenter, windowWidth, photometric);
        for (const face of FACES) {
          const ijk: [number, number, number] = [i, j, k];
          ijk[face.axis] += face.dir * step[face.axis];
          if (isSolid(volume, ijk, request.threshold, clip)) {
            continue;
          }
          const normalHalf = half[face.axis];
          const [uAxis, vAxis] = otherAxes(face.axis);
          const uHalf = half[uAxis];
          const vHalf = half[vAxis];
          const shade = AXIS_SHADE[face.axis];
          const shaded = Math.round(grey * shade);
          const first = vertex;
          for (const [us, vs] of face.corners) {
            const p = vertex * 3;
            positions[p] = cx + face.dir * normalHalf[0] + us * uHalf[0] + vs * vHalf[0];
            positions[p + 1] = cy + face.dir * normalHalf[1] + us * uHalf[1] + vs * vHalf[1];
            positions[p + 2] = cz + face.dir * normalHalf[2] + us * uHalf[2] + vs * vHalf[2];
            colors[p] = shaded;
            colors[p + 1] = shaded;
            colors[p + 2] = shaded;
            intensity[vertex] = value;
            vertex++;
          }
          indices[index++] = first;
          indices[index++] = first + 1;
          indices[index++] = first + 2;
          indices[index++] = first;
          indices[index++] = first + 2;
          indices[index++] = first + 3;
        }
      }
    }
    request.onProgress?.(Math.min(1, (k + sz) / nz));
    if (isCancelled()) {
      return null;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  request.onProgress?.(1);

  const voxelSize: [number, number, number] = [
    Math.hypot(m[0], m[4], m[8]) * sx,
    Math.hypot(m[1], m[5], m[9]) * sy,
    Math.hypot(m[2], m[6], m[10]) * sz,
  ];

  return {
    step,
    voxelSize,
    data: {
      vertices: [],
      faces: [],
      format: 'binary_little_endian',
      version: '1.0',
      comments: [
        `Volume ${volume.sizes.join(' x ')} voxels`,
        `One solid box per voxel at or above ${request.threshold}`,
        `Box size ${voxelSize.join(' x ')} ${volume.spaceUnits || ''}`.trim(),
      ],
      vertexCount,
      faceCount: faces * 2,
      hasColors: true,
      hasNormals: false,
      hasIntensity: true,
      useTypedArrays: true,
      positionsArray: positions,
      colorsArray: colors,
      indicesArray: indices,
      intensityArray: intensity,
      scalarFields: { intensity },
      fileName: volume.fileName,
      metadata: {
        volumeSizes: volume.sizes,
        ijkToWorld: volume.ijkToWorld,
        spaceUnits: volume.spaceUnits,
        intensityUnits: volume.intensityUnits,
        threshold: request.threshold,
        windowCenter: request.windowCenter,
        windowWidth: request.windowWidth,
        photometricInterpretation: photometric,
        extractionStep: step,
        effectiveSpacing: voxelSize,
        voxelSize,
        voxelClip: clip.map(range => [...range]),
        renderedVoxelCount: voxels,
        renderedFaceCount: faces,
        sourceVoxelCount: volume.sizes[0] * volume.sizes[1] * volume.sizes[2],
        volumeRenderMode: 'voxels',
        channels: volume.channels,
      },
    },
  };
}

function otherAxes(axis: 0 | 1 | 2): [number, number] {
  return axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
}

type Clip = ReadonlyArray<readonly [number, number]>;

function resolveClip(volume: VolumeData, requested: Clip | undefined): Clip {
  return volume.sizes.map((size, axis) => {
    const max = Math.max(0, size - 1);
    const range = requested?.[axis];
    if (!range) {
      return [0, max] as const;
    }
    const lower = Math.max(0, Math.min(max, Math.round(Math.min(range[0], range[1]))));
    const upper = Math.max(0, Math.min(max, Math.round(Math.max(range[0], range[1]))));
    return [lower, upper] as const;
  });
}

/** First sample index on the global stride grid that the clip range keeps. */
function clipStart(clip: Clip, axis: number, stride: number): number {
  return Math.ceil(clip[axis][0] / stride) * stride;
}

/** A neighbour hides a face only when it is retained and itself visible. */
function isSolid(
  volume: VolumeData,
  ijk: readonly [number, number, number],
  threshold: number,
  clip: Clip
): boolean {
  const [nx, ny, nz] = volume.sizes;
  const [i, j, k] = ijk;
  if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) {
    return false;
  }
  if (
    i < clip[0][0] ||
    i > clip[0][1] ||
    j < clip[1][0] ||
    j > clip[1][1] ||
    k < clip[2][0] ||
    k > clip[2][1]
  ) {
    return false;
  }
  return volume.samples[i + j * nx + k * nx * ny] >= threshold;
}

async function countFacesAsync(
  volume: VolumeData,
  threshold: number,
  step: readonly [number, number, number],
  clip: Clip,
  stopAfter: number,
  isCancelled: () => boolean
): Promise<number | null> {
  const [nx, ny, nz] = volume.sizes;
  const [sx, sy, sz] = step;
  let faces = 0;
  for (let k = clipStart(clip, 2, sz); k <= clip[2][1] && k < nz; k += sz) {
    for (let j = clipStart(clip, 1, sy); j <= clip[1][1] && j < ny; j += sy) {
      for (let i = clipStart(clip, 0, sx); i <= clip[0][1] && i < nx; i += sx) {
        if (volume.samples[i + j * nx + k * nx * ny] < threshold) {
          continue;
        }
        for (const face of FACES) {
          const ijk: [number, number, number] = [i, j, k];
          ijk[face.axis] += face.dir * step[face.axis];
          if (!isSolid(volume, ijk, threshold, clip)) {
            faces++;
          }
        }
        if (faces >= stopAfter) {
          return faces;
        }
      }
    }
    if (isCancelled()) {
      return null;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return faces;
}
