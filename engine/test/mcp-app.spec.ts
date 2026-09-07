/* eslint-disable @typescript-eslint/naming-convention -- Python MCP wire-format keys */
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

for (const fixture of ['agent-mesh.ply', 'agent-labels.pcd']) {
  test(`direct MCP ${fixture} widget loads geometry and supports agent controls without network or nested frames`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    page.on('pageerror', error => console.log('APP ERROR', error.message));
    const python = path.resolve('../packages/python/.venv/bin/python');
    const child = spawn(
      existsSync(python) ? python : 'python3',
      [path.resolve('../packages/python/tests/mcp_browser_host.py')],
      {
        env: {
          ...process.env,
          PLY_AGENT_TEST_FILE:
            process.env.PLY_AGENT_TEST_FILE ?? path.resolve('test/fixtures', fixture),
          PYTHONPATH: path.resolve('../packages/python'),
        },
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
                {
                  jsonrpc: '2.0',
                  method: 'ui/notifications/tool-input',
                  params: { arguments: {} },
                },
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
      await control('manage_3d_views', { action: 'save', name: 'overview' });
      const before = (await control('manage_3d_views', { action: 'list' })).camera;
      await control('navigate_3d_view', { action: 'zoom', factor: 0.5 });
      expect((await control('manage_3d_views', { action: 'undo' })).camera).toEqual(before);
      await control('navigate_3d_view', { action: 'orbit', yaw: 15 });
      expect(
        (await control('manage_3d_views', { action: 'restore', name: 'overview' })).camera
      ).toEqual(before);
      if (info.objects[0].scalar_fields.includes('label')) {
        const counts = info.objects[0].attributes.label.value_counts;
        const label = process.env.PLY_AGENT_TEST_FILE
          ? Number(process.env.PLY_AGENT_LABEL ?? Object.keys(counts)[0])
          : 2;
        const selected = await call('select_3d_region', {
          scene_id: sceneId,
          object_index: 0,
          field: 'label',
          values: [label],
        });
        expect(selected.isError, JSON.stringify(selected.content) + stderr).toBeFalsy();
        expect(selected.content.some((c: any) => c.type === 'image')).toBe(true);
        await writeFile(
          test.info().outputPath('selected-region.png'),
          Buffer.from(selected.content.find((c: any) => c.type === 'image').data, 'base64')
        );
        const detail = JSON.parse(selected.content[0].text);
        expect(detail.selected_points).toBe(counts[String(label)]);
        const isolated = await control('inspect_3d_scene');
        expect(isolated.objects[0].visible).toBe(false);
        expect(isolated.objects[1].visible).toBe(true);
        const pickScreen = await frame.evaluate(() => {
          const v = (window as any).visualizer,
            mesh = v.meshes[1];
          const point = v.camera.position
            .clone()
            .fromBufferAttribute(mesh.geometry.getAttribute('position'), 0);
          mesh.localToWorld(point);
          point.project(v.camera);
          return [(point.x + 1) / 2, (1 - point.y) / 2];
        });
        const picked = await control('pick_3d_point', { screen: pickScreen });
        expect(picked.hit).toBe(true);
        expect(picked.object_index).toBe(1);
        expect(picked.attributes.label).toBe(label);
        expect(picked.source_point_index).toBeGreaterThanOrEqual(0);
        await control('set_3d_object', {
          object_index: 1,
          opacity: 0.35,
          color_mode: 'scalar:label:colors',
        });
        expect(
          await frame.evaluate(() => (window as any).visualizer.meshes[1].material.opacity)
        ).toBe(0.35);
        const failed = await call('select_3d_region', {
          scene_id: sceneId,
          object_index: 0,
          field: 'label',
          values: [-999],
        });
        expect(failed.isError).toBe(true);
        expect((await control('inspect_3d_scene')).objects).toHaveLength(2);
        await control('select_3d_region', { action: 'clear', preview: false });
        const restored = await control('inspect_3d_scene');
        expect(restored.objects).toHaveLength(1);
        expect(restored.objects[0].visible).toBe(true);
        if (!process.env.PLY_AGENT_TEST_FILE) {
          const cropped = await control('select_3d_region', {
            bounds: [-1, -1, 0.1, 1, 1, 2],
            plane: [1, 0, 0, 0],
            preview: false,
          });
          expect(cropped.selected_points).toBe(4);
          await control('select_3d_region', { action: 'clear', preview: false });
        }
      }
      const capture = await call('capture_3d_view', { scene_id: sceneId });
      expect(capture.content.some((c: any) => c.type === 'image')).toBe(true);
      await page.screenshot({ path: test.info().outputPath('direct-mcp.png') });
    } finally {
      child.kill('SIGINT');
    }
  });
}
