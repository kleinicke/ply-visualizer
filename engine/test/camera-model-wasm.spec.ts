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
  ['opencvPinholeExtended', 'pinhole-opencv'],
  ['opencvFisheye', 'fisheye-opencv'],
  ['fisheye624', 'fisheye624'],
  ['e57Pinhole', 'e57-pinhole'],
  ['e57Spherical', 'e57-spherical'],
  ['e57Cylindrical', 'e57-cylindrical'],
] as const) {
  test(`${name} (${model}) matches its golden and round-trips through the WASM boundary`, async ({
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

test('indexed camera batch uses the extended OpenCV model and FOV guard', async ({ page }) => {
  const result = await page.evaluate(
    ({ intrinsics, fixture }) => {
      const api = (0, eval)('wasm_bindgen');
      return Array.from(
        api.camera_project_points_indexed(
          'pinhole-opencv',
          intrinsics.fx,
          intrinsics.fy,
          intrinsics.cx,
          intrinsics.cy,
          new Float64Array(fixture.coefficients),
          new Float32Array([...fixture.ray, 2, 0, 1]),
          new Uint32Array([0, 1]),
          new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
          1,
          1
        ) as Float32Array
      );
    },
    { intrinsics, fixture: goldens.opencvPinholeExtended }
  );
  expect(result[0]).toBeCloseTo(goldens.opencvPinholeExtended.pixel[0], 4);
  expect(result[1]).toBeCloseTo(goldens.opencvPinholeExtended.pixel[1], 4);
  expect(result[2]).toBeNaN();
  expect(result[3]).toBeNaN();
});

test('indexed camera batch supports E57 all-around and negative-Z conventions', async ({
  page,
}) => {
  const result = await page.evaluate(
    ({ intrinsics }) => {
      const api = (0, eval)('wasm_bindgen');
      const identity = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const spherical = Array.from(
        api.camera_project_points_indexed(
          'e57-spherical',
          intrinsics.fx,
          intrinsics.fy,
          intrinsics.cx,
          intrinsics.cy,
          new Float64Array(),
          new Float32Array([3, 4, 2]),
          new Uint32Array([0]),
          identity,
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY
        ) as Float32Array
      );
      const pinhole = Array.from(
        api.camera_project_points_indexed(
          'e57-pinhole',
          intrinsics.fx,
          intrinsics.fy,
          intrinsics.cx,
          intrinsics.cy,
          new Float64Array(),
          new Float32Array([0.3, -0.2, -2]),
          new Uint32Array([0]),
          identity,
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY
        ) as Float32Array
      );
      return { spherical, pinhole };
    },
    { intrinsics }
  );
  expect(result.spherical[0]).toBeCloseTo(goldens.e57Spherical.pixel[0], 4);
  expect(result.spherical[1]).toBeCloseTo(goldens.e57Spherical.pixel[1], 4);
  expect(result.pinhole[0]).toBeCloseTo(goldens.e57Pinhole.pixel[0], 4);
  expect(result.pinhole[1]).toBeCloseTo(goldens.e57Pinhole.pixel[1], 4);
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
