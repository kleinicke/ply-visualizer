import { test, expect } from '@playwright/test';

test('round alpha mask does not darken retained point fragments', async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForFunction(() => (window as any).visualizer !== undefined);
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'one-point.ply',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(
      'ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n'
    ),
  });
  await page.waitForFunction(() => {
    const mesh = (window as any).visualizer?.meshes?.[0];
    return mesh?.children?.some((child: any) => child.name === 'adaptive-round-pass');
  });

  const result = await page.evaluate(async () => {
    const visualizer = (window as any).visualizer;
    const mesh = visualizer.meshes[0];
    const renderer = visualizer.webglRenderer;
    const gl = renderer.getContext();
    visualizer.edlEnabled = false;
    visualizer.scene.background = null;
    renderer.setClearColor(0xffffff, 1);
    visualizer.camera.position.set(0, 0, 5);
    visualizer.camera.lookAt(0, 0, 0);
    visualizer.camera.updateMatrixWorld();
    const adaptiveRound = mesh.children.find((child: any) => child.name === 'adaptive-round-pass');
    mesh.visible = false;

    const makeMaterial = (round: boolean) => {
      const material = mesh.material.clone();
      material.vertexColors = false;
      material.color.setRGB(0.25, 0.25, 0.25);
      material.size = (20 * 5) / (renderer.domElement.height * 0.5);
      material.map = null;
      material.alphaMap = round ? adaptiveRound.material.alphaMap : null;
      material.alphaTest = round ? 0.5 : 0;
      material.onBeforeCompile = () => {};
      material.customProgramCacheKey = () => `brightness-${round ? 'round' : 'square'}`;
      material.needsUpdate = true;
      return material;
    };
    const sample = new mesh.constructor(mesh.geometry, makeMaterial(false));
    sample.frustumCulled = false;
    visualizer.scene.add(sample);

    const read = (round: boolean) => {
      const previous = sample.material;
      sample.material = makeMaterial(round);
      previous.dispose();
      renderer.setRenderTarget(null);
      renderer.render(visualizer.scene, visualizer.camera);
      gl.finish();
      const width = renderer.domElement.width;
      const height = renderer.domElement.height;
      const pixels = new Uint8Array(32 * 32 * 4);
      gl.readPixels(width / 2 - 16, height / 2 - 16, 32, 32, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let nonWhite = 0;
      let rgb = 0;
      let minimum = 255;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 250 || pixels[i + 1] < 250 || pixels[i + 2] < 250) {
          nonWhite++;
          rgb += pixels[i] + pixels[i + 1] + pixels[i + 2];
          minimum = Math.min(minimum, pixels[i], pixels[i + 1], pixels[i + 2]);
        }
      }
      return { nonWhite, average: rgb / Math.max(1, nonWhite * 3), minimum };
    };
    const result = { square: read(false), round: read(true) };
    visualizer.scene.remove(sample);
    sample.material.dispose();
    return result;
  });
  expect(result.round.minimum).toBeGreaterThanOrEqual(result.square.minimum);
  expect(result.round.average).toBeGreaterThanOrEqual(result.square.average);
});
