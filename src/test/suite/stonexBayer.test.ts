import * as assert from 'assert';
import { decodeCameraRgbForComparison } from '../../../engine/src/parsers/stonexX3aParser';
import { loadRegistrationWasm } from '../../../engine/src/registration/wasmLoader';

/**
 * The Rust demosaic against the TypeScript one it replaces.
 *
 * Equivalence is the whole bar for this port: the colour these produce is what
 * a user sees, and "close enough" would show up as a subtly different image
 * with no way to tell which half was wrong. So the comparison is byte-for-byte
 * on a plane built to exercise the parts that differ between naive and
 * per-lattice demosaicing — sharp colour edges, saturation, and the borders
 * where sampling has to clamp.
 */
suite('Stonex Bayer demosaic: Rust matches TypeScript', () => {
  /** A GRBG plane with hard edges, saturated patches and a gradient. */
  function makePlane(width: number, height: number): Uint8Array {
    const pixels = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const evenRow = (y & 1) === 0;
        const evenCol = (x & 1) === 0;
        // GRBG: even row = G R, odd row = B G.
        const isGreen = evenRow === evenCol;
        let value: number;
        if (x < width / 3) {
          value = isGreen ? 200 : 20; // strong green field
        } else if (x < (2 * width) / 3) {
          value = evenRow && !evenCol ? 255 : 5; // saturated red, clipped
        } else {
          value = Math.round(((x + y) / (width + height)) * 255); // gradient
        }
        pixels[y * width + x] = value;
      }
    }
    return pixels;
  }

  test('produces identical images on a plane with edges, clipping and a gradient', async function () {
    const wasm = (await loadRegistrationWasm()) as unknown as {
      stonex_decode_frame?: (
        pixels: Uint8Array,
        rawWidth: number,
        rawHeight: number,
        imageWidth: number,
        imageHeight: number
      ) => { width: number; height: number; take_data(): Uint8Array; free?(): void };
    } | null;
    if (!wasm?.stonex_decode_frame) {
      this.skip();
      return;
    }

    // Landscape raw plane, portrait calibrated image, as the sensor is mounted.
    const rawWidth = 64;
    const rawHeight = 48;
    const imageWidth = rawHeight;
    const imageHeight = rawWidth;
    const pixels = makePlane(rawWidth, rawHeight);

    const expected = decodeCameraRgbForComparison(
      pixels,
      rawWidth,
      rawHeight,
      imageWidth,
      imageHeight
    );
    const actual = wasm.stonex_decode_frame(pixels, rawWidth, rawHeight, imageWidth, imageHeight);
    // Read the dimensions before taking the buffer: freeing the handle first
    // leaves the getters pointing at nothing.
    const actualWidth = actual.width;
    const actualHeight = actual.height;
    const actualData = actual.take_data();
    actual.free?.();

    assert.strictEqual(actualWidth, expected.width, 'width');
    assert.strictEqual(actualHeight, expected.height, 'height');
    assert.strictEqual(actualData.length, expected.data.length, 'byte length');

    let firstMismatch = -1;
    for (let i = 0; i < expected.data.length; i++) {
      if (actualData[i] !== expected.data[i]) {
        firstMismatch = i;
        break;
      }
    }
    assert.strictEqual(
      firstMismatch,
      -1,
      firstMismatch < 0
        ? ''
        : `byte ${firstMismatch} (pixel ${Math.floor(firstMismatch / 3)}, channel ${firstMismatch % 3}): ` +
            `rust ${actualData[firstMismatch]} vs ts ${expected.data[firstMismatch]}`
    );
  });

  test('agrees on a flat sensor, which must stay colourless', async function () {
    const wasm = (await loadRegistrationWasm()) as any;
    if (!wasm?.stonex_decode_frame) {
      this.skip();
      return;
    }
    const pixels = new Uint8Array(32 * 16).fill(128);
    const expected = decodeCameraRgbForComparison(pixels, 32, 16, 16, 32);
    const actual = wasm.stonex_decode_frame(pixels, 32, 16, 16, 32);
    const data = actual.take_data();
    assert.deepStrictEqual(Array.from(data), Array.from(expected.data));
    assert.ok(
      Array.from(data as Uint8Array).every(value => value === 128),
      'a uniform plane must not gain colour'
    );
  });
});
