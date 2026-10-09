import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * A large stripped TIFF is decoded a run of strips per pool worker, and the
 * runs stack back into the image. Like the banded projection, this must be the
 * same bytes as decoding the file in one call, not merely the same size.
 */
test('decoding a TIFF in strip runs equals decoding it in one call', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  await page.waitForFunction(() => (window as any).__plyDepthPool !== undefined);
  // 2112 x 2112 deflate float with the floating-point predictor, 69 strips.
  const encoded = fs
    .readFileSync(path.resolve('../testfiles/tif/depth_left.tif'))
    .toString('base64');

  const outcome = await page.evaluate(async encoded => {
    const { decodeTiffInStrips, decodeTiffWasm } = (window as any).__plyDepthPool;
    const file = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    const striped = await decodeTiffInStrips(file);
    const whole = await decodeTiffWasm(file.slice().buffer);
    const same = (a: Float32Array, b: Float32Array) => {
      if (a.length !== b.length) {
        return false;
      }
      const x = new Uint32Array(a.buffer, a.byteOffset, a.length);
      const y = new Uint32Array(b.buffer, b.byteOffset, b.length);
      for (let i = 0; i < x.length; i++) {
        if (x[i] !== y[i]) {
          return false;
        }
      }
      return true;
    };
    return {
      striped: !!striped,
      layout: striped && [striped.width, striped.height, striped.channels],
      wholeLayout: [whole.width, whole.height, whole.channels],
      identical: !!striped && same(striped.data, whole.data),
    };
  }, encoded);

  expect(outcome.striped).toBe(true);
  expect(outcome.layout).toEqual(outcome.wholeLayout);
  expect(outcome.identical).toBe(true);
});

test('decoding a ZIP16 EXR in block runs equals decoding it in one call', async ({ page }) => {
  // Served from the build output, like the zero-copy PLY fixture: 45 MB is
  // too much to hand to the page as an argument.
  fs.copyFileSync(
    path.resolve('../testfiles/exr/z_00_depth_002.exr'),
    path.resolve('dist/strip-decode-fixture.exr')
  );
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  await page.waitForFunction(() => (window as any).__plyDepthPool !== undefined);

  const outcome = await page.evaluate(async () => {
    const { decodeExrInBlocks, decodeExrWasm } = (window as any).__plyDepthPool;
    const file = new Uint8Array(await (await fetch('/strip-decode-fixture.exr')).arrayBuffer());
    const blocks = await decodeExrInBlocks(file);
    const whole = await decodeExrWasm(file.slice().buffer);
    const same = (a: Float32Array, b: Float32Array) => {
      if (a.length !== b.length) {
        return false;
      }
      const x = new Uint32Array(a.buffer, a.byteOffset, a.length);
      const y = new Uint32Array(b.buffer, b.byteOffset, b.length);
      for (let i = 0; i < x.length; i++) {
        if (x[i] !== y[i]) {
          return false;
        }
      }
      return true;
    };
    return {
      blocks: !!blocks,
      layout: blocks && [blocks.width, blocks.height, blocks.channels, blocks.displayedChannels],
      wholeLayout: [whole.width, whole.height, whole.channels, whole.displayedChannels],
      identical: !!blocks && same(blocks.data, whole.data),
    };
  });

  expect(outcome.blocks).toBe(true);
  expect(outcome.layout).toEqual(outcome.wholeLayout);
  expect(outcome.identical).toBe(true);
});
