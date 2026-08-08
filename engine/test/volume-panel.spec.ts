import { expect, test } from '@playwright/test';

test('volume controls request filtered points and replace them with a thresholded mesh', async ({
  page,
}) => {
  await page.goto('/3d-visualizer/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
  await page.waitForTimeout(500);

  await page.evaluate(async () => {
    const visualizer = (window as any).visualizer;
    await visualizer.handleVolumeData({
      type: 'volumeData',
      fileName: 'synthetic.nrrd',
      data: {
        vertices: [],
        faces: [],
        format: 'binary_little_endian',
        version: '1.0',
        comments: [],
        vertexCount: 8,
        faceCount: 0,
        hasColors: true,
        hasNormals: false,
        hasIntensity: true,
        useTypedArrays: true,
        positionsArray: new Float32Array(24),
        colorsArray: new Uint8Array(24),
        intensityArray: new Float32Array([0, 1, 2, 3, 0, 1, 2, 3]),
        scalarFields: { intensity: new Float32Array([0, 1, 2, 3, 0, 1, 2, 3]) },
        metadata: {
          volumeSessionId: 'synthetic-session',
          volumeRenderMode: 'points',
          volumeRange: { min: 0, max: 3 },
          volumeHistogram: [2, 2, 2, 2],
          volumeSizes: [2, 2, 2],
          threshold: 0,
          windowCenter: 1.5,
          windowWidth: 3,
          sliceIndices: [0, 0, 0],
          meshExtractionStep: [1, 1, 1],
          extractionStep: [1, 1, 1],
          ijkToWorld: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        },
      },
    });
  });

  const threshold = page.getByLabel('Volume threshold value');
  await expect(threshold).toBeVisible();
  const scrollTopBefore = await page.locator('#file-list').evaluate(element => {
    const list = element as HTMLElement;
    list.style.height = '48px';
    list.style.overflowY = 'auto';
    list.scrollTop = list.scrollHeight;
    const input = list.querySelector('[aria-label="Volume threshold value"]') as HTMLInputElement;
    input.value = '2';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return list.scrollTop;
  });
  expect(scrollTopBefore).toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const visualizer = (window as any).visualizer;
        return visualizer.spatialFiles[0]?.vertexCount;
      })
    )
    .toBe(4);
  expect(await page.locator('#file-list').evaluate(element => element.scrollTop)).toBe(
    scrollTopBefore
  );

  await page.getByLabel('Volume render mode').selectOption('mesh');

  await expect
    .poll(() =>
      page.evaluate(() => {
        const visualizer = (window as any).visualizer;
        return {
          isMesh: visualizer.meshes[0]?.isMesh === true,
          hasFaces: visualizer.spatialFiles[0]?.faceCount > 0,
        };
      })
    )
    .toEqual({ isMesh: true, hasFaces: true });
});
