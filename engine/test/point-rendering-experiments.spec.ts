import { test, expect, type Page } from '@playwright/test';

function smallPly(pointCount = 1_000): Buffer {
  const header = Buffer.from(
    `ply\nformat binary_little_endian 1.0\nelement vertex ${pointCount}\n` +
      'property float x\nproperty float y\nproperty float z\nend_header\n'
  );
  const body = Buffer.alloc(pointCount * 12);
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2;
    body.writeFloatLE(Math.cos(angle), i * 12);
    body.writeFloatLE(Math.sin(angle), i * 12 + 4);
    body.writeFloatLE((i % 20) / 20, i * 12 + 8);
  }
  return Buffer.concat([header, body]);
}

async function load(page: Page): Promise<void> {
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'experiment.ply',
    mimeType: 'application/octet-stream',
    buffer: smallPly(),
  });
  await page.waitForFunction(() => (window as any).visualizer?.meshes?.length === 1);
  await page.locator('[data-tab="controls"]').click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
  await load(page);
});

test('exposes all experiment setups and switches alpha behavior', async ({ page }) => {
  const options = await page.locator('#point-experiment-mode option').allTextContents();
  expect(options).toEqual([
    'Baseline — original round points',
    'Adaptive — whole cloud at 4 px',
    'Adaptive 2-pass — per point at 4 px',
    'A — square, no alpha test',
    'B — round, transparent',
    'D — square, front-to-back chunks',
    'C — square, depth prepass',
  ]);

  const cameraBefore = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    return {
      position: visualizer.camera.position.toArray(),
      quaternion: visualizer.camera.quaternion.toArray(),
      target: visualizer.controls.target.toArray(),
    };
  });

  await page.locator('#point-experiment-mode').selectOption('no-alpha');
  expect(
    await page.evaluate(() => {
      const material = (window as any).visualizer.meshes[0].material;
      return {
        alphaMap: material.alphaMap,
        alphaTest: material.alphaTest,
        transparent: material.transparent,
      };
    })
  ).toEqual({ alphaMap: null, alphaTest: 0, transparent: false });

  await page.locator('#point-experiment-mode').selectOption('transparent');
  expect(
    await page.evaluate(() => {
      const material = (window as any).visualizer.meshes[0].material;
      return {
        hasMask: material.alphaMap !== null,
        alphaTest: material.alphaTest,
        transparent: material.transparent,
      };
    })
  ).toEqual({ hasMask: true, alphaTest: 0.5, transparent: true });

  expect(
    await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      return {
        position: visualizer.camera.position.toArray(),
        quaternion: visualizer.camera.quaternion.toArray(),
        target: visualizer.controls.target.toArray(),
      };
    })
  ).toEqual(cameraBefore);
});

test('baseline is original round rendering and adaptive is a separate immediate mode', async ({
  page,
}) => {
  const readShape = () =>
    page.evaluate(() => {
      const material = (window as any).visualizer.meshes[0].material;
      return { hasMask: material.alphaMap !== null, alphaTest: material.alphaTest };
    });

  expect(await readShape()).toEqual({ hasMask: true, alphaTest: 0.5 });
  await page.locator('#point-experiment-mode').selectOption('adaptive');
  expect(await readShape()).toEqual({ hasMask: false, alphaTest: 0 });
  await page.locator('#point-experiment-mode').selectOption('baseline');
  expect(await readShape()).toEqual({ hasMask: true, alphaTest: 0.5 });
});

test('two-pass adaptive shares geometry and culls opposite point-size bands', async ({ page }) => {
  const state = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    visualizer.pointRenderingExperiments.applyMode('adaptive-two-pass');
    const group = visualizer.scene.children.find(
      (child: any) => child.name === 'point-rendering-experiment-two-pass'
    );
    const [square, round] = group.children;
    const shaderFor = (material: any) => {
      const shader = {
        vertexShader: '#include <logdepthbuf_vertex>',
        fragmentShader: '#include <common>\n#include <color_fragment>',
      };
      material.onBeforeCompile(shader, visualizer.webglRenderer);
      return shader.vertexShader;
    };
    return {
      sourceVisible: visualizer.meshes[0].visible,
      children: group.children.length,
      sharesGeometry:
        square.geometry === visualizer.meshes[0].geometry &&
        round.geometry === visualizer.meshes[0].geometry,
      square: {
        hasMask: square.material.alphaMap !== null,
        alphaTest: square.material.alphaTest,
        shader: shaderFor(square.material),
      },
      round: {
        hasMask: round.material.alphaMap !== null,
        alphaTest: round.material.alphaTest,
        shader: shaderFor(round.material),
      },
    };
  });

  expect(state.sourceVisible).toBe(false);
  expect(state.children).toBe(2);
  expect(state.sharesGeometry).toBe(true);
  expect(state.square.hasMask).toBe(false);
  expect(state.square.alphaTest).toBe(0);
  expect(state.square.shader).toContain('gl_PointSize > 4.0');
  expect(state.round.hasMask).toBe(true);
  expect(state.round.alphaTest).toBe(0.5);
  expect(state.round.shader).toContain('gl_PointSize <= 4.0');
});

test('two-pass adaptive follows an alignment applied after the mode is selected', async ({
  page,
}) => {
  const state = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    visualizer.pointRenderingExperiments.applyMode('adaptive-two-pass');
    const aligned = visualizer.transformationMatrices[0].clone().makeTranslation(12, -3, 7);

    visualizer.setTransformationMatrix(0, aligned);
    visualizer.pointRenderingExperiments.beforeRender();

    const group = visualizer.scene.children.find(
      (child: any) => child.name === 'point-rendering-experiment-two-pass'
    );
    return {
      source: visualizer.meshes[0].matrix.elements.slice(),
      proxy: group.matrix.elements.slice(),
      proxyAutoUpdates: group.matrixAutoUpdate,
    };
  });

  expect(state.proxy).toEqual(state.source);
  expect(state.proxyAutoUpdates).toBe(false);
  expect(state.proxy.slice(12, 15)).toEqual([12, -3, 7]);
});

test('10% is a uniformly strided indexed sample and reset restores the geometry', async ({
  page,
}) => {
  await page.locator('#point-experiment-count').selectOption('0.1');
  const decimated = await page.evaluate(() => {
    const geometry = (window as any).visualizer.meshes[0].geometry;
    return {
      indexCount: geometry.index?.count,
      first: Array.from(geometry.index.array.slice(0, 5)),
      drawCount: geometry.drawRange.count,
    };
  });
  expect(decimated).toEqual({ indexCount: 100, first: [0, 10, 20, 30, 40], drawCount: 100 });

  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  expect(
    await page.evaluate(() => {
      const geometry = (window as any).visualizer.meshes[0].geometry;
      return { index: geometry.index, drawCount: geometry.drawRange.count };
    })
  ).toEqual({ index: null, drawCount: Infinity });
});

test('normal and generated degenerate poses are fixed and repeatable', async ({ page }) => {
  await page.getByRole('button', { name: 'Fit + Save Normal' }).click();
  const positions = await page.evaluate(() => {
    const experiments = (window as any).visualizer.pointRenderingExperiments;
    experiments.applyPose('normal');
    const normal = (window as any).visualizer.camera.position.toArray();
    experiments.applyPose('degenerate');
    const first = (window as any).visualizer.camera.position.toArray();
    experiments.applyPose('normal');
    experiments.applyPose('degenerate');
    const second = (window as any).visualizer.camera.position.toArray();
    return { normal, first, second };
  });
  expect(positions.first).toEqual(positions.second);
  expect(positions.first).not.toEqual(positions.normal);
});

test('D installs render chunks and C executes and restores the ordinary scene', async ({
  page,
}) => {
  const state = await page.evaluate(() => {
    const visualizer = (window as any).visualizer;
    const experiments = visualizer.pointRenderingExperiments;
    experiments.applyMode('front-to-back');
    const chunkGroups = visualizer.scene.children.filter(
      (child: any) => child.name === 'point-rendering-experiment-chunks'
    );
    const duringD = {
      sourceVisible: visualizer.meshes[0].visible,
      groups: chunkGroups.length,
      chunks: chunkGroups[0]?.children.length ?? 0,
    };
    experiments.applyMode('depth-prepass');
    const depthRendered = experiments.renderDepthPrepass();
    return {
      duringD,
      afterD: {
        sourceVisible: visualizer.meshes[0].visible,
        groups: visualizer.scene.children.filter(
          (child: any) => child.name === 'point-rendering-experiment-chunks'
        ).length,
      },
      depthRendered,
    };
  });
  expect(state.duringD).toEqual({ sourceVisible: false, groups: 1, chunks: 1 });
  expect(state.afterD).toEqual({ sourceVisible: true, groups: 0 });
  expect(state.depthRendered).toBe(true);
});
