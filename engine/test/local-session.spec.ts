import { expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';

test('Python point arrays and CLI files open in the shared 3D viewer', async ({ page }) => {
  const cases = [
    [
      '-c',
      'from ply_visualizer import show; s = show([[0,0,0],[1,0,0],[0,1,0]], colors=[[255,0,0],[0,255,0],[0,0,255]], open_browser=False); print(s.url, flush=True); s.wait()',
    ],
    ['-m', 'ply_visualizer', '--no-browser', path.resolve('examples/example-point-cloud.ply')],
  ];
  for (const args of cases) {
    const child = spawn('python3', args, {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Python's standard environment variable
      env: { ...process.env, PYTHONPATH: path.resolve('../packages/python') },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      const url = await new Promise<string>((resolve, reject) => {
        let output = '',
          errors = '';
        const timer = setTimeout(() => reject(new Error('Local viewer did not start')), 10000);
        child.stderr.on('data', data => {
          errors += data;
        });
        child.stdout.on('data', data => {
          output += data;
          const url = output.match(/http:\/\/127\.0\.0\.1:\d+\/[^\s]+/);
          if (url) {
            clearTimeout(timer);
            resolve(url[0]);
          }
        });
        child.on('error', error => {
          clearTimeout(timer);
          reject(error);
        });
        child.on('exit', code => {
          clearTimeout(timer);
          reject(new Error(`Viewer exited ${code}: ${errors}`));
        });
      });
      await page.goto(url);
      await expect(page.locator('html')).toHaveAttribute('data-local-session', 'loaded');
      await expect(page.locator('#three-canvas')).toBeVisible();
      await expect(page.locator('#file-list')).toContainText(
        args[0] === '-c' ? 'points.ply' : 'example-point-cloud.ply'
      );
      expect(await page.evaluate(() => (window as any).visualizer.spatialFiles.length)).toBe(1);
      await page.screenshot({
        path: test.info().outputPath(args[0] === '-c' ? 'python-points.png' : 'cli-file.png'),
      });
    } finally {
      child.kill('SIGINT');
      await new Promise<void>(resolve => {
        if (child.exitCode !== null || child.signalCode !== null) {
          resolve();
        } else {
          child.once('exit', () => resolve());
        }
      });
    }
  }
});

test('inline training viewer preserves camera, switches batches, and draws vectors', async ({
  page,
}) => {
  const child = spawn(
    'python3',
    [
      '-u',
      '-c',
      `
import json, sys
from ply_visualizer import show_batch
points = [[[0,0,0],[1,0,0],[0,1,0]], [[0,0,0],[1,0,0],[0,1,0],[0,0,1]]]
s = show_batch(points, target=points, vectors=points, labels=['original','augmented'], open_browser=False)
print(json.dumps({'url': s.url, 'html': s.iframe()}), flush=True)
try:
    for line in sys.stdin:
        s.update_batch(**json.loads(line))
finally:
    s.close()
`,
    ],
    {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Python environment
      env: { ...process.env, PYTHONPATH: path.resolve('../packages/python') },
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
  let errors = '';
  child.stderr.on('data', data => {
    errors += data;
  });
  try {
    const info = await new Promise<{ url: string; html: string }>((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(
        () => reject(new Error(`Viewer startup timed out: ${errors}`)),
        10000
      );
      child.stdout.on('data', data => {
        output += data;
        if (output.includes('\n')) {
          clearTimeout(timeout);
          resolve(JSON.parse(output.split('\n')[0]));
        }
      });
      child.once('error', reject);
      child.once('exit', code => {
        clearTimeout(timeout);
        reject(new Error(`Viewer exited ${code}: ${errors}`));
      });
    });
    await page.setContent(info.html);
    const viewer = page.frameLocator('iframe');
    await expect(viewer.locator('html')).toHaveAttribute('data-session-revision', '1');
    await expect(viewer.locator('#main-ui-panel')).toBeHidden();
    await viewer.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(viewer.locator('#main-ui-panel')).toBeVisible();
    await expect(viewer.locator('#file-list')).toContainText('prediction.ply');
    await expect(viewer.locator('#file-list')).toContainText('target.ply');
    await viewer.getByLabel('Batch sample').selectOption('1');
    await expect(viewer.locator('#file-list')).toContainText('4 vertices');
    const frame = page.frames().find(frame => frame.url().startsWith(info.url))!;
    const camera = await frame.evaluate(() => {
      const v = (window as any).visualizer;
      v.camera.position.set(4, 5, 6);
      v.controls.target.set(0.5, 0.5, 0.5);
      v.controls.update();
      return { position: v.camera.position.toArray(), target: v.controls.target.toArray() };
    });
    child.stdin.write(
      JSON.stringify({
        points: [
          [[2, 0, 0]],
          [
            [0, 0, 0],
            [2, 0, 0],
          ],
        ],
        target: [
          [[1, 0, 0]],
          [
            [0, 0, 0],
            [1, 0, 0],
          ],
        ],
        vectors: [
          [[1, 0, 0]],
          [
            [0, 1, 0],
            [1, 0, 0],
          ],
        ],
        labels: ['original', 'augmented'],
        step: 100,
      }) + '\n'
    );
    await expect(viewer.locator('html')).toHaveAttribute('data-session-revision', '2');
    await expect(viewer.locator('#file-list')).toContainText('2 vertices');
    await expect(viewer.getByText('Step 100')).toBeVisible();
    const after = await frame.evaluate(() => {
      const v = (window as any).visualizer;
      return {
        position: v.camera.position.toArray(),
        target: v.controls.target.toArray(),
        arrows: v.scene.getObjectByName('training-vectors').children.length,
      };
    });
    after.position.forEach((value: number, i: number) =>
      expect(value).toBeCloseTo(camera.position[i], 6)
    );
    expect(after.target).toEqual(camera.target);
    expect(after.arrows).toBe(2);
    await viewer.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.screenshot({ path: test.info().outputPath('inline-training.png') });
    await frame.goto(info.url + '?ui=none');
    await expect(viewer.locator('html')).toHaveAttribute('data-session-revision', '2');
    await expect(viewer.locator('#main-ui-panel')).toBeHidden();
    await expect(viewer.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0);
  } finally {
    child.stdin.end();
    child.kill('SIGINT');
  }
});

test('agent bridge inspects geometry, applies camera and captures rendered pixels', async ({
  page,
}) => {
  const child = spawn(
    'python3',
    [
      '-u',
      '-c',
      `
import json, sys
from ply_visualizer import show
s = show([[0,0,0],[1,0,0],[0,1,0]], open_browser=False)
print(json.dumps({'url': s.url}), flush=True)
try:
    for line in sys.stdin:
        command = json.loads(line)
        print(json.dumps(s._bridge.request(**command)), flush=True)
finally:
    s.close()
`,
    ],
    {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Python environment
      env: { ...process.env, PYTHONPATH: path.resolve('../packages/python') },
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
  const { createInterface } = await import('node:readline');
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  async function command(operation: string, args = {}) {
    child.stdin.write(JSON.stringify({ operation, arguments: args }) + '\n');
    return JSON.parse((await lines.next()).value!);
  }
  try {
    const { url } = JSON.parse((await lines.next()).value!);
    await page.goto(url);
    await expect(page.locator('html')).toHaveAttribute('data-local-session', 'loaded');
    const info = await command('inspect');
    expect(info.objects[0].vertices).toBe(3);
    expect(info.bounds).not.toBeNull();
    const camera = await command('camera', { position: [4, 5, 6], target: [0, 0, 0] });
    expect(camera.camera.position).toEqual([4, 5, 6]);
    const capture = await command('capture');
    expect(capture.width).toBeLessThanOrEqual(1024);
    expect(Buffer.from(capture.png, 'base64').subarray(1, 4).toString()).toBe('PNG');
    const colors = await page.evaluate(async png => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + png;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, img.width, img.height).data;
      return new Set(new Uint32Array(pixels.buffer)).size;
    }, capture.png);
    expect(colors).toBeGreaterThan(1);
  } finally {
    child.stdin.end();
    child.kill('SIGINT');
  }
});

test('MCP App embeds the shared viewer and rejects non-local scene URLs', async ({ page }) => {
  const { readFile } = await import('node:fs/promises');
  const { createInterface } = await import('node:readline');
  const html = await readFile(
    path.resolve('../packages/python/ply_visualizer/_mcp_app/viewer.html'),
    'utf8'
  );
  const child = spawn(
    'python3',
    [
      '-u',
      '-c',
      `
import json
from ply_visualizer import show
s = show([[0,0,0],[1,0,0],[0,1,0]], open_browser=False)
print(json.dumps({'url': s.url}), flush=True)
s.wait()
`,
    ],
    {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- Python environment
      env: { ...process.env, PYTHONPATH: path.resolve('../packages/python') },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  try {
    const scene = JSON.parse((await lines.next()).value!);
    await page.setContent(
      '<iframe id="app" title="MCP App" sandbox="allow-scripts allow-same-origin" style="width:900px;height:600px"></iframe>'
    );
    await page.evaluate(html => {
      (window as any).appReady = false;
      window.addEventListener('message', event => {
        const frame = document.querySelector('iframe')!;
        if (event.source !== frame.contentWindow) {
          return;
        }
        const msg = event.data;
        if (msg.method === 'ui/initialize') {
          frame.contentWindow!.postMessage(
            {
              jsonrpc: '2.0',
              id: msg.id,
              result: {
                protocolVersion: '2026-01-26',
                hostInfo: { name: 'test-host', version: '1' },
                hostCapabilities: { openLinks: {} },
                hostContext: { displayMode: 'inline' },
              },
            },
            '*'
          );
        }
        if (msg.method === 'ui/notifications/initialized') {
          (window as any).appReady = true;
        }
        if (msg.method === 'ui/open-link') {
          (window as any).openedUrl = msg.params.url;
          frame.contentWindow!.postMessage({ jsonrpc: '2.0', id: msg.id, result: {} }, '*');
        }
      });
      document.querySelector('iframe')!.srcdoc = html.replace(
        '<head>',
        "<head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src http://127.0.0.1:*\">"
      );
    }, html);
    await expect.poll(() => page.evaluate(() => (window as any).appReady)).toBe(true);
    async function result(url: string) {
      await page.evaluate(url => {
        const host = document.querySelector('iframe')!.contentWindow!;
        host.postMessage(
          { jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: {} } },
          '*'
        );
        host.postMessage(
          {
            jsonrpc: '2.0',
            method: 'ui/notifications/tool-result',
            params: { content: [], structuredContent: { url } },
          },
          '*'
        );
      }, url);
    }
    await result('https://example.com/');
    const app = page.frameLocator('#app');
    await expect(app.getByRole('alert')).toContainText('invalid local viewer URL');
    await expect(app.locator('iframe')).toHaveCount(0);
    await result(scene.url);
    const viewer = app.frameLocator('iframe');
    await expect(viewer.locator('html')).toHaveAttribute('data-local-session', 'loaded');
    await expect(viewer.locator('#main-ui-panel')).toBeHidden();
    await viewer.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(viewer.locator('#main-ui-panel')).toBeVisible();
    await app.getByRole('button', { name: 'Open in browser' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as any).openedUrl))
      .toBe(scene.url + '?ui=collapsed');
    await page.screenshot({ path: test.info().outputPath('mcp-inline.png') });
  } finally {
    child.kill('SIGINT');
  }
});
