import type { FileEntryRegistry } from './state/fileEntries';
import {
  replaceSpatialGeometry,
  type GeometryReplacementHost,
} from './visualization/replaceSpatialGeometry';
import { cannotSubsample, subsampleSpatialData, type SubsampleOptions } from './utils/subsample';
import { fileBusy } from './state/fileSelection.svelte';
import { runWithFileActivity } from './fileActivity';

export interface SubsampleLoadedHost extends GeometryReplacementHost {
  fileEntries: FileEntryRegistry;
  updateFileList(): void;
  updateFileStats(): void;
  requestRender(): void;
  showStatus(message: string): void;
  showError(message: string): void;
}

export interface SubsampleLoadedSummary {
  changed: number;
  skipped: string[];
  before: number;
  after: number;
}

/**
 * Thins already-loaded point clouds to a random subset of their points and
 * rebuilds their geometry. The dropped points are gone until the file is
 * opened again; the full-size arrays are released.
 *
 * The work runs in slices, so the page stays responsive; the clouds being
 * worked on are marked busy (their cards locked, with progress) until done.
 */
export async function subsampleLoadedEntries(
  host: SubsampleLoadedHost,
  ids: readonly number[],
  options: SubsampleOptions
): Promise<SubsampleLoadedSummary> {
  const summary: SubsampleLoadedSummary = { changed: 0, skipped: [], before: 0, after: 0 };
  const queue = ids.filter(id => !(id in fileBusy.byId) && host.fileEntries.get(id)?.spatial);
  for (const id of queue) {
    fileBusy.byId[id] = 0;
  }
  try {
    await runWithFileActivity(async () => {
      for (const id of queue) {
        await subsampleOne(host, id, options, summary);
        delete fileBusy.byId[id];
      }
    });
  } finally {
    for (const id of queue) {
      delete fileBusy.byId[id];
    }
  }
  if (summary.changed) {
    host.updateFileList();
    host.updateFileStats();
    host.requestRender();
  }
  const parts = [];
  if (summary.changed) {
    parts.push(
      `Subsampled ${summary.changed} cloud${summary.changed === 1 ? '' : 's'}: ` +
        `${summary.before.toLocaleString()} → ${summary.after.toLocaleString()} points`
    );
  } else {
    parts.push('Nothing to subsample');
  }
  if (summary.skipped.length) {
    parts.push(`skipped ${summary.skipped.join(', ')}`);
  }
  host.showStatus(parts.join('; '));
  return summary;
}

async function subsampleOne(
  host: SubsampleLoadedHost,
  id: number,
  options: SubsampleOptions,
  summary: SubsampleLoadedSummary
): Promise<void> {
  const entry = host.fileEntries.get(id);
  const current = entry?.spatial?.data;
  if (!entry || !current) {
    return;
  }
  const name = current.fileName ?? `#${id}`;
  const reason = cannotSubsample(current);
  if (reason) {
    summary.skipped.push(`${name} (${reason})`);
    return;
  }
  // Work on a shallow copy: the displayed object keeps its own data until
  // the replacement is built.
  const data = {
    ...current,
    scalarFields: current.scalarFields ? { ...current.scalarFields } : undefined,
    metadata: current.metadata ? { ...current.metadata } : undefined,
  };
  const result = await subsampleSpatialData(data, options, fraction => {
    fileBusy.byId[id] = fraction * 0.9;
  });
  if (!result.subsampled) {
    return;
  }
  // The entry may have been removed meanwhile.
  if (host.fileEntries.get(id) !== entry || entry.spatial?.data !== current) {
    return;
  }
  // Chain with an earlier subsampling, so `of` stays the original count.
  const earlier = current.metadata?.subsampled as { of?: number } | undefined;
  if (earlier?.of) {
    data.metadata = { ...data.metadata, subsampled: { kept: result.kept, of: earlier.of } };
  }
  fileBusy.byId[id] = 0.95;
  try {
    replaceSpatialGeometry(host, entry, data, host.fileEntries.indexOf(id));
    summary.changed++;
    summary.before += result.of;
    summary.after += result.kept;
  } catch (error) {
    host.showError(
      `Could not subsample ${name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
