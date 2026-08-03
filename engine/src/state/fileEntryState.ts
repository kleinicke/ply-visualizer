import * as THREE from 'three';
import { filesState } from './files.svelte.js';
import { FileEntryRegistry } from './fileEntries';

/**
 * Per-entry state keyed by the unified index that FileEntryRegistry hands out.
 *
 * Four loaders (cameraProfile.ts, pose.ts, visualization/stonexCameras.ts and
 * visualization/e57Cameras.ts) each grew their own copy of "extend the arrays
 * until they reach my index, then assign", which only lands on the right slot
 * when nothing of a later kind is already loaded. Inserting at the entry's own
 * index instead keeps every array aligned with the registry whatever the load
 * order, and keeps the Svelte mirror in files.svelte.js aligned with it.
 */

export interface EntryStateHost {
  fileVisibility: boolean[];
  pointSizes: number[];
  individualColorModes: string[];
  transformationMatrices: THREE.Matrix4[];
}

export interface EntryStateDefaults {
  visible: boolean;
  pointSize: number;
  colorMode: string;
}

/**
 * Grows `array` so that `index` is a valid insertion point. The old
 * grow-then-assign code left holes when an index was skipped; filling them with
 * the default keeps `??` fallbacks at read sites from seeing `undefined`.
 */
function padTo<T>(array: T[], index: number, fill: T): void {
  while (array.length < index) {
    array.push(fill);
  }
}

export function insertEntryState(
  host: EntryStateHost,
  index: number,
  defaults: EntryStateDefaults
): void {
  padTo(host.fileVisibility, index, false);
  padTo(host.pointSizes, index, defaults.pointSize);
  padTo(host.individualColorModes, index, defaults.colorMode);
  padTo(host.transformationMatrices, index, new THREE.Matrix4());
  padTo(filesState.visibility, index, false);
  padTo(filesState.pointSizes, index, defaults.pointSize);
  padTo(filesState.colorModes, index, defaults.colorMode);
  padTo(filesState.collapsed, index, false);

  host.fileVisibility.splice(index, 0, defaults.visible);
  host.pointSizes.splice(index, 0, defaults.pointSize);
  host.individualColorModes.splice(index, 0, defaults.colorMode);
  host.transformationMatrices.splice(index, 0, new THREE.Matrix4());
  filesState.visibility.splice(index, 0, defaults.visible);
  filesState.pointSizes.splice(index, 0, defaults.pointSize);
  filesState.colorModes.splice(index, 0, defaults.colorMode);
  filesState.collapsed.splice(index, 0, false);
}

export interface CameraEntryHost extends EntryStateHost {
  fileEntries: FileEntryRegistry;
  cameraShowLabels: boolean[];
  cameraShowCoords: boolean[];
}

/**
 * Claims the file-list slot for a camera profile. Shared by the three sources
 * that publish one - JSON camera profiles, X3A archives and E57 images - which
 * previously each carried their own copy of this bookkeeping.
 *
 * Returns the unified index; the label/coordinate toggles are keyed by camera
 * index, matching cameraGroups and cameraNames.
 */
export function registerCameraEntry(host: CameraEntryHost): number {
  const { index } = host.fileEntries.add('camera');
  insertEntryState(host, index, { visible: true, pointSize: 1, colorMode: 'assigned' });
  const cameraIndex = host.fileEntries.kindIndexAt(index);
  host.cameraShowLabels.splice(cameraIndex, 0, false);
  host.cameraShowCoords.splice(cameraIndex, 0, false);
  return index;
}

export function removeEntryState(host: EntryStateHost, index: number): void {
  host.fileVisibility.splice(index, 1);
  host.pointSizes.splice(index, 1);
  host.individualColorModes.splice(index, 1);
  host.transformationMatrices.splice(index, 1);
  filesState.visibility.splice(index, 1);
  filesState.pointSizes.splice(index, 1);
  filesState.colorModes.splice(index, 1);
  filesState.collapsed.splice(index, 1);
}
