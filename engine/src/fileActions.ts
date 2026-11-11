import type { FileEntry } from './state/fileEntries';
import type { FileListHost } from './components/fileListTypes';
import type { SubsampleOptions } from './utils/subsample';

/**
 * Actions that apply to the files selected in the file list (action bar and
 * right-click menu). An action runs on the selected entries it `appliesTo`;
 * one with a `form` first asks for parameters in the action bar.
 */
export interface FileAction {
  id: string;
  label: string;
  title: string;
  /** Parameters to ask for before running ('subsample' is the only form so far). */
  form?: 'subsample';
  danger?: boolean;
  appliesTo(entry: FileEntry, host: FileListHost): boolean;
  run(host: FileListHost, entries: FileEntry[], params?: unknown): void;
}

const isPointCloud = (entry: FileEntry) => {
  const data = entry.spatial?.data;
  return (
    !!data &&
    data.faceCount === 0 &&
    !data.indicesArray?.length &&
    !data.sceneModel &&
    !data.isGaussianSplat &&
    data.vertexCount > 1
  );
};

function setVisible(host: FileListHost, entries: FileEntry[], visible: boolean): void {
  for (const entry of entries) {
    if (host.solo.layered) {
      // Solo/grouping decide what is shown; change the file's own setting.
      host.solo.setBaseVisible(entry, visible);
    } else {
      const index = host.fileEntries.indexOf(entry.id);
      if (index >= 0) {
        host.setFileEntryVisibility(index, visible);
      }
    }
  }
  host.requestRender();
}

export const fileActions: FileAction[] = [
  {
    id: 'subsample',
    label: 'Subsample…',
    title:
      'Keep a random subset of the points (frees memory; reopen the file to get all points back)',
    form: 'subsample',
    appliesTo: entry => isPointCloud(entry),
    run: (host, entries, params) =>
      host.subsampleEntries(
        entries.map(e => e.id),
        params as SubsampleOptions
      ),
  },
  {
    id: 'show',
    label: 'Show',
    title: 'Make visible',
    appliesTo: () => true,
    run: (host, entries) => setVisible(host, entries, true),
  },
  {
    id: 'hide',
    label: 'Hide',
    title: 'Hide',
    appliesTo: () => true,
    run: (host, entries) => setVisible(host, entries, false),
  },
  {
    id: 'remove',
    label: 'Remove',
    title: 'Remove from the scene',
    danger: true,
    appliesTo: () => true,
    run: (host, entries) => {
      // Highest index first, so earlier removals do not shift later ones.
      const indices = entries
        .map(entry => host.fileEntries.indexOf(entry.id))
        .filter(index => index >= 0)
        .sort((a, b) => b - a);
      for (const index of indices) {
        host.requestRemoveFile(index);
      }
    },
  },
];
