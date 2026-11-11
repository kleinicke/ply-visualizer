import type { FileEntryRegistry } from './state/fileEntries';
import {
  replaceSpatialGeometry,
  type GeometryReplacementHost,
} from './visualization/replaceSpatialGeometry';
import { subsampleSpatialData, type SubsampleOptions } from './utils/subsample';

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
 */
export function subsampleLoadedEntries(
  host: SubsampleLoadedHost,
  ids: readonly number[],
  options: SubsampleOptions
): SubsampleLoadedSummary {
  const summary: SubsampleLoadedSummary = { changed: 0, skipped: [], before: 0, after: 0 };
  for (const id of ids) {
    const entry = host.fileEntries.get(id);
    const current = entry?.spatial?.data;
    if (!entry || !current) {
      continue;
    }
    // Work on a shallow copy: the displayed object keeps its own data until
    // the replacement is built.
    const data = {
      ...current,
      scalarFields: current.scalarFields ? { ...current.scalarFields } : undefined,
      metadata: current.metadata ? { ...current.metadata } : undefined,
    };
    const result = subsampleSpatialData(data, options);
    const name = current.fileName ?? `#${id}`;
    if (!result.subsampled) {
      if (result.reason) {
        summary.skipped.push(`${name} (${result.reason})`);
      }
      continue;
    }
    // Chain with an earlier subsampling, so `of` stays the original count.
    const earlier = current.metadata?.subsampled as { of?: number } | undefined;
    if (earlier?.of) {
      data.metadata = { ...data.metadata, subsampled: { kept: result.kept, of: earlier.of } };
    }
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
