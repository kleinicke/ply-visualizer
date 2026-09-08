/* eslint-disable @typescript-eslint/naming-convention -- MCP wire keys */
/** Agent jobs reuse the viewer's registration workflows and Rust solvers. */
import * as THREE from 'three';
import type { ControlHost } from './agentControls';
import type { SpatialData } from '../interfaces';
import { registrationState as ui } from '../state/registration.svelte';
import {
  beginSession,
  endSession,
  autoAlign,
  refineIcp,
  alignAllTo,
  worldPoints,
} from '../registrationFeature';
import { fitCorrespondences, registrationBackend } from '../registration';

type Job = {
  id: number;
  action: string;
  state: 'queued' | 'running' | 'completed' | 'failed';
  message: string;
  metrics?: unknown;
  revision?: number;
  settings?: Record<string, unknown>;
};
type State = { serial: number; job?: Job; undo?: Map<SpatialData, THREE.Matrix4> };
const states = new WeakMap<ControlHost, State>();
function state(host: ControlHost) {
  let s = states.get(host);
  if (!s) {
    s = { serial: 0 };
    states.set(host, s);
  }
  return s;
}
export function agentAlignmentBusy(host: ControlHost) {
  return ['queued', 'running'].includes(state(host).job?.state ?? '') || ui.busy;
}
export function alignmentStatus(host: ControlHost) {
  const s = state(host);
  return {
    job: s.job ?? null,
    busy: agentAlignmentBusy(host),
    backend: registrationBackend(),
    progress: {
      message: ui.status,
      completed: ui.alignDone,
      entries: JSON.parse(JSON.stringify(ui.alignEntries)),
    },
    unattached_groups: JSON.parse(JSON.stringify(ui.unattachedGroups)),
    can_undo: !!s.undo?.size && [...s.undo.keys()].every(file => host.spatialFiles.includes(file)),
    transforms: host.spatialFiles.map((file, i) => ({
      object_index: i,
      name: file.fileName,
      matrix: host.transformationMatrices[i]?.toArray() ?? null,
    })),
    matrix_layout: 'column-major',
    units: 'scene units',
  };
}
export function startAgentAlignment(host: ControlHost, a: Record<string, any>) {
  const s = state(host);
  if (a.action === 'status') {
    return alignmentStatus(host);
  }
  if (agentAlignmentBusy(host)) {
    throw new Error('Alignment is running; use action=status before starting another operation');
  }
  if (a.action === 'undo') {
    if (!s.undo?.size) {
      throw new Error('No agent alignment to undo');
    }
    if ([...s.undo.keys()].some(file => !host.spatialFiles.includes(file))) {
      throw new Error('Geometry changed; the previous alignment cannot be undone');
    }
    endSession(host);
    s.undo.forEach((matrix, file) => {
      const i = host.spatialFiles.indexOf(file);
      host.setTransformationMatrix(i, matrix);
      host.updateMatrixTextarea(i);
    });
    s.undo = undefined;
    ui.canUndoAll = false;
    ui.alignEntries = [];
    ui.alignedIndices = [];
    ui.alignmentAnchorIndex = null;
    s.job = {
      id: ++s.serial,
      action: 'undo',
      state: 'completed',
      message: 'Restored transforms from before the last agent alignment',
    };
    host.requestRender();
    return alignmentStatus(host);
  }
  const target = a.target_index;
  const check = (i: number) => {
    if (!Number.isInteger(i) || !host.spatialFiles[i] || !worldPoints(host, i)) {
      throw new Error('Choose an object_index with point data from inspect_3d_scene');
    }
  };
  check(target);
  const all = ['align_all', 'refine_all'].includes(a.action);
  if (!all) {
    check(a.source_index);
    if (a.source_index === target) {
      throw new Error('Moving and fixed clouds must differ');
    }
  }
  if (all && host.spatialFiles.length < 2) {
    throw new Error('Load at least two point clouds');
  }
  if (host.spatialFiles.some(file => file.metadata?.agentSelection)) {
    throw new Error(
      'Clear the temporary region selection before alignment; load subsets as independent files to align them'
    );
  }
  const before = new Map(
    host.spatialFiles.map((file, i) => [file, host.transformationMatrices[i].clone()])
  );
  const job: Job = {
    id: ++s.serial,
    action: a.action,
    state: 'queued',
    message: 'Queued; poll action=status for the result',
    revision: Number(document.documentElement.dataset.sessionRevision),
    settings: {
      source_index: a.source_index ?? null,
      target_index: target,
      strategy: a.strategy,
      up_axis: a.up_axis,
      against_all_others: a.against_all_others === true,
    },
  };
  s.job = job;
  // Reply before starting work. Solvers may fall back to in-page WASM in a sandbox.
  window.setTimeout(() => {
    void run();
  }, 100);
  async function run() {
    job.state = 'running';
    job.message = 'Alignment running';
    const camera = host.camera.clone(),
      targetPoint = host.controls.target.clone();
    const previousUp = ui.upAxis,
      previousOthers = ui.matchAgainstAllOthers;
    try {
      ui.upAxis = a.up_axis ?? 'y';
      ui.matchAgainstAllOthers = a.against_all_others === true;
      ui.result = '';
      ui.alignEntries = [];
      ui.alignDone = 0;
      ui.unattachedGroups = [];
      endSession(host);
      if (all) {
        await alignAllTo(host, target, {
          refineOnly: a.action === 'refine_all',
          nested: a.strategy === 'nested',
          complex: a.strategy === 'complex',
        });
      } else if (a.action === 'correspondences') {
        const fit = await fitCorrespondences(
          new Float32Array(a.source_points.flat()),
          new Float32Array(a.target_points.flat())
        );
        if (!fit) {
          throw new Error(
            'Correspondences are degenerate; provide at least three non-collinear pairs'
          );
        }
        host.setTransformationMatrix(
          a.source_index,
          fit.matrix.clone().multiply(before.get(host.spatialFiles[a.source_index])!)
        );
        host.updateMatrixTextarea(a.source_index);
        job.metrics = {
          rmse: fit.rmse,
          max_error: fit.maxError,
          pair_count: a.source_points.length,
        };
        ui.result = 'Correspondence fit applied';
      } else {
        beginSession(host, a.source_index, target);
        await (a.action === 'icp' ? refineIcp(host) : autoAlign(host));
      }
      const changed = new Map(
        [...before].filter(([file, matrix]) => {
          const i = host.spatialFiles.indexOf(file);
          return i >= 0 && !host.transformationMatrices[i].equals(matrix);
        })
      );
      // The shared workflows report rejected/partial fits in result/entries.
      const accepted =
        a.action === 'correspondences' ||
        (all ? ui.alignEntries.some(entry => entry.state === 'aligned') : ui.canUndo);
      if (!accepted) {
        throw new Error(ui.result || 'No alignment was accepted; transforms unchanged');
      }
      s.undo = changed.size ? changed : undefined;
      job.state = 'completed';
      job.message = ui.result;
    } catch (error) {
      job.state = 'failed';
      job.message = error instanceof Error ? error.message : String(error);
    } finally {
      ui.upAxis = previousUp;
      ui.matchAgainstAllOthers = previousOthers;
      host.camera.copy(camera);
      host.controls.target.copy(targetPoint);
      host.controls.update();
      host.camera.updateProjectionMatrix();
      host.requestRender();
    }
  }
  return alignmentStatus(host);
}

/** Drop undo references before a session revision replaces its geometry. */
export function resetAgentAlignment(host: ControlHost) {
  if (agentAlignmentBusy(host)) {
    throw new Error('Cannot replace geometry during alignment');
  }
  state(host).undo = undefined;
  endSession(host);
  ui.canUndoAll = false;
  ui.alignEntries = [];
  ui.alignedIndices = [];
  ui.alignmentAnchorIndex = null;
  ui.unattachedGroups = [];
}
