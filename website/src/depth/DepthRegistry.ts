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
  // const { ExrReader } = require('./readers/ExrReader');

  registerReader(new PfmReader());
  registerReader(new TifReader());
  registerReader(new NpyReader());
  registerReader(new PngReader());
  // registerReader(new ExrReader());

  // Note: Rgb24Reader is no longer used as a reader.
  // RGB24 conversion is now handled by TifReader and PngReader directly
  // after they detect RGB images at runtime using Rgb24Converter utility.
}

export function findReader(filename: string, mimeType?: string): DepthReader | undefined {
  // Search from the END to prioritize most recently registered readers
  // This allows custom-configured readers to override default readers
  for (let i = readers.length - 1; i >= 0; i--) {
    if (readers[i].canRead(filename, mimeType)) {
      return readers[i];
    }
  }
  return undefined;
}

export async function readDepth(filename: string, buf: ArrayBuffer): Promise<DepthReaderResult> {
  const reader = findReader(filename);
  if (!reader) {
    throw new Error(`No depth reader registered for ${filename}`);
  }
  console.log(`[DepthRegistry] Selected reader for ${filename}: ${reader.constructor.name}`);
  return reader.read(buf);
}

// For testing purposes - clear all registered readers
export function clearReaders(): void {
  readers.length = 0;
}
