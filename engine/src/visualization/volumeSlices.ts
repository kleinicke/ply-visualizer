import type { SpatialData } from '../interfaces';
import type { VolumeData } from '../parsers/nrrdParser';
import { volumeGreyByte } from './volumePresentation';

export interface VolumeSlicesRequest {
  windowCenter: number;
  windowWidth: number;
  slices: readonly [number, number, number];
  onProgress?: (fraction: number) => void;
}

export interface VolumeSlicesResult {
  data: SpatialData;
  slices: [number, number, number];
}

/**
 * Builds three orthogonal, vertex-coloured section planes from the original
 * voxel samples. Unlike an isosurface, this is presentation rather than
 * segmentation: every displayed grey value comes directly from the volume's
 * window/level mapping.
 */
export async function buildVolumeSlicesAsync(
  volume: VolumeData,
  request: VolumeSlicesRequest,
  isCancelled: () => boolean
): Promise<VolumeSlicesResult | null> {
  const slices = request.slices.map((value, axis) =>
    Math.max(0, Math.min(volume.sizes[axis] - 1, Math.round(value)))
  ) as [number, number, number];
  const planes: Array<[number, number, number]> = [
    [0, 1, 2],
    [1, 0, 2],
    [2, 0, 1],
  ];
  const vertexCount = planes.reduce(
    (sum, [, uAxis, vAxis]) => sum + volume.sizes[uAxis] * volume.sizes[vAxis],
    0
  );
  const triangleCount = planes.reduce(
    (sum, [, uAxis, vAxis]) =>
      sum + Math.max(0, volume.sizes[uAxis] - 1) * Math.max(0, volume.sizes[vAxis] - 1) * 2,
    0
  );
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Uint8Array(vertexCount * 3);
  const indices = new Uint32Array(triangleCount * 3);
  const m = volume.ijkToWorld;
  const width = Math.max(Number.EPSILON, request.windowWidth);
  const invert = volume.header['photometric interpretation']?.toUpperCase() === 'MONOCHROME1';
  let vertexOffset = 0;
  let indexOffset = 0;

  for (let planeIndex = 0; planeIndex < planes.length; planeIndex++) {
    const [fixedAxis, uAxis, vAxis] = planes[planeIndex];
    const nu = volume.sizes[uAxis];
    const nv = volume.sizes[vAxis];
    for (let v = 0; v < nv; v++) {
      for (let u = 0; u < nu; u++) {
        const ijk = [0, 0, 0];
        ijk[fixedAxis] = slices[fixedAxis];
        ijk[uAxis] = u;
        ijk[vAxis] = v;
        const [i, j, k] = ijk;
        const vertex = vertexOffset + u + v * nu;
        const p = vertex * 3;
        positions[p] = m[0] * i + m[1] * j + m[2] * k + m[3];
        positions[p + 1] = m[4] * i + m[5] * j + m[6] * k + m[7];
        positions[p + 2] = m[8] * i + m[9] * j + m[10] * k + m[11];
        const sample =
          volume.samples[i + j * volume.sizes[0] + k * volume.sizes[0] * volume.sizes[1]];
        const grey = volumeGreyByte(
          sample,
          request.windowCenter,
          width,
          invert ? 'MONOCHROME1' : 'MONOCHROME2'
        );
        colors[p] = grey;
        colors[p + 1] = grey;
        colors[p + 2] = grey;
      }
      if (isCancelled()) {
        return null;
      }
      if ((v & 31) === 31) {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }
    for (let v = 0; v < nv - 1; v++) {
      for (let u = 0; u < nu - 1; u++) {
        const a = vertexOffset + u + v * nu;
        const b = a + 1;
        const c = a + nu;
        const d = c + 1;
        indices[indexOffset++] = a;
        indices[indexOffset++] = b;
        indices[indexOffset++] = d;
        indices[indexOffset++] = a;
        indices[indexOffset++] = d;
        indices[indexOffset++] = c;
      }
    }
    vertexOffset += nu * nv;
    request.onProgress?.((planeIndex + 1) / planes.length);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  return {
    slices,
    data: {
      vertices: [],
      faces: [],
      format: 'binary_little_endian',
      version: '1.0',
      comments: [
        `Volume ${volume.sizes.join(' x ')} voxels`,
        `Orthogonal slices ${slices.join(' / ')}`,
        `Window ${request.windowCenter} / ${request.windowWidth}`,
      ],
      vertexCount,
      faceCount: triangleCount,
      hasColors: true,
      hasNormals: false,
      useTypedArrays: true,
      positionsArray: positions,
      colorsArray: colors,
      indicesArray: indices,
      fileName: volume.fileName,
      metadata: {
        volumeSizes: volume.sizes,
        ijkToWorld: volume.ijkToWorld,
        spaceUnits: volume.spaceUnits,
        intensityUnits: volume.intensityUnits,
        volumeRenderMode: 'slices',
        windowCenter: request.windowCenter,
        windowWidth: request.windowWidth,
        sliceIndices: slices,
        channels: volume.channels,
      },
    },
  };
}
