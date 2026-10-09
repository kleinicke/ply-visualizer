import { test, expect } from '@playwright/test';

/**
 * The banded projection must equal the single-pass one, byte for byte.
 *
 * Point count is the number a careless comparison would check, and it is the
 * one thing that stays right when a band goes wrong: a per-band depth range
 * shifts the grey ramp, an unshifted principal point bends the rays, and a
 * band-relative row index corrupts the pixel coordinates used for colour
 * mapping — none of them lose a point. So this compares the actual bytes, at
 * several splits, because a bug that only appears at eight bands will not show
 * up at one.
 */
test('bands reproduce a whole-image projection exactly', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  await page.waitForFunction(() => (window as any).__plyDepth !== undefined);

  const outcome = await page.evaluate(async () => {
    const depthApi = (window as any).__plyDepth;
    if (!(await depthApi.initTiffWasm())) {
      return { skipped: true, results: [] as any[] };
    }

    const width = 256;
    const height = 192;
    const data = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const hole = ((x >> 5) + (y >> 5)) % 11 === 0;
        data[y * width + x] = hole ? 0 : 1.5 + (x / width) * 4 + Math.sin(y * 0.02) * 0.6;
      }
    }

    const digest = (...arrays: any[]) => {
      // FNV-1a over the raw bytes: enough to catch a shifted ramp or a bent
      // ray, and available without a crypto round trip in the page.
      let hash = 0x811c9dc5;
      for (const array of arrays) {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let index = 0; index < bytes.length; index++) {
          hash ^= bytes[index];
          hash = Math.imul(hash, 0x01000193) >>> 0;
        }
      }
      return hash >>> 0;
    };

    const models: Array<[string, number[]]> = [
      ['pinhole-ideal', []],
      ['pinhole-opencv', [-0.28, 0.11, 0.0004, -0.0002, -0.02]],
      ['fisheye-kb3', [-0.02, 0.003, -0.0006, 0.00007]],
    ];

    let depthMin = Infinity;
    let depthMax = -Infinity;
    for (const value of data) {
      if (value > 0) {
        depthMin = Math.min(depthMin, value);
        depthMax = Math.max(depthMax, value);
      }
    }

    const results: any[] = [];
    for (const [model, coefficients] of models) {
      const params = {
        kind: 'euclidean',
        cameraModel: model,
        convention: 'opengl',
        fx: width * 0.9,
        fy: width * 0.9,
        cx: width / 2,
        cy: height / 2,
        coefficients,
      };
      const whole = depthApi.projectDepthWasmSync(data, width, height, params);
      const reference = { count: whole.pointCount, hash: digest(whole.vertices, whole.colors) };

      for (const bands of [2, 3, 8]) {
        const rows = Math.ceil(height / bands);
        const positions: Float32Array[] = [];
        const colors: Uint8Array[] = [];
        let count = 0;
        for (let index = 0; index < bands; index++) {
          const from = index * rows;
          const bandRows = Math.min(rows, height - from);
          if (bandRows <= 0) {
            break;
          }
          const slice = data.slice(from * width, (from + bandRows) * width);
          const band = depthApi.projectDepthBandWasmSync(
            slice,
            width,
            bandRows,
            from,
            depthMin,
            depthMax,
            { ...params, cy: params.cy - from }
          );
          count += band.pointCount;
          positions.push(band.vertices);
          colors.push(band.colors);
        }
        const join = (parts: any[], Type: any) => {
          const total = parts.reduce((sum, part) => sum + part.length, 0);
          const out = new Type(total);
          let at = 0;
          for (const part of parts) {
            out.set(part, at);
            at += part.length;
          }
          return out;
        };
        results.push({
          model,
          bands,
          same:
            count === reference.count &&
            digest(join(positions, Float32Array), join(colors, Uint8Array)) === reference.hash,
        });
      }
    }
    return { skipped: false, results };
  });

  test.skip(outcome.skipped, 'camera-model kernel unavailable in this browser');
  expect(outcome.results.length).toBe(9);
  for (const result of outcome.results) {
    expect(result, `${result.model} at ${result.bands} bands`).toMatchObject({ same: true });
  }
});

/**
 * The pool keeps each band's rows in its worker after the first projection,
 * so a parameter change sends only the parameters. Every later projection of
 * the same image with other intrinsics must still equal a whole-image one.
 */
test('re-projecting kept rows with new parameters matches a whole-image projection', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  await page.waitForFunction(
    () => (window as any).__plyDepth !== undefined && (window as any).__plyDepthPool !== undefined
  );

  const outcome = await page.evaluate(async () => {
    const depthApi = (window as any).__plyDepth;
    const { projectDepthInBands } = (window as any).__plyDepthPool;
    if (!(await depthApi.initTiffWasm())) {
      return { skipped: true, results: [] as any[] };
    }
    const width = 1200;
    const height = 900;
    const data = new Float32Array(width * height);
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 97 === 0 ? 0 : 1 + ((i * 7919) % 1000) / 250;
    }
    const digest = (...arrays: any[]) => {
      let hash = 0x811c9dc5;
      for (const array of arrays) {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let index = 0; index < bytes.length; index++) {
          hash = Math.imul(hash ^ bytes[index], 0x01000193) >>> 0;
        }
      }
      return hash >>> 0;
    };
    const results: any[] = [];
    for (const fx of [900, 1400, 900]) {
      const params = {
        kind: 'euclidean',
        cameraModel: 'pinhole-opencv',
        convention: 'opengl',
        fx,
        fy: fx,
        cx: width / 2,
        cy: height / 2,
        coefficients: [-0.2, 0.05, 0.0003, -0.0001, -0.01],
      };
      const whole = depthApi.projectDepthWasmSync(data, width, height, params);
      const banded = await projectDepthInBands(data, width, height, params);
      results.push({
        fx,
        banded: !!banded,
        same:
          !!banded &&
          banded.pointCount === whole.pointCount &&
          digest(banded.vertices, banded.colors) === digest(whole.vertices, whole.colors),
      });
    }
    return { skipped: false, results };
  });

  test.skip(outcome.skipped, 'camera-model kernel unavailable in this browser');
  expect(outcome.results).toEqual([
    { fx: 900, banded: true, same: true },
    { fx: 1400, banded: true, same: true },
    { fx: 900, banded: true, same: true },
  ]);
});
