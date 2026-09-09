/* eslint-disable @typescript-eslint/naming-convention -- Python MCP wire-format keys */
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { crc32, deflateSync } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';

for (const fixture of ['depth']) {
  test(`direct MCP ${fixture} widget loads geometry and supports agent controls without network or nested frames`, async ({
    page,
  }) => {
    test.setTimeout(240000);
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('pageerror', error => console.log('APP ERROR', error.message));
    const directory = path.resolve('test-results/depth-input');
    await (await import('node:fs/promises')).mkdir(directory, { recursive: true });
    const depthPath = path.join(directory, 'depth.bin');
    const values = Buffer.alloc(16);
    [2, 0, 4, 8].forEach((v, i) => values.writeFloatLE(v, i * 4));
    await writeFile(depthPath, Buffer.concat([Buffer.from('2&2&1&'), values]));
    const calibration = {
      width: 2,
      height: 2,
      fx: 2,
      fy: 2,
      cx: 0,
      cy: 0,
      kind: 'z',
      sources: { intrinsics: 'synthetic known camera' },
    };
    const python = path.resolve('../packages/python/.venv/bin/python');
    const child = spawn(
      existsSync(python) ? python : 'python3',
      [path.resolve('../packages/python/tests/mcp_browser_host.py')],
      {
        env: {
          ...process.env,
          PLY_AGENT_TEST_FILE: depthPath,
          PYTHONPATH: path.resolve('../packages/python'),
          PLY_AGENT_TEST_DEPTH: JSON.stringify({ path: depthPath, calibration }),
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
        path.resolve('../packages/python/viz3d/_mcp_app/viewer.html'),
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
        timeout: 30000,
      });
      async function geometry() {
        return viewer.locator('html').evaluate(() => {
          const h = (window as any).visualizer;
          return h.spatialFiles.map((f: any) => ({
            positions: [...f.positionsArray],
            indices: [...f.sourcePointIndices],
            colors: [...f.colorsArray],
            pixels: [...f.scalarFields.pixel_v],
            raw: [...f.scalarFields.raw_depth_value],
            metadata: f.metadata,
          }));
        });
      }
      expect((await geometry())[0]).toMatchObject({
        positions: [0, 0, 2, 0, 2, 4, 4, 4, 8],
        indices: [0, 2, 3],
        pixels: [0, 1, 1],
        raw: [2, 4, 8],
      });
      async function append(config: any, extra: any = {}) {
        const result = await call('open_depth_image', {
          path: depthPath,
          calibration: { ...calibration, ...config },
          scene_id: sceneId,
          ...extra,
        });
        expect(result.isError, JSON.stringify(result)).not.toBe(true);
        await expect(viewer.locator('html')).toHaveAttribute(
          'data-session-revision',
          String(result.structuredContent.revision),
          { timeout: 20000 }
        );
        return (await geometry()).at(-1);
      }
      const disparity = await append({ kind: 'disparity', baseline: 1, image_rectified: true });
      expect(disparity.positions).toEqual([0, 0, 1, 0, 0.25, 0.5, 0.125, 0.125, 0.25]);
      const inverse = await append({ kind: 'inverse_depth' });
      expect(inverse.positions).toEqual([0, 0, 0.5, 0, 0.125, 0.25, 0.0625, 0.0625, 0.125]);
      const range = await append({ kind: 'depth' });
      expect(Math.hypot(...range.positions.slice(6))).toBeCloseTo(8, 5);
      const gl = await append({ kind: 'z', convention: 'opengl', value_scale: 0.001 });
      expect(gl.positions[8]).toBeCloseTo(-0.008, 7);
      function png(channels: number, pixels: number[]) {
        const chunk = (name: string, data: Buffer) => {
          const type = Buffer.from(name),
            head = Buffer.alloc(4),
            checksum = Buffer.alloc(4);
          head.writeUInt32BE(data.length);
          checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
          return Buffer.concat([head, type, data, checksum]);
        };
        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(2);
        ihdr.writeUInt32BE(2, 4);
        ihdr[8] = 8;
        ihdr[9] = channels === 3 ? 2 : 0;
        const rows = Buffer.from([
          0,
          ...pixels.slice(0, 2 * channels),
          0,
          ...pixels.slice(2 * channels),
        ]);
        return Buffer.concat([
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          chunk('IHDR', ihdr),
          chunk('IDAT', deflateSync(rows)),
          chunk('IEND', Buffer.alloc(0)),
        ]);
      }
      const rgbPath = path.join(directory, 'rgb.png'),
        maskPath = path.join(directory, 'mask.png');
      await writeFile(rgbPath, png(3, [255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0]));
      await writeFile(maskPath, png(1, [1, 1, 0, 1]));
      const masked = await append({}, { rgb: rgbPath, mask: maskPath });
      expect(masked.indices).toEqual([0, 3]);
      expect(masked.colors).toEqual([255, 0, 0, 255, 255, 0]);
      const distorted = await append({
        camera_model: 'pinhole-opencv',
        coefficients: [0.1, 0, 0, 0],
      });
      const [dx, dy, dz] = distorted.positions.slice(6);
      const radial = 1 + 0.1 * ((dx / dz) ** 2 + (dy / dz) ** 2);
      expect(((2 * dx) / dz) * radial).toBeCloseTo(1, 5);
      expect(((2 * dy) / dz) * radial).toBeCloseTo(1, 5);
      // NPY uses the shared Rust reader, with the same raw samples and pixel provenance.
      const npyPath = path.join(directory, 'depth.npy');
      const npyHeader = Buffer.from("{'descr': '<f4', 'fortran_order': False, 'shape': (2, 2)}\n");
      const npyPrefix = Buffer.from([147, 78, 85, 77, 80, 89, 1, 0, 0, 0]);
      npyPrefix.writeUInt16LE(npyHeader.length, 8);
      await writeFile(npyPath, Buffer.concat([npyPrefix, npyHeader, values]));
      const npy = await append({}, { path: npyPath });
      expect(npy.positions).toEqual([0, 0, 2, 0, 2, 4, 4, 4, 8]);
      const inspect = await call('inspect_3d_scene', { scene_id: sceneId, detail: 'full' });
      expect(inspect.structuredContent.objects[0].depth.calibration.sources.intrinsics).toBe(
        'synthetic known camera'
      );
      expect(inspect.structuredContent.objects[0].depth.source_pixels).toBe(4);
      const missing = await call('open_depth_image', { path: depthPath });
      expect(missing.isError).toBe(true);
      expect(JSON.stringify(missing)).toContain('Explicit calibration');
      // COLMAP dense calibration belongs to its undistorted workspace; pose is inverted.
      await (
        await import('node:fs/promises')
      ).mkdir(path.join(directory, 'sparse'), { recursive: true });
      await (
        await import('node:fs/promises')
      ).mkdir(path.join(directory, 'stereo/depth_maps'), { recursive: true });
      await writeFile(path.join(directory, 'sparse/cameras.txt'), '7 PINHOLE 4 4 4 4 0 0\n');
      await writeFile(path.join(directory, 'sparse/images.txt'), '9 1 0 0 0 1 2 3 7 test.jpg\n\n');
      await writeFile(
        path.join(directory, 'stereo/depth_maps/test.jpg.geometric.bin'),
        await readFile(depthPath)
      );
      const colmap = await call('open_depth_image', {
        path: directory,
        colmap_image: 'test.jpg',
        scene_id: sceneId,
      });
      expect(colmap.isError, JSON.stringify(colmap)).not.toBe(true);
      await expect(viewer.locator('html')).toHaveAttribute(
        'data-session-revision',
        String(colmap.structuredContent.revision),
        { timeout: 20000 }
      );
      const cloud = (await geometry()).at(-1);
      expect(cloud.positions).toEqual([-1, -2, -1, -1, 0, 1, 3, 2, 5]);
      expect(cloud.metadata.depth.units).toBe('COLMAP reconstruction units');
      await expect(viewer.locator('iframe')).toHaveCount(0);
      await expect(viewer.locator('#main-ui-panel')).toBeHidden();
      expect(pageErrors).toEqual([]);
      const capture = await call('capture_3d_view', { scene_id: sceneId });
      expect(capture.content.some((item: any) => item.type === 'image')).toBe(true);
      const selected = await call('select_3d_region', {
        scene_id: sceneId,
        object_index: 0,
        isolate: false,
        focus: false,
        preview: false,
      });
      expect(selected.isError, JSON.stringify(selected)).not.toBe(true);
      const exportedPath = path.join(directory, `subset-${Date.now()}.ply`);
      const exported = await call('export_3d_selection', { scene_id: sceneId, path: exportedPath });
      expect(exported.isError, JSON.stringify(exported)).not.toBe(true);
      const exportedBytes = await readFile(exportedPath);
      const bodyAt = exportedBytes.indexOf('end_header\n') + 11;
      const header = exportedBytes.subarray(0, bodyAt).toString();
      expect(header).toContain('synthetic known camera');
      const properties = header
        .split('\n')
        .filter(l => l.startsWith('property '))
        .map(l => l.split(' ').slice(1));
      let offset = bodyAt;
      const rows: Record<string, number>[] = [];
      for (let i = 0; i < 3; i++) {
        const row: Record<string, number> = {};
        for (const [type, name] of properties) {
          row[name] =
            type === 'uchar'
              ? exportedBytes.readUInt8(offset)
              : type === 'uint'
                ? exportedBytes.readUInt32LE(offset)
                : exportedBytes.readFloatLE(offset);
          offset += type === 'uchar' ? 1 : 4;
        }
        rows.push(row);
      }
      expect(rows.map(r => r.source_row)).toEqual([0, 2, 3]);
      expect(rows.map(r => r.pixel_u)).toEqual([0, 0, 1]);
      expect(rows.map(r => r.raw_depth_value)).toEqual([2, 4, 8]);
      await call('open_depth_image', {
        path: depthPath,
        calibration: { ...calibration, width: 3 },
        scene_id: sceneId,
      });
      await expect(viewer.locator('html')).toHaveAttribute('data-local-session', 'error', {
        timeout: 20000,
      });
      const invalid = await call('inspect_3d_scene', { scene_id: sceneId });
      expect(invalid.isError).toBe(true);
      expect(JSON.stringify(invalid)).toContain('Calibration 3x2 does not match raster 2x2');
    } finally {
      child.stdin.end();
      child.kill();
    }
  });
}
