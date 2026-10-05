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

export function registerCameraEntry(
  host: EntryStateHost,
  object: import('three').Group,
  name: string,
  parentId: number | null = null
): number {
  const entry = host.fileEntries.prepare('camera', parentId);
  entry.camera = { object, name, showLabels: false, showCoords: false };
  return host.fileEntries.commit(entry);
}
