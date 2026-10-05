import type * as vscode from 'vscode';
import type { WebviewReadyGate } from './webviewReadyGate';

interface Transport {
  gate: WebviewReadyGate;
  initialLoad?: WebviewReadyGate;
  loadStartedAt(): number;
}
const transports = new WeakMap<vscode.Webview, Transport>();

export function registerWebviewTransport(
  panel: vscode.WebviewPanel,
  gate: WebviewReadyGate,
  loadStartedAt: () => number,
  initialLoad?: WebviewReadyGate
): void {
  transports.set(panel.webview, { gate, loadStartedAt, initialLoad });
}

/** Explicit readiness/timing boundary; never replaces VS Code's API methods. */
export async function sendToWebview(
  panel: vscode.WebviewPanel,
  message: { type: string; [key: string]: unknown }
): Promise<boolean> {
  const transport = transports.get(panel.webview);
  if (transport && !(await transport.gate.wait())) {
    return false;
  }
  if (
    message.type === 'nativeAgentRequest' &&
    transport?.initialLoad &&
    !(await transport.initialLoad.wait())
  ) {
    return false;
  }
  const dataMessage = message.type.endsWith('Data');
  return panel.webview.postMessage(
    dataMessage
      ? {
          ...message,
          postedAt: message.postedAt ?? Date.now(),
          loadStartedAt: message.loadStartedAt ?? transport?.loadStartedAt(),
        }
      : message
  );
}
