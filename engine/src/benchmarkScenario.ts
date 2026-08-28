/**
 * Scripted runs of the operations a benchmark needs to time.
 *
 * Loading is easy to benchmark from outside — open a file, wait. Aligning and
 * recolouring are not: both are webview button presses, and a harness sitting
 * in the extension host has no way to press them. This module is the seam. The
 * extension forwards a `benchmarkScenario` message, one step per message, and
 * each step runs exactly the code path the button runs, so the timings the
 * benchmark reports are the timings the user gets.
 *
 * Nothing here measures anything itself. Every step is already instrumented and
 * emits its own PERF line (`registration/align-all`, `registration/refine-all`,
 * `x3a/recolour-all`), which is what the runner scrapes — a second measurement
 * taken out here could disagree with the one in the Output channel, and then
 * neither would be trustworthy.
 */
import { alignAllTo } from './registrationFeature';
import { firstArchiveScanIndex, runStationPipeline } from './stationPipelineTrigger';
import { perfLog } from './utils/perfLog';

export type BenchmarkStep = 'alignAll' | 'refineAll' | 'recolorAll' | 'registerAndRecolorAll';

/**
 * @param anchorIndex cloud every other one is aligned onto. Defaults to the
 *   first loaded cloud, which is what the align menu defaults to as well.
 */
export async function runBenchmarkScenario(
  host: any,
  step: BenchmarkStep,
  anchorIndex = 0
): Promise<void> {
  switch (step) {
    case 'alignAll':
      await alignAllTo(host, anchorIndex);
      return;
    case 'refineAll':
      await alignAllTo(host, anchorIndex, { refineOnly: true });
      return;
    case 'recolorAll':
    case 'registerAndRecolorAll': {
      const archiveIndex = firstArchiveScanIndex(host);
      if (archiveIndex === null) {
        // The runner waits for a PERF line; say so there rather than letting it
        // sit until the timeout and report a phantom "no measurement".
        perfLog(`⏱️ PERF[benchmark/skipped] ${step}: no archive scan is loaded`);
        return;
      }
      runStationPipeline(host, archiveIndex, step === 'registerAndRecolorAll');
      return;
    }
    default:
      perfLog(`⏱️ PERF[benchmark/skipped] unknown step "${step}"`);
  }
}
