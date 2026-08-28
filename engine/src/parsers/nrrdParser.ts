import { parseNrrdWasm } from '../visualization/volumeWasm';

/**
 * NRRD volume reader.
 *
 * NRRD is the bridge payload between `tiff-visualizer` (which decodes DICOM,
 * OME-TIFF and friends) and this viewer: a plain-text header followed by raw
 * voxels. It was chosen over a bespoke descriptor because it is a documented
 * standard that already carries everything the handover needs — a full affine,
 * world units, dtype and endianness — so there is no private contract for two
 * repositories to keep in sync, and `.nrrd` files from 3D Slicer/ITK open here
 * directly as a side effect.
 *
 * This reader deliberately stops at "a volume in world space". Turning that
 * into geometry is `visualization/marchingCubes.ts`; nothing here knows about
 * Three.js.
 */

/** Voxel sample types NRRD can declare, normalised to the typed array we use. */
export type VolumeScalarArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

export interface VolumeData {
  /** Voxel counts along the volume's own i/j/k axes. */
  sizes: [number, number, number];
  /** Samples in i-fastest order, length = sizes[0] * sizes[1] * sizes[2]. */
  samples: VolumeScalarArray;
  /**
   * Voxel index (i,j,k,1) to world space, row-major 4x4.
   *
   * This is the whole reason the bridge carries an affine rather than a
   * spacing triple: DICOM series are routinely oblique, so axis-aligned
   * spacing cannot represent them. An axis-aligned volume is just an affine
   * with a diagonal 3x3.
   */
  ijkToWorld: number[];
  /** World unit of the affine's translation/scale, e.g. "mm". */
  spaceUnits: string;
  /**
   * What a sample *means*. CT arrives in Hounsfield units once
   * RescaleSlope/RescaleIntercept have been applied, which is what makes a
   * threshold like "+300 HU" mean bone rather than an arbitrary number.
   * Microscopy has no such scale and leaves this undefined.
   */
  intensityUnits?: string;
  /** Inclusive sample range, when the producer measured it. */
  range?: { min: number; max: number };
  /** Channel/component count; only channel 0 is used for isosurfacing today. */
  channels: number;
  /** Everything from the header, including `key:=value` pairs. */
  header: Record<string, string>;
  fileName?: string;
}

export type DataFileResolver = (relativePath: string) => Promise<Uint8Array>;

/**
 * Reads a NRRD volume.
 *
 * The reading itself is Rust (`wasm/pointcloud-parser/src/volume/nrrd.rs`):
 * header, affine, endianness, the raw/gzip/ascii encodings and the channel
 * split. What is left here is resolving a detached data file, which needs the
 * host's file access, and shaping the result into `VolumeData`.
 */
export class NrrdParser {
  async parse(
    data: Uint8Array,
    fileName?: string,
    timingCallback?: (message: string) => void,
    resolveDataFile?: DataFileResolver
  ): Promise<VolumeData> {
    const start = performance.now();
    timingCallback?.('🔍 NRRD: reading header...');

    // A detached header names its payload; the bytes have to be fetched here,
    // where the host's file access lives, and handed to the reader.
    let detached: Uint8Array<ArrayBuffer> = new Uint8Array(0);
    const relative = detachedDataFile(data);
    if (relative) {
      if (relative.startsWith('LIST')) {
        throw new Error('Detached NRRD "data file: LIST" (one file per slice) is not supported');
      }
      if (!resolveDataFile) {
        throw new Error(
          `NRRD header references a detached data file "${relative}" but no way to read it was provided`
        );
      }
      const resolved = await resolveDataFile(relative);
      detached = new Uint8Array(resolved);
    }

    const volume = await parseNrrdWasm(data, detached);
    timingCallback?.(
      `✅ NRRD: ${volume.sizes.join('x')} volume in ${(performance.now() - start).toFixed(1)}ms`
    );

    const header = volume.header;
    return {
      sizes: volume.sizes,
      samples: volume.samples,
      ijkToWorld: volume.ijkToWorld,
      spaceUnits: readSpaceUnits(header),
      intensityUnits: readIntensityUnits(header),
      range: readRange(header),
      channels: volume.channels,
      header,
      fileName,
    };
  }
}

/** The `data file` field, read from the header text without decoding the body. */
function detachedDataFile(data: Uint8Array): string | undefined {
  const limit = Math.min(data.length, 1 << 16);
  let text = '';
  for (let i = 0; i < limit; i++) {
    text += String.fromCharCode(data[i]);
  }
  const match = text.match(/^\s*data\s*file\s*:\s*(.+)$/im);
  return match?.[1]?.trim();
}

function readSpaceUnits(header: Record<string, string>): string {
  const declared = header['space units'];
  if (declared) {
    const first = declared.match(/"([^"]*)"/);
    if (first?.[1]) {
      return first[1];
    }
  }
  // Medical NRRD without explicit units is millimetres by convention.
  return 'mm';
}

/**
 * Intensity semantics, which NRRD has no standard field for.
 *
 * `units:=HU` is what the tiff-visualizer bridge writes after applying
 * RescaleSlope/RescaleIntercept. `modality` is the DICOM-derived fallback so a
 * CT written by another tool still gets Hounsfield-aware defaults.
 */
function readIntensityUnits(header: Record<string, string>): string | undefined {
  const explicit = (header['units'] || header['intensity units'] || '').replace(/"/g, '').trim();
  if (explicit) {
    return explicit;
  }
  const modality = (header['modality'] || '').trim().toUpperCase();
  if (modality === 'CT' || modality.endsWith(':CT')) {
    return 'HU';
  }
  return undefined;
}

function readRange(header: Record<string, string>): { min: number; max: number } | undefined {
  const min = Number(header['min']);
  const max = Number(header['max']);
  if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
    return { min, max };
  }
  return undefined;
}
