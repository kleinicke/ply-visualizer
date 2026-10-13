import type {
  StonexColourScanJob,
  StonexColourScanResult,
  StonexColourScans,
  StonexDecodeScanJob,
  StonexDecodeScanResult,
  StonexDecodeScans,
} from '../../engine/src/parsers/stonexWasm';
import type {
  StationColoringResult,
  StonexStationColouring,
} from '../../engine/src/parsers/stonexStationColoring';
import type { StonexColourJob, StonexDecodeJob, StonexStationColourJob } from './parseWorker';
import { defaultParallelism, runParseJob, runParseJobs } from './parsePool';

/**
 * Colours an X3A archive's independent scan groups on the decoder pool.
 *
 * The photographic colour pass was two thirds of opening a large archive, run
 * scan after scan on the extension host's own thread: 4.4 s of OHP_FRONT's
 * 6.5 s parse, three scans of 14 million points each with ten frames apiece.
 * The groups share nothing, so they run at once; the output is identical
 * (StonexX3aParser groups scans that share a frame, so each frame is still
 * demosaiced once). Its wasm memory - every frame's pixels and demosaic - also
 * leaves with the workers instead of staying in the extension host's instance.
 *
 * Returns null when the pool cannot help; the parser then colours in-process.
 */
export const colourStonexScansInParallel: StonexColourScans = async (
  jobs: StonexColourScanJob[]
): Promise<StonexColourScanResult[] | null> => {
  if (jobs.length < 2 || defaultParallelism() < 2) {
    return null;
  }
  return runParseJobs<StonexColourScanResult>(
    jobs.map(job => {
      const message: StonexColourJob = { kind: 'stonexColour', ...job };
      return {
        message,
        transfer: [
          // A gathered copy moves; an archive in shared memory is gathered there.
          ...(job.pixels instanceof Uint8Array ? [job.pixels.buffer] : []),
          ...job.scans.flatMap(scan => [
            scan.positions.buffer,
            scan.azimuths.buffer,
            scan.counts.buffer,
            scan.activeFrames.buffer,
          ]),
          // Shared memory is shared, not transferred (and cannot be listed).
        ].filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer),
      };
    }),
    defaultParallelism()
  );
};

/**
 * Decodes an X3A archive's scan records on the decoder pool. The archive must
 * be in shared memory (readFileShared), so each job posts only a view of its
 * record. Point decode was a single-threaded quarter of a recolour's re-parse
 * (~1 s on OHP_FRONT); the output is the same call's.
 */
export const decodeStonexScansInParallel: StonexDecodeScans = async (
  jobs: StonexDecodeScanJob[],
  onDecoded?: (index: number, result: StonexDecodeScanResult) => void
): Promise<StonexDecodeScanResult[] | null> => {
  if (jobs.length < 2 || defaultParallelism() < 2) {
    return null;
  }
  return runParseJobs<StonexDecodeScanResult>(
    jobs.map(job => {
      const message: StonexDecodeJob = { kind: 'stonexDecode', ...job };
      return { message };
    }),
    defaultParallelism(),
    onDecoded
  );
};

const isShared = (array: ArrayBufferView) =>
  typeof SharedArrayBuffer !== 'undefined' && array.buffer instanceof SharedArrayBuffer;

/**
 * Colours an X3A archive from every station on a decoder thread. The session
 * copies the archive's points, colours and photographs into wasm - 1.3 GB
 * for OHP_FRONT - and wasm memory never shrinks, so in the extension host's
 * own instance that stayed resident until it restarted; a pool worker gives
 * it back when it is released. The arrays must be in shared memory: the
 * worker writes each scan's result into them and reports it, and the host
 * publishes it from there.
 */
export const colourStationsOnPool: StonexStationColouring = async (job, onScanColored) => {
  if (![job.positions, job.rawColors, job.frameIndices, job.colored, job.changed].every(isShared)) {
    return null;
  }
  const message: StonexStationColourJob = { kind: 'stonexStation', ...job };
  return runParseJob<StationColoringResult>(message, [], index => onScanColored(index as number));
};
