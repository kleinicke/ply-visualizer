/**
 * Firing the archive-wide colouring pipeline.
 *
 * The pipeline itself runs in the extension host (it re-reads the archive for
 * full-resolution photographs, which the webview never holds). Everything here
 * is the trigger: deciding whether the control may be shown at all, working out
 * the scope, and packing the transforms currently on screen into the request.
 *
 * It lives outside the components because two places now fire it — the per-file
 * RegistrationPanel and the global align menu — and a second copy of the scope
 * rules is exactly how the two would drift apart.
 */
import { filesState } from './state/files.svelte';
import { registrationState, stationPipelineUi } from './state/registration.svelte';
import { beginStationRecolor } from './stationPipelineFeature';

/** Archive this cloud came out of, or undefined for an ordinary file. */
export function archiveNameOf(host: any, fileIndex: number): string | undefined {
  return host?.spatialFiles?.[fileIndex]?.metadata?.containerFileName as string | undefined;
}

/**
 * First loaded scan that belongs to an archive.
 *
 * The global menu has no file of its own to key off, and every scan of one
 * archive answers the pipeline question identically, so the first one stands
 * for all of them.
 */
export function firstArchiveScanIndex(host: any): number | null {
  const count = host?.spatialFiles?.length ?? 0;
  for (let index = 0; index < count; index++) {
    const metadata = host.spatialFiles[index]?.metadata;
    if (metadata?.containerFileName && metadata?.embeddedScanName) {
      return index;
    }
  }
  return null;
}

/**
 * Whether the colouring controls may be offered for this cloud.
 *
 * Two conditions, both hard: the cloud must carry archive metadata (the
 * photographs and the camera profile live in that container), and the viewer
 * must be the extension, because only that process still holds the file. The
 * standalone page never sees these controls.
 */
export function canRunStationPipeline(host: any, fileIndex: number | null): boolean {
  if (fileIndex === null) {
    return false;
  }
  return !!archiveNameOf(host, fileIndex) && host?.runningInVSCode === true && !!host?.vscode;
}

/**
 * The placement the viewer currently has for every scan of this archive, keyed
 * by scan stem.
 *
 * Colouring needs the scans in one frame, but it does not care how they got
 * there — "align all", a hand-built matrix, or an archive that was already
 * consistent all work. Sending what is on screen means the pipeline never
 * throws away alignment the user has already done or corrected.
 */
function currentTransforms(
  host: any,
  archiveName: string,
  anchorIndex: number,
  scope: ReadonlySet<string>
): Record<string, number[]> {
  const transforms: Record<string, number[]> = {};
  const alignedOnly =
    registrationState.alignmentAnchorIndex === anchorIndex &&
    registrationState.alignedIndices.length > 0
      ? new Set(registrationState.alignedIndices)
      : null;
  for (let index = 0; index < (host.spatialFiles?.length ?? 0); index++) {
    const metadata = host.spatialFiles[index]?.metadata;
    if (metadata?.containerFileName !== archiveName || !metadata?.embeddedScanName) {
      continue;
    }
    if (alignedOnly && !alignedOnly.has(index)) {
      continue;
    }
    const stem = String(metadata.embeddedScanName).replace(/\.x3r$/i, '');
    if (!scope.has(stem)) {
      continue;
    }
    transforms[stem] = Array.from(host.transformationMatrices[index].elements);
  }
  return transforms;
}

/** Checked capture places are also the archive-processing scope. */
function visibleArchiveStems(host: any, archiveName: string, fallbackIndex: number): string[] {
  const stems: string[] = [];
  for (let index = 0; index < (host.spatialFiles?.length ?? 0); index++) {
    const metadata = host.spatialFiles[index]?.metadata;
    if (
      metadata?.containerFileName !== archiveName ||
      !metadata?.embeddedScanName ||
      filesState.visibility[index] === false
    ) {
      continue;
    }
    stems.push(String(metadata.embeddedScanName).replace(/\.x3r$/i, ''));
  }
  // Never allow a stale visibility signal to produce an empty, expensive
  // no-op request.
  if (stems.length === 0) {
    const own = host.spatialFiles?.[fallbackIndex]?.metadata?.embeddedScanName;
    if (own) {
      stems.push(String(own).replace(/\.x3r$/i, ''));
    }
  }
  return stems;
}

/**
 * Ask the host to colour the archive's scans from its photographs.
 *
 * @param register when true the host re-derives the alignment itself and
 *   discards what is on screen; when false the current transforms are sent.
 */
export function runStationPipeline(host: any, fileIndex: number, register: boolean): void {
  const archiveName = archiveNameOf(host, fileIndex);
  if (!archiveName || !host.vscode) {
    return;
  }
  const scopeScanStems = visibleArchiveStems(host, archiveName, fileIndex);
  const scope = new Set(scopeScanStems);
  const diagnostic = stationPipelineUi.projectionDiagnostic;
  const diagnosticRun = diagnostic !== 'normal';
  const recolorExisting = stationPipelineUi.recolorAlreadyColored || diagnosticRun;
  stationPipelineUi.busy = true;
  stationPipelineUi.message = register
    ? 'Registering every scan, then colouring...'
    : diagnosticRun
      ? `Testing projection variant: ${diagnostic}...`
      : 'Colouring with the current alignment...';
  // Blank the archive and switch to the camera view first, so the scans
  // visibly fill in as the host reports each one instead of the view sitting
  // unchanged for a minute and then flipping.
  beginStationRecolor(host, archiveName, !recolorExisting, scopeScanStems);
  host.vscode.postMessage({
    type: 'stationPipeline',
    options: {
      register,
      transforms: register ? undefined : currentTransforms(host, archiveName, fileIndex, scope),
      colorUncolored: true,
      recolorAlreadyColored: recolorExisting,
      projectionDiagnostic: diagnostic,
      scopeScanStems,
      upAxis: registrationState.upAxis,
    },
  });
}
