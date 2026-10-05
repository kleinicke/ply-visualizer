import { sendToWebview } from './webviewTransport';
import type * as vscode from 'vscode';
import * as path from 'node:path';
import { isCadFormat } from '../../engine/src/models/cadTypes';
import { decodeCadInNode } from '../../engine/src/parsers/cadNode';

export async function handleCadDecodeRequest(
  panel: vscode.WebviewPanel,
  extensionPath: string,
  message: { requestId?: unknown; bytes?: unknown; format?: unknown }
): Promise<void> {
  if (typeof message.requestId !== 'string') {
    return;
  }
  try {
    if (!isCadFormat(message.format)) {
      throw new Error('Unsupported CAD format.');
    }
    if (!(message.bytes instanceof Uint8Array) || !message.bytes.length) {
      throw new Error('CAD request contains no file bytes.');
    }
    const result = await decodeCadInNode(
      message.bytes,
      path.join(extensionPath, 'out', 'wasm', 'cad', 'occt-import-js.js'),
      message.format
    );
    await sendToWebview(panel, {
      type: 'cadDecodeResult',
      requestId: message.requestId,
      result,
    });
  } catch (error) {
    await sendToWebview(panel, {
      type: 'cadDecodeResult',
      requestId: message.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
