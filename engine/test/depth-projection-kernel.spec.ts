import { expect, test } from '@playwright/test';

/**
 * The depth kernels — normalization and unprojection — checked against the
 * arithmetic rather than against the TypeScript loops they replaced.
 *
 * Those loops used to sit behind the Rust as a fallback, so a disagreement
 * between the two showed up as "the same file looks different depending on
 * whether the wasm loaded". The fallbacks are gone; these expectations are
 * worked out from the camera model by hand, so they hold the Rust to the
 * definition instead of to a second implementation.
 */

interface Projected {
  vertices: number[];
  colors: number[];
  pointCount: number;
}

/** Runs the kernels in the page, on a depth image built to order. */
async function project(
  page: import('@playwright/test').Page,
  depth: number[],
  width: number,
  height: number,
  meta: Record<string, unknown>
): Promise<Projected> {
  return page.evaluate(
    async ({ depth, width, height, meta }) => {
      const { initTiffWasm, normalizeDepth, projectToPointCloud } = (window as any).__plyDepth;
      // The module loads lazily, on the first depth file. Without this the
      // kernels throw — which is how this spec caught itself measuring the
      // JavaScript fallback rather than the Rust it names.
      if (!(await initTiffWasm())) {
        throw new Error('tiff wasm did not initialize');
      }
      const image = { width, height, data: new Float32Array(depth) };
      const normalized = normalizeDepth(image, { ...meta });
      const result = projectToPointCloud(normalized, meta);
      return {
        vertices: Array.from(result.vertices as Float32Array),
        colors: Array.from((result.colors ?? []) as Uint8Array),
        pointCount: result.pointCount as number,
      };
    },
    { depth, width, height, meta }
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
});

test('pinhole, orthogonal depth: X and Y come off the ray through the pixel', async ({ page }) => {
  // 2x1 image, principal point on the left pixel, so that pixel is the axis.
  const result = await project(page, [2, 2], 2, 1, {
    kind: 'z',
    cameraModel: 'pinhole-ideal',
    convention: 'opencv',
    fx: 100,
    fy: 100,
    cx: 0,
    cy: 0,
  });

  expect(result.pointCount).toBe(2);
  // Pixel (0,0) is on the optical axis: X = Y = 0, Z = the depth itself.
  expect(result.vertices.slice(0, 3)).toEqual([0, 0, 2]);
  // Pixel (1,0): X = ((u - cx) / fx) * Z = (1/100) * 2 = 0.02.
  expect(result.vertices[3]).toBeCloseTo(0.02, 6);
  expect(result.vertices[4]).toBeCloseTo(0, 6);
  expect(result.vertices[5]).toBeCloseTo(2, 6);
});

test('the OpenGL convention flips Y and Z against OpenCV', async ({ page }) => {
  const meta = {
    kind: 'z',
    cameraModel: 'pinhole-ideal',
    fx: 100,
    fy: 100,
    cx: 0,
    cy: 0,
  };
  const opencv = await project(page, [2, 2], 1, 2, { ...meta, convention: 'opencv' });
  const opengl = await project(page, [2, 2], 1, 2, { ...meta, convention: 'opengl' });

  expect(opengl.vertices.length).toBe(opencv.vertices.length);
  for (let i = 0; i < opencv.vertices.length; i += 3) {
    expect(opengl.vertices[i]).toBeCloseTo(opencv.vertices[i], 6);
    expect(opengl.vertices[i + 1]).toBeCloseTo(-opencv.vertices[i + 1], 6);
    expect(opengl.vertices[i + 2]).toBeCloseTo(-opencv.vertices[i + 2], 6);
  }
});

test('euclidean depth puts every point at that distance from the camera', async ({ page }) => {
  const result = await project(page, [3, 3, 3, 3], 2, 2, {
    kind: 'depth',
    cameraModel: 'pinhole-ideal',
    convention: 'opencv',
    fx: 50,
    fy: 50,
    cx: 0.5,
    cy: 0.5,
  });

  expect(result.pointCount).toBe(4);
  // The defining property: |P| is the depth value, whatever the pixel.
  for (let i = 0; i < result.pointCount; i++) {
    const [x, y, z] = result.vertices.slice(i * 3, i * 3 + 3);
    expect(Math.hypot(x, y, z)).toBeCloseTo(3, 4);
  }
});

test('fisheye-equidistant maps pixel radius to angle', async ({ page }) => {
  // r = 100 pixels at fx = 100 is theta = 1 radian from the axis.
  const result = await project(page, [0, 5], 2, 1, {
    kind: 'depth',
    cameraModel: 'fisheye-equidistant',
    convention: 'opencv',
    fx: 100,
    fy: 100,
    cx: -99,
    cy: 0,
  });

  // The first pixel is zero depth and therefore not a point at all.
  expect(result.pointCount).toBe(1);
  const [x, y, z] = result.vertices;
  expect(x).toBeCloseTo(5 * Math.sin(1), 3);
  expect(y).toBeCloseTo(0, 5);
  expect(z).toBeCloseTo(5 * Math.cos(1), 3);
});

test('invalid pixels are dropped, not projected to the origin', async ({ page }) => {
  const result = await project(page, [1, 0, Number.NaN, 2, -1, Number.POSITIVE_INFINITY], 3, 2, {
    kind: 'z',
    cameraModel: 'pinhole-ideal',
    convention: 'opencv',
    fx: 10,
    fy: 10,
    cx: 0,
    cy: 0,
  });

  // Zero, NaN, negative and infinite depths are all "no measurement here".
  expect(result.pointCount).toBe(2);
  expect(result.vertices.length).toBe(6);
  expect(result.vertices.every(Number.isFinite)).toBe(true);
});

test('disparity becomes metric depth through fx and the baseline', async ({ page }) => {
  // depth = fx * baseline / disparity: 100 * 0.5 / 25 = 2 metres.
  const result = await project(page, [25, 25], 2, 1, {
    kind: 'disparity',
    cameraModel: 'pinhole-ideal',
    convention: 'opencv',
    fx: 100,
    fy: 100,
    cx: 0,
    cy: 0,
    baseline: 0.5,
  });

  expect(result.pointCount).toBe(2);
  expect(result.vertices[2]).toBeCloseTo(2, 4);
});

test('inverse depth is inverted before projection', async ({ page }) => {
  const result = await project(page, [0.25, 0.5], 2, 1, {
    kind: 'inverse_depth',
    cameraModel: 'pinhole-ideal',
    convention: 'opencv',
    fx: 100,
    fy: 100,
    cx: 0,
    cy: 0,
    unit: 'meter',
    scale: 1,
  });

  expect(result.pointCount).toBe(2);
  expect(result.vertices[2]).toBeCloseTo(4, 4);
});

test('millimetre depth is converted to metres', async ({ page }) => {
  const result = await project(page, [1500, 1500], 2, 1, {
    kind: 'z',
    cameraModel: 'pinhole-ideal',
    convention: 'opencv',
    fx: 100,
    fy: 100,
    cx: 0,
    cy: 0,
    unit: 'millimeter',
    scale: 1,
  });

  expect(result.vertices[2]).toBeCloseTo(1.5, 5);
});

test('a depth clamp removes what falls outside it', async ({ page }) => {
  const result = await project(page, [1, 5, 10], 3, 1, {
    kind: 'z',
    cameraModel: 'pinhole-ideal',
    convention: 'opencv',
    fx: 100,
    fy: 100,
    cx: 0,
    cy: 0,
    depthClamp: { min: 2, max: 8 },
  });

  expect(result.pointCount).toBe(1);
  expect(result.vertices[2]).toBeCloseTo(5, 5);
});

test('the grey ramp runs with depth and stays inside its band', async ({ page }) => {
  const result = await project(page, [1, 10, 100], 3, 1, {
    kind: 'z',
    cameraModel: 'pinhole-ideal',
    convention: 'opencv',
    fx: 100,
    fy: 100,
    cx: 0,
    cy: 0,
  });

  const grey = [result.colors[0], result.colors[3], result.colors[6]];
  // Nearest is darkest, farthest is white, and the floor lifts the dark end
  // off black so the near points stay visible against the background.
  expect(grey[0]).toBeLessThan(grey[1]);
  expect(grey[1]).toBeLessThan(grey[2]);
  expect(grey[0]).toBeGreaterThanOrEqual(51);
  expect(grey[2]).toBeLessThanOrEqual(255);
  // Each channel of a point carries the same value: this is a grey ramp.
  expect(result.colors[0]).toBe(result.colors[1]);
  expect(result.colors[1]).toBe(result.colors[2]);
});

test('coefficients left over from another model do not break the projection', async ({ page }) => {
  // The reported failure: distortion values entered for an OpenCV fisheye, then
  // the model switched to ideal pinhole. The kernel refuses a four-coefficient
  // list for a model that takes none, so the list has to be fitted to the model
  // before it gets there — otherwise the depth panel produces no cloud at all.
  const result = await project(page, [2, 2], 2, 1, {
    kind: 'z',
    cameraModel: 'pinhole-ideal',
    convention: 'opencv',
    fx: 100,
    fy: 100,
    cx: 0,
    cy: 0,
    coefficients: [-0.02, 0.001, 0, 0],
  });

  expect(result.pointCount).toBe(2);
  expect(result.vertices.slice(0, 3)).toEqual([0, 0, 2]);
});

test('switching to equidistant fisheye with stale coefficients still projects', async ({
  page,
}) => {
  const result = await project(page, [0, 5], 2, 1, {
    kind: 'depth',
    cameraModel: 'fisheye-equidistant',
    convention: 'opencv',
    fx: 100,
    fy: 100,
    cx: -99,
    cy: 0,
    coefficients: [0.1, 0.2, 0.3, 0.4, 0.5],
  });

  expect(result.pointCount).toBe(1);
  expect(result.vertices[0]).toBeCloseTo(5 * Math.sin(1), 3);
});
