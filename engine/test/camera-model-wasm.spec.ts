import { expect, test } from '@playwright/test';
import goldens from './fixtures/camera-model-goldens.json';

const intrinsics = { fx: 510, fy: 470, cx: 320, cy: 240 };

test.beforeEach(async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.evaluate(async () => {
    const api = (0, eval)('wasm_bindgen');
    await api({ module_or_path: (globalThis as any).__TIFF_WASM_URL__ });
  });
});

for (const [name, model] of [
  ['opencvPinhole', 'pinhole-opencv'],
  ['opencvFisheye', 'fisheye-opencv'],
  ['fisheye624', 'fisheye624'],
] as const) {
  test(`${model} matches its golden and round-trips through the WASM boundary`, async ({
    page,
  }) => {
    const fixture = goldens[name];
    const result = await page.evaluate(
      ({ model, fixture, intrinsics }) => {
        const api = (0, eval)('wasm_bindgen');
        const projected = Array.from(
          api.camera_project(
            model,
            intrinsics.fx,
            intrinsics.fy,
            intrinsics.cx,
            intrinsics.cy,
            new Float64Array(fixture.coefficients),
            fixture.ray[0],
            fixture.ray[1],
            fixture.ray[2]
          ) as Float64Array
        );
        const unprojected = Array.from(
          api.camera_unproject(
            model,
            intrinsics.fx,
            intrinsics.fy,
            intrinsics.cx,
            intrinsics.cy,
            new Float64Array(fixture.coefficients),
            projected[3],
            projected[4]
          ) as Float64Array
        );
        return { projected, unprojected };
      },
      { model, fixture, intrinsics }
    );

    expect(result.projected[0]).toBe(1);
    expect(result.projected[3]).toBeCloseTo(fixture.pixel[0], 7);
    expect(result.projected[4]).toBeCloseTo(fixture.pixel[1], 7);
    expect(result.unprojected[0]).toBe(1);
    const norm = Math.hypot(...fixture.ray);
    expect(result.unprojected[3]).toBeCloseTo(fixture.ray[0] / norm, 7);
    expect(result.unprojected[4]).toBeCloseTo(fixture.ray[1] / norm, 7);
    expect(result.unprojected[5]).toBeCloseTo(fixture.ray[2] / norm, 7);
  });
}

test('WASM reports coefficient errors and rejects out-of-domain pixels', async ({ page }) => {
  const result = await page.evaluate(
    ({ intrinsics }) => {
      const api = (0, eval)('wasm_bindgen');
      let coefficientError = '';
      try {
        api.camera_unproject(
          'fisheye-kb3',
          intrinsics.fx,
          intrinsics.fy,
          intrinsics.cx,
          intrinsics.cy,
          new Float64Array(5),
          320,
          240
        );
      } catch (error) {
        coefficientError = String(error);
      }
      const rejected = Array.from(
        api.camera_unproject(
          'fisheye-equidistant',
          intrinsics.fx,
          intrinsics.fy,
          intrinsics.cx,
          intrinsics.cy,
          new Float64Array(),
          1e9,
          1e9
        ) as Float64Array
      );
      return { coefficientError, rejected };
    },
    { intrinsics }
  );
  expect(result.coefficientError).toContain('exactly 4 coefficients');
  expect(result.rejected[0]).toBe(0);
  expect(result.rejected[1]).toBe(0);
});

test('batched depth projection uses the same inverse and reports rejected pixels', async ({
  page,
}) => {
  const result = await page.evaluate(
    ({ intrinsics }) => {
      const api = (0, eval)('wasm_bindgen');
      const batch = api.project_depth_fast(
        new Float32Array([2, 2]),
        2,
        1,
        'depth',
        'fisheye-equidistant',
        'opencv',
        intrinsics.fx,
        intrinsics.fy,
        0,
        0,
        new Float64Array()
      );
      const output = {
        pointCount: batch.point_count,
        rejectedCount: batch.rejected_count,
        nonConvergedCount: batch.non_converged_count,
        positions: Array.from(batch.take_positions() as Float32Array),
      };
      batch.free();
      return output;
    },
    { intrinsics }
  );
  expect(result.pointCount).toBe(2);
  expect(result.rejectedCount).toBe(0);
  expect(result.nonConvergedCount).toBe(0);
  expect(Math.hypot(...result.positions.slice(3, 6))).toBeCloseTo(2, 6);
});
