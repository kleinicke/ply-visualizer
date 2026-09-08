/* eslint-disable @typescript-eslint/naming-convention -- MCP wire keys */
import type { ControlHost } from './agentControls';
import { selectionData } from './agentInspection';
import { loadRegistrationWasm } from '../registration/wasmLoader';
const exports = new WeakMap<ControlHost, { id: string; bytes: Uint8Array; created: number }>();
export async function agentExport(host: ControlHost, a: Record<string, any>) {
  if (a.action === 'start') {
    const item = selectionData(host, a.name);
    const data = item.data;
    const fields = {
      ...data.scalarFields,
      ...(data.intensityArray ? { intensity: data.intensityArray } : {}),
    };
    const entries = Object.entries(fields);
    const flat = new Float32Array(entries.length * data.vertexCount);
    entries.forEach(([, values], i) => flat.set(values, i * data.vertexCount));
    const wasm = (await loadRegistrationWasm()) as unknown as {
      export_inspection_ply(
        p: Float32Array,
        c: Uint8Array,
        n: Float32Array,
        s: Float32Array,
        names: string,
        d: Uint32Array,
        o: Uint32Array,
        m: string
      ): Uint8Array;
    };
    const metadata = {
      coordinates: 'object-local; apply local_to_world for the rendered pose',
      local_to_world: host.transformationMatrices[host.spatialFiles.indexOf(data)].toArray(),
      source_origin: data.sourceOrigin ?? null,
      source_file: item.source.fileName,
      original_rows_available: !!data.sourcePointIndices?.length,
    };
    const bytes = wasm.export_inspection_ply(
      data.positionsArray!,
      data.colorsArray ?? new Uint8Array(),
      data.normalsArray ?? new Float32Array(),
      flat,
      JSON.stringify(entries.map(([key]) => key)),
      item.indices,
      data.sourcePointIndices ?? new Uint32Array(),
      JSON.stringify(metadata)
    );
    if (!bytes.length || bytes.length > 256 * 1024 * 1024) {
      throw new Error('Export is empty or exceeds 256 MiB');
    }
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), v =>
      v.toString(16).padStart(2, '0')
    ).join('');
    exports.set(host, { id, bytes, created: Date.now() });
    return {
      export_id: id,
      size: bytes.length,
      points: data.vertexCount,
      attributes: entries.map(([key]) => key),
      ...metadata,
    };
  }
  const pending = exports.get(host);
  if (!pending || pending.id !== a.export_id || Date.now() - pending.created > 120000) {
    throw new Error('Export expired; start again');
  }
  if (a.action === 'release') {
    exports.delete(host);
    return { released: true };
  }
  if (!Number.isInteger(a.offset) || a.offset < 0 || a.offset > pending.bytes.length) {
    throw new Error('Invalid export offset');
  }
  pending.created = Date.now();
  const bytes = pending.bytes.subarray(a.offset, a.offset + 512 * 1024);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return { data: btoa(binary), offset: a.offset, size: pending.bytes.length };
}
