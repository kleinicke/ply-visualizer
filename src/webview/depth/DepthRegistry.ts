import { DepthReader, DepthReaderResult } from './types';

const readers: DepthReader[] = [];

export function registerReader(reader: DepthReader): void {
  readers.push(reader);
}

export function registerDefaultReaders(): void {
  // Lazy require to avoid circular deps in bundlers
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TiffReader } = require('./readers/TiffReader');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Png16Reader } = require('./readers/Png16Reader');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PfmReader } = require('./readers/PfmReader');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ExrReader } = require('./readers/ExrReader');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NpyReader } = require('./readers/NpyReader');

  registerReader(new TiffReader());
  registerReader(new Png16Reader());
  registerReader(new PfmReader());
  registerReader(new ExrReader());
  registerReader(new NpyReader());
}

export function findReader(filename: string, mimeType?: string): DepthReader | undefined {
  return readers.find(r => r.canRead(filename, mimeType));
}

export async function readDepth(filename: string, buf: ArrayBuffer): Promise<DepthReaderResult> {
  const reader = findReader(filename);
  if (!reader) throw new Error(`No depth reader registered for ${filename}`);
  return reader.read(buf);
}


