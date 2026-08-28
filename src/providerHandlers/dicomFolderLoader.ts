import * as vscode from 'vscode';
import * as path from 'path';
import * as zlib from 'zlib';

interface ElementLocation {
  offset: number;
  length: number;
  vr: string;
}

export interface DicomSlice {
  uri: vscode.Uri;
  bytes: Uint8Array;
  studyUid: string;
  seriesUid: string;
  sopUid: string;
  seriesNumber?: number;
  instanceNumber?: number;
  modality?: string;
  position?: number[];
  orientation?: number[];
  pixelSpacing?: number[];
  sliceThickness?: number;
  windowCenter?: number;
  windowWidth?: number;
  photometricInterpretation: string;
  rows: number;
  columns: number;
  samplesPerPixel: number;
  bitsAllocated: number;
  bitsStored: number;
  signed: boolean;
  slope: number;
  intercept: number;
  transferSyntax: string;
  littleEndian: boolean;
  pixelTag: number;
  pixel: ElementLocation;
}

export interface DicomSeries {
  id: string;
  label: string;
  slices: DicomSlice[];
}

/** Semantic temporary filename: selection order must never replace DICOM identity. */
export function dicomSeriesFileName(series: DicomSeries, fallbackNumber: number): string {
  return `${dicomSeriesDisplayName(series, fallbackNumber)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}.nrrd`;
}

export function dicomSeriesDisplayName(series: DicomSeries, fallbackNumber: number): string {
  const first = series.slices[0];
  const seriesNumber = Number.isFinite(first?.seriesNumber)
    ? Math.trunc(first.seriesNumber!)
    : fallbackNumber;
  const modality = (first?.modality || 'DICOM').trim().toUpperCase();
  return `Series ${seriesNumber} ${modality || 'DICOM'}`;
}

const LONG_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN']);
const NATIVE_SYNTAXES: Record<string, { explicit: boolean; little: boolean }> = {
  '1.2.840.10008.1.2': { explicit: false, little: true },
  '1.2.840.10008.1.2.1': { explicit: true, little: true },
  '1.2.840.10008.1.2.2': { explicit: true, little: false },
};

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = offset; i < Math.min(bytes.length, offset + length); i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function readElement(
  view: DataView,
  bytes: Uint8Array,
  offset: number,
  explicit: boolean,
  little: boolean
):
  | ({ group: number; element: number; tag: number } & ElementLocation & { valueOffset: number })
  | null {
  if (offset + 8 > view.byteLength) {
    return null;
  }
  const group = view.getUint16(offset, little);
  const element = view.getUint16(offset + 2, little);
  let vr = '';
  let length: number;
  let valueOffset: number;
  if (explicit) {
    vr = ascii(bytes, offset + 4, 2);
    if (!/^[A-Z]{2}$/.test(vr)) {
      return null;
    }
    if (LONG_VR.has(vr)) {
      if (offset + 12 > view.byteLength) {
        return null;
      }
      length = view.getUint32(offset + 8, little);
      valueOffset = offset + 12;
    } else {
      length = view.getUint16(offset + 6, little);
      valueOffset = offset + 8;
    }
  } else {
    length = view.getUint32(offset + 4, little);
    valueOffset = offset + 8;
  }
  return {
    group,
    element,
    tag: group * 0x10000 + element,
    vr,
    length,
    offset: valueOffset,
    valueOffset,
  };
}

/** Skip a DICOM sequence/item whose value uses delimiter-based length. */
function skipUndefinedValue(
  view: DataView,
  bytes: Uint8Array,
  start: number,
  explicit: boolean,
  little: boolean,
  endElement = 0xe0dd
): number {
  let offset = start;
  while (offset + 8 <= view.byteLength) {
    const group = view.getUint16(offset, little);
    const element = view.getUint16(offset + 2, little);
    if (group === 0xfffe) {
      const length = view.getUint32(offset + 4, little);
      if (element === endElement) {
        return offset + 8;
      }
      if (element === 0xe000) {
        offset =
          length === 0xffffffff
            ? skipUndefinedValue(view, bytes, offset + 8, explicit, little, 0xe00d)
            : offset + 8 + length;
        continue;
      }
      offset += 8;
      continue;
    }
    const nested = readElement(view, bytes, offset, explicit, little);
    if (!nested) {
      return view.byteLength;
    }
    offset =
      nested.length === 0xffffffff
        ? skipUndefinedValue(view, bytes, nested.valueOffset, explicit, little)
        : nested.valueOffset + nested.length;
  }
  return view.byteLength;
}

function parseNumbers(value: string): number[] | undefined {
  const values = value.split('\\').map(Number);
  return values.length && values.every(Number.isFinite) ? values : undefined;
}

/** Content-based DICOM detection and native pixel-data header parsing. */
export function parseDicomSlice(uri: vscode.Uri, bytes: Uint8Array): DicomSlice | null {
  if (bytes.byteLength < 8) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hasPreamble = bytes.byteLength >= 132 && ascii(bytes, 128, 4) === 'DICM';
  let offset = hasPreamble ? 132 : 0;
  let transferSyntax = '1.2.840.10008.1.2';
  if (hasPreamble) {
    while (offset + 8 <= bytes.byteLength) {
      const el = readElement(view, bytes, offset, true, true);
      if (!el || el.group !== 0x0002) {
        break;
      }
      if (el.tag === 0x00020010) {
        transferSyntax = ascii(bytes, el.valueOffset, el.length).replace(/[\0 ]+$/g, '');
      }
      offset = el.valueOffset + el.length;
    }
  }
  let encoding = NATIVE_SYNTAXES[transferSyntax];
  if (!hasPreamble) {
    encoding = { explicit: /^[A-Z]{2}$/.test(ascii(bytes, 4, 2)), little: true };
  }
  if (!encoding) {
    return null;
  }

  const tags = new Map<number, ElementLocation>();
  let pixelTag = 0;
  let pixel: ElementLocation | undefined;
  while (offset + 8 <= bytes.byteLength) {
    const el = readElement(view, bytes, offset, encoding.explicit, encoding.little);
    if (!el) {
      break;
    }
    if (el.length === 0xffffffff) {
      offset = skipUndefinedValue(view, bytes, el.valueOffset, encoding.explicit, encoding.little);
      continue;
    }
    if (el.valueOffset + el.length > bytes.byteLength) {
      break;
    }
    if (el.tag === 0x7fe00010 || el.tag === 0x7fe00008 || el.tag === 0x7fe00009) {
      pixelTag = el.tag;
      pixel = { offset: el.valueOffset, length: el.length, vr: el.vr };
      break;
    }
    tags.set(el.tag, { offset: el.valueOffset, length: el.length, vr: el.vr });
    offset = el.valueOffset + el.length;
  }
  if (!pixel) {
    return null;
  }
  const text = (tag: number): string => {
    const el = tags.get(tag);
    return el ? ascii(bytes, el.offset, el.length).replace(/[\0 ]+$/g, '') : '';
  };
  const number = (tag: number, fallback?: number): number | undefined => {
    const value = Number(text(tag).split('\\')[0]);
    return Number.isFinite(value) ? value : fallback;
  };
  const ushort = (tag: number, fallback = 0): number => {
    const el = tags.get(tag);
    return el && el.length >= 2 ? view.getUint16(el.offset, encoding.little) : fallback;
  };
  const rows = ushort(0x00280010);
  const columns = ushort(0x00280011);
  const samplesPerPixel = ushort(0x00280002, 1);
  const bitsAllocated = ushort(
    0x00280100,
    pixelTag === 0x7fe00008 ? 32 : pixelTag === 0x7fe00009 ? 64 : 0
  );
  if (!rows || !columns || !bitsAllocated) {
    return null;
  }
  return {
    uri,
    bytes,
    studyUid: text(0x0020000d),
    seriesUid: text(0x0020000e),
    sopUid: text(0x00080018),
    seriesNumber: number(0x00200011),
    instanceNumber: number(0x00200013),
    modality: text(0x00080060) || undefined,
    position: parseNumbers(text(0x00200032)),
    orientation: parseNumbers(text(0x00200037)),
    pixelSpacing: parseNumbers(text(0x00280030)),
    sliceThickness: number(0x00180050),
    windowCenter: number(0x00281050),
    windowWidth: number(0x00281051),
    photometricInterpretation: text(0x00280004) || 'MONOCHROME2',
    rows,
    columns,
    samplesPerPixel,
    bitsAllocated,
    bitsStored: ushort(0x00280101, bitsAllocated),
    signed: ushort(0x00280103) === 1,
    slope: number(0x00281053, 1)!,
    intercept: number(0x00281052, 0)!,
    transferSyntax,
    littleEndian: encoding.little,
    pixelTag,
    pixel,
  };
}

function dot(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normal(slice: DicomSlice): number[] | undefined {
  if (!slice.orientation || slice.orientation.length < 6) {
    return undefined;
  }
  const [ax, ay, az, bx, by, bz] = slice.orientation;
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

export async function scanDicomFolder(
  folder: vscode.Uri,
  progress?: (done: number, total: number, name: string) => void,
  isCancelled?: () => boolean
): Promise<DicomSeries[]> {
  const entries = (await vscode.workspace.fs.readDirectory(folder)).filter(
    ([, type]) => (type & vscode.FileType.File) !== 0
  );
  const slices: DicomSlice[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, entries.length) }, async () => {
      while (!isCancelled?.()) {
        const index = next++;
        if (index >= entries.length) {
          return;
        }
        const [name] = entries[index];
        try {
          const uri = vscode.Uri.joinPath(folder, name);
          const bytes = await vscode.workspace.fs.readFile(uri);
          const slice = parseDicomSlice(uri, bytes);
          if (slice) {
            slices.push(slice);
          }
        } catch {
          // Mixed-content folders are normal; unreadable/non-DICOM files are ignored.
        }
        progress?.(index + 1, entries.length, name);
      }
    })
  );
  if (isCancelled?.()) {
    throw new Error('DICOM folder scan cancelled');
  }
  // Duplicate copies with different filenames are common in exported DICOM
  // folders. SOP Instance UID identifies the image object independently of
  // its path, so keep the first copy and do not create duplicate planes.
  const uniqueSlices = new Map<string, DicomSlice>();
  for (const slice of slices.sort((a, b) =>
    a.uri.path.localeCompare(b.uri.path, undefined, { numeric: true })
  )) {
    const key = slice.sopUid || slice.uri.toString();
    if (!uniqueSlices.has(key)) {
      uniqueSlices.set(key, slice);
    }
  }

  const groups = new Map<string, DicomSlice[]>();
  for (const slice of uniqueSlices.values()) {
    const orientation =
      slice.orientation
        ?.slice(0, 6)
        .map(v => v.toFixed(5))
        .join('\\') || '';
    const key = `${slice.studyUid}|${slice.seriesUid}|${slice.rows}x${slice.columns}|${orientation}`;
    const group = groups.get(key) || [];
    group.push(slice);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([id, group]) => {
      const n = normal(group[0]);
      group.sort((a, b) => {
        const ap = n && a.position ? dot(a.position, n) : undefined;
        const bp = n && b.position ? dot(b.position, n) : undefined;
        return ap !== undefined && bp !== undefined
          ? ap - bp
          : (a.instanceNumber ?? 0) - (b.instanceNumber ?? 0) ||
              path.basename(a.uri.fsPath).localeCompare(path.basename(b.uri.fsPath), undefined, {
                numeric: true,
              });
      });
      const first = group[0];
      return {
        id,
        label: `Series ${first.seriesNumber ?? '?'} · ${first.modality || 'DICOM'} · ${first.columns}×${first.rows}×${group.length}`,
        slices: group,
      };
    })
    .sort(
      (a, b) => (a.slices[0].seriesNumber ?? Infinity) - (b.slices[0].seriesNumber ?? Infinity)
    );
}

function decodeSlice(slice: DicomSlice): Float32Array {
  if (slice.samplesPerPixel !== 1) {
    throw new Error('Only grayscale DICOM series are supported.');
  }
  const count = slice.rows * slice.columns;
  const bytesPerSample = slice.bitsAllocated / 8;
  if (![1, 2, 4, 8].includes(bytesPerSample) || slice.pixel.length < count * bytesPerSample) {
    throw new Error(`Unsupported or truncated ${slice.bitsAllocated}-bit DICOM pixel data.`);
  }
  const view = new DataView(slice.bytes.buffer, slice.bytes.byteOffset, slice.bytes.byteLength);
  const out = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    const p = slice.pixel.offset + index * bytesPerSample;
    let value: number;
    if (slice.pixelTag === 0x7fe00008) {
      value = view.getFloat32(p, slice.littleEndian);
    } else if (slice.pixelTag === 0x7fe00009) {
      value = view.getFloat64(p, slice.littleEndian);
    } else if (bytesPerSample === 1) {
      value = slice.signed ? view.getInt8(p) : view.getUint8(p);
    } else if (bytesPerSample === 2) {
      value = view.getUint16(p, slice.littleEndian);
      if (slice.bitsStored < 16) {
        value &= 2 ** slice.bitsStored - 1;
      }
      if (slice.signed && value >= 2 ** (slice.bitsStored - 1)) {
        value -= 2 ** slice.bitsStored;
      }
    } else {
      value = slice.signed
        ? view.getInt32(p, slice.littleEndian)
        : view.getUint32(p, slice.littleEndian);
    }
    out[index] = value * slice.slope + slice.intercept;
  }
  return out;
}

function vector(v: readonly number[]): string {
  return `(${v.map(value => Number(value.toPrecision(12))).join(',')})`;
}

/** Decode a selected native grayscale series and serialize it as an internal NRRD. */
export function buildDicomSeriesNrrd(series: DicomSeries): Uint8Array {
  if (!series.slices.length) {
    throw new Error('The selected DICOM series is empty.');
  }
  const first = series.slices[0];
  const last = series.slices[series.slices.length - 1];
  const samples = new Float32Array(first.columns * first.rows * series.slices.length);
  for (let k = 0; k < series.slices.length; k++) {
    const slice = series.slices[k];
    if (slice.rows !== first.rows || slice.columns !== first.columns) {
      throw new Error('All slices in a DICOM series must have identical dimensions.');
    }
    samples.set(decodeSlice(slice), k * first.columns * first.rows);
  }
  const orientation = first.orientation?.length === 6 ? first.orientation : [1, 0, 0, 0, 1, 0];
  const row = orientation.slice(0, 3);
  const column = orientation.slice(3, 6);
  const spacing = first.pixelSpacing?.length === 2 ? first.pixelSpacing : [1, 1];
  const mmToM = 0.001;
  const iVector = row.map(v => v * spacing[1] * mmToM);
  const jVector = column.map(v => v * spacing[0] * mmToM);
  const cross = [
    row[1] * column[2] - row[2] * column[1],
    row[2] * column[0] - row[0] * column[2],
    row[0] * column[1] - row[1] * column[0],
  ];
  const kVector =
    series.slices.length > 1 && first.position && last.position
      ? first.position.map(
          (value, axis) => ((last.position![axis] - value) * mmToM) / (series.slices.length - 1)
        )
      : cross.map(v => v * (first.sliceThickness || 1) * mmToM);
  const origin = (first.position || [0, 0, 0]).map(v => v * mmToM);
  const lines = [
    'NRRD0004',
    '# Built directly from a DICOM folder by ply-visualizer',
    `content: ${dicomSeriesDisplayName(series, 1)}`,
    'type: float',
    'dimension: 3',
    `sizes: ${first.columns} ${first.rows} ${series.slices.length}`,
    'space: left-posterior-superior',
    `space directions: ${vector(iVector)} ${vector(jVector)} ${vector(kVector)}`,
    `space origin: ${vector(origin)}`,
    'space units: "m" "m" "m"',
    'kinds: domain domain domain',
    'encoding: gzip',
    'endian: little',
    `modality:=${first.modality || ''}`,
    ...(Number.isFinite(first.seriesNumber)
      ? [`dicom series number:=${Math.trunc(first.seriesNumber!)}`]
      : []),
    ...(first.modality?.toUpperCase() === 'CT' ? ['units:=HU'] : []),
    ...(Number.isFinite(first.windowCenter) ? [`window center:=${first.windowCenter}`] : []),
    ...(Number.isFinite(first.windowWidth) && first.windowWidth! > 0
      ? [`window width:=${first.windowWidth}`]
      : []),
    `photometric interpretation:=${first.photometricInterpretation}`,
  ];
  const header = Buffer.from(`${lines.join('\n')}\n\n`, 'ascii');
  const raw = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const payload = zlib.gzipSync(raw);
  return new Uint8Array(Buffer.concat([header, payload]));
}
