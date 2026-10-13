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
  const compacted = compactTypedArrayViews(message);
  return panel.webview.postMessage(
    dataMessage
      ? {
          ...compacted,
          postedAt: message.postedAt ?? Date.now(),
          loadStartedAt: message.loadStartedAt ?? transport?.loadStartedAt(),
        }
      : compacted
  );
}

/** Longer plain arrays are not searched (they are JSON-encoded element by element anyway). */
const MAX_WALKED_ARRAY = 4096;

/**
 * VS Code posts a typed array as its whole underlying ArrayBuffer, and the
 * webview copies all of it, so a view into a larger buffer ships the larger
 * buffer. The per-scan colour updates of an archive recolour were views into
 * archive-wide arrays: eight of them moved 1.7 GB instead of 210 MB and took
 * three seconds. A view that does not cover its whole buffer is copied to its
 * exact size; everything else is passed through untouched, and the caller's
 * objects are never modified.
 */
export function compactTypedArrayViews<T>(value: T): T {
  return compact(value, 0) as T;
}

function compact(value: unknown, depth: number): unknown {
  if (ArrayBuffer.isView(value)) {
    // DataViews are not sent as binary, and Node Buffers are JSON-encoded by
    // VS Code; neither is a view this can usefully tighten.
    if (value instanceof DataView || (typeof Buffer !== 'undefined' && Buffer.isBuffer(value))) {
      return value;
    }
    // A view of shared memory (an archive read for the decoder pool) is always
    // copied: VS Code would otherwise post the whole SharedArrayBuffer.
    const shared =
      typeof SharedArrayBuffer !== 'undefined' && value.buffer instanceof SharedArrayBuffer;
    const covers = value.byteOffset === 0 && value.byteLength === value.buffer.byteLength;
    return covers && !shared ? value : (value as unknown as { slice(): unknown }).slice();
  }
  if (!value || typeof value !== 'object' || depth > 32) {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_WALKED_ARRAY) {
      return value;
    }
    let out: unknown[] | null = null;
    for (let index = 0; index < value.length; index++) {
      const item = compact(value[index], depth + 1);
      if (item !== value[index]) {
        out ??= value.slice();
        out[index] = item;
      }
    }
    return out ?? value;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return value;
  }
  let out: Record<string, unknown> | null = null;
  for (const [key, entry] of Object.entries(value)) {
    const item = compact(entry, depth + 1);
    if (item !== entry) {
      out ??= { ...(value as Record<string, unknown>) };
      out[key] = item;
    }
  }
  return out ?? value;
}
