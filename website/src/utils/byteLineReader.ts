/**
 * Reads lines one at a time from a raw Uint8Array without decoding the entire
 * buffer upfront. Keeps memory usage proportional to one line at a time instead
 * of O(file size).
 *
 * Handles both LF (\n) and CRLF (\r\n) line endings.
 */
export class ByteLineReader {
  private pos: number;
  private readonly data: Uint8Array;
  private readonly decoder: TextDecoder;

  constructor(data: Uint8Array, startOffset = 0) {
    this.data = data;
    this.pos = startOffset;
    this.decoder = new TextDecoder('utf-8');
  }

  get offset(): number {
    return this.pos;
  }

  get done(): boolean {
    return this.pos >= this.data.length;
  }

  /** Read and return the next line, or null when the buffer is exhausted. */
  nextLine(): string | null {
    if (this.pos >= this.data.length) {
      return null;
    }

    const start = this.pos;
    while (this.pos < this.data.length && this.data[this.pos] !== 10 /* \n */) {
      this.pos++;
    }

    const line = this.decoder.decode(this.data.subarray(start, this.pos));

    if (this.pos < this.data.length) {
      this.pos++;
    } // consume \n

    // Strip trailing \r for CRLF files
    return line.endsWith('\r') ? line.slice(0, -1) : line;
  }
}

/**
 * Scan the raw byte buffer for the first occurrence of "DATA " at the start of
 * a line and return the byte offset immediately after that line's newline.
 * Returns -1 if not found.
 */
export function findPcdDataOffset(data: Uint8Array): number {
  // "DATA" in ASCII: 68 65 84 65
  for (let i = 0; i + 5 < data.length; i++) {
    // Must be at start of a line (position 0 or preceded by \n)
    if (i > 0 && data[i - 1] !== 10) {
      continue;
    }

    if (
      data[i] === 68 &&
      data[i + 1] === 65 &&
      data[i + 2] === 84 &&
      data[i + 3] === 65 &&
      data[i + 4] === 32 // space after "DATA"
    ) {
      // Advance past this line
      let j = i + 5;
      while (j < data.length && data[j] !== 10) {
        j++;
      }
      return j + 1; // byte after \n
    }
  }
  return -1;
}
