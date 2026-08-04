/**
 * Normalises binary payloads that arrived over `postMessage`.
 *
 * The extension-host boundary does not reliably preserve typed-array identity.
 * Depending on the VS Code version and how the message was serialised, a
 * `Uint8Array` sent from the extension can arrive as an `ArrayBuffer`, as a
 * typed-array view, as a plain array, or as a plain object with numeric keys
 * (`{0: 137, 1: 80, ...}`).
 *
 * The last case is the dangerous one: `new Uint8Array({0: 137, ...})` does not
 * throw, it silently yields a **zero-length** array. A caller then sees an
 * empty file rather than a transfer bug, and reports something misleading -
 * which is exactly how a COLMAP model came out looking like it had no points.
 *
 * Existing senders avoid this by posting `ArrayBuffer` slices (see
 * providerHandlers/binaryTransfer.ts). This accepts every shape anyway, so a
 * sender that forgets degrades to correct-but-slower rather than to silence.
 */
export function messageBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown> & { length?: number };
    // A structured clone of a typed array keeps a `length`; a JSON round trip
    // keeps only the numeric keys.
    const length =
      typeof record.length === 'number'
        ? record.length
        : Object.keys(record).filter(key => /^\d+$/.test(key)).length;
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index++) {
      bytes[index] = Number(record[index] ?? 0);
    }
    return bytes;
  }
  return new Uint8Array(0);
}
