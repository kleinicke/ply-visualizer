import { test } from '@playwright/test';
test('cost of unused parameters', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('/3d-visualizer/');
  await page.waitForSelector('#three-canvas');
  const out = await page.evaluate(async () => {
    const { initTiffWasm, normalizeDepth, projectToPointCloud } = (window as any).__plyDepth;
    await initTiffWasm();
    const w = 1024,
      h = 1024;
    const data = new Float32Array(w * h);
    for (let i = 0; i < data.length; i++) {data[i] = 2 + (i % 100) / 100;}
    const run = (cameraModel: string, coefficients: number[]) => {
      const meta: any = {
        kind: 'depth',
        cameraModel,
        convention: 'opengl',
        fx: 500,
        fy: 500,
        cx: (w - 1) / 2,
        cy: (h - 1) / 2,
        coefficients,
      };
      // Two runs, report the faster, to take JIT/warm-up out of it.
      let best = Infinity,
        points = 0;
      for (let i = 0; i < 2; i++) {
        const t = performance.now();
        const r = projectToPointCloud(
          normalizeDepth({ width: w, height: h, data: new Float32Array(data) }, { ...meta }),
          meta
        );
        best = Math.min(best, performance.now() - t);
        points = r.pointCount;
      }
      return { ms: Math.round(best), points };
    };
    const k = [-0.05, 0.01, 0.001, 0.002, 0.0001];
    const radial4 = [-0.05, 0.01, 0.001, 0.0001];
    return {
      'pinhole-opencv (5 coefficients)': run('pinhole-opencv', k),
      'pinhole-opencv (same 5, padded to 14)': run('pinhole-opencv', [
        ...k,
        ...new Array(9).fill(0),
      ]),
      'pinhole-opencv (14, rational+prism set)': run('pinhole-opencv', [
        ...k,
        0.01,
        0.001,
        0.0001,
        1e-5,
        1e-5,
        1e-5,
        1e-5,
        0,
        0,
      ]),
      'fisheye-kb3 (4 radial)': run('fisheye-kb3', radial4),
      'fisheye624 (same 4 radial, 8 zeros)': run('fisheye624', [
        ...radial4,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ]),
      'fisheye624 (radial + tangential/prism)': run('fisheye624', [
        ...radial4,
        0,
        0,
        1e-4,
        1e-4,
        1e-5,
        1e-5,
        1e-5,
        1e-5,
      ]),
    };
  });
  console.log('\n==== COST ====\n' + JSON.stringify(out, null, 1));
});
