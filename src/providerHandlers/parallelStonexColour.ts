import type {
  StonexColourScanJob,
  StonexColourScanResult,
  StonexColourScans,
} from '../../engine/src/parsers/stonexWasm';
import type { StonexColourJob } from './parseWorker';
import { defaultParallelism, runParseJobs } from './parsePool';

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
          job.pixels.buffer as ArrayBuffer,
          ...job.scans.flatMap(scan => [
            scan.positions.buffer as ArrayBuffer,
            scan.azimuths.buffer as ArrayBuffer,
            scan.counts.buffer as ArrayBuffer,
            scan.activeFrames.buffer as ArrayBuffer,
          ]),
        ],
      };
    }),
    defaultParallelism()
  );
};
