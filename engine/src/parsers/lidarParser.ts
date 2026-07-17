import initWasm, {
  parse_e57,
  parse_las,
} from '../../../wasm/pointcloud-parser/pkg-web/pointcloud_parser';
import { SpatialData } from '../interfaces';

let initPromise: Promise<unknown> | null = null;
let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<
  number,
  { resolve: (scans: SpatialData[]) => void; reject: (error: Error) => void; fileName: string }
>();

function ensureWorker(): Worker | null {
  if (typeof Worker === 'undefined') {return null;}
  if (worker) {return worker;}
  // @ts-ignore -- the extension-host tsconfig type-checks shared parser files
  // as CommonJS, while this expression is emitted only by the web bundle.
  worker = new Worker(new URL('./lidarWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = event => {
    const request = pending.get(event.data.id);
    if (!request) {return;}
    pending.delete(event.data.id);
    if (event.data.error) {
      request.reject(new Error(event.data.error));
      return;
    }
    if (event.data.warnings?.length) {
      console.warn(
        `[LiDAR] ${request.fileName} loaded with decoder warnings:`,
        event.data.warnings
      );
    }
    request.resolve(event.data.scans as SpatialData[]);
  };
  worker.onerror = event => {
    const error = new Error(event.message || 'LiDAR decoder worker failed');
    for (const request of pending.values()) {request.reject(error);}
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function ensureInitialized(): Promise<unknown> {
  if (!initPromise) {
    initPromise = initWasm();
  }
  return initPromise;
}

function takeField(scan: any, method: string): Float32Array | null {
  const values = scan[method]() as Float32Array;
  return values.length ? values : null;
}

function marshalScan(scan: any, fallbackName: string): SpatialData {
  const scalarFields: Record<string, Float32Array> = {};
  const fields: Array<[string, string]> = [
    ['intensity', 'take_intensity'],
    ['classification', 'take_classification'],
    ['returnNumber', 'take_return_number'],
    ['numberOfReturns', 'take_number_of_returns'],
    ['scanAngle', 'take_scan_angle'],
    ['gpsTime', 'take_gps_time'],
    ['userData', 'take_user_data'],
    ['pointSourceId', 'take_point_source_id'],
    ['rowIndex', 'take_row_index'],
    ['columnIndex', 'take_column_index'],
  ];
  for (const [name, method] of fields) {
    const value = takeField(scan, method);
    if (value) {
      scalarFields[name] = value;
    }
  }
  const hasColors = scan.has_colors;
  const metadata = JSON.parse(scan.metadata_json || '{}') as Record<string, unknown>;
  const origin = Array.from(scan.source_origin() as Float64Array) as [number, number, number];
  const result: SpatialData = {
    vertices: [],
    faces: [],
    format: 'binary_little_endian',
    version: '1.0',
    comments: [`Imported from ${String(metadata.format ?? 'LiDAR')}`],
    vertexCount: scan.vertex_count,
    sourcePointCount: scan.source_count,
    faceCount: 0,
    hasColors,
    hasNormals: false,
    hasIntensity: !!scalarFields.intensity,
    fileName: scan.name || fallbackName,
    positionsArray: scan.take_positions(),
    colorsArray: hasColors ? scan.take_colors() : null,
    normalsArray: null,
    intensityArray: scalarFields.intensity ?? null,
    scalarFields,
    useTypedArrays: true,
    sourceOrigin: origin,
    metadata,
  };
  scan.free();
  return result;
}

export async function parseLidarFile(
  data: Uint8Array,
  extension: 'las' | 'laz' | 'e57',
  fileName: string
): Promise<SpatialData[]> {
  const decoderWorker = ensureWorker();
  if (decoderWorker) {
    const id = nextRequestId++;
    const result = new Promise<SpatialData[]>((resolve, reject) => {
      pending.set(id, { resolve, reject, fileName });
    });
    try {
      decoderWorker.postMessage({ id, data, extension, fileName }, [data.buffer]);
    } catch (error) {
      pending.delete(id);
      throw error;
    }
    return result;
  }

  // Non-browser test/runtime fallback.
  await ensureInitialized();
  const collection: any =
    extension === 'e57' ? parse_e57(data, fileName) : parse_las(data, fileName);
  try {
    const decodeErrors = JSON.parse(collection.errors_json || '[]') as string[];
    if (decodeErrors.length) {
      console.warn(`[LiDAR] ${fileName} loaded with decoder warnings:`, decodeErrors);
    }
    const scans: SpatialData[] = [];
    for (let i = 0; i < collection.scan_count; i++) {
      scans.push(marshalScan(collection.take_scan(i), fileName));
    }
    return scans;
  } finally {
    collection.free();
  }
}
