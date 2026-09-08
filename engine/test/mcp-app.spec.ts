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
    test.setTimeout(180000);
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
          PLY_AGENT_TEST_REMOTE: fixture === 'agent-labels.pcd' ? '1' : '',
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
      expect(info.objects[0].available_color_modes).toContainEqual({
        value: 'assigned',
        label: expect.any(String),
      });
      const palette = await control('set_3d_object', {
        object_index: 0,
        color_mode: '0',
        point_size: 0.03,
      });
      expect(palette.objects[0].color_mode).toBe('0');
      expect(palette.objects[0].point_size).toBeCloseTo(0.03);
      const missingColor = await call('set_3d_object', {
        scene_id: sceneId,
        object_index: 0,
        color_mode: 'recolored',
      });
      expect(missingColor.isError).toBe(true);

      expect(info.camera.up).toEqual([0, 1, 0]);
      expect(info.renderer_id).toMatch(/^[a-f0-9]{32}$/);
      expect(info.coordinate_system.handedness).toBe('right-handed');
      expect(info.coordinate_system.meters_per_unit).toBeNull();
      expect(info.camera.rotation_center).toEqual(info.camera.target);
      expect(info.camera.view_direction).toEqual([0, 0, -1]);
      expect(info.camera.screen_right).toEqual([1, 0, 0]);
      expect(info.camera.distance_to_rotation_center).toBeGreaterThan(0);
      expect(info.camera.viewport.css_width).toBeGreaterThan(0);
      const appearance = await control('set_3d_appearance', {
        axes: true,
        grid: true,
        legend: true,
        gamma_correction: true,
        theme: 'light-modern',
      });
      expect(appearance.presentation).toMatchObject({
        axes: true,
        grid: true,
        legend: true,
        gamma_correction: true,
        theme: 'light-modern',
      });
      await expect(viewer.locator('[data-testid="coordinate-grid"]')).toBeVisible();
      await expect(viewer.locator('.scene-legend')).toBeVisible();
      await control('set_3d_appearance', {
        axes: false,
        grid: false,
        legend: false,
        gamma_correction: false,
        theme: 'dark-modern',
      });
      const fov = await control('set_3d_camera', { fov: 50 });
      expect(fov.camera.vertical_fov_degrees).toBe(50);
      expect(fov.camera.position).toEqual(info.camera.position);
      const rotated = await control('set_3d_camera', { rotation: [0, 90, 0] });
      expect(rotated.camera.view_direction[0]).toBeCloseTo(-1);
      const invalidCamera = await call('set_3d_camera', {
        scene_id: sceneId,
        position: rotated.camera.target,
      });
      expect(invalidCamera.isError).toBe(true);
      await control('set_3d_camera', {
        position: info.camera.position,
        target: info.camera.target,
        up: info.camera.up,
        fov: info.camera.vertical_fov_degrees,
      });
      const translated = await control('transform_3d_object', {
        object_index: 0,
        action: 'translate',
        vector: [1, 2, 3],
      });
      expect(translated.objects[0].local_to_world.slice(12, 15)).toEqual([1, 2, 3]);
      expect(translated.camera.position).toEqual(info.camera.position);
      const rotation = await control('transform_3d_object', {
        object_index: 0,
        action: 'rotate',
        vector: [0, 0, 1],
        angle: 90,
        space: 'world',
      });
      expect(rotation.objects[0].local_to_world[12]).toBeCloseTo(-2);
      expect(rotation.objects[0].local_to_world[13]).toBeCloseTo(1);
      const inverted = await control('transform_3d_object', { object_index: 0, action: 'invert' });
      expect(inverted.objects[0].local_to_world[12]).toBeCloseTo(-1);
      await control('transform_3d_object', {
        object_index: 0,
        action: 'quaternion',
        quaternion: [0, 0, 0, 2],
        replace: true,
      });
      const scaled = await control('transform_3d_object', {
        object_index: 0,
        action: 'scale',
        vector: [2, 3, 4],
      });
      expect([0, 5, 10].map(i => scaled.objects[0].local_to_world[i])).toEqual([2, 3, 4]);
      const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 5, 6, 1];
      const replaced = await control('transform_3d_object', {
        object_index: 0,
        action: 'matrix',
        matrix,
        replace: true,
      });
      expect(replaced.objects[0].local_to_world).toEqual(matrix);
      await control('transform_3d_object', { object_index: 0, action: 'reset' });
      const hidden = await control('set_3d_object', { object_index: 0, visible: false });
      expect(hidden.objects[0].visible).toBe(false);
      await control('set_3d_object', { object_index: 0, visible: true });
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
        expect(isolated.selection.criteria.field).toBe('label');
        expect(isolated.selection.criteria.values).toEqual([label]);
        expect(isolated.presentation.brightness_stops).toBe(1);
        expect(isolated.presentation.background).toBe('rgb(18, 52, 86)');
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
        expect((await control('inspect_3d_scene')).objects[1].opacity).toBe(0.35);
        const failed = await call('select_3d_region', {
          scene_id: sceneId,
          object_index: 0,
          field: 'label',
          values: [-999],
        });
        expect(failed.isError).toBe(true);
        expect(failed.content[0].text).toContain(
          'Selection matched no points; previous selection is unchanged'
        );
        expect(failed.content[0].text).toContain('Available label values');
        expect((await control('inspect_3d_scene')).objects).toHaveLength(2);
        await control('select_3d_region', { action: 'clear', preview: false });
        const restored = await control('inspect_3d_scene');
        expect(restored.selection).toBeNull();
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
      if (info.objects[0].scalar_fields.includes('label')) {
        await control('select_3d_region', {
          field: 'label',
          values: [Number(Object.keys(info.objects[0].attributes.label.value_counts)[0])],
          preview: false,
        });
      }
      const fixed = await control('set_3d_camera', {
        position: [3, 2, 4],
        target: [0.5, 0.5, 0.1],
        up: [0, 1, 0],
      });
      const updated = await control('update_3d_scene', {
        points: [
          [0, 0, 0],
          [2, 0, 0],
          [0, 2, 0],
        ],
      });
      await expect(viewer.locator('html')).toHaveAttribute(
        'data-session-revision',
        String(updated.revision)
      );
      const afterUpdate = await control('inspect_3d_scene');
      expect(afterUpdate.renderer_id).toBe(info.renderer_id);
      expect(afterUpdate.camera.position).toEqual(fixed.camera.position);
      expect(afterUpdate.camera.target).toEqual([0.5, 0.5, 0.1]);
      expect(afterUpdate.camera.up).toEqual(fixed.camera.up);
      expect(afterUpdate.objects).toHaveLength(1);
      expect(afterUpdate.selection).toBeNull();
      if (fixture === 'agent-labels.pcd' && !process.env.PLY_AGENT_TEST_FILE) {
        // Same asymmetric Z-up room construction used by the native Rust tests.
        let seed = 7;
        const random = () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        const target = Array.from({ length: 20000 }, (_, i) => {
          const u = random(),
            v = random();
          if (i % 11 === 0) {
            return [5.5 + u * 0.4, 1 + v * 0.4, random() * 3];
          }
          return [
            [0, u * 6, v * 3],
            [8, u * 6, v * 3],
            [u * 8, 0, v * 3],
            [u * 8, 6, v * 3],
            [u * 8, v * 6, 0],
            [u * 8, v * 6, 3],
          ][i % 6];
        });
        const offset = [0.05, -0.04, 0.03];
        const source = target.map(p => p.map((v, k) => v + offset[k]));
        const replaced = await control('update_3d_scene', { points: source, target });
        await expect(viewer.locator('html')).toHaveAttribute(
          'data-session-revision',
          String(replaced.revision)
        );
        async function align(args: any, success: boolean | null = true) {
          const started = await control('align_3d_clouds', { up_axis: 'z', ...args });
          expect(started.job.state).toBe('queued');
          let status: any;
          await expect
            .poll(
              async () => {
                status = await control('align_3d_clouds', { action: 'status' });
                return status.job.state;
              },
              { timeout: 60000, intervals: [500, 1000] }
            )
            .toMatch(/completed|failed/);
          if (success !== null) {
            expect(status.job.state, JSON.stringify(status)).toBe(success ? 'completed' : 'failed');
          }
          return status;
        }
        const correspondences = {
          action: 'correspondences',
          source_index: 0,
          target_index: 1,
          source_points: source.slice(0, 4),
          target_points: target.slice(0, 4),
        };
        const fitted = await align(correspondences);
        expect(fitted.job.metrics.rmse).toBeLessThan(0.00001);
        const matrix = fitted.transforms[0].matrix;
        offset.forEach((v, i) => expect(matrix[12 + i]).toBeCloseTo(-v, 5));
        await control('align_3d_clouds', { action: 'undo' });
        expect((await control('inspect_3d_scene')).objects[0].local_to_world[12]).toBe(0);
        await align(
          {
            ...correspondences,
            source_points: [
              [0, 0, 0],
              [1, 0, 0],
              [2, 0, 0],
            ],
            target_points: [
              [0, 1, 0],
              [1, 1, 0],
              [2, 1, 0],
            ],
          },
          false
        );
        const refined = await align({
          action: 'icp',
          source_index: 0,
          target_index: 1,
          against_all_others: true,
        });
        offset.forEach((v, i) => expect(refined.transforms[0].matrix[12 + i]).toBeCloseTo(-v, 2));
        expect(refined.can_undo).toBe(true);
        await control('align_3d_clouds', { action: 'undo' });
        await align({ action: 'auto', source_index: 0, target_index: 1, up_axis: 'z' });
        await control('align_3d_clouds', { action: 'undo' });
        for (const strategy of ['anchor', 'nested', 'complex']) {
          const result = await align(
            { action: 'align_all', target_index: 1, strategy },
            strategy === 'complex' ? null : true
          );
          expect(result.progress.entries).toHaveLength(1);
          if (result.job.state === 'completed') {
            expect(result.progress.entries[0].state).toBe('aligned');
            await control('align_3d_clouds', { action: 'undo' });
          } else {
            // Complex mode has stricter overlap gates: rejection must be honest and reversible.
            expect(result.progress.entries[0].state).toBe('failed');
            expect(result.progress.entries[0].detail).toContain('overlap');
            expect(result.transforms[0].matrix[12]).toBe(0);
            expect(result.can_undo).toBe(false);
          }
        }
        await align({ action: 'refine_all', target_index: 1 });
        const revision = await control('update_3d_scene', {
          points: [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
          ],
        });
        await expect(viewer.locator('html')).toHaveAttribute(
          'data-session-revision',
          String(revision.revision)
        );
        expect((await control('align_3d_clouds', { action: 'status' })).can_undo).toBe(false);
      }
      const capture = await call('capture_3d_view', { scene_id: sceneId });
      expect(capture.content.some((c: any) => c.type === 'image')).toBe(true);
      await page.screenshot({ path: test.info().outputPath('direct-mcp.png') });
    } finally {
      child.kill('SIGINT');
    }
  });
}
