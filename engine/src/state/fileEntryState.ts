import type { FileEntryRegistry } from './fileEntries';

export interface EntryStateHost {
  fileEntries: FileEntryRegistry;
}
export interface EntryStateDefaults {
  visible: boolean;
  pointSize: number;
  colorMode: string;
}

export function insertEntryState(
  host: EntryStateHost,
  index: number,
  defaults: EntryStateDefaults
): void {
  Object.assign(host.fileEntries.require(index).state, defaults);
}

export interface CameraEntryHost extends EntryStateHost {
  cameraShowLabels: boolean[];
  cameraShowCoords: boolean[];
}

export function registerCameraEntry(host: CameraEntryHost, parentId: number | null = null): number {
  const { index } = host.fileEntries.add('camera', parentId);
  insertEntryState(host, index, { visible: true, pointSize: 1, colorMode: 'assigned' });
  const cameraIndex = host.fileEntries.kindIndexAt(index);
  host.cameraShowLabels.splice(cameraIndex, 0, false);
  host.cameraShowCoords.splice(cameraIndex, 0, false);
  return index;
}
