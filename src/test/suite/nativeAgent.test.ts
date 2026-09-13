/* eslint-disable @typescript-eslint/naming-convention -- Test the public MCP-compatible wire format. */
import { createServer } from 'http';
import { gzipSync } from 'zlib';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

suite('Native VS Code agent tools — real webview', function () {
  this.timeout(180000);
  let id: string;
  const points = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
  ];
  async function call(name: string, input: any = {}) {
    const result = await vscode.lm.invokeTool('viz3d_' + name, {
      input,
      toolInvocationToken: undefined,
    });
    const text = result.content.find(
      p => p instanceof vscode.LanguageModelTextPart
    ) as vscode.LanguageModelTextPart;
    const data = JSON.parse(text.value);
    assert.ok(data.ok, JSON.stringify(data));
    return { data, content: result.content };
  }
  suiteSetup(async () => {
    await vscode.extensions.getExtension('kleinicke.ply-visualizer')!.activate();
  });
  suiteTeardown(async () => {
    if (id) {
      await call('close_3d_scene', { scene_id: id });
    }
  });
  test('all 25 MCP viewer operations are discoverable as native tools', () => {
    const tools = vscode.lm.tools.filter(t => t.name.startsWith('viz3d_'));
    assert.strictEqual(tools.length, 25);
    assert.ok(tools.some(t => t.name === 'viz3d_transform_3d_object'));
  });
  test('loads, navigates, transforms, captures and updates in the identical renderer/tab', async () => {
    const opened = (await call('visualize_points', { points })).data;
    id = opened.scene_id;
    assert.strictEqual(opened.objects[0].vertices, 3);
    const renderer = opened.renderer_id;
    const moved = (
      await call('set_3d_camera', { scene_id: id, position: [2, 3, 4], target: [0.5, 0.5, 0.1] })
    ).data;
    await call('transform_3d_object', {
      scene_id: id,
      object_index: 0,
      action: 'translate',
      vector: [1, 0, 0],
    });
    await call('set_3d_object', { scene_id: id, object_index: 0, color: '#0088ff', opacity: 0.8 });
    const capture = await call('capture_3d_view', { scene_id: id });
    assert.ok(
      capture.content.some(
        p =>
          p instanceof vscode.LanguageModelDataPart &&
          p.mimeType === 'image/png' &&
          p.data.length > 100
      )
    );
    const updated = (
      await call('update_3d_scene', {
        scene_id: id,
        points: [
          [0, 0, 0],
          [2, 2, 0],
          [1, 1, 0],
        ],
        target: points,
        vectors: points,
      })
    ).data;
    assert.strictEqual(updated.renderer_id, renderer);
    assert.deepStrictEqual(updated.camera, moved.camera);
    assert.strictEqual(updated.objects.length, 2);
    const scene = (await call('list_3d_scenes')).data.scenes.find((s: any) => s.scene_id === id);
    assert.strictEqual(scene.host, 'vscode');
    assert.ok(scene.visible);
  });
  test('selection errors are informative; state export/import and subset exports work', async () => {
    await call('manage_3d_scene_states', { scene_id: id, action: 'save', name: 'Overview' });
    await call('set_3d_appearance', {
      scene_id: id,
      axes: true,
      grid: true,
      legend: true,
      background: '#123456',
    });
    await call('select_3d_region', {
      scene_id: id,
      object_index: 0,
      bounds: [-1, -1, -1, 0.1, 0.1, 0.1],
      focus: true,
    });
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const artifact = path.join(root, `.native-agent-test-${Date.now()}.ply`);
    const state = artifact.replace('.ply', '.json');
    try {
      const exported = (await call('export_3d_selection', { scene_id: id, path: artifact })).data;
      assert.strictEqual(exported.points, 1);
      assert.ok((await fs.readFile(artifact)).subarray(0, 3).equals(Buffer.from('ply')));
      await call('manage_3d_scene_states', {
        scene_id: id,
        action: 'export',
        name: 'Overview',
        path: state,
      });
      await call('manage_3d_scene_states', {
        scene_id: id,
        action: 'import',
        name: 'Imported',
        path: state,
        restore: true,
      });
      const duplicate = await vscode.lm.invokeTool('viz3d_export_3d_selection', {
        input: { scene_id: id, path: artifact },
        toolInvocationToken: undefined,
      });
      assert.match((duplicate.content[0] as vscode.LanguageModelTextPart).value, /already exists/);
    } finally {
      await fs.rm(artifact, { force: true });
      await fs.rm(state, { force: true });
    }
  });
  test('depth projection with defaults, attributes, comparison, measurements and preview', async () => {
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const file = path.join(root, `.native-depth-${Date.now()}.pfm`);
    const header = Buffer.from('Pf\n2 2\n-1.0\n');
    const values = Buffer.alloc(16);
    [1, 2, 3, 4].forEach((v, i) => values.writeFloatLE(v, i * 4));
    await fs.writeFile(file, Buffer.concat([header, values]));
    try {
      const result = (
        await call('open_depth_image', {
          scene_id: id,
          path: file,
          calibration: { width: 2, height: 2, fx: 2, fy: 2, cx: 0, cy: 0, kind: 'z' },
        })
      ).data;
      assert.strictEqual(result.objects.at(-1).vertices, 4);
      assert.ok(result.objects.at(-1).scalar_fields.includes('pixel_u'));
      await call('manage_3d_views', { scene_id: id, action: 'save', name: 'Test camera' });
      await call('navigate_3d_view', { scene_id: id, action: 'orbit', yaw: 25, pitch: 10 });
      await call('manage_3d_views', { scene_id: id, action: 'restore', name: 'Test camera' });
      await call('select_3d_region', {
        scene_id: id,
        object_index: 0,
        bounds: [-1, -1, -1, 0.1, 0.1, 0.1],
        preview: false,
      });
      await call('manage_3d_selections', { scene_id: id, action: 'save', name: 'First' });
      await call('manage_3d_selections', { scene_id: id, action: 'list' });
      await call('select_3d_region', { scene_id: id, action: 'clear' });
      await call('compare_3d_clouds', { scene_id: id, action: 'distance', left: 0, right: 1 });
      await call('align_3d_clouds', { scene_id: id, action: 'status' });
      const measured = (
        await call('measure_3d_scene', {
          scene_id: id,
          action: 'distance',
          start: [0, 0, 0],
          end: [3, 4, 0],
        })
      ).data;
      assert.ok(JSON.stringify(measured).includes('5'));
      await call('pick_3d_point', { scene_id: id, screen: [0.5, 0.5] });
      const preview = await call('preview_3d_views', {
        scene_id: id,
        presets: ['front', 'right', 'top', 'isometric'],
      });
      const png = preview.content.find(
        p => p instanceof vscode.LanguageModelDataPart && p.mimeType === 'image/png'
      ) as vscode.LanguageModelDataPart;
      assert.ok(png && png.data.length > 100);
      await fs.writeFile('/tmp/viz3d-native-preview.png', png.data);
    } finally {
      await fs.rm(file, { force: true });
    }
  });
  test('animated models play, seek and change speed in the native scene and export GLB', async () => {
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const model = path.join(
      root,
      'testfiles/scene-models/gltf/AnimatedMorphSphere/glTF/AnimatedMorphSphere.gltf'
    );
    const data = model.replace('.gltf', '.bin');
    const opened = (await call('open_3d_files', { paths: [model, data] })).data;
    const scene_id = opened.scene_id;
    const artifact = path.join(root, `.native-model-${Date.now()}.glb`);
    try {
      const animation = (
        await call('control_3d_video', { scene_id, object_index: 0, action: 'list' })
      ).data;
      assert.ok(animation.animation.clips.length);
      await call('control_3d_video', { scene_id, object_index: 0, action: 'play' });
      await call('control_3d_video', { scene_id, object_index: 0, action: 'update', speed: 0.5 });
      await call('control_3d_video', { scene_id, object_index: 0, action: 'loop', enabled: true });
      const seek = (
        await call('control_3d_video', { scene_id, object_index: 0, action: 'goto', time: 0.5 })
      ).data;
      assert.strictEqual(seek.animation.playing, false);
      await call('control_3d_video', { scene_id, object_index: 0, action: 'stop' });
      await call('manage_3d_scene_states', { scene_id, action: 'export_models', path: artifact });
      assert.strictEqual((await fs.readFile(artifact)).toString('ascii', 0, 4), 'glTF');
    } finally {
      await fs.rm(artifact, { force: true });
      await call('close_3d_scene', { scene_id });
    }
  });
  test('URL loading uses the extension host, honors size limits and appends to the native scene', async () => {
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const bytes = gzipSync(await fs.readFile(path.join(root, 'testfiles/ply/test_ascii.ply')));
    const server = createServer((_request, response) => {
      response.end(bytes);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/cloud.ply.gz`;
    try {
      const before = (await call('inspect_3d_scene', { scene_id: id })).data;
      const after = (await call('open_3d_url', { scene_id: id, url })).data;
      assert.strictEqual(after.renderer_id, before.renderer_id);
      assert.strictEqual(after.objects.length, before.objects.length + 1);
      assert.deepStrictEqual(after.camera, before.camera);
      const refused = await vscode.lm.invokeTool('viz3d_open_3d_url', {
        input: { scene_id: id, url, max_bytes: 1 },
        toolInvocationToken: undefined,
      });
      assert.match((refused.content[0] as vscode.LanguageModelTextPart).value, /exceeds max_bytes/);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
  test('discovers a manually opened PLY editor and appends without changing camera', async () => {
    const file = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders![0].uri,
      'testfiles',
      'ply',
      'test_ascii.ply'
    );
    await vscode.commands.executeCommand('vscode.openWith', file, 'plyViewer.plyEditor');
    const scenes = (await call('list_3d_scenes')).data.scenes;
    const manual = scenes.find((s: any) => s.source === file.toString());
    assert.ok(manual);
    const before = (await call('inspect_3d_scene', { scene_id: manual.scene_id })).data;
    const after = (await call('open_3d_files', { scene_id: manual.scene_id, paths: [file.fsPath] }))
      .data;
    assert.strictEqual(after.renderer_id, before.renderer_id);
    assert.deepStrictEqual(after.camera, before.camera);
    assert.strictEqual(after.objects.length, before.objects.length + 1);
    await call('close_3d_scene', { scene_id: manual.scene_id });
  });
});
