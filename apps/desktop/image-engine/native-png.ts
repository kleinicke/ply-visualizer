// Embedded layered-document previews are RGBA8 display images. Keep precise
// standalone PNG samples on the image engine's existing Rust worker path.
export async function decodeEmbeddedPng(bytes: Uint8Array) {
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = header.getUint32(16),
    height = header.getUint32(20);
  if (!width || !height || width * height > 150_000_000) {
    throw new Error('Embedded PNG exceeds the preview limit');
  }
  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Native PNG preview canvas unavailable');
    }
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, data: new Uint8Array(pixels.data.buffer) };
  } finally {
    bitmap.close();
  }
}

export async function mapSequential<T, R>(
  values: T[],
  convert: (value: T) => Promise<R>
): Promise<R[]> {
  const result: R[] = [];
  for (const value of values) {
    result.push(await convert(value));
  }
  return result;
}
