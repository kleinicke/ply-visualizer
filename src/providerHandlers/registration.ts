import type * as vscode from 'vscode';
import {
  loadRegistrationWasm,
  type RegistrationWasm,
} from '../../engine/src/registration/wasmLoader';
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

function run(
  wasm: RegistrationWasm,
  kind: RegistrationKind,
  source: Float32Array,
  target: Float32Array,
  settingsJson: string
): { matrix: Float64Array; stats: string } | null {
  const result =
    kind === 'register'
      ? wasm.register_pair(source, target, settingsJson)
      : kind === 'coarse'
        ? wasm.coarse_align(source, target, settingsJson)
        : kind === 'icp'
          ? wasm.icp_refine(source, target, settingsJson)
          : wasm.fit_correspondences(source, target);
  if (!result) {
    return null;
  }
  try {
    return { matrix: result.matrix, stats: result.stats };
  } finally {
    result.free?.();
  }
}

/** Runs browser registration in the extension process so ICP cannot freeze the webview. */
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
    const wasm = await loadRegistrationWasm();
    if (!wasm) {
      throw new Error('The registration WebAssembly module failed to load in the extension host.');
    }
    const result = run(wasm, message.kind as RegistrationKind, source, target, settingsJson);
    await webviewPanel.webview.postMessage({
      type: 'registrationResult',
      id,
      matrix: result?.matrix ?? null,
      stats: result?.stats ?? null,
    });
  } catch (error) {
    await webviewPanel.webview.postMessage({
      type: 'registrationResult',
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
