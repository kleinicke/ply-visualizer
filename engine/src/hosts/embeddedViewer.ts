/** Framework-neutral embedding boundary. This module imports no native host API. */
import { NpyReader } from '../depth/readers/NpyReader';
import { PfmReader } from '../depth/readers/PfmReader';
import { ExrReader } from '../depth/readers/ExrReader';
import { decodeTiffWasm } from '../depth/readers/tiffWasm';
import { handleBrowserFiles, type BrowserFileDragDropHost } from '../browserFileDragDrop';
import { setExportFileHost, type ExportFile } from './exportFile';

export interface ImagePreview {
  blob: Blob;
  width: number;
  height: number;
  description: string;
}
export interface EmbeddedViewer {
  ready(): Promise<void>;
  open(file: File, id: string): Promise<boolean>;
  configureExport(save: ExportFile): void;
  preview(file: File): Promise<ImagePreview>;
  objectCount(): number;
}

type EmbeddedWindow = Window & {
  embeddedViewer?: EmbeddedViewer;
  visualizer?: BrowserFileDragDropHost & { meshes?: unknown[] };
};
const opened = new Map<string, object[]>();
const previewReaders = [new NpyReader(), new PfmReader(), new ExrReader()];

async function ready() {
  const deadline = Date.now() + 60000;
  while (document.documentElement.dataset.visualizerReady !== 'true') {
    if (Date.now() > deadline) {throw new Error('3D viewer initialization timed out');}
    await new Promise(resolve => setTimeout(resolve, 30));
  }
}

async function preview(file: File): Promise<ImagePreview> {
  await ready();
  const bytes = await file.arrayBuffer();
  let width: number, height: number, data: Float32Array, channels: number;
  let description: string;
  if (/\.tiff?$/i.test(file.name)) {
    const decoded = await decodeTiffWasm(bytes);
    if (!decoded) {throw new Error('TIFF decoder is unavailable');}
    ({ width, height, data, channels } = decoded);
    description = `${channels} channel${channels === 1 ? '' : 's'} · display normalized to sample range`;
  } else {
    const reader = previewReaders.find(reader => reader.canRead(file.name));
    if (!reader) {throw new Error(`No image preview reader for ${file.name}`);}
    const decoded = await reader.read(bytes);
    ({ width, height, data } = decoded.image);
    channels = 1;
    description = 'Scalar preview · channel 0 · display normalized to sample range';
  }
  if (!width || !height || data.length < width * height * channels)
    {throw new Error('Image has no complete pixel plane');}
  // This is display mapping only. Original samples remain in the source File;
  // 3D conversion always reads that source, never the normalized preview.
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < data.length; i++)
    {if (Number.isFinite(data[i])) {
      min = Math.min(min, data[i]);
      max = Math.max(max, data[i]);
    }}
  const range = max > min ? max - min : 1;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {throw new Error('Image canvas is unavailable');}
  const pixels = ctx.createImageData(width, height);
  for (let p = 0; p < width * height; p++) {
    for (let c = 0; c < 3; c++) {
      const value = data[p * channels + (channels >= 3 ? c : 0)];
      pixels.data[p * 4 + c] = Number.isFinite(value)
        ? Math.round(((value - min) * 255) / range)
        : 0;
    }
    pixels.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Could not create preview'))),
      'image/png'
    )
  );
  canvas.width = canvas.height = 0;
  return { blob, width, height, description };
}

(window as EmbeddedWindow).embeddedViewer = {
  ready,
  configureExport: setExportFileHost,
  async open(file, id) {
    await ready();
    const host = (window as EmbeddedWindow).visualizer!;
    if (opened.get(id)?.some(data => host.spatialFiles.includes(data as never))) {return true;}
    const before = new Set(host.spatialFiles);
    const input = document.getElementById('hiddenFileInput') as HTMLInputElement;
    const transfer = new DataTransfer();
    transfer.items.add(new File([file], file.name, { type: file.type }));
    input.files = transfer.files;
    await handleBrowserFiles(host, [transfer.files[0]]);
    const added = host.spatialFiles.filter(data => !before.has(data));
    if (added.length) {opened.set(id, added);}
    return added.length > 0;
  },
  preview,
  objectCount: () => (window as EmbeddedWindow).visualizer?.meshes?.length ?? 0,
};
