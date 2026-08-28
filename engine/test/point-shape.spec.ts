import { test, expect, Page } from '@playwright/test';

function buildSmallPly(pointCount: number): Buffer {
  const header =
    'ply\n' +
    'format binary_little_endian 1.0\n' +
    `element vertex ${pointCount}\n` +
    'property float x\n' +
    'property float y\n' +
    'property float z\n' +
    'end_header\n';
  const body = Buffer.alloc(pointCount * 12);
  for (let i = 0; i < pointCount; i++) {
    body.writeFloatLE((i % 10) / 10, i * 12);
    body.writeFloatLE((i % 7) / 7, i * 12 + 4);
    body.writeFloatLE((i % 5) / 5, i * 12 + 8);
  }
  return Buffer.concat([Buffer.from(header, 'ascii'), body]);
}

async function loadPly(page: Page): Promise<void> {
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'small.ply',
    mimeType: 'application/octet-stream',
    buffer: buildSmallPly(1000),
  });
  await page.waitForFunction(() => {
    const source = (window as any).visualizer?.meshes?.[0];
    return source?.children?.some((child: any) => child.name === 'adaptive-round-pass');
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
  await loadPly(page);
});

test('adaptive two-pass is the default with an exact 3 px diameter cutoff', async ({ page }) => {
  const state = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    const source = visualizer.meshes[0];
    const round = source.children.find((child: any) => child.name === 'adaptive-round-pass');
    const shaderFor = (material: any) => {
      const shader = {
        vertexShader: '#include <logdepthbuf_vertex>',
        fragmentShader: '#include <common>\n#include <color_fragment>',
      };
      material.onBeforeCompile(shader, visualizer.webglRenderer);
      return shader.vertexShader;
    };
    return {
      sourceVisible: source.visible,
      roundParentIsSource: round.parent === source,
      sharesGeometry: round.geometry === source.geometry,
      square: {
        hasMask: source.material.alphaMap !== null,
        alphaTest: source.material.alphaTest,
        shader: shaderFor(source.material),
      },
      round: {
        hasMask: round.material.alphaMap !== null,
        alphaTest: round.material.alphaTest,
        shader: shaderFor(round.material),
      },
    };
  });

  expect(state.sourceVisible).toBe(true);
  expect(state.roundParentIsSource).toBe(true);
  expect(state.sharesGeometry).toBe(true);
  expect(state.square.hasMask).toBe(false);
  expect(state.square.alphaTest).toBe(0);
  expect(state.square.shader).toContain('gl_PointSize > 3.0');
  expect(state.round.hasMask).toBe(true);
  expect(state.round.alphaTest).toBe(0.5);
  expect(state.round.shader).toContain('gl_PointSize <= 3.0');
});

test('round pass inherits an alignment applied after loading', async ({ page }) => {
  const state = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    const source = visualizer.meshes[0];
    const round = source.children.find((child: any) => child.name === 'adaptive-round-pass');
    const aligned = visualizer.transformationMatrices[0].clone().makeTranslation(12, -3, 7);
    visualizer.setTransformationMatrix(0, aligned);
    source.updateWorldMatrix(true, true);
    return {
      sourceWorld: source.matrixWorld.elements.slice(),
      roundWorld: round.matrixWorld.elements.slice(),
      roundLocal: round.matrix.elements.slice(),
    };
  });

  expect(state.roundWorld).toEqual(state.sourceWorld);
  expect(state.sourceWorld.slice(12, 15)).toEqual([12, -3, 7]);
  expect(state.roundLocal).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
});

test('the experiment controls and alternate render modes are gone', async ({ page }) => {
  await page.locator('[data-tab="controls"]').click();
  await expect(page.locator('#point-rendering-experiments-mount')).toHaveCount(0);
  await expect(page.locator('#point-experiment-mode')).toHaveCount(0);
  expect(await page.evaluate(() => 'pointRenderingExperiments' in (window as any).visualizer)).toBe(
    false
  );
});
