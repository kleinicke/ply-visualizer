/**
 * Runs the X3A station pipeline for an already-open archive.
 *
 * It re-reads and re-parses the file rather than working from what the webview
 * holds, because registration and colouring need the full-resolution X3I frames
 * and those only exist during a parse — the webview keeps a 1/8-scale preview,
 * whose pixels span roughly thirteen points vertically.
 *
 * Only the result travels back: a 4x4 per scan, plus colours for the scans that
 * actually changed. In the default "fill in the grey ones" mode that is the
 * small preview sweeps, a couple of megabytes, rather than the tens of
 * megabytes re-sending every cloud would cost.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import {
  StonexX3aParser,
  type StonexStationPipelineOptions,
  type StonexStationPipelineTiming,
} from '../../engine/src/parsers/stonexX3aParser';
import { stonexCameraProjector } from '../wasmCameraModels';
import { readFileFast } from './binaryTransfer';

export interface StationPipelineHost {
  logPerf(line: string): void;
}

export async function handleStationPipeline(
  host: StationPipelineHost,
  webviewPanel: vscode.WebviewPanel,
  documentPath: string | undefined,
  options: StonexStationPipelineOptions
): Promise<void> {
  if (!documentPath || !/\.x3a$/i.test(documentPath)) {
    webviewPanel.webview.postMessage({
      type: 'stationPipelineResult',
      error: 'The station pipeline only applies to an open .x3a archive.',
    });
    return;
  }

  // The pipeline takes minutes on a large archive, so every step it announces
  // goes to the panel. Without this the button just says "Working..." and there
  // is no way to tell slow from stuck.
  const notify = (message: string) =>
    void webviewPanel.webview.postMessage({
      type: 'stationPipelineProgress',
      message: message.replace(/^Stonex X3A: /, ''),
    });

  try {
    const startedAt = performance.now();
    const progressivelyPublishedScans = new Set<string>();
    const bytes = await readFileFast(vscode.Uri.file(documentPath));
    const readMs = performance.now() - startedAt;
    const parser = new StonexX3aParser(stonexCameraProjector);
    const parseStarted = performance.now();
    const parsed = await parser.parseAll(bytes, path.basename(documentPath), notify, {
      ...options,
      onScanColored: async update => {
        const scanName = `${update.scanStem}.x3r`;
        const delivered = await webviewPanel.webview.postMessage({
          type: 'stationPipelineResult',
          partial: true,
          updates: [
            {
              scanName,
              transform: null,
              partial: true,
              rawColors: update.rawColors,
              frameIndices: update.frameIndices,
            },
          ],
        });
        if (delivered) {
          progressivelyPublishedScans.add(scanName);
        }
      },
    });
    const parseAllMs = performance.now() - parseStarted;

    const prepareStarted = performance.now();
    const updates = parsed.map(scan => {
      const metadata = scan.metadata as Record<string, unknown>;
      const changed = metadata.stationColorChanged === true;
      const scanName = metadata.embeddedScanName as string;
      const needsFinalColorDelivery = changed && !progressivelyPublishedScans.has(scanName);
      return {
        scanName,
        transform: (metadata.stationTransform as number[] | null) ?? null,
        // Do not transfer a full colour buffer twice after a progressive update
        // has already reached the webview. Keep the final result as a fallback
        // if VS Code rejected that earlier message.
        rawColors: needsFinalColorDelivery ? (metadata.stonexRawColors as Uint8Array | null) : null,
        frameIndices: needsFinalColorDelivery
          ? (metadata.stonexFrameIndices as Uint16Array | null)
          : null,
        photographicallyColoredPoints: metadata.photographicallyColoredPoints as number | undefined,
      };
    });
    const prepareMs = performance.now() - prepareStarted;

    const metadata = parsed[0]?.metadata as Record<string, any> | undefined;
    const coloring = metadata?.stationColoringResult;
    const timing = metadata?.stationPipelineTiming as StonexStationPipelineTiming | undefined;
    const publishStarted = performance.now();
    await webviewPanel.webview.postMessage({
      type: 'stationPipelineResult',
      updates,
      summary: coloring
        ? `Coloured ${Number(coloring.newlyColored).toLocaleString()} previously grey points`
        : `Registered ${updates.filter(update => update.transform).length} scans`,
    });
    const publishMs = performance.now() - publishStarted;
    const totalMs = performance.now() - startedAt;
    const pipelineMs = timing?.totalMs ?? 0;
    const reloadMs = Math.max(0, parseAllMs - pipelineMs);
    const colourPartsMs = timing
      ? timing.frameGatherMs + timing.coloringMs + timing.whiteBalanceMs + timing.summarizeMs
      : 0;
    const pipelineOverheadMs = Math.max(0, pipelineMs - (timing?.matchingMs ?? 0) - colourPartsMs);
    const hostOverheadMs = Math.max(
      0,
      totalMs - readMs - reloadMs - pipelineMs - prepareMs - publishMs
    );
    const operation = options.register ? 'auto-match+recolour-all' : 'recolour-all';
    host.logPerf(
      `⏱️ PERF[x3a/${operation} ${path.basename(documentPath)}] ` +
        `read ${readMs.toFixed(1)}ms · reload ${reloadMs.toFixed(1)}ms · ` +
        `match ${(timing?.matchingMs ?? 0).toFixed(1)}ms · ` +
        `colour ${colourPartsMs.toFixed(1)}ms ` +
        `(frames ${(timing?.frameGatherMs ?? 0).toFixed(1)} + ` +
        `project ${(timing?.coloringMs ?? 0).toFixed(1)} + ` +
        `white balance ${(timing?.whiteBalanceMs ?? 0).toFixed(1)} + ` +
        `summarize ${(timing?.summarizeMs ?? 0).toFixed(1)}) · ` +
        `pipeline overhead ${pipelineOverheadMs.toFixed(1)}ms · ` +
        `prepare result ${prepareMs.toFixed(1)}ms · publish ${publishMs.toFixed(1)}ms · ` +
        `host overhead ${hostOverheadMs.toFixed(1)}ms | total ${totalMs.toFixed(1)}ms  ` +
        `(${parsed.length} scans)`
    );
  } catch (error) {
    webviewPanel.webview.postMessage({
      type: 'stationPipelineResult',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
