import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Provided in the page by media/wasm/tiff_wasm.js (no-modules build).
declare const wasm_bindgen: any;

/**
 * Coverage for the WASM-only image decode path.
 *
 * The extension used to decode TIFFs with geotiff.js and only used Rust as an
 * accelerator for the easy cases. That fallback is gone, so these tests pin the
 * two things the removal depends on: the decoder is genuinely reachable in the
 * webview, and it handles the layouts the old decoder choked on (tiled LZW,
 * planar configuration, sub-byte bit depths) rather than silently degrading.
 *
 * The fixtures in testfiles/tif/layouts/ all failed outright on the previous
 * decoder ("no lzw end code found", "color type RGB(12) is unsupported").
 */

/** Decode a file inside the page and return its shape, or the thrown error. */
async function decodeInPage(page: import('@playwright/test').Page, filePath: string) {
  const bytes = Array.from(new Uint8Array(fs.readFileSync(filePath)));
  return page.evaluate(async (data: number[]) => {
    // The no-modules glue declares `wasm_bindgen` as a top-level lexical
    // binding, which is NOT a property of globalThis - it has to be reached by
    // bare identifier, exactly as depth/readers/tiffWasm.ts does.
    const wasmApi = typeof wasm_bindgen === 'undefined' ? null : wasm_bindgen;
    if (!wasmApi) {
      return { error: 'wasm_bindgen global missing' };
    }
    await wasmApi({ module_or_path: (globalThis as any).__TIFF_WASM_URL__ });
    let result: any = null;
    try {
      result = wasmApi.decode_tiff_fast(new Uint8Array(data));
      const shape = {
        width: result.width,
        height: result.height,
        channels: result.channels,
        bitsPerSample: result.bits_per_sample,
      };
      const pixels = result.take_data_as_f32();
      let finite = 0;
      for (let i = 0; i < pixels.length; i++) {
        if (Number.isFinite(pixels[i])) {
          finite++;
        }
      }
      return { ...shape, samples: pixels.length, finite };
    } catch (error) {
      return { error: String(error) };
    } finally {
      try {
        result?.free?.();
      } catch {
        /* already freed */
      }
    }
  }, bytes);
}

test.describe('WASM TIFF decoding in the webview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/3d-visualizer/');
    await page.waitForSelector('#three-canvas');
  });

  test('the page loads no geotiff bundle', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', request => requests.push(request.url()));
    await page.reload();
    await page.waitForSelector('#three-canvas');
    expect(requests.filter(url => url.includes('geotiff'))).toEqual([]);
  });

  for (const fixture of [
    'shapes_lzw_tiled.tif',
    'shapes_lzw_tiled_planar.tif',
    'shapes_lzw_planar.tif',
    'shapes_lzw_12bps.tif',
  ]) {
    test(`decodes ${fixture}, which the geotiff-era decoder rejected`, async ({ page }) => {
      const result = await decodeInPage(page, path.resolve(`../testfiles/tif/layouts/${fixture}`));

      expect(result.error).toBeUndefined();
      expect(result.width).toBe(128);
      expect(result.height).toBe(72);
      expect(result.channels).toBe(3);
      // Every sample must be real data, not padding or NaN.
      expect(result.samples).toBe(128 * 72 * 3);
      expect(result.finite).toBe(result.samples);
    });
  }

  test('decodes 16-bit PNG through the vendored Rust backend', async ({ page }) => {
    const bytes = Array.from(
      new Uint8Array(fs.readFileSync(path.resolve('../testfiles/png/test_depth_16bit_mm.png')))
    );
    const result = await page.evaluate(async (data: number[]) => {
      const wasmApi = typeof wasm_bindgen === 'undefined' ? null : wasm_bindgen;
      await wasmApi({ module_or_path: (globalThis as any).__TIFF_WASM_URL__ });
      const decoded = wasmApi.decode_png16_fast(new Uint8Array(data));
      try {
        const samples = decoded.take_data_as_u16();
        return {
          width: decoded.width,
          height: decoded.height,
          channels: decoded.channels,
          bitDepth: decoded.bit_depth,
          sampleCount: samples.length,
        };
      } finally {
        decoded.free();
      }
    }, bytes);

    expect(result.bitDepth).toBe(16);
    expect(result.sampleCount).toBe(result.width * result.height * result.channels);
  });

  test('decodes EXR through the vendored Rust backend', async ({ page }) => {
    const bytes = Array.from(
      new Uint8Array(fs.readFileSync(path.resolve('../testfiles/exr/simple_uncompressed.exr')))
    );
    const result = await page.evaluate(async (data: number[]) => {
      const wasmApi = typeof wasm_bindgen === 'undefined' ? null : wasm_bindgen;
      await wasmApi({ module_or_path: (globalThis as any).__TIFF_WASM_URL__ });
      const decoded = wasmApi.decode_exr_fast(new Uint8Array(data));
      try {
        const samples = decoded.take_data_as_f32();
        return {
          width: decoded.width,
          height: decoded.height,
          channels: decoded.channels,
          sampleCount: samples.length,
        };
      } finally {
        decoded.free();
      }
    }, bytes);

    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.sampleCount).toBe(result.width * result.height * result.channels);
  });

  test('projects a depth TIFF to a point cloud with no JS fallback available', async ({ page }) => {
    await page
      .locator('#hiddenFileInput')
      .setInputFiles(path.resolve('../testfiles/tif/depth.tif'));

    const okButton = page.locator('#depth-ok');
    await expect(okButton).toBeVisible({ timeout: 10000 });
    await okButton.click();

    await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 15000 });
  });
});
