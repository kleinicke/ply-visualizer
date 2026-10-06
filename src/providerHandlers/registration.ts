import { sendToWebview } from './webviewTransport';
import type * as vscode from 'vscode';
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import type { RegistrationKind } from '../../engine/src/registration/registrationWorker';

interface RegistrationMessage {
  id?: unknown;
  kind?: unknown;
  source?: unknown;
  target?: unknown;
  settingsJson?: unknown;
}

const KINDS = new Set<RegistrationKind>(['register', 'coarse', 'icp', 'fit']);
const MAX_COORDINATES = 6_000_000;

function coordinates(value: unknown, name: string): Float32Array {
  if (!(value instanceof Float32Array)) {
    throw new Error(`${name} point data did not arrive as Float32Array.`);
  }
  if (value.length < 9 || value.length % 3 !== 0) {
    throw new Error(`${name} needs at least three complete xyz points.`);
  }
  if (value.length > MAX_COORDINATES) {
    throw new Error(`${name} exceeds the registration safety limit.`);
  }
  return value;
}

interface HostWorker {
  worker: Worker;
  active?: { id: string; resolve(value: any): void; reject(error: Error): void };
}
const workers = new WeakMap<vscode.WebviewPanel, HostWorker>();

/** Termination interrupts synchronous WASM without blocking the extension host. */
export function cancelRegistrationRequest(panel: vscode.WebviewPanel, id?: string): void {
  const state = workers.get(panel);
  if (!state || (id !== undefined && state.active?.id !== id)) {
    return;
  }
  workers.delete(panel);
  const error = new Error('Alignment cancelled.');
  error.name = 'AbortError';
  state.active?.reject(error);
  state.active = undefined;
  void state.worker.terminate();
}

function getWorker(panel: vscode.WebviewPanel): HostWorker {
  const existing = workers.get(panel);
  if (existing) {
    return existing;
  }
  const worker = new Worker(join(__dirname, 'registrationWorker.js'));
  const state: HostWorker = { worker };
  workers.set(panel, state);
  worker.on('message', value => {
    const active = state.active;
    state.active = undefined;
    worker.unref();
    if (value?.error) {
      active?.reject(new Error(value.error));
    } else {
      active?.resolve(value);
    }
  });
  const failed = (error: Error) => {
    if (workers.get(panel) === state) {
      workers.delete(panel);
    }
    state.active?.reject(error);
    state.active = undefined;
    void worker.terminate();
  };
  worker.on('error', failed);
  worker.on('exit', code => {
    if (workers.get(panel) === state) {
      workers.delete(panel);
    }
    if (state.active) {
      failed(new Error(`Registration worker exited (${code}).`));
    }
  });
  worker.unref();
  return state;
}

/** Each panel owns one reusable, cancellable solver worker. */
export async function handleRegistrationRequest(
  webviewPanel: vscode.WebviewPanel,
  message: RegistrationMessage
): Promise<void> {
  const id = typeof message.id === 'string' ? message.id : '';
  try {
    if (!id) {
      throw new Error('Registration request has no ID.');
    }
    if (typeof message.kind !== 'string' || !KINDS.has(message.kind as RegistrationKind)) {
      throw new Error('Registration request has an unknown operation.');
    }
    const source = coordinates(message.source, 'Source');
    const target = coordinates(message.target, 'Target');
    const settingsJson = typeof message.settingsJson === 'string' ? message.settingsJson : '{}';
    const state = getWorker(webviewPanel);
    if (state.active) {
      throw new Error('An alignment is already running in this panel.');
    }
    const result = await new Promise<{ matrix: Float64Array; stats: string } | null>(
      (resolve, reject) => {
        state.active = { id, resolve, reject };
        state.worker.ref();
        // Do not detach webview transport buffers that another consumer may retain.
        state.worker.postMessage({ kind: message.kind, source, target, settingsJson });
      }
    );
    await sendToWebview(webviewPanel, {
      type: 'registrationResult',
      id,
      matrix: result?.matrix ?? null,
      stats: result?.stats ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return;
    }
    await sendToWebview(webviewPanel, {
      type: 'registrationResult',
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
