import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { readRemoteModelResource } from '../../engine/src/models/remoteModelResource';

const sources = new WeakMap<
  vscode.WebviewPanel,
  Map<string, { uri: vscode.Uri; remote?: string }>
>();
export async function sendSceneModel(panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
  let map = sources.get(panel);
  if (!map) {
    map = new Map();
    sources.set(panel, map);
  }
  const sourceId = randomUUID();
  let remote: string | undefined;
  try {
    const metadata = JSON.parse(
      new TextDecoder().decode(
        await vscode.workspace.fs.readFile(vscode.Uri.joinPath(uri, '..', '.remote-source.json'))
      )
    );
    if (typeof metadata.url === 'string' && /^https?:/.test(metadata.url)) {
      remote = metadata.url;
    }
  } catch {
    /* Local models do not have remote metadata. */
  }
  map.set(sourceId, { uri, remote });
  const bytes = await vscode.workspace.fs.readFile(uri);
  await panel.webview.postMessage({
    type: 'sceneModelData',
    sourceId,
    fileName: path.basename(uri.path),
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
}

export async function handleModelResourceRequest(
  panel: vscode.WebviewPanel,
  message: any
): Promise<void> {
  try {
    const source = sources.get(panel)?.get(message.sourceId);
    if (!source || typeof message.relative !== 'string') {
      throw new Error('Unknown model resource source');
    }
    const relative = message.relative.replace(/\\/g, '/');
    let bytes: Uint8Array;
    if (source.remote) {
      bytes = (await readRemoteModelResource(relative, source.remote)).bytes;
    } else {
      const base = vscode.Uri.joinPath(source.uri, '..');
      const name = path.posix.basename(relative);
      const candidates = [relative, name, `textures/${name}`];
      let found: Uint8Array | undefined;
      for (const candidate of candidates) {
        const uri = vscode.Uri.joinPath(base, candidate);
        // A model may only read supporting files under its own directory.
        if (!uri.path.startsWith(base.path + '/') || /^[a-z]+:/i.test(candidate)) {
          continue;
        }
        try {
          found = await vscode.workspace.fs.readFile(uri);
          break;
        } catch {
          /* Try legacy texture layout. */
        }
      }
      if (!found) {
        throw new Error(`Missing model resource: ${relative}`);
      }
      bytes = found;
    }
    await panel.webview.postMessage({
      type: 'modelResourceResult',
      requestId: message.requestId,
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    });
  } catch (error) {
    await panel.webview.postMessage({
      type: 'modelResourceResult',
      requestId: message.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
