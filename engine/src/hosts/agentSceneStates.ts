import {
  agentPointSizePixels,
  agentPointSizeMode,
  setAgentPointSizeMode,
} from './agentPointSizing';
import { comparisonState, agentComparison } from './agentComparison';
import {
  setSelectionCriteria,
  selectionRestoreVisibility,
  setSelectionRestoreVisibility,
  makeNamedSelectionActive,
  invalidateAgentAttributes,
} from './agentInspection';
/* eslint-disable @typescript-eslint/naming-convention -- saved state format */
import * as THREE from 'three';
import type { ControlHost } from './agentControls';
import { applyAgentControl } from './agentControls';
import {
  agentSelection,
  agentNamedSelections,
  namedSelectionEntries,
  selectionData,
  currentAgentSelection,
  resetAgentSelections,
  pose,
  restore,
  type Pose,
} from './agentInspection';
import { agentViewState, objectPresentation } from './agentViewState';
import { loadRegistrationWasm } from '../registration/wasmLoader';
import type { SpatialData } from '../interfaces';

type SubsetState = {
  restore_visibility?: boolean[];
  source: number;
  indices: number[];
  criteria: Record<string, unknown>;
  appearance: ObjectState;
  name?: string;
};
type ObjectState = {
  point_size_mode?: string;
  point_size_pixels?: number;
  distance?: (number | null)[];
  signature: string;
  matrix: number[];
  visible: boolean;
  point_size: number;
  color_mode: string;
  opacity: number;
  points: boolean;
  mesh: boolean;
};
type Snapshot = {
  comparison?: { left: number; right: number } | null;
  active_name?: string;
  version: 1;
  camera: Pose;
  palette: number[][];
  presentation: Record<string, any>;
  objects: ObjectState[];
  selections: SubsetState[];
  active: SubsetState | null;
};
const saved = new WeakMap<ControlHost, Map<string, Snapshot>>();
const fingerprints = new WeakMap<SpatialData, string>();
function states(host: ControlHost) {
  let map = saved.get(host);
  if (!map) {
    map = new Map();
    saved.set(host, map);
  }
  return map;
}
function sources(host: ControlHost) {
  return host.spatialFiles.filter(file => !file.metadata?.agentSelection);
}
async function signature(file: SpatialData) {
  let value = fingerprints.get(file);
  if (!value) {
    const wasm = (await loadRegistrationWasm()) as unknown as {
      inspection_fingerprint(p: Float32Array): string;
    };
    const p = file.positionsArray ?? new Float32Array(file.vertices.flatMap(v => [v.x, v.y, v.z]));
    value = `${file.fileName}:${file.vertexCount}:${wasm.inspection_fingerprint(p)}`;
    fingerprints.set(file, value);
  }
  return value;
}
async function object(host: ControlHost, file: SpatialData): Promise<ObjectState> {
  const i = host.spatialFiles.indexOf(file);
  return {
    point_size_mode: agentPointSizeMode(file),
    point_size_pixels: agentPointSizePixels(file),
    distance: file.metadata?.agentDistance
      ? Array.from(file.scalarFields!.agent_distance, v => (Number.isFinite(v) ? v : null))
      : undefined,
    signature: await signature(file),
    matrix: host.transformationMatrices[i].toArray(),
    visible: host.fileVisibility[i],
    point_size: host.pointSizes[i],
    color_mode: host.individualColorModes[i],
    opacity: objectPresentation(host, i).opacity ?? 1,
    points: host.pointsVisible[i],
    mesh: host.solidVisible[i],
  };
}
async function snapshot(host: ControlHost): Promise<Snapshot> {
  const base = sources(host);
  const ordered = [...base, ...namedSelectionEntries(host).map(([, item]) => item.data)];
  if (currentAgentSelection(host) && !ordered.includes(selectionData(host).data)) {
    ordered.push(selectionData(host).data);
  }
  const split = comparisonState(host);
  const subset = async (name?: string): Promise<SubsetState> => {
    const item = selectionData(host, name);
    return {
      restore_visibility: base.map(
        file =>
          selectionRestoreVisibility(host)?.get(file) ??
          host.fileVisibility[host.spatialFiles.indexOf(file)]
      ),
      name,
      source: base.indexOf(item.source),
      indices: Array.from(item.indices),
      criteria: structuredClone(item.criteria),
      appearance: await object(host, item.data),
    };
  };
  return {
    comparison: split
      ? {
          left: ordered.indexOf(host.spatialFiles[split.left]),
          right: ordered.indexOf(host.spatialFiles[split.right]),
        }
      : null,
    active_name: currentAgentSelection(host)
      ? namedSelectionEntries(host).find(([, item]) => item.data === selectionData(host).data)?.[0]
      : undefined,
    version: 1,
    camera: pose(host),
    palette: host.fileColors.map(c => [...c]),
    presentation: agentViewState(host).presentation,
    objects: await Promise.all(base.map(file => object(host, file))),
    selections: await Promise.all(namedSelectionEntries(host).map(([name]) => subset(name))),
    active: currentAgentSelection(host) ? await subset() : null,
  };
}
function finiteVector(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every(v => typeof v === 'number' && Number.isFinite(v))
  );
}
async function validate(host: ControlHost, value: Snapshot) {
  const base = sources(host);
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.objects) ||
    value.objects.length !== base.length ||
    !Array.isArray(value.selections) ||
    value.selections.length > 20 ||
    new TextEncoder().encode(JSON.stringify(value)).length > 4 * 1024 * 1024
  ) {
    throw new Error(
      'Invalid or oversized scene state (version 1, matching source objects, maximum 4 MiB)'
    );
  }
  const c = value.camera;
  if (
    !c ||
    !finiteVector(c.position, 3) ||
    !finiteVector(c.target, 3) ||
    !finiteVector(c.up, 3) ||
    ![c.fov, c.near, c.far].every(Number.isFinite) ||
    c.fov <= 0 ||
    c.fov >= 180 ||
    c.near <= 0 ||
    c.far <= c.near ||
    new THREE.Vector3()
      .fromArray(c.position)
      .distanceToSquared(new THREE.Vector3().fromArray(c.target)) === 0 ||
    new THREE.Vector3().fromArray(c.up).lengthSq() === 0
  ) {
    throw new Error('Invalid saved camera');
  }
  if (
    !Array.isArray(value.palette) ||
    !value.palette.length ||
    value.palette.length > 4096 ||
    !value.palette.every(color => finiteVector(color, 3) && color.every(v => v >= 0 && v <= 1))
  ) {
    throw new Error('Invalid saved palette');
  }
  const appearance = (o: ObjectState) => {
    if (
      !o ||
      !finiteVector(o.matrix, 16) ||
      [3, 7, 11].some(i => o.matrix[i] !== 0) ||
      o.matrix[15] !== 1 ||
      !Number.isFinite(o.point_size) ||
      o.point_size <= 0 ||
      !Number.isFinite(o.opacity) ||
      o.opacity < 0 ||
      o.opacity > 1 ||
      typeof o.visible !== 'boolean' ||
      typeof o.points !== 'boolean' ||
      typeof o.mesh !== 'boolean' ||
      typeof o.color_mode !== 'string'
    ) {
      throw new Error('Invalid object presentation in scene state');
    }
    if (
      o.distance &&
      (!Array.isArray(o.distance) ||
        !o.distance.every(v => v === null || (typeof v === 'number' && Number.isFinite(v))))
    ) {
      throw new Error('Invalid saved distances');
    }
    if (
      o.point_size_pixels !== undefined &&
      (!Number.isFinite(o.point_size_pixels) || o.point_size_pixels < 1 || o.point_size_pixels > 64)
    ) {
      throw new Error('Invalid adaptive pixel target');
    }
    if (o.point_size_mode && !['adaptive', 'fixed'].includes(o.point_size_mode)) {
      throw new Error('Invalid point size mode');
    }
    if (/^\d+$/.test(o.color_mode) && Number(o.color_mode) >= value.palette.length) {
      throw new Error('Saved palette color is missing');
    }
  };
  for (const [i, o] of value.objects.entries()) {
    appearance(o);
    if (o.distance && o.distance.length !== base[i].vertexCount) {
      throw new Error('Saved distance count does not match source');
    }
    if (o.signature !== (await signature(base[i]))) {
      throw new Error(
        `Scene state source ${i} does not match loaded geometry; reopen the same files in the same order`
      );
    }
  }
  const names = new Set<string>();
  for (const item of [...value.selections, ...(value.active ? [value.active] : [])]) {
    if (
      !Number.isInteger(item.source) ||
      !base[item.source] ||
      !Array.isArray(item.indices) ||
      !item.indices.length ||
      item.indices.some(i => !Number.isInteger(i) || i < 0 || i >= base[item.source].vertexCount) ||
      !item.criteria ||
      typeof item.criteria !== 'object'
    ) {
      throw new Error('Invalid saved selection indices');
    }
    if (
      item.restore_visibility &&
      (item.restore_visibility.length !== base.length ||
        !item.restore_visibility.every(v => typeof v === 'boolean'))
    ) {
      throw new Error('Invalid saved visibility');
    }
    appearance(item.appearance);
    if (item.appearance.distance && item.appearance.distance.length !== item.indices.length) {
      throw new Error('Saved distance count does not match selection');
    }
  }
  for (const item of value.selections) {
    if (!item.name || item.name.length > 100 || names.has(item.name)) {
      throw new Error('Invalid or duplicate selection name');
    }
    names.add(item.name);
  }
  if (value.active_name && !names.has(value.active_name)) {
    throw new Error('Saved active selection is missing');
  }
  if (
    value.comparison &&
    (!Number.isInteger(value.comparison.left) ||
      !Number.isInteger(value.comparison.right) ||
      [value.comparison.left, value.comparison.right].some(
        i =>
          i < 0 ||
          i >= base.length + value.selections.length + (value.active && !value.active_name ? 1 : 0)
      ) ||
      value.comparison.left === value.comparison.right)
  ) {
    throw new Error('Invalid comparison state');
  }
  const p = value.presentation;
  if (
    !p ||
    !Number.isFinite(p.brightness_stops) ||
    p.brightness_stops < -10 ||
    p.brightness_stops > 10 ||
    !['light-modern', 'dark-modern'].includes(p.theme) ||
    typeof p.background !== 'string' ||
    !/^#[\da-f]{6}$|^rgba?\([\d.,%\s]+\)$/i.test(p.background) ||
    !['axes', 'grid', 'legend', 'gamma_correction'].every(k => typeof p[k] === 'boolean')
  ) {
    throw new Error('Unsupported presentation in saved state');
  }
}
async function apply(host: ControlHost, value: Snapshot) {
  await validate(host, value);
  await agentComparison(host, { action: 'disable' });
  resetAgentSelections(host);
  const base = sources(host);
  host.fileColors.splice(
    0,
    host.fileColors.length,
    ...value.palette.map(c => [...c] as [number, number, number])
  );
  const applyObject = async (file: SpatialData, o: ObjectState) => {
    const i = host.spatialFiles.indexOf(file);
    if (!o.distance && file.metadata?.agentDistance) {
      delete file.scalarFields?.agent_distance;
      delete file.metadata.agentDistance;
      invalidateAgentAttributes(file);
    }
    if (o.distance) {
      file.scalarFields = {
        ...file.scalarFields,
        agent_distance: Float32Array.from(o.distance, v => v ?? NaN),
      };
      file.metadata = { ...file.metadata, agentDistance: true };
      invalidateAgentAttributes(file);
    }
    host.setTransformationMatrix(i, new THREE.Matrix4().fromArray(o.matrix));
    host.updateMatrixTextarea(i);
    await applyAgentControl(host, 'object', {
      object_index: i,
      point_size: o.point_size,
      color_mode: o.color_mode,
      opacity: o.opacity,
      visible: o.visible,
      mode: o.mesh ? 'mesh' : 'points',
    });
    setAgentPointSizeMode(host, i, o.point_size_mode === 'adaptive', o.point_size_pixels);
  };
  for (const [i, file] of base.entries()) {
    await applyObject(file, value.objects[i]);
  }
  const makeSubset = async (item: SubsetState) => {
    await agentSelection(host, {
      object_index: host.spatialFiles.indexOf(base[item.source]),
      indices: Uint32Array.from(item.indices),
      isolate: false,
      focus: false,
      highlight: false,
    });
    const selected = selectionData(host);
    setSelectionCriteria(host, item.criteria);
    await applyObject(selected.data, item.appearance);
  };
  for (const item of value.selections) {
    await makeSubset(item);
    await agentNamedSelections(host, { action: 'save', name: item.name });
  }
  // Clear active selection while retaining named ones, then recreate the saved active subset.
  await agentSelection(host, { action: 'clear' });
  if (value.active_name) {
    makeNamedSelectionActive(host, value.active_name);
  } else if (value.active) {
    await makeSubset(value.active);
  }
  if (value.active?.restore_visibility) {
    setSelectionRestoreVisibility(
      host,
      base.map((file, i) => [file, value.active!.restore_visibility![i]])
    );
  }
  // Creating subsets can restore prior visibility; apply the complete saved visibility last.
  base.forEach((file, i) =>
    host.setFileEntryVisibility(host.spatialFiles.indexOf(file), value.objects[i].visible)
  );
  for (const item of value.selections) {
    const selected = selectionData(host, item.name);
    host.setFileEntryVisibility(host.spatialFiles.indexOf(selected.data), item.appearance.visible);
  }
  const p = value.presentation;
  await applyAgentControl(host, 'appearance', {
    brightness: p.brightness_stops,
    background: p.background,
    axes: p.axes,
    grid: p.grid,
    legend: p.legend,
    gamma_correction: p.gamma_correction,
    theme: p.theme,
  });
  restore(host, value.camera);
  if (value.comparison) {
    await agentComparison(host, { action: 'enable', ...value.comparison });
  }
}
export async function agentSceneStates(host: ControlHost, a: Record<string, any>) {
  const map = states(host);
  if (a.action === 'save' || a.action === 'import') {
    if (!map.has(a.name) && map.size >= 20) {
      throw new Error('At most 20 scene states');
    }
    const value = a.action === 'save' ? await snapshot(host) : a.state;
    await validate(host, value);
    map.set(a.name, structuredClone(value));
  } else if (a.action === 'restore') {
    const value = map.get(a.name);
    if (!value) {
      throw new Error('Unknown scene state');
    }
    await validate(host, value);
    const before = await snapshot(host);
    try {
      await apply(host, value);
    } catch (error) {
      await apply(host, before);
      throw error;
    }
  } else if (a.action === 'delete') {
    map.delete(a.name);
  } else if (a.action === 'export') {
    const value = map.get(a.name);
    if (!value) {
      throw new Error('Unknown scene state');
    }
    return { state: value };
  }
  return { scene_states: [...map.keys()], restored: a.action === 'restore' ? a.name : null };
}
