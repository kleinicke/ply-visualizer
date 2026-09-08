/* eslint-disable @typescript-eslint/naming-convention -- MCP wire keys */
import * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import type { SelectionManager } from '../SelectionManager';
import { loadRegistrationWasm } from '../registration/wasmLoader';
import { fitAgentView, type ControlHost } from './agentControls';

type Pose = {
  position: number[];
  target: number[];
  up: number[];
  near: number;
  far: number;
  fov: number;
};
type InspectionState = {
  views: Map<string, Pose>;
  undo: Pose[];
  selection?: SpatialData;
  criteria?: Record<string, unknown>;
  source?: SpatialData;
  indices?: Uint32Array;
  visibility?: Map<SpatialData, boolean>;
};
const states = new WeakMap<ControlHost, InspectionState>();
function state(host: ControlHost) {
  let value = states.get(host);
  if (!value) {
    value = { views: new Map(), undo: [] };
    states.set(host, value);
  }
  return value;
}
function pose(host: ControlHost): Pose {
  return {
    position: host.camera.position.toArray(),
    target: host.controls.target.toArray(),
    up: host.camera.up.toArray(),
    near: host.camera.near,
    far: host.camera.far,
    fov: host.camera.fov,
  };
}
export function rememberAgentCamera(host: ControlHost) {
  const s = state(host);
  s.undo.push(pose(host));
  if (s.undo.length > 50) {
    s.undo.shift();
  }
}
function restore(host: ControlHost, p: Pose) {
  host.camera.position.fromArray(p.position);
  host.controls.target.fromArray(p.target);
  host.camera.up.fromArray(p.up);
  host.camera.near = p.near;
  host.camera.far = p.far;
  host.camera.fov = p.fov;
  host.camera.updateProjectionMatrix();
  host.controls.update();
  host.requestRender();
}
export function agentViews(host: ControlHost, a: Record<string, any>) {
  const s = state(host);
  if (a.action === 'save') {
    if (!s.views.has(a.name) && s.views.size >= 50) {
      throw new Error('At most 50 named views');
    }
    s.views.set(a.name, pose(host));
  } else if (a.action === 'restore') {
    const p = s.views.get(a.name);
    if (!p) {
      throw new Error('Unknown view name');
    }
    rememberAgentCamera(host);
    restore(host, p);
  } else if (a.action === 'delete') {
    s.views.delete(a.name);
  } else if (a.action === 'undo') {
    const p = s.undo.pop();
    if (!p) {
      throw new Error('No camera change to undo');
    }
    restore(host, p);
  }
  return { views: Object.fromEntries(s.views), undo_available: s.undo.length, camera: pose(host) };
}
export async function agentPick(host: ControlHost, screen: number[]) {
  const picker = host as unknown as {
    selectionManager: SelectionManager;
    getSelectionContext(): any;
  };
  picker.selectionManager.updateContext(picker.getSelectionContext());
  const canvas = host.renderer.domElement;
  const hit = await picker.selectionManager.selectPointWithLoggingAsync(
    screen[0] * canvas.clientWidth,
    screen[1] * canvas.clientHeight,
    canvas
  );
  if (!hit) {
    return {
      hit: false,
      xyz: null as number[] | null,
      object_index: null as number | null,
      point_index: null as number | null,
      attributes: {},
    };
  }
  const file = hit.objectIndex === undefined ? undefined : host.spatialFiles[hit.objectIndex];
  const s = state(host);
  const sourceIndex =
    file === s.selection && hit.pointIndex !== undefined
      ? s.indices?.[hit.pointIndex]
      : hit.pointIndex;
  return {
    hit: true,
    xyz: hit.point.toArray(),
    object_index: hit.objectIndex ?? null,
    point_index: hit.pointIndex ?? null,
    source_object_index:
      file === s.selection ? host.spatialFiles.indexOf(s.source!) : (hit.objectIndex ?? null),
    source_point_index: sourceIndex ?? null,
    index_space: 'decoded cloud (invalid source rows removed)',
    attributes: Object.fromEntries(
      Object.entries(file?.scalarFields ?? {}).map(([key, values]) => [
        key,
        hit.pointIndex === undefined ? null : values[hit.pointIndex],
      ])
    ),
    info: hit.info,
  };
}
export function clearAgentSelection(host: ControlHost) {
  const s = state(host);
  const index = s.selection ? host.spatialFiles.indexOf(s.selection) : -1;
  if (index >= 0) {
    host.removeFileByIndex(index);
  }
  s.visibility?.forEach((visible, file) => {
    const i = host.spatialFiles.indexOf(file);
    if (i >= 0) {
      host.setFileEntryVisibility(i, visible);
    }
  });
  s.selection = undefined;
  s.criteria = undefined;
  s.visibility = undefined;
  s.source = undefined;
  s.indices = undefined;
  host.requestRender();
}
export async function agentSelection(host: ControlHost, a: Record<string, any>) {
  if (a.action === 'clear') {
    clearAgentSelection(host);
    return { selected_points: 0, restored: true };
  }
  const source = host.spatialFiles[a.object_index];
  if (!source || source === state(host).selection) {
    throw new Error('Select a source object_index from inspect_3d_scene');
  }
  const mesh = host.meshes[a.object_index];
  if (!mesh || source.faceCount) {
    throw new Error(
      'Region selection currently requires a point cloud; use object visibility for meshes'
    );
  }
  const position = (mesh as THREE.Points).geometry.getAttribute('position');
  if (!position || position.count !== source.vertexCount) {
    throw new Error('Selection requires full point geometry');
  }
  const positions =
    source.positionsArray ?? new Float32Array(source.vertices.flatMap(v => [v.x, v.y, v.z]));
  const values = a.field ? source.scalarFields?.[a.field] : undefined;
  if (a.field && !values) {
    throw new Error('Unknown scalar field');
  }
  mesh.updateWorldMatrix(true, false);
  const matrix = mesh.matrixWorld.clone();
  const wasm = (await loadRegistrationWasm()) as unknown as {
    select_point_indices(
      p: Float32Array,
      v: Float32Array,
      accepted: Float32Array,
      matrix: Float64Array,
      bounds: Float64Array,
      plane: Float64Array
    ): Uint32Array;
  };
  if (!wasm) {
    throw new Error('Selection WebAssembly unavailable');
  }
  const indices = wasm.select_point_indices(
    positions,
    values ?? new Float32Array(),
    new Float32Array(a.values ?? []),
    new Float64Array(matrix.elements),
    new Float64Array(a.bounds ?? []),
    new Float64Array(a.plane ?? [])
  );
  if (!indices.length) {
    const summary = a.field
      ? ((await agentAttributes([source]))[0][a.field] as {
          value_counts: Record<string, number>;
          values_truncated: boolean;
        })
      : null;
    const available = summary
      ? ` Available ${a.field} values${summary.values_truncated ? ' (first 64)' : ''}: ${Object.keys(summary.value_counts).join(', ')}.`
      : '';
    throw new Error('Selection matched no points; previous selection is unchanged.' + available);
  }
  const subset = <T extends Float32Array | Uint8Array>(
    array: T | null | undefined,
    stride: number
  ): T | null => {
    if (!array) {
      return null;
    }
    const result = new (array.constructor as { new (length: number): T })(indices.length * stride);
    indices.forEach((index, i) =>
      result.set(array.subarray(index * stride, (index + 1) * stride), i * stride)
    );
    return result;
  };
  const data: SpatialData = {
    ...source,
    fileName: `Selection: ${source.fileName ?? a.object_index}`,
    fileIndex: undefined,
    vertices: [],
    faces: [],
    faceCount: 0,
    vertexCount: indices.length,
    sourcePointCount: undefined,
    positionsArray: subset(positions, 3)!,
    colorsArray: subset(source.colorsArray, 3),
    normalsArray: subset(source.normalsArray, 3),
    intensityArray: subset(source.intensityArray, 1),
    scalarFields: Object.fromEntries(
      Object.entries(source.scalarFields ?? {}).map(([name, array]) => [name, subset(array, 1)!])
    ),
    metadata: { agentSelection: true },
    useTypedArrays: true,
  };
  clearAgentSelection(host);
  const s = state(host);
  s.visibility = new Map(host.spatialFiles.map((file, i) => [file, host.fileVisibility[i]]));
  const before = pose(host);
  const i = host.spatialFiles.length;
  host.addNewFiles([data]);
  restore(host, before);
  const selected = host.meshes[i]!;
  // Preserve the source's complete world transform, including its PCD VIEWPOINT.
  host.setTransformationMatrix(i, matrix);
  selected.updateMatrixWorld(true);
  s.selection = data;
  s.criteria = {
    field: a.field ?? null,
    values: a.values ?? null,
    bounds: a.bounds ?? null,
    plane: a.plane ?? null,
    isolate: !!a.isolate,
    highlight: a.highlight !== false,
  };
  s.source = source;
  s.indices = indices;
  if (a.isolate) {
    host.spatialFiles.forEach((_, index) => host.setFileEntryVisibility(index, index === i));
  }
  if (a.highlight !== false) {
    const color = host.fileColors.push([1, 0.65, 0]) - 1;
    host.onFileColorModeChange(i, String(color));
  }
  const box = new THREE.Box3().setFromObject(selected);
  if (a.focus) {
    rememberAgentCamera(host);
    fitAgentView(host, undefined, box);
  }
  host.requestRender();
  return {
    object_index: i,
    source_object_index: host.spatialFiles.indexOf(source),
    selected_points: indices.length,
    source_points: source.vertexCount,
    isolated: !!a.isolate,
    bounds: { min: box.min.toArray(), max: box.max.toArray() },
    camera: pose(host),
  };
}

const summaries = new WeakMap<SpatialData, Record<string, unknown>>();
export async function agentAttributes(files: SpatialData[]) {
  const wasm = (await loadRegistrationWasm()) as unknown as {
    scalar_summary(values: Float32Array): string;
  };
  return files.map(file => {
    let summary = summaries.get(file);
    if (!summary) {
      summary = Object.fromEntries(
        Object.entries(file.scalarFields ?? {}).map(([name, values]) => [
          name,
          JSON.parse(wasm.scalar_summary(values)),
        ])
      );
      summaries.set(file, summary);
    }
    return summary;
  });
}

export function currentAgentSelection(host: ControlHost) {
  const s = state(host);
  const index = s.selection ? host.spatialFiles.indexOf(s.selection) : -1;
  if (index < 0) {
    return null;
  }
  return {
    object_index: index,
    source_object_index: host.spatialFiles.indexOf(s.source!),
    selected_points: s.selection!.vertexCount,
    criteria: s.criteria,
  };
}
