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
