import { perfLog } from './perfLog';

/**
 * One end-to-end PERF line per container file (E57, X3A).
 *
 * These formats fan out into many scans, each transferred and displayed on its
 * own — large ones through the chunked path. Every scan already logs its own
 * line, but nothing reported the whole file: the extension's `/ext` line stops
 * at read+parse, and the webview only ever saw individual scans. This closes
 * that gap by counting scan completions and emitting a total when the last one
 * lands.
 *
 * The total is measured against the extension's wall-clock epoch (Date.now,
 * shared by both processes), matching how PerfTimer anchors its own totals.
 */

export interface ContainerInfo {
  id: string;
  kind: string;
  name: string;
  scanCount: number;
  startedAt: number;
}

interface ContainerProgress {
  info: ContainerInfo;
  completed: number;
  vertices: number;
}

const inFlight = new Map<string, ContainerProgress>();

function isContainerInfo(value: unknown): value is ContainerInfo {
  const info = value as ContainerInfo | undefined;
  return (
    !!info &&
    typeof info.id === 'string' &&
    typeof info.scanCount === 'number' &&
    info.scanCount > 0 &&
    typeof info.startedAt === 'number' &&
    info.startedAt > 0
  );
}

/**
 * Record that one scan of a container finished displaying. Emits the summary
 * once every scan has reported. Safe to call with undefined — non-container
 * formats pass nothing and are ignored.
 */
export function noteContainerScanLoaded(container: unknown, vertexCount?: number): void {
  if (!isContainerInfo(container)) {
    return;
  }

  let progress = inFlight.get(container.id);
  if (!progress) {
    progress = { info: container, completed: 0, vertices: 0 };
    inFlight.set(container.id, progress);
  }
  progress.completed++;
  progress.vertices += typeof vertexCount === 'number' ? vertexCount : 0;

  if (progress.completed < container.scanCount) {
    return;
  }

  // A scan that errors out never reports, so its container stays parked here
  // rather than logging a total that would be wrong anyway.
  inFlight.delete(container.id);

  const totalMs = Math.max(0, Date.now() - container.startedAt);
  const scans = `${container.scanCount} scan${container.scanCount === 1 ? '' : 's'}`;
  perfLog(
    `⏱️ PERF[${container.kind}/all ${container.name}] total ${totalMs.toFixed(1)}ms` +
      `  (${scans} · ${progress.vertices.toLocaleString()} pts)`
  );
}

/** Test hook: drop any partially-completed containers. */
export function resetContainerPerf(): void {
  inFlight.clear();
}
