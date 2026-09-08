import { setAgentPointSizeMode } from './agentPointSizing';
import { comparisonState } from './agentComparison';
/* eslint-disable @typescript-eslint/naming-convention -- MCP wire keys */
import * as THREE from 'three';
import type { SpatialData } from '../interfaces';
import type { SelectionManager } from '../SelectionManager';
import { loadRegistrationWasm } from '../registration/wasmLoader';
import { fitAgentView, type ControlHost } from './agentControls';

export type Pose = {
  position: number[];
  target: number[];
  up: number[];
  near: number;
  far: number;
  fov: number;
};
export type NamedSelection = {
  source: SpatialData;
  indices: Uint32Array;
  data: SpatialData;
  criteria: Record<string, unknown>;
};
type InspectionState = {
  named: Map<string, NamedSelection>;
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
    value = { views: new Map(), undo: [], named: new Map() };
    states.set(host, value);
  }
  return value;
}
export function pose(host: ControlHost): Pose {
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
export function restore(host: ControlHost, p: Pose) {
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
  const split = comparisonState(host);
  if (!split) {
    return pickSingleView(host, screen);
  }
  const side = screen[0] < 0.5 ? split.left : split.right;
  const visible = host.fileVisibility.slice();
  const meshVisible = host.meshes.map(mesh => mesh?.visible);
  const aspect = host.camera.aspect;
  try {
    host.fileVisibility.forEach((_, i) => {
      host.fileVisibility[i] = i === side;
      if (host.meshes[i]) {
        host.meshes[i]!.visible = i === side;
      }
    });
    host.camera.aspect = aspect / 2;
    host.camera.updateProjectionMatrix();
    return await pickSingleView(host, [screen[0] * 2 - (screen[0] < 0.5 ? 0 : 1), screen[1]]);
  } finally {
    host.fileVisibility.splice(0, host.fileVisibility.length, ...visible);
    host.meshes.forEach((mesh, i) => {
      if (mesh) {
        mesh.visible = meshVisible[i]!;
      }
    });
    host.camera.aspect = aspect;
    host.camera.updateProjectionMatrix();
  }
}
async function pickSingleView(host: ControlHost, screen: number[]) {
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
  const saved = [...s.named.values()].find(item => item.data === file);
  const selected = file === s.selection ? { source: s.source!, indices: s.indices! } : saved;
  const sourceIndex =
    selected && hit.pointIndex !== undefined ? selected.indices[hit.pointIndex] : hit.pointIndex;
  return {
    hit: true,
    xyz: hit.point.toArray(),
    object_index: hit.objectIndex ?? null,
    point_index: hit.pointIndex ?? null,
    source_object_index: selected
      ? host.spatialFiles.indexOf(selected.source)
      : (hit.objectIndex ?? null),
    source_point_index: sourceIndex ?? null,
    source_row:
      sourceIndex === undefined
        ? null
        : ((selected?.source ?? file)?.sourcePointIndices?.[sourceIndex] ?? null),
    index_space:
      'source_point_index is decoded; source_row is original zero-based source record (depth raster: v*width+u), null when unavailable',
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
  if (index >= 0 && ![...s.named.values()].some(item => item.data === s.selection)) {
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
  if (!source || source.metadata?.agentSelection) {
    throw new Error('Select a source object_index from inspect_3d_scene');
  }
  const mesh = host.meshes[a.object_index];
  if (!mesh || source.faceCount || source.sceneModel) {
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
  const indices: Uint32Array =
    a.indices ??
    wasm.select_point_indices(
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
    sourcePointCount: indices.length,
    sourcePointIndices: source.sourcePointIndices?.length
      ? Uint32Array.from(indices, index => source.sourcePointIndices![index])
      : undefined,
    positionsArray: subset(positions, 3)!,
    colorsArray: subset(source.colorsArray, 3),
    normalsArray: subset(source.normalsArray, 3),
    intensityArray: subset(source.intensityArray, 1),
    scalarFields: Object.fromEntries(
      Object.entries(source.scalarFields ?? {}).map(([name, array]) => [name, subset(array, 1)!])
    ),
    metadata: { ...source.metadata, agentSelection: true },
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
  if (data.vertexCount <= 100) {
    setAgentPointSizeMode(host, i, true);
  }
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

export function selectionData(host: ControlHost, name?: string) {
  const s = state(host);
  if (name) {
    const item = s.named.get(name);
    if (
      !item ||
      !host.spatialFiles.includes(item.source) ||
      !host.spatialFiles.includes(item.data)
    ) {
      throw new Error('Unknown or expired selection name');
    }
    return item;
  }
  if (!s.selection || !s.source || !s.indices) {
    throw new Error('Select some points first');
  }
  return { source: s.source, indices: s.indices, data: s.selection, criteria: s.criteria ?? {} };
}

export function namedSelectionEntries(host: ControlHost) {
  const s = state(host);
  for (const [name, item] of s.named) {
    if (!host.spatialFiles.includes(item.source) || !host.spatialFiles.includes(item.data)) {
      s.named.delete(name);
    }
  }
  return [...s.named.entries()];
}

export async function agentNamedSelections(host: ControlHost, a: Record<string, any>) {
  const s = state(host);
  namedSelectionEntries(host);
  if (a.action === 'save') {
    if (s.named.has(a.name)) {
      throw new Error('Selection name already exists; delete it first');
    }
    if (s.named.size >= 20) {
      throw new Error('At most 20 named selections');
    }
    const item = selectionData(host);
    if ([...s.named.values()].some(value => value.data === item.data)) {
      throw new Error('This selection is already named');
    }
    item.data.fileName = a.name;
    s.named.set(a.name, { ...item, indices: item.indices.slice() });
    host.updateFileList();
  } else if (a.action === 'delete') {
    const item = selectionData(host, a.name);
    s.named.delete(a.name);
    if (item.data === s.selection) {
      clearAgentSelection(host);
    } else {
      host.removeFileByIndex(host.spatialFiles.indexOf(item.data));
    }
  } else if (a.action === 'visible') {
    const item = selectionData(host, a.name);
    host.setFileEntryVisibility(host.spatialFiles.indexOf(item.data), a.visible);
  } else if (a.action === 'activate' || ['union', 'intersection', 'subtract'].includes(a.action)) {
    const left = selectionData(host, a.name);
    let indices = left.indices;
    if (a.action !== 'activate') {
      const right = selectionData(host, a.other);
      if (left.source !== right.source) {
        throw new Error('Set operations require selections from the same source cloud');
      }
      const wasm = (await loadRegistrationWasm()) as unknown as {
        combine_point_indices(a: Uint32Array, b: Uint32Array, op: string): Uint32Array;
      };
      indices = wasm.combine_point_indices(left.indices, right.indices, a.action);
    }
    const visibility = new Map(host.spatialFiles.map((file, i) => [file, host.fileVisibility[i]]));
    if (!indices.length) {
      clearAgentSelection(host);
      visibility.forEach((visible, file) => {
        const i = host.spatialFiles.indexOf(file);
        if (i >= 0) {
          host.setFileEntryVisibility(i, visible);
        }
      });
      return {
        status: 'empty',
        selected_points: 0,
        active_selection: null,
        operation: a.action,
        exportable: false,
      };
    }
    await agentSelection(host, {
      object_index: host.spatialFiles.indexOf(left.source),
      indices,
      isolate: a.isolate,
      focus: a.focus,
      highlight: true,
    });
    if (!a.isolate) {
      visibility.forEach((visible, file) => {
        const i = host.spatialFiles.indexOf(file);
        if (i >= 0) {
          host.setFileEntryVisibility(i, visible);
        }
      });
    }
    s.criteria = {
      named_operation: a.action,
      name: a.name,
      other: a.other ?? null,
      isolate: !!a.isolate,
    };
  }
  host.requestRender();
  return {
    named_selections: namedSelectionEntries(host).map(([name, item]) => ({
      name,
      selected_points: item.indices.length,
      object_index: host.spatialFiles.indexOf(item.data),
      source_object_index: host.spatialFiles.indexOf(item.source),
      visible: host.fileVisibility[host.spatialFiles.indexOf(item.data)],
    })),
    active_selection: currentAgentSelection(host),
  };
}

export function resetAgentSelections(host: ControlHost) {
  const s = state(host);
  clearAgentSelection(host);
  for (const item of s.named.values()) {
    const i = host.spatialFiles.indexOf(item.data);
    if (i >= 0) {
      host.removeFileByIndex(i);
    }
  }
  s.named.clear();
}

export function invalidateAgentAttributes(file: SpatialData) {
  summaries.delete(file);
}

export function setSelectionCriteria(host: ControlHost, criteria: Record<string, unknown>) {
  state(host).criteria = structuredClone(criteria);
}
export function selectionRestoreVisibility(host: ControlHost) {
  return state(host).visibility;
}
export function setSelectionRestoreVisibility(
  host: ControlHost,
  entries: [SpatialData, boolean][]
) {
  state(host).visibility = new Map(entries);
}
export function makeNamedSelectionActive(host: ControlHost, name: string) {
  const item = selectionData(host, name),
    s = state(host);
  s.selection = item.data;
  s.source = item.source;
  s.indices = item.indices;
  s.criteria = item.criteria;
}
