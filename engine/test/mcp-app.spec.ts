/* eslint-disable @typescript-eslint/naming-convention -- Python MCP wire-format keys */
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

test('direct MCP widget loads geometry and supports agent controls without network or nested frames', async ({
  page,
}) => {
  test.setTimeout(90000);
  page.on('pageerror', error => console.log('APP ERROR', error.message));
  const python = path.resolve('../packages/python/.venv/bin/python');
  const child = spawn(
    existsSync(python) ? python : 'python3',
    [path.resolve('../packages/python/tests/mcp_browser_host.py')],
    {
      env: { ...process.env, PYTHONPATH: path.resolve('../packages/python') },
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
  let stderr = '';
  child.stderr.on('data', d => {
    stderr += d;
  });
  let sequence = 0;
  const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void }>();
  let resolveInitial: (v: any) => void;
  const initial = new Promise<any>((resolve, reject) => {
    resolveInitial = resolve;
    child.on('error', reject);
    child.on('exit', () => reject(new Error(stderr)));
  });
  createInterface({ input: child.stdout }).on('line', line => {
    const msg = JSON.parse(line);
    if (msg.initial) {
      resolveInitial(msg.initial);
    } else {
      const task = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        task?.reject(new Error(msg.error));
      } else {
        task?.resolve(msg.result);
      }
    }
  });
  child.on('exit', () => {
    for (const task of pending.values()) {
      task.reject(new Error(stderr));
    }
  });
  async function call(name: string, args: any) {
    const id = ++sequence;
    const response = new Promise<any>((resolve, reject) => pending.set(id, { resolve, reject }));
    child.stdin.write(JSON.stringify({ id, name, arguments: args }) + '\n');
    return response;
  }
  try {
    const opening = await initial;
    const sceneId = opening.structuredContent.scene_id;
    const html = await readFile(
      path.resolve('../packages/python/ply_visualizer/_mcp_app/viewer.html'),
      'utf8'
    );
    await page.exposeFunction('mcpCall', (params: any) => call(params.name, params.arguments));
    await page.setContent(
      '<iframe id="app" title="MCP viewer" sandbox="allow-scripts allow-same-origin" style="width:900px;height:600px"></iframe>'
    );
    await page.evaluate(
      ({ html, opening }) => {
        window.addEventListener('message', async event => {
          const frame = document.querySelector('iframe')!;
          if (event.source !== frame.contentWindow) {
            return;
          }
          const msg = event.data;
          const reply = (result: any) =>
            frame.contentWindow!.postMessage({ jsonrpc: '2.0', id: msg.id, result }, '*');
          if (msg.method === 'ui/initialize') {
            reply({
              protocolVersion: '2026-01-26',
              hostInfo: { name: 'test', version: '1' },
              hostCapabilities: { serverTools: {} },
              hostContext: { displayMode: 'inline' },
            });
          }
          if (msg.method === 'ui/notifications/initialized') {
            frame.contentWindow!.postMessage(
              { jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: {} } },
              '*'
            );
            frame.contentWindow!.postMessage(
              { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: opening },
              '*'
            );
          }
          if (msg.method === 'tools/call') {
            try {
              reply(await (window as any).mcpCall(msg.params));
            } catch (error) {
              frame.contentWindow!.postMessage(
                { jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: String(error) } },
                '*'
              );
            }
          }
        });
        document.querySelector('iframe')!.srcdoc = html.replace(
          '<head>',
          `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'">`
        );
      },
      { html, opening }
    );
    const viewer = page.frameLocator('#app');
    await expect(viewer.locator('html')).toHaveAttribute('data-local-session', 'loaded', {
      timeout: 20000,
    });
    await expect(viewer.locator('iframe')).toHaveCount(0);
    await expect(viewer.locator('#main-ui-panel')).toBeHidden();
    async function control(name: string, args = {}) {
      const result = await call(name, { scene_id: sceneId, ...args });
      expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
      return result.structuredContent ?? JSON.parse(result.content[0].text);
    }
    const info = await control('inspect_3d_scene');
    expect(info.objects[0].vertices).toBeGreaterThan(0);
    expect(info.camera.up).toEqual([0, 1, 0]);
    await control('navigate_3d_view', { action: 'preset', preset: 'isometric' });
    const frame = page.frames().find(frame => frame.parentFrame() === page.mainFrame())!;
    const screen = await frame.evaluate(() => {
      const v = (window as any).visualizer;
      const mesh = v.meshes[0];
      const position = mesh.geometry.getAttribute('position');
      const point = v.camera.position.clone().fromBufferAttribute(position, 0);
      mesh.localToWorld(point);
      point.project(v.camera);
      return [(point.x + 1) / 2, (1 - point.y) / 2];
    });
    await control('navigate_3d_view', { action: 'pick', screen });
    await control('navigate_3d_view', { action: 'orbit', yaw: 20, pitch: 10 });
    await control('navigate_3d_view', { action: 'pan', vector: [1, 0, 0] });
    await control('navigate_3d_view', { action: 'zoom', factor: 0.8 });
    const origin = await control('navigate_3d_view', { action: 'origin' });
    expect(origin.camera.target).toEqual([0, 0, 0]);
    await control('set_3d_appearance', { brightness: 1, background: '#123456' });
    await control('set_3d_object', {
      object_index: 0,
      point_size: 0.01,
      color: '#ff0000',
      mode: 'points',
    });
    if (info.objects[0].faces > 0) {
      expect(
        (await control('set_3d_object', { object_index: 0, mode: 'mesh' })).objects[0].mesh
      ).toBe(true);
    }
    const measure = await control('measure_3d_scene', {
      action: 'distance',
      start: [0, 0, 0],
      end: [3, 4, 0],
    });
    expect(measure.distances[0].distance).toBe(5);
    await control('control_3d_video', { action: 'add' });
    await control('navigate_3d_view', { action: 'preset', preset: 'front' });
    await control('control_3d_video', { action: 'add' });
    const loop = await control('control_3d_video', { action: 'loop', enabled: true });
    expect(loop.keyframes.length).toBe(2);
    expect(loop.loop).toBe(true);
    expect((await control('control_3d_video', { action: 'play' })).playing).toBe(true);
    await control('control_3d_video', { action: 'stop' });
    const capture = await call('capture_3d_view', { scene_id: sceneId });
    expect(capture.content.some((c: any) => c.type === 'image')).toBe(true);
    await page.screenshot({ path: test.info().outputPath('direct-mcp.png') });
  } finally {
    child.kill('SIGINT');
  }
});
