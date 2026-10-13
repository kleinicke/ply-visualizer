import { test, expect } from '@playwright/test';

test('reports renderer startup failure without a WebGL context', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: any[]) {
      if (/webgl/.test(type)) {
        return null;
      }
      return original.call(this, type as any, ...args);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.locator('#error-message')).toContainText('Failed to initialize 3D Visualizer');
  await expect(page.locator('#error')).toBeVisible();
});

test('retains a file selected while optional GPU initialization is pending', async ({ page }) => {
  await page.addInitScript(() => {
    const gpu = (navigator as any).gpu;
    if (gpu) {
      const request = gpu.requestAdapter.bind(gpu);
      gpu.requestAdapter = async (...args: any[]) => {
        await new Promise(resolve => setTimeout(resolve, 1200));
        return request(...args);
      };
    }
  });
  // The WebGPU backend awaits its adapter before the viewer is ready (the
  // optional picker no longer holds the default WebGL boot back).
  await page.goto('/?webgpu=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window as any).visualizer);
  expect(await page.locator('html').getAttribute('data-visualizer-ready')).not.toBe('true');
  await page.locator('#hiddenFileInput').setInputFiles({
    name: 'early.ply',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(
      'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 0 0\n0 1 0\n'
    ),
  });
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  await expect
    .poll(() => page.evaluate(() => (window as any).visualizer.spatialFiles.length))
    .toBe(1);
});

test('the WebGL viewer is ready before the optional WebGPU helpers finish', async ({ page }) => {
  await page.addInitScript(() => {
    const gpu = (navigator as any).gpu;
    if (gpu) {
      const request = gpu.requestAdapter.bind(gpu);
      gpu.requestAdapter = async (...args: any[]) => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return request(...args);
      };
    }
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true', {
    timeout: 1000,
  });
  const settled = await page.evaluate(async () => {
    const v = (window as any).visualizer;
    let done = false;
    void v.webgpuReady.then(() => (done = true));
    await new Promise(resolve => setTimeout(resolve, 0));
    const before = done;
    await v.webgpuReady;
    return { before, after: v.webgpuPickingUnavailableReason };
  });
  expect(settled.before).toBe(false);
  // Known by now, whether or not this machine has WebGPU.
  expect(settled.after).not.toBe('WebGPU availability has not been checked');
  await page.locator('[data-tab="controls"]').click();
  const webgpuPicking = page.locator('#point-picking-webgpu');
  const available = await page.evaluate(() => (window as any).visualizer.webgpuPickingAvailable);
  if (available) {
    await expect(webgpuPicking).toBeEnabled();
    await expect(webgpuPicking).toHaveClass(/active/);
  } else {
    await expect(webgpuPicking).toBeDisabled();
  }
});

test('an unavailable optional picker chunk keeps the WebGL viewer usable', async ({ page }) => {
  let blocked = false;
  await page.route('**/*.js', async route => {
    const response = await route.fetch();
    const body = await response.text();
    // Production webpack uses numeric chunk names.
    if (body.includes('WebGPU picker point ID space exceeded')) {
      blocked = true;
      await route.abort();
    } else {
      await route.fulfill({ response, body });
    }
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  // The optional picker loads after the viewer is ready.
  await page.evaluate(() => (window as any).visualizer.webgpuReady);
  expect(blocked).toBe(true);
  expect(await page.evaluate(() => (window as any).visualizer.pointPickingImplementation)).toBe(
    'cpu'
  );
  await expect(page.locator('#error')).toBeHidden();
});

test('renderer identity works when the page has no secure-context UUID API', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: undefined });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  await expect(page.locator('#error')).toBeHidden();
});

test('blocked storage does not prevent startup or theme switching', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Storage blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-visualizer-ready', 'true');
  await page.locator('[data-tab="controls"]').click();
  await page.locator('#theme-selector').selectOption('light-modern');
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue('--vscode-editor-background')
      )
    )
    .toBe('#FFFFFF');
  expect(errors).toEqual([]);
});
