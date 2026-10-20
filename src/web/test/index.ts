/* eslint-disable @typescript-eslint/naming-convention -- Public agent and GLTF wire formats. */
import * as vscode from 'vscode';
import type { WebPointCloudEditorProvider } from '../provider';

function check(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension<WebPointCloudEditorProvider>(
    'kleinicke.ply-visualizer'
  );
  check(extension, 'Extension is available in the web host');
  const provider = await extension.activate();
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  check(root, 'Virtual workspace is open');
  check(root.scheme !== 'file', 'Test uses a virtual filesystem, not local Node filesystem access');
  const ply = vscode.Uri.joinPath(root, 'web-smoke.ply');
  const xyz = vscode.Uri.joinPath(root, 'web-second.xyz');
  const depth = vscode.Uri.joinPath(root, 'web-depth.pfm');
  const mesh = vscode.Uri.joinPath(root, 'web-mesh.stl');
  const encode = (text: string) => new TextEncoder().encode(text);
  await vscode.workspace.fs.writeFile(
    ply,
    encode(
      'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 0 0\n0 1 0\n'
    )
  );
  await vscode.workspace.fs.writeFile(xyz, encode('0 0 1\n1 0 1\n0 1 1\n'));
  await vscode.workspace.fs.writeFile(
    mesh,
    encode(
      'solid triangle\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle\n'
    )
  );
  const header = encode('Pf\n2 2\n-1.0\n');
  const raster = new Uint8Array(header.length + 16);
  raster.set(header);
  const view = new DataView(raster.buffer);
  for (let i = 0; i < 4; i++) {
    view.setFloat32(header.length + i * 4, i + 1, true);
  }
  await vscode.workspace.fs.writeFile(depth, raster);
  try {
    await vscode.commands.executeCommand('plyViewer.openMultipleFiles', [ply, xyz, mesh, depth]);
    let state: any;
    const deadline = Date.now() + 90000;
    do {
      state = await provider.request(ply, 'inspect');
      if (state.objects?.length === 4) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    console.log('WEB VIEWER STATE', JSON.stringify(state));
    check(state.objects?.length === 4, 'PLY, XYZ, STL and depth render in the web extension');
    check(
      state.objects.every(
        (object: any) => object.vertices === (object.name === 'web-depth.pfm' ? 4 : 3)
      ),
      'Decoded geometry has three vertices per file'
    );
    const capture: any = await provider.request(ply, 'capture', { width: 320, height: 240 });
    console.log('WEB_CAPTURE_PNG', capture.png);
    check(
      capture.png?.startsWith('iVBOR') && capture.width > 0 && capture.height > 0,
      'The viewer renders a PNG capture'
    );
    const depthObject = state.objects.find((object: any) => object.name === 'web-depth.pfm');
    check(depthObject.color_mode === '0', 'Depth defaults to uniform coloring');
    await provider.request(ply, 'alignment', {
      action: 'correspondences',
      source_index: 1,
      target_index: 0,
      source_points: [
        [0, 0, 1],
        [1, 0, 1],
        [0, 1, 1],
      ],
      target_points: [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ],
    });
    let alignment: any;
    const alignmentDeadline = Date.now() + 30000;
    do {
      alignment = (
        (await provider.request(ply, 'alignment', { action: 'status', detail: 'full' })) as any
      ).alignment;
      if (alignment.job?.state === 'completed' || alignment.job?.state === 'failed') {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < alignmentDeadline);
    console.log('WEB ALIGNMENT', JSON.stringify(alignment));
    check(alignment.job?.state === 'completed', 'Alignment completes using browser WASM');
    check(
      alignment.backend === 'worker',
      'Alignment runs off the render thread in a browser worker'
    );
    const model = vscode.Uri.joinPath(root, 'web-model.gltf');
    const buffer = vscode.Uri.joinPath(root, 'web-model.bin');
    await vscode.workspace.fs.writeFile(
      buffer,
      new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer)
    );
    await vscode.workspace.fs.writeFile(
      model,
      encode(
        JSON.stringify({
          asset: { version: '2.0' },
          scene: 0,
          scenes: [{ nodes: [0] }],
          nodes: [{ mesh: 0 }],
          meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
          buffers: [{ uri: 'web-model.bin', byteLength: 36 }],
          bufferViews: [{ buffer: 0, byteLength: 36 }],
          accessors: [
            {
              bufferView: 0,
              componentType: 5126,
              count: 3,
              type: 'VEC3',
              min: [0, 0, 0],
              max: [1, 1, 0],
            },
          ],
        })
      )
    );
    try {
      await vscode.commands.executeCommand('plyViewer.openFile', model);
      const modelState: any = await provider.request(model, 'inspect');
      check(
        modelState.objects?.[0]?.vertices === 3,
        'GLTF loads its companion buffer through workspace.fs'
      );
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
      await vscode.commands.executeCommand('plyViewer.openMultipleFiles', [model, buffer]);
      const combined: any = await provider.request(model, 'inspect');
      check(
        combined.objects?.length === 1 && combined.objects[0].vertices === 3,
        'A selected model buffer is not also decoded as a point cloud'
      );
      console.log('WEB MODEL COMPANION PASSED');
    } finally {
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await vscode.workspace.fs.delete(model);
      await vscode.workspace.fs.delete(buffer);
    }
    console.log('WEB EXTENSION TEST PASSED');
  } finally {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    for (const uri of [ply, xyz, mesh, depth]) {
      await vscode.workspace.fs.delete(uri);
    }
  }
}
