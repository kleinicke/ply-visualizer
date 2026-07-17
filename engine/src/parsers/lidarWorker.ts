import initWasm, {
  parse_e57,
  parse_las,
} from '../../../wasm/pointcloud-parser/pkg-web/pointcloud_parser';
import { SpatialData } from '../interfaces';

interface DecodeRequest {
  id: number;
  data: Uint8Array;
  extension: 'las' | 'laz' | 'e57';
  fileName: string;
}

// Keep WebWorker globals local to this module. A triple-slash WebWorker lib
// reference pollutes the shared DOM compilation and changes CanvasImageSource.
const workerScope: any = self;

let initPromise: Promise<unknown> | null = null;

function takeField(scan: any, method: string): Float32Array | null {
  const values = scan[method]() as Float32Array;
  return values.length ? values : null;
}

function marshalScan(scan: any, fallbackName: string): SpatialData {
  try {
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
      if (value) {scalarFields[name] = value;}
    }
    const hasColors = scan.has_colors;
    const metadata = JSON.parse(scan.metadata_json || '{}') as Record<string, unknown>;
    return {
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
      sourceOrigin: Array.from(scan.source_origin() as Float64Array) as [number, number, number],
      metadata,
    };
  } finally {
    scan.free();
  }
}

function transferables(scans: SpatialData[]): Transferable[] {
  const buffers = new Set<ArrayBuffer>();
  for (const scan of scans) {
    if (scan.positionsArray) {buffers.add(scan.positionsArray.buffer as ArrayBuffer);}
    if (scan.colorsArray) {buffers.add(scan.colorsArray.buffer as ArrayBuffer);}
    if (scan.normalsArray) {buffers.add(scan.normalsArray.buffer as ArrayBuffer);}
    for (const values of Object.values(scan.scalarFields || {})) {
      buffers.add(values.buffer as ArrayBuffer);
    }
  }
  return [...buffers];
}

workerScope.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const { id, data, extension, fileName } = event.data;
  let collection: any;
  try {
    initPromise ??= initWasm();
    await initPromise;
    collection = extension === 'e57' ? parse_e57(data, fileName) : parse_las(data, fileName);
    const warnings = JSON.parse(collection.errors_json || '[]') as string[];
    const scans: SpatialData[] = [];
    for (let i = 0; i < collection.scan_count; i++) {
      scans.push(marshalScan(collection.take_scan(i), fileName));
    }
    workerScope.postMessage({ id, scans, warnings }, transferables(scans));
  } catch (error) {
    workerScope.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    collection?.free();
  }
};
