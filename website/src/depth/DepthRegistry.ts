import { DepthReader, DepthReaderResult } from './types';

const readers: DepthReader[] = [];

export function registerReader(reader: DepthReader): void {
  readers.push(reader);
}

export function registerDefaultReaders(): void {
  // Register depth format readers
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PfmReader } = require('./readers/PfmReader');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { TifReader } = require('./readers/TifReader');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { NpyReader } = require('./readers/NpyReader');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PngReader } = require('./readers/PngReader');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ExrReader } = require('./readers/ExrReader');

  registerReader(new PfmReader());
  registerReader(new TifReader());
  registerReader(new NpyReader());
  registerReader(new PngReader());
  registerReader(new ExrReader());
}

export function findReader(filename: string, mimeType?: string): DepthReader | undefined {
  return readers.find(r => r.canRead(filename, mimeType));
}

export async function readDepth(filename: string, buf: ArrayBuffer): Promise<DepthReaderResult> {
  const reader = findReader(filename);
  if (!reader) {
    throw new Error(`No depth reader registered for ${filename}`);
  }
  return reader.read(buf);
}

// For testing purposes - clear all registered readers
export function clearReaders(): void {
  readers.length = 0;
}
