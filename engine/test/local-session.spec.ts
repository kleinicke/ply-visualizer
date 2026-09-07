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
