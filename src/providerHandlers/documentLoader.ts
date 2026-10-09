import { sendToWebview } from './webviewTransport';
import { decodesInViewer } from '../../engine/src/fileHandler';
import { isSceneModel } from '../../engine/src/models/modelFormats';
import { sendSceneModel } from './sceneModels';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PlyParser } from '../../engine/src/parsers/plyParser';
import { StonexX3aParser } from '../../engine/src/parsers/stonexX3aParser';
import { stonexCameraProjector } from '../wasmCameraModels';
import { GltfParser } from '../../engine/src/parsers/gltfParser';
import { NpyParser } from '../../engine/src/parsers/npyParser';
import { NrrdParser } from '../../engine/src/parsers/nrrdParser';
import { buildInitialVolumeData, decorateVolumeData, retainVolume } from './volumeSessions';
import {
  parseXyzWasm,
  parseAsciiPlyWasm,
  streamParseFile,
  detectXyzColorMode,
} from '../wasmPointcloud';
import { toPointCloudPayload } from '../../engine/src/parsers/pointcloudWasm';
import { isPlyBinary } from '../../engine/src/fileHandler';
import { parallelParseTextFile, parallelStreamTextFile } from './parallelTextParse';
import { decodeInWorker, decodeLidar } from './parallelLidarParse';
import {
  readFileFast,
  readFileShared,
  readFileHead,
  pcdViewpointIsIdentity,
  sendSpatialDataToWebview,
  sendSplatContainerUri,
} from './binaryTransfer';

export interface DocumentLoaderHost {
  getShortPath(filePath: string): string;
  logPerf(line: string): void;
  getCurrentLoadStartedAt(): number;
  tryAutoLoadMtl(
    webviewPanel: vscode.WebviewPanel,
    objUri: vscode.Uri,
    parsedObjData: any,
    fileIndex: number
  ): Promise<void>;
  getSceneMetadata(fsPath: string): Promise<any>;
}

export interface DocumentFileTypeFlags {
  /** Set when the page was told to fetch this depth image itself. */
  depthPrefetchUri?: string;
  fileType: { extension?: string; category?: string; isDepthFile?: boolean } | null | undefined;
  isDepthFile: boolean;
  isPfmFile: boolean;
  isNpyFile: boolean;
  isPngFile: boolean;
  isExrFile: boolean;
  isNpyPointCloud: boolean;
  isObjFile: boolean;
  isStlFile: boolean;
  isPcdFile: boolean;
  isPtsFile: boolean;
  isStonexX3aFile: boolean;
  isGltfFile: boolean;
  isVolumeFile: boolean;
  isXyzVariant: boolean;
  isJsonFile: boolean;
  isLidarFile: boolean;
  isSplatContainerFile: boolean;
}

/**
 * Stamp every scan of a container file (E57, X3A) with shared identity so the
 * webview can report one honest end-to-end total for the whole file.
 *
 * Each scan is transferred and displayed independently — and large ones go down
 * the chunked path — so the extension cannot know when the container as a whole
 * is finished. It can only say "this scan is 1 of N, and the file started at T";
 * the webview counts the arrivals and closes the books on the last one.
 */
function tagContainer(scans: any[], kind: string, name: string, startedAt: number): void {
  const container = {
    id: `${startedAt}-${name}`,
    kind,
    name,
    scanCount: scans.length,
    startedAt,
  };
  for (const scan of scans) {
    scan.container = container;
  }
}

/**
 * Reads, parses (or streams), and posts a just-opened document's content to
 * the webview, dispatching by the already-detected file type. Runs inside the
 * `setImmediate` callback resolveCustomEditor schedules so the webview HTML
 * can paint before any file IO starts.
 */
interface StonexPhaseReport {
  totalMs: number;
  points: number;
  scans: number;
  frames: number;
  archiveBytes: number;
  phases: Array<{ name: string; ms: number }>;
  marshalMs?: number;
  projectMs?: number;
  sampleMs?: number;
  candidateTotal?: number;
  pixelsInFrame?: number;
  samplesTaken?: number;
}

/**
 * Prints the parse breakdown next to the existing PERF lines.
 *
 * Deliberately verbose while the colour path is being worked on. Timings alone
 * proved too easy to misread - a phase can be slow because it did more work
 * rather than because it is slow per unit of work - so the counts and the
 * derived rates travel with them, and one run can be compared against another
 * on a machine that is not perfectly quiet.
 */
/**
 * Break a parse down into its phases in the Output channel.
 *
 * Exported because the recolour pipeline re-parses the whole archive and that
 * re-parse was a black box: the pipeline line reported it as one `reload`
 * number computed by subtraction, which is the least informative shape a
 * measurement can have. Same report, different tag, so the two parses stay
 * distinguishable in the log.
 */
export function logStonexPhases(
  host: { logPerf(line: string): void },
  scan: { metadata?: Record<string, unknown> } | undefined,
  fileName: string,
  tag = 'x3a/phases'
): void {
  const report = scan?.metadata?.stonexParsePhases as StonexPhaseReport | undefined;
  if (!report) {
    return;
  }
  const seconds = (ms: number) => (ms / 1000).toFixed(2);
  const share = (ms: number) => `${((ms / report.totalMs) * 100).toFixed(0)}%`;
  host.logPerf(
    `⏱️ PERF[${tag}] ${fileName} · total ${seconds(report.totalMs)}s · ` +
      `${(report.points / 1e6).toFixed(1)}M pts · ${report.scans} scans · ${report.frames} frames · ` +
      `${(report.archiveBytes / 1e6).toFixed(0)} MB`
  );
  for (const phase of report.phases) {
    if (phase.ms >= 1) {
      host.logPerf(
        `⏱️ PERF[${tag.replace(/s$/, '')}]   ${phase.name}: ${seconds(phase.ms)}s (${share(phase.ms)})`
      );
    }
  }
  if (report.projectMs !== undefined) {
    const candidates = report.candidateTotal ?? 0;
    const perMillion = (ms: number) =>
      candidates > 0 ? `${((ms * 1e6) / candidates).toFixed(1)}ms/M` : 'n/a';
    host.logPerf(
      `⏱️ PERF[x3a/colour]   candidates ${(candidates / 1e6).toFixed(1)}M · ` +
        `in-frame ${((report.pixelsInFrame ?? 0) / 1e6).toFixed(1)}M · ` +
        `sampled ${((report.samplesTaken ?? 0) / 1e6).toFixed(1)}M`
    );
    host.logPerf(
      `⏱️ PERF[x3a/colour]   marshal ${seconds(report.marshalMs ?? 0)}s (${perMillion(report.marshalMs ?? 0)}) · ` +
        `rust-project ${seconds(report.projectMs)}s (${perMillion(report.projectMs)}) · ` +
        `js-sample ${seconds(report.sampleMs ?? 0)}s (${perMillion(report.sampleMs ?? 0)})`
    );
  }
}

function decorateStonexScans(
  host: DocumentLoaderHost,
  scans: any[],
  documentUri: vscode.Uri,
  archiveBytes: number
): void {
  for (const scan of scans) {
    scan.shortPath = host.getShortPath(documentUri.fsPath);
    scan.fileSizeInBytes = (scan.metadata.embeddedMemberSize as number | undefined) ?? archiveBytes;
  }
}

/** Sends colour separately after geometry is visible, bounded so Electron does
 * not silently drop a single hundreds-of-megabytes structured clone. */
async function sendStonexColors(
  webviewPanel: vscode.WebviewPanel,
  scans: any[],
  container: Record<string, unknown>
): Promise<void> {
  // Raw RGB + u16 frame id is 5 MB per million points. Staying comfortably
  // below Electron's unreliable huge-message range while avoiding hundreds of
  // tiny sequential colour messages on large archives.
  const pointsPerChunk = 1_000_000;
  for (const scan of scans) {
    const rawColors = scan.metadata.stonexRawColors as Uint8Array | null;
    const frameIndices = scan.metadata.stonexFrameIndices as Uint16Array | null;
    if (!rawColors) {
      continue;
    }
    for (let pointOffset = 0; pointOffset < scan.vertexCount; pointOffset += pointsPerChunk) {
      const pointEnd = Math.min(scan.vertexCount, pointOffset + pointsPerChunk);
      const final = pointEnd === scan.vertexCount;
      const delivered = await sendToWebview(webviewPanel, {
        type: 'stonexColorReady',
        updates: [
          {
            scanName: scan.metadata.embeddedScanName,
            pointOffset,
            totalPoints: scan.vertexCount,
            final,
            // Raw RGB is enough: the webview already owns the correction
            // kernel and derives its display array on the closing chunk. This
            // avoids shipping two three-byte colour arrays per point.
            colors: rawColors.slice(pointOffset * 3, pointEnd * 3),
            colorsAreRaw: true,
            frameIndices: frameIndices?.slice(pointOffset, pointEnd) ?? null,
            colorCalibration: final ? scan.metadata.stonexColorCalibration : undefined,
            photographicallyColoredPoints: final
              ? scan.metadata.photographicallyColoredPoints
              : undefined,
            cameraFrames: final ? scan.metadata.stonexCameraFrames : undefined,
            container: final ? container : undefined,
          },
        ],
      });
      if (!delivered) {
        throw new Error(`The webview rejected colour for ${scan.fileName}`);
      }
    }
  }
}

/**
 * Parse a large local text cloud on the decoder pool and send it to the
 * webview in parts as the slices finish (see engine/src/hosts/pointStream.ts),
 * so the copy into the webview overlaps the parse instead of following it.
 * The closing message is the usual `xyzVariantData` without its arrays.
 *
 * Returns false - having told the webview to drop any parts it received -
 * when the caller should use its sequential path instead.
 */
export async function sendStreamedTextCloud(
  host: Pick<DocumentLoaderHost, 'getShortPath' | 'logPerf' | 'getCurrentLoadStartedAt'>,
  webviewPanel: vscode.WebviewPanel,
  documentUri: vscode.Uri,
  format: string,
  colorMode: string,
  variant: string,
  tag: string,
  loadStartTime: number,
  /** Added beside what is loaded ("+ Add Point Cloud") instead of replacing it. */
  isAddFile = false
): Promise<boolean> {
  const streamId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let parts = 0;
  const summary = await parallelStreamTextFile(documentUri.fsPath, format, colorMode, part => {
    parts++;
    return sendToWebview(webviewPanel, { type: 'pointStreamPart', streamId, ...part });
  });
  if (!summary) {
    if (parts > 0) {
      void sendToWebview(webviewPanel, { type: 'pointStreamCancel', streamId });
    }
    return false;
  }
  host.logPerf(
    `⏱️ PERF[${tag}/ext] load ${(performance.now() - loadStartTime).toFixed(1)}ms (${summary.vertexCount} pts, wasm-parallel, ${parts} parts) for ${path.basename(documentUri.fsPath)}`
  );
  await sendToWebview(webviewPanel, {
    type: 'pointStreamEnd',
    streamId,
    message: {
      fileName: path.basename(documentUri.fsPath),
      shortPath: host.getShortPath(documentUri.fsPath),
      fileSizeInBytes: fs.statSync(documentUri.fsPath).size,
      data: summary,
      variant,
      isAddFile,
      parseMode: 'wasm-parallel',
      // This message type is not stamped by the transport; the PERF line
      // needs the load's own epochs.
      loadStartedAt: host.getCurrentLoadStartedAt(),
      postedAt: Date.now(),
    },
  });
  return true;
}

/** Read a depth image and post its bytes for conversion in the webview. */
export async function sendDepthImage(
  host: DocumentLoaderHost,
  documentUri: vscode.Uri,
  webviewPanel: vscode.WebviewPanel,
  loadStartTime = performance.now()
): Promise<void> {
  const depthData = await vscode.workspace.fs.readFile(documentUri);
  const fileReadTime = performance.now();
  sendToWebview(webviewPanel, {
    type: 'timing',
    phase: 'read',
    kind: 'depth',
    ms: +(fileReadTime - loadStartTime).toFixed(1),
  });

  // Check for dataset scene metadata
  const sceneMetadata = await host.getSceneMetadata(documentUri.fsPath);

  // Send depth data to webview for conversion
  sendToWebview(webviewPanel, {
    type: 'depthData',
    // Wall-clock epoch for measuring cross-process transfer cost in the webview.
    postedAt: Date.now(),
    fileName: path.basename(documentUri.fsPath),
    shortPath: host.getShortPath(documentUri.fsPath),
    data: depthData.buffer.slice(depthData.byteOffset, depthData.byteOffset + depthData.byteLength),
    sceneMetadata: sceneMetadata || undefined,
  });
}

export async function loadDocumentContent(
  host: DocumentLoaderHost,
  documentUri: vscode.Uri,
  webviewPanel: vscode.WebviewPanel,
  flags: DocumentFileTypeFlags
): Promise<void> {
  const {
    fileType,
    isDepthFile,
    isPfmFile,
    isNpyFile,
    isPngFile,
    isExrFile,
    isNpyPointCloud,
    isObjFile,
    isStlFile,
    isPcdFile,
    isPtsFile,
    isStonexX3aFile,
    isGltfFile,
    isVolumeFile,
    isXyzVariant,
    isJsonFile,
    isLidarFile,
    isSplatContainerFile,
  } = flags;

  try {
    if (decodesInViewer(documentUri.path)) {
      const data = await readFileFast(documentUri);
      await sendToWebview(webviewPanel, {
        type: 'fileData',
        fileName: path.basename(documentUri.path),
        shortPath: host.getShortPath(documentUri.fsPath),
        data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      });
      return;
    }
    if (isSceneModel(documentUri.path)) {
      await sendSceneModel(webviewPanel, documentUri);
      return;
    }
    const loadStartTime = performance.now();
    // Wall-clock twin of loadStartTime. Container formats (E57, X3A) fan out into
    // many scans that finish in the webview at different times, so the honest
    // end-to-end total has to be measured against a clock both processes share.
    const loadStartedAtEpoch = Date.now();
    const wallStart = new Date().toISOString();

    if (isSplatContainerFile) {
      const stat = await vscode.workspace.fs.stat(documentUri);
      sendSplatContainerUri(
        webviewPanel,
        documentUri,
        path.basename(documentUri.fsPath),
        host.getShortPath(documentUri.fsPath),
        'multiSpatialData',
        stat.size
      );
      return;
    }

    if (isLidarFile) {
      const bytes = await readFileShared(documentUri);
      const readTime = performance.now();
      const extension = path.extname(documentUri.fsPath).slice(1).toLowerCase() as
        'las' | 'laz' | 'e57';
      const decoded = await decodeLidar(bytes, extension, path.basename(documentUri.fsPath));
      const parsedData = decoded.map((cloud, index) => ({
        vertices: [],
        faces: [],
        format: 'binary_little_endian' as const,
        version: '1.0',
        comments: [`Imported from ${extension.toUpperCase()}`],
        vertexCount: cloud.vertexCount,
        sourcePointCount: cloud.sourcePointCount,
        faceCount: 0,
        hasColors: cloud.hasColors,
        hasNormals: false,
        hasIntensity: cloud.hasIntensity,
        fileName: extension === 'e57' ? cloud.name : path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileIndex: index,
        fileSizeInBytes: bytes.byteLength,
        positionsArray: cloud.positionsArray,
        colorsArray: cloud.colorsArray,
        normalsArray: null,
        intensityArray: cloud.intensityArray,
        scalarFields: cloud.scalarFields,
        useTypedArrays: true,
        sourceOrigin: Array.from(cloud.sourceOrigin) as [number, number, number],
        metadata: cloud.metadata,
      }));
      host.logPerf(
        `⏱️ PERF[${extension}/ext] read ${(readTime - loadStartTime).toFixed(1)}ms, parse ${(performance.now() - readTime).toFixed(1)}ms (${parsedData.reduce((n, d) => n + d.vertexCount, 0)} pts) for ${path.basename(documentUri.fsPath)}`
      );
      tagContainer(parsedData, extension, path.basename(documentUri.fsPath), loadStartedAtEpoch);
      await sendSpatialDataToWebview(webviewPanel, parsedData, 'multiSpatialData');
      return;
    }

    if (isStonexX3aFile) {
      const bytes = await readFileFast(documentUri);
      const readTime = performance.now();
      const parser = new StonexX3aParser(stonexCameraProjector);
      let geometrySent = false;
      const archiveName = path.basename(documentUri.fsPath);
      const colorContainer = {
        id: `${loadStartedAtEpoch}-${archiveName}-colour`,
        kind: 'x3a',
        name: archiveName,
        scanCount: 0,
        startedAt: loadStartedAtEpoch,
      };
      const parsed = await parser.parseAll(
        bytes,
        archiveName,
        message =>
          void sendToWebview(webviewPanel, {
            type: 'timingUpdate',
            message,
            timestamp: performance.now(),
          }),
        undefined,
        async geometry => {
          decorateStonexScans(host, geometry, documentUri, bytes.byteLength);
          tagContainer(geometry, 'x3a/geometry', archiveName, loadStartedAtEpoch);
          colorContainer.scanCount = geometry.filter(scan => scan.hasColors === false).length;
          geometrySent = true;
          await sendSpatialDataToWebview(
            webviewPanel,
            geometry,
            'multiSpatialData',
            host.logPerf.bind(host)
          );
        }
      );
      decorateStonexScans(host, parsed, documentUri, bytes.byteLength);
      host.logPerf(
        `⏱️ PERF[x3a/ext] read ${(readTime - loadStartTime).toFixed(1)}ms, parse ${(performance.now() - readTime).toFixed(1)}ms (${parsed.reduce((sum, scan) => sum + scan.vertexCount, 0)} pts in ${parsed.length} scans) for ${path.basename(documentUri.fsPath)}`
      );
      logStonexPhases(host, parsed[0], path.basename(documentUri.fsPath));
      if (geometrySent) {
        // Every parsed scan with photographic colour sends one closing update.
        colorContainer.scanCount = parsed.filter(scan => scan.colorsArray).length;
        await sendStonexColors(webviewPanel, parsed, colorContainer);
      } else {
        tagContainer(parsed, 'x3a', path.basename(documentUri.fsPath), loadStartedAtEpoch);
        await sendSpatialDataToWebview(webviewPanel, parsed, 'multiSpatialData');
      }
      return;
    }

    if (isDepthFile) {
      // Handle depth files (TIF, PFM, NPY, NPZ, PNG, EXR) for point cloud conversion
      const depthFileType = isPfmFile
        ? 'PFM'
        : isNpyFile
          ? 'NPY'
          : isPngFile
            ? 'PNG'
            : isExrFile
              ? 'EXR'
              : 'TIF';
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: `🚀 Extension: Starting ${depthFileType} file processing for depth conversion...`,
        timestamp: loadStartTime,
      });

      if (flags.depthPrefetchUri) {
        // The page has been fetching the file since it booted; tell it which
        // one, and send the bytes only if it asks (`depthFetchFailed`).
        sendToWebview(webviewPanel, {
          type: 'depthData',
          postedAt: Date.now(),
          fileName: path.basename(documentUri.fsPath),
          shortPath: host.getShortPath(documentUri.fsPath),
          fileUri: flags.depthPrefetchUri,
          sceneMetadata: (await host.getSceneMetadata(documentUri.fsPath)) || undefined,
        });
      } else {
        await sendDepthImage(host, documentUri, webviewPanel, loadStartTime);
      }

      return; // Exit early for depth files
    }

    if (isNpyPointCloud) {
      // Handle NPY point cloud file (shape ending with 3)
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: '🚀 Extension: Starting NPY point cloud processing...',
        timestamp: loadStartTime,
      });
      const npyData = await vscode.workspace.fs.readFile(documentUri);
      const fileReadTime = performance.now();
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: `📁 Extension: File read in ${(fileReadTime - loadStartTime).toFixed(2)}ms`,
        timestamp: loadStartTime,
      });

      const npyParser = new NpyParser();
      const parsedData = await npyParser.parse(npyData);

      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: `🔬 Extension: NPY parsing completed in ${performance.now() - fileReadTime}ms`,
        timestamp: loadStartTime,
      });

      // Send parsed NPY data to webview
      sendToWebview(webviewPanel, {
        type: 'npyData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        data: parsedData,
      });
      return; // Exit early for NPY point cloud files
    }

    const isOffFile = fileType?.extension === 'off';
    if (isObjFile || isStlFile || isOffFile) {
      // Decoded in Rust into packed buffers, which cross to the webview as raw
      // ArrayBuffers. The old object-per-triangle form crossed as JSON and
      // either took tens of seconds or exceeded V8's string limit outright.
      // Decoding here rather than in the webview also keeps the parse off the
      // UI thread and overlaps it with the webview's startup.
      const bytes = await readFileShared(documentUri);
      const readTime = performance.now();
      const kind = isObjFile ? 'obj' : isStlFile ? 'stl' : 'off';
      const parsed = await decodeInWorker<{ vertexCount: number; materialFile?: string }>(
        kind,
        bytes,
        path.basename(documentUri.fsPath)
      );
      host.logPerf(
        `⏱️ PERF[${kind}/ext] read ${(readTime - loadStartTime).toFixed(1)}ms, parse ${(performance.now() - readTime).toFixed(1)}ms (${parsed.vertexCount} vertices) for ${path.basename(documentUri.fsPath)}`
      );
      await sendToWebview(webviewPanel, {
        type: `${kind}Data`,
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: bytes.byteLength,
        data: parsed,
      });
      if (isObjFile) {
        await host.tryAutoLoadMtl(webviewPanel, documentUri, parsed, 0);
      }
      return;
    }

    if (isPcdFile) {
      // Handle PCD file
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: '🚀 Extension: Starting PCD file processing...',
        timestamp: loadStartTime,
      });

      // Streaming overlap for ASCII PCD (same cold-cache win as XYZ: the next
      // chunk's disk read overlaps the current chunk's parse). Gate on the
      // HEADER only so we don't read the whole file first: require ASCII data
      // and an identity VIEWPOINT — unlike `parse_pcd`, the streaming parser
      // reads rows without the header, so it carries no viewpoint transform.
      // Anything else falls through to the whole-file path below.
      if (documentUri.scheme === 'file') {
        try {
          const head = await readFileHead(documentUri, 65536);
          const headText = Buffer.from(head).toString('latin1');
          const isAsciiPcd = /[\r\n]DATA\s+ascii/i.test('\n' + headText);
          if (isAsciiPcd && pcdViewpointIsIdentity(head)) {
            if (
              await sendStreamedTextCloud(
                host,
                webviewPanel,
                documentUri,
                'pcd',
                'auto',
                'pcd',
                'pcd',
                loadStartTime
              )
            ) {
              return;
            }
            const streamed = await streamParseFile(documentUri.fsPath, 'pcd');
            const pcdMode = 'wasm-stream';
            if (streamed) {
              let pcdBytes = head.byteLength;
              try {
                pcdBytes = fs.statSync(documentUri.fsPath).size;
              } catch {
                /* size is best-effort for logging only */
              }
              host.logPerf(
                `⏱️ PERF[pcd/ext] load ${(performance.now() - loadStartTime).toFixed(1)}ms (${streamed.vertexCount} pts, ${pcdMode}) for ${path.basename(documentUri.fsPath)}`
              );
              sendToWebview(webviewPanel, {
                type: 'xyzVariantData',
                fileName: path.basename(documentUri.fsPath),
                shortPath: host.getShortPath(documentUri.fsPath),
                fileSizeInBytes: pcdBytes,
                data: streamed,
                variant: 'pcd',
                parseMode: pcdMode,
              });
              return;
            }
          }
        } catch {
          /* fall through to the whole-file path */
        }
      }

      const pcdData = await readFileShared(documentUri);
      const fileReadTime = performance.now();
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: `📁 Extension: PCD file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
        timestamp: fileReadTime,
      });

      const parsedData = await decodeInWorker<Record<string, any>>(
        'pcd',
        pcdData,
        path.basename(documentUri.fsPath)
      );
      const parseTime = performance.now();
      host.logPerf(
        `⏱️ PERF[pcd/ext] parse ${(parseTime - fileReadTime).toFixed(1)}ms (${parsedData.vertexCount} pts) for ${path.basename(documentUri.fsPath)}`
      );
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: `🎯 Extension: PCD parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
        timestamp: parseTime,
      });

      // Send parsed PCD data to webview
      sendToWebview(webviewPanel, {
        type: 'pcdData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: pcdData.byteLength,
        data: parsedData,
      });

      return; // Exit early for PCD files
    }

    if (isPtsFile) {
      // Handle PTS file
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: '🚀 Extension: Starting PTS file processing...',
        timestamp: loadStartTime,
      });

      const parallel =
        documentUri.scheme === 'file'
          ? await parallelParseTextFile(documentUri.fsPath, 'pts')
          : null;
      let parsedData: Record<string, unknown>;
      let ptsBytes: number;
      if (parallel) {
        parsedData = toPointCloudPayload(
          { ...parallel, metadataJson: '', scalarFields: {} },
          'pts'
        );
        ptsBytes = fs.statSync(documentUri.fsPath).size;
      } else {
        const ptsData = await readFileShared(documentUri);
        parsedData = await decodeInWorker<Record<string, unknown>>(
          'pts',
          ptsData,
          path.basename(documentUri.fsPath)
        );
        ptsBytes = ptsData.byteLength;
      }
      host.logPerf(
        `⏱️ PERF[pts/ext] load ${(performance.now() - loadStartTime).toFixed(1)}ms (${parsedData.vertexCount} pts, ${parallel ? 'wasm-parallel' : 'wasm'}) for ${path.basename(documentUri.fsPath)}`
      );

      // Send parsed PTS data to webview
      sendToWebview(webviewPanel, {
        type: 'ptsData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: ptsBytes,
        data: parsedData,
        parseMode: parallel ? 'wasm-parallel' : 'wasm',
      });

      return; // Exit early for PTS files
    }

    if (isVolumeFile) {
      // NRRD volume: retain the scalar samples and initially hand over one
      // windowed-grey point per voxel. Optional threshold-driven mesh
      // extraction still runs in the extension host so it cannot freeze the
      // webview.
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: '🚀 Extension: Starting volume processing...',
        timestamp: loadStartTime,
      });

      const volumeBytes = await readFileFast(documentUri);
      const fileReadTime = performance.now();

      const timingCallback = (message: string) => {
        sendToWebview(webviewPanel, {
          type: 'timingUpdate',
          message,
          timestamp: performance.now(),
        });
      };

      // A detached `.nhdr` names its data file relative to the header, so the
      // resolver reads siblings of the document rather than assuming the bytes
      // are attached.
      const directory = vscode.Uri.joinPath(documentUri, '..');
      const volume = await new NrrdParser().parse(
        volumeBytes,
        path.basename(documentUri.fsPath),
        timingCallback,
        async relative =>
          new Uint8Array(
            await vscode.workspace.fs.readFile(vscode.Uri.joinPath(directory, relative))
          )
      );
      const volumeDisplayName = volume.header['dicom series number']
        ? volume.header['content'] || path.basename(documentUri.fsPath)
        : path.basename(documentUri.fsPath);
      volume.fileName = volumeDisplayName;

      const volumeKey = documentUri.toString();
      const session = retainVolume(volumeKey, volume);
      const pointData = buildInitialVolumeData(session);
      decorateVolumeData(pointData, volumeKey, session);
      const parseTime = performance.now();
      host.logPerf(
        `⏱️ PERF[volume/ext] read ${(fileReadTime - loadStartTime).toFixed(1)}ms, ` +
          `points ${(parseTime - fileReadTime).toFixed(1)}ms ` +
          `(${volume.sizes.join('x')} → ${pointData.vertexCount} points @ ${session.options.threshold.toFixed(0)}) ` +
          `for ${path.basename(documentUri.fsPath)}`
      );

      sendToWebview(webviewPanel, {
        type: 'volumeData',
        fileName: volumeDisplayName,
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: volumeBytes.byteLength,
        data: pointData,
      });

      return;
    }

    if (isGltfFile) {
      // Handle GLTF/GLB file
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: '🚀 Extension: Starting GLTF/GLB file processing...',
        timestamp: loadStartTime,
      });

      const gltfData = await vscode.workspace.fs.readFile(documentUri);
      const fileReadTime = performance.now();
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: `📁 Extension: GLTF/GLB file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
        timestamp: fileReadTime,
      });

      const gltfParser = new GltfParser();
      const timingCallback = (message: string) => {
        sendToWebview(webviewPanel, {
          type: 'timingUpdate',
          message: message,
          timestamp: performance.now(),
        });
      };

      const parsedData = await gltfParser.parse(gltfData, timingCallback);
      const parseTime = performance.now();
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: `🎯 Extension: GLTF/GLB parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
        timestamp: parseTime,
      });

      // Send parsed GLTF/GLB data to webview
      sendToWebview(webviewPanel, {
        type: 'gltfData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: gltfData.byteLength,
        data: parsedData,
      });

      return; // Exit early for GLTF/GLB files
    }

    if (isXyzVariant) {
      // Handle XYZN/XYZRGB variants - send to webview for processing
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: '🚀 Extension: Starting XYZ variant file processing...',
        timestamp: loadStartTime,
      });

      const xyzVariant =
        fileType?.extension === 'xyzn'
          ? 'xyzn'
          : fileType?.extension === 'xyzrgb'
            ? 'xyzrgb'
            : 'xyz';

      // Streaming overlap (Rust/WASM StreamParser): the next chunk's disk
      // read (libuv) runs while the current chunk parses (main thread), so
      // total ≈ max(read, parse). A controlled cold A/B (purge between each)
      // showed it saves ~0.6–1.2s on 600MB XYZ files — cold is the
      // real-world first-open case. It costs ~300ms only when re-opening an
      // already-cached file (warm), which is rare. So: on for local files.
      const ENABLE_XYZ_STREAMING = true;
      const loadStart = performance.now();
      let xyzParsed: any = null;
      let xyzMode = 'js';
      let xyzBytes = 0;

      // XYZRGB has no type header, so decide once per file whether its colors
      // are 0-255 ints or 0-1 floats by checking the color tokens' text (a
      // decimal point ⇒ float). Done from a small header sample.
      let xyzColorMode = 'auto';
      if (xyzVariant === 'xyzrgb' && documentUri.scheme === 'file') {
        try {
          const head = await readFileHead(documentUri, 65536);
          xyzColorMode = detectXyzColorMode(head, xyzVariant);
        } catch {
          /* fall back to the in-parser value heuristic */
        }
      }

      if (
        documentUri.scheme === 'file' &&
        (await sendStreamedTextCloud(
          host,
          webviewPanel,
          documentUri,
          xyzVariant,
          xyzColorMode,
          xyzVariant,
          'xyz',
          loadStartTime
        ))
      ) {
        return;
      }
      if (!xyzParsed && ENABLE_XYZ_STREAMING && documentUri.scheme === 'file') {
        const streamed = await streamParseFile(documentUri.fsPath, xyzVariant, xyzColorMode);
        if (streamed) {
          xyzParsed = streamed;
          xyzMode = 'wasm-stream';
          try {
            xyzBytes = fs.statSync(documentUri.fsPath).size;
          } catch {
            /* size is best-effort for logging only */
          }
        }
      }
      if (!xyzParsed) {
        const xyzData = await readFileFast(documentUri);
        xyzBytes = xyzData.byteLength;
        const wasmParsed = parseXyzWasm(xyzData, xyzVariant, xyzColorMode);
        if (!wasmParsed) {
          throw new Error('XYZ parse failed: the Rust point-cloud parser is unavailable');
        }
        xyzParsed = wasmParsed;
        xyzMode = 'wasm';
      }
      host.logPerf(
        `⏱️ PERF[xyz/ext] load ${(performance.now() - loadStart).toFixed(1)}ms (${xyzParsed.vertexCount} pts, ${xyzMode}) for ${path.basename(documentUri.fsPath)}`
      );

      sendToWebview(webviewPanel, {
        type: 'xyzVariantData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: xyzBytes,
        data: xyzParsed,
        variant: xyzVariant,
        parseMode: xyzMode,
      });

      return; // Exit early for XYZ variant files
    }

    // Handle JSON pose files
    if (isJsonFile) {
      try {
        const jsonBytes = await vscode.workspace.fs.readFile(documentUri);
        const jsonText = Buffer.from(jsonBytes).toString('utf-8');

        // Try standard parse first
        let parsed: any;
        try {
          parsed = JSON.parse(jsonText);
        } catch (e) {
          // Fallback: sanitize non-standard tokens (NaN, Infinity) often found in pose dumps
          const sanitizedText = jsonText
            .replace(/\bNaN\b/g, 'null')
            .replace(/\bInfinity\b/g, 'null')
            .replace(/\b-Infinity\b/g, 'null');
          parsed = JSON.parse(sanitizedText);
        }

        sendToWebview(webviewPanel, {
          type: 'poseData',
          fileName: path.basename(documentUri.fsPath),
          shortPath: host.getShortPath(documentUri.fsPath),
          data: parsed,
        });
        return; // Exit early for JSON pose files
      } catch (err) {
        sendToWebview(webviewPanel, {
          type: 'loadingError',
          fileName: path.basename(documentUri.fsPath),
          fileType: 'JSON',
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }
    }

    // Everything below is the PLY path, which doubles as the catch-all. A file
    // whose extension this build does not know reaches it and fails as
    // "Invalid PLY/XYZ file: missing PLY header", which sends the reader
    // looking for a corrupt file instead of a missing format.
    //
    // That is exactly what an older build does when handed a format a newer
    // one added — `vscode.openWith` names this editor explicitly, so the
    // custom-editor selector never gets to reject the file. Say what actually
    // happened.
    if (!fileType) {
      const extension = path.extname(documentUri.fsPath).toLowerCase().replace(/^\./, '');
      sendToWebview(webviewPanel, {
        type: 'loadingError',
        fileName: path.basename(documentUri.fsPath),
        fileType: extension.toUpperCase() || 'unknown',
        error:
          `This build of the 3D Visualizer does not support .${extension} files. ` +
          'If another extension opened this file, the two versions are out of step — ' +
          'update or rebuild the 3D Visualizer.',
      });
      return;
    }

    // Send timing updates to webview for visibility
    sendToWebview(webviewPanel, {
      type: 'timing',
      phase: 'start',
      kind: 'ply',
      at: wallStart,
    });

    // Streaming overlap for ASCII PLY point clouds (same cold-cache win as
    // XYZ). Gate on a 64KB header read so we don't read the whole file first:
    // only ASCII PLY streams (binary PLY uses the transfer-via-fetch path
    // below); the stream parser returns null for binary/meshes → falls
    // through to the whole-file path unchanged.
    if (documentUri.scheme === 'file') {
      try {
        const head = await readFileHead(documentUri, 65536);
        if (!isPlyBinary(head)) {
          if (
            await sendStreamedTextCloud(
              host,
              webviewPanel,
              documentUri,
              'ply',
              'auto',
              'ply',
              'ply',
              loadStartTime
            )
          ) {
            return;
          }
          const streamed = await streamParseFile(documentUri.fsPath, 'ply');
          const plyMode = 'wasm-stream';
          if (streamed) {
            let plyBytes = head.byteLength;
            try {
              plyBytes = fs.statSync(documentUri.fsPath).size;
            } catch {
              /* size is best-effort for logging only */
            }
            host.logPerf(
              `⏱️ PERF[ply/ext] load ${(performance.now() - loadStartTime).toFixed(1)}ms (${streamed.vertexCount} pts, ${plyMode}) for ${path.basename(documentUri.fsPath)}`
            );
            sendToWebview(webviewPanel, {
              type: 'xyzVariantData',
              fileName: path.basename(documentUri.fsPath),
              shortPath: host.getShortPath(documentUri.fsPath),
              fileSizeInBytes: plyBytes,
              data: streamed,
              variant: 'ply',
              parseMode: plyMode,
            });
            return;
          }
        }
      } catch {
        /* fall through to the whole-file path */
      }
    }

    // Read only a header-sized prefix first. Binary PLYs take the
    // transfer-via-fetch path, where the webview fetches the full file bytes
    // itself — so reading all bytes here just to parse a few-KB header adds
    // a second full-disk pass (~200 ms for a 200 MB cloud). ASCII files (and
    // rare over-long headers) lazily fall back to the full read below.
    let fullBytes: Uint8Array | null = null;
    let prefix: Uint8Array | null = null;
    if (documentUri.scheme === 'file') {
      try {
        prefix = await readFileHead(documentUri, 65536);
      } catch {
        prefix = null;
      }
    }
    if (!prefix) {
      fullBytes = await vscode.workspace.fs.readFile(documentUri);
      prefix = fullBytes;
    }
    const readFullBytes = async (): Promise<Uint8Array> => {
      fullBytes ??= await vscode.workspace.fs.readFile(documentUri);
      return fullBytes;
    };
    const fileReadTime = performance.now();
    sendToWebview(webviewPanel, {
      type: 'timing',
      phase: 'read',
      kind: 'ply',
      ms: +(fileReadTime - loadStartTime).toFixed(1),
    });

    const parser = new PlyParser();
    sendToWebview(webviewPanel, {
      type: 'timingUpdate',
      message: '🚀 Extension: ULTIMATE - Starting header-only parsing...',
      timestamp: performance.now(),
    });

    // Create timing callback that forwards to webview
    const timingCallback = (message: string) => {
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: message,
        timestamp: performance.now(),
      });
    };

    // Detect format first using shared functionality
    const isBinary = isPlyBinary(prefix);

    if (isBinary) {
      // Binary PLY - use ULTIMATE parsing. The prefix covers any realistic
      // header; if end_header lies beyond it, retry on the full bytes.
      let headerResult;
      try {
        headerResult = await parser.parseHeaderOnly(prefix, timingCallback);
      } catch {
        headerResult = await parser.parseHeaderOnly(await readFullBytes(), timingCallback);
      }
      const parsedData = headerResult.headerInfo;
      const parseTime = performance.now();
      sendToWebview(webviewPanel, {
        type: 'timing',
        phase: 'parse',
        kind: 'ply',
        format: parsedData.format,
        ms: +(parseTime - fileReadTime).toFixed(1),
      });

      // Add file info
      parsedData.fileName = path.basename(documentUri.fsPath);
      parsedData.shortPath = host.getShortPath(documentUri.fsPath);
      parsedData.fileIndex = 0;

      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: '🚀 Extension: Starting binary data conversion...',
        timestamp: performance.now(),
      });

      // ULTIMATE: Send raw binary data for webview-side parsing
      sendToWebview(webviewPanel, {
        type: 'timingUpdate',
        message: '🚀 Extension: ULTIMATE - Sending raw binary data...',
        timestamp: performance.now(),
      });

      // Transfer-via-fetch: send only header metadata + a webview URI for
      // the file. The webview fetches the bytes directly, avoiding the
      // multi-hundred-ms structured-clone of the full vertex buffer. On a
      // fetch failure the webview asks the extension to resend over
      // postMessage (see the 'plyFetchFailed' handler, which re-reads).
      sendToWebview(webviewPanel, {
        type: 'ultimateRawBinaryUri',
        messageType: 'multiSpatialData',
        postedAt: Date.now(),
        loadStartedAt: host.getCurrentLoadStartedAt(),
        fileUri: webviewPanel.webview.asWebviewUri(documentUri).toString(),
        docUri: documentUri.toString(),
        fileName: parsedData.fileName,
        shortPath: parsedData.shortPath,
        fileSizeInBytes: fullBytes
          ? fullBytes.byteLength
          : (await vscode.workspace.fs.stat(documentUri)).size,
        vertexCount: parsedData.vertexCount,
        faceCount: parsedData.faceCount,
        hasColors: parsedData.hasColors,
        hasNormals: parsedData.hasNormals,
        hasIntensity: parsedData.hasIntensity,
        format: parsedData.format,
        comments: parsedData.comments,
        littleEndian: headerResult.headerInfo.format === 'binary_little_endian',
      });
    } else {
      // ASCII PLY. Try the Rust/WASM parser first — it handles point clouds
      // (no faces) and returns null for meshes or on any failure, so those
      // transparently fall through to the JS parser below. 3DGS files must
      // take the JS parser: the WASM path doesn't know the f_dc_* color
      // layout and would deliver an uncolored cloud.
      const asciiBytes = await readFullBytes();
      const headSample = new TextDecoder('utf-8').decode(asciiBytes.slice(0, 4096));
      const plyWasm = headSample.includes('f_dc_0') ? null : parseAsciiPlyWasm(asciiBytes);
      if (plyWasm) {
        host.logPerf(
          `⏱️ PERF[ply/ext] parse ${(performance.now() - fileReadTime).toFixed(1)}ms (${plyWasm.vertexCount} pts, wasm) for ${path.basename(documentUri.fsPath)}`
        );
        sendToWebview(webviewPanel, {
          type: 'xyzVariantData',
          fileName: path.basename(documentUri.fsPath),
          shortPath: host.getShortPath(documentUri.fsPath),
          fileSizeInBytes: asciiBytes.byteLength,
          data: plyWasm,
          variant: 'ply',
          parseMode: 'wasm',
        });
        return; // handled by the fast path
      }
      console.log(
        `📝 ASCII PLY detected: ${path.basename(documentUri.fsPath)} - using traditional parsing`
      );
      const parsedData = await parser.parse(asciiBytes, timingCallback);
      const parseTime = performance.now();
      const isXyz = /\.xyz$/i.test(documentUri.fsPath);
      host.logPerf(
        `⏱️ PERF[${isXyz ? 'xyz' : 'ply'}/ext] parse ${(parseTime - fileReadTime).toFixed(1)}ms (${parsedData.vertexCount} pts) for ${path.basename(documentUri.fsPath)}`
      );
      sendToWebview(webviewPanel, {
        type: 'timing',
        phase: 'parse',
        kind: 'ply',
        format: parsedData.format,
        ms: +(parseTime - fileReadTime).toFixed(1),
      });

      // Add file info
      parsedData.fileName = path.basename(documentUri.fsPath);
      parsedData.shortPath = host.getShortPath(documentUri.fsPath);
      parsedData.fileIndex = 0;
      (parsedData as any).fileSizeInBytes = asciiBytes.byteLength;
      if (parsedData.isGaussianSplat) {
        // Splat mode re-reads the full PLY from this URI on demand.
        parsedData.splatSource = {
          url: webviewPanel.webview.asWebviewUri(documentUri).toString(),
        };
      }

      // Send via traditional method (will use binary transfer if possible)
      await sendSpatialDataToWebview(webviewPanel, [parsedData], 'multiSpatialData');
    }
    const totalTime = performance.now();
    sendToWebview(webviewPanel, {
      type: 'timing',
      phase: 'total',
      kind: 'ply',
      ms: +(totalTime - loadStartTime).toFixed(1),
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Extension: PLY processing failed:`, error);
    const ext = path.extname(documentUri.fsPath).toLowerCase();
    const fileTypeMap: Record<string, string> = {
      '.ply': 'PLY',
      '.pcd': 'PCD',
      '.stl': 'STL',
      '.obj': 'OBJ',
      '.xyz': 'XYZ',
      '.pts': 'PTS',
      '.bin': 'KITTI BIN',
      '.tif': 'TIFF',
      '.tiff': 'TIFF',
      '.pfm': 'PFM',
      '.npy': 'NPY',
      '.npz': 'NPZ',
      '.png': 'PNG',
      '.json': 'JSON',
    };
    const errFileType = fileTypeMap[ext] || ext.toUpperCase().slice(1) || 'point cloud';
    sendToWebview(webviewPanel, {
      type: 'loadingError',
      fileName: path.basename(documentUri.fsPath),
      fileType: errFileType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
