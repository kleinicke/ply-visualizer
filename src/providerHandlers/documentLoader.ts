import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PlyParser } from '../../engine/src/parsers/plyParser';
import { ObjParser } from '../../engine/src/parsers/objParser';
import { StlParser } from '../../engine/src/parsers/stlParser';
import { PcdParser } from '../../engine/src/parsers/pcdParser';
import { PtsParser } from '../../engine/src/parsers/ptsParser';
import { KittiBinParser } from '../../engine/src/parsers/kittiBinParser';
import { OffParser } from '../../engine/src/parsers/offParser';
import { GltfParser } from '../../engine/src/parsers/gltfParser';
import { NpyParser } from '../../engine/src/parsers/npyParser';
import { XyzVariantParser } from '../../engine/src/parsers/xyzVariantParser';
import {
  parseXyzWasm,
  parseAsciiPlyWasm,
  parsePcdAsciiWasm,
  parsePcdBinaryWasm,
  parsePtsWasm,
  streamParseFile,
  detectXyzColorMode,
  parseLidarWasm,
} from '../wasmPointcloud';
import { isPlyBinary } from '../../engine/src/fileHandler';
import {
  readFileFast,
  readFileHead,
  pcdViewpointIsIdentity,
  sendSpatialDataToWebview,
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
  isKittiBinFile: boolean;
  isOffFile: boolean;
  isGltfFile: boolean;
  isXyzVariant: boolean;
  isJsonFile: boolean;
  isLidarFile: boolean;
}

/**
 * Reads, parses (or streams), and posts a just-opened document's content to
 * the webview, dispatching by the already-detected file type. Runs inside the
 * `setImmediate` callback resolveCustomEditor schedules so the webview HTML
 * can paint before any file IO starts.
 */
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
    isKittiBinFile,
    isOffFile,
    isGltfFile,
    isXyzVariant,
    isJsonFile,
    isLidarFile,
  } = flags;

  try {
    const loadStartTime = performance.now();
    const wallStart = new Date().toISOString();

    if (isLidarFile) {
      const bytes = await readFileFast(documentUri);
      const readTime = performance.now();
      const extension = path.extname(documentUri.fsPath).slice(1).toLowerCase() as
        | 'las'
        | 'laz'
        | 'e57';
      const decoded = parseLidarWasm(bytes, extension, path.basename(documentUri.fsPath));
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
      await sendSpatialDataToWebview(webviewPanel, parsedData, 'multiSpatialData');
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
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `🚀 Extension: Starting ${depthFileType} file processing for depth conversion...`,
        timestamp: loadStartTime,
      });

      // Read depth file and send for webview processing
      const depthData = await vscode.workspace.fs.readFile(documentUri);
      const fileReadTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timing',
        phase: 'read',
        kind: 'depth',
        ms: +(fileReadTime - loadStartTime).toFixed(1),
      });

      // Check for dataset scene metadata
      const sceneMetadata = await host.getSceneMetadata(documentUri.fsPath);

      // Send depth data to webview for conversion
      webviewPanel.webview.postMessage({
        type: 'depthData',
        // Wall-clock epoch for measuring cross-process transfer cost in the webview.
        postedAt: Date.now(),
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        data: depthData.buffer.slice(
          depthData.byteOffset,
          depthData.byteOffset + depthData.byteLength
        ),
        sceneMetadata: sceneMetadata || undefined,
      });

      return; // Exit early for depth files
    }

    if (isNpyPointCloud) {
      // Handle NPY point cloud file (shape ending with 3)
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: '🚀 Extension: Starting NPY point cloud processing...',
        timestamp: loadStartTime,
      });
      const npyData = await vscode.workspace.fs.readFile(documentUri);
      const fileReadTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `📁 Extension: File read in ${(fileReadTime - loadStartTime).toFixed(2)}ms`,
        timestamp: loadStartTime,
      });

      const npyParser = new NpyParser();
      const parsedData = await npyParser.parse(npyData);

      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `🔬 Extension: NPY parsing completed in ${performance.now() - fileReadTime}ms`,
        timestamp: loadStartTime,
      });

      // Send parsed NPY data to webview
      webviewPanel.webview.postMessage({
        type: 'npyData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        data: parsedData,
      });
      return; // Exit early for NPY point cloud files
    }

    if (isObjFile) {
      // Handle OBJ file
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: '🚀 Extension: Starting OBJ file processing...',
        timestamp: loadStartTime,
      });

      const objData = await vscode.workspace.fs.readFile(documentUri);
      const fileReadTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `📁 Extension: OBJ file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
        timestamp: fileReadTime,
      });

      const objParser = new ObjParser();
      const timingCallback = (message: string) => {
        webviewPanel.webview.postMessage({
          type: 'timingUpdate',
          message: message,
          timestamp: performance.now(),
        });
      };

      const parsedData = await objParser.parse(objData, timingCallback);
      const parseTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `🎯 Extension: OBJ parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
        timestamp: parseTime,
      });

      // Send parsed OBJ data to webview
      webviewPanel.webview.postMessage({
        type: 'objData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: objData.byteLength,
        data: parsedData,
      });

      // Try to auto-load MTL file
      await host.tryAutoLoadMtl(webviewPanel, documentUri, parsedData, 0);

      return; // Exit early for OBJ files
    }

    if (isStlFile) {
      // Handle STL file
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: '🚀 Extension: Starting STL file processing...',
        timestamp: loadStartTime,
      });

      const stlData = await vscode.workspace.fs.readFile(documentUri);
      const fileReadTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `📁 Extension: STL file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
        timestamp: fileReadTime,
      });

      const stlParser = new StlParser();
      const timingCallback = (message: string) => {
        webviewPanel.webview.postMessage({
          type: 'timingUpdate',
          message: message,
          timestamp: performance.now(),
        });
      };

      const parsedData = await stlParser.parse(stlData, timingCallback);
      const parseTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `🎯 Extension: STL parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
        timestamp: parseTime,
      });

      // Send parsed STL data to webview
      webviewPanel.webview.postMessage({
        type: 'stlData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: stlData.byteLength,
        data: parsedData,
      });

      return; // Exit early for STL files
    }

    if (isPcdFile) {
      // Handle PCD file
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: '🚀 Extension: Starting PCD file processing...',
        timestamp: loadStartTime,
      });

      // Streaming overlap for ASCII PCD (same cold-cache win as XYZ: the next
      // chunk's disk read overlaps the current chunk's parse). Gate on the
      // HEADER only so we don't read the whole file first: require ASCII data
      // and an identity VIEWPOINT (the WASM stream parser carries no viewpoint
      // transform). Anything else falls through to the whole-file path below.
      if (documentUri.scheme === 'file') {
        try {
          const head = await readFileHead(documentUri, 65536);
          const headText = Buffer.from(head).toString('latin1');
          const isAsciiPcd = /[\r\n]DATA\s+ascii/i.test('\n' + headText);
          if (isAsciiPcd && pcdViewpointIsIdentity(head)) {
            const streamed = await streamParseFile(documentUri.fsPath, 'pcd');
            if (streamed) {
              let pcdBytes = head.byteLength;
              try {
                pcdBytes = fs.statSync(documentUri.fsPath).size;
              } catch {
                /* size is best-effort for logging only */
              }
              host.logPerf(
                `⏱️ PERF[pcd/ext] load ${(performance.now() - loadStartTime).toFixed(1)}ms (${streamed.vertexCount} pts, wasm-stream) for ${path.basename(documentUri.fsPath)}`
              );
              webviewPanel.webview.postMessage({
                type: 'xyzVariantData',
                fileName: path.basename(documentUri.fsPath),
                shortPath: host.getShortPath(documentUri.fsPath),
                fileSizeInBytes: pcdBytes,
                data: streamed,
                variant: 'pcd',
                parseMode: 'wasm-stream',
              });
              return;
            }
          }
        } catch {
          /* fall through to the whole-file path */
        }
      }

      const pcdData = await readFileFast(documentUri);
      const fileReadTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `📁 Extension: PCD file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
        timestamp: fileReadTime,
      });

      // Fast path: Rust/WASM for ASCII PCD point clouds with an identity
      // viewpoint. parse_pcd_ascii returns null for binary PCD; the
      // viewpoint guard keeps clouds that need the VIEWPOINT transform on
      // the JS path. Anything else falls through to the JS parser below.
      if (pcdViewpointIsIdentity(pcdData)) {
        // ASCII via WASM, then binary via WASM (binary PCD otherwise falls to
        // the slow JS parser — ~11x slower). Both gated on identity viewpoint
        // since the WASM parsers don't carry the VIEWPOINT transform.
        const pcdWasm = parsePcdAsciiWasm(pcdData) || parsePcdBinaryWasm(pcdData);
        if (pcdWasm) {
          host.logPerf(
            `⏱️ PERF[pcd/ext] parse ${(performance.now() - fileReadTime).toFixed(1)}ms (${pcdWasm.vertexCount} pts, wasm) for ${path.basename(documentUri.fsPath)}`
          );
          webviewPanel.webview.postMessage({
            type: 'xyzVariantData',
            fileName: path.basename(documentUri.fsPath),
            shortPath: host.getShortPath(documentUri.fsPath),
            fileSizeInBytes: pcdData.byteLength,
            data: pcdWasm,
            variant: 'pcd',
            parseMode: 'wasm',
          });
          return;
        }
      }

      const pcdParser = new PcdParser();
      const timingCallback = (message: string) => {
        webviewPanel.webview.postMessage({
          type: 'timingUpdate',
          message: message,
          timestamp: performance.now(),
        });
      };

      const parsedData = await pcdParser.parse(pcdData, timingCallback);
      const parseTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `🎯 Extension: PCD parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
        timestamp: parseTime,
      });

      // Send parsed PCD data to webview
      webviewPanel.webview.postMessage({
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
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: '🚀 Extension: Starting PTS file processing...',
        timestamp: loadStartTime,
      });

      const ptsData = await readFileFast(documentUri);
      const fileReadTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `📁 Extension: PTS file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
        timestamp: fileReadTime,
      });

      // Try the Rust/WASM parser (~2.5-3x faster); fall back to JS.
      let parsedData: any;
      let ptsMode = 'js';
      const ptsWasm = parsePtsWasm(ptsData);
      if (ptsWasm) {
        parsedData = {
          vertexCount: ptsWasm.vertexCount,
          positionsArray: ptsWasm.positionsArray,
          colorsArray: ptsWasm.colorsArray,
          normalsArray: ptsWasm.normalsArray,
          intensityArray: ptsWasm.intensityArray,
          hasColors: ptsWasm.hasColors,
          hasNormals: ptsWasm.hasNormals,
          hasIntensity: ptsWasm.hasIntensity,
          scalarFields: ptsWasm.intensityArray ? { intensity: ptsWasm.intensityArray } : {},
          detectedFormat: `x y z${ptsWasm.hasIntensity ? ' intensity' : ''}${ptsWasm.hasColors ? ' r g b' : ''}`,
          comments: [],
        };
        ptsMode = 'wasm';
      } else {
        const ptsParser = new PtsParser();
        parsedData = await ptsParser.parse(ptsData);
      }
      host.logPerf(
        `⏱️ PERF[pts/ext] parse ${(performance.now() - fileReadTime).toFixed(1)}ms (${parsedData.vertexCount} pts, ${ptsMode}) for ${path.basename(documentUri.fsPath)}`
      );

      // Send parsed PTS data to webview
      webviewPanel.webview.postMessage({
        type: 'ptsData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: ptsData.byteLength,
        data: parsedData,
        parseMode: ptsMode,
      });

      return; // Exit early for PTS files
    }

    if (isOffFile) {
      // Handle OFF file
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: '🚀 Extension: Starting OFF file processing...',
        timestamp: loadStartTime,
      });

      const offData = await vscode.workspace.fs.readFile(documentUri);
      const fileReadTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `📁 Extension: OFF file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
        timestamp: fileReadTime,
      });

      const offParser = new OffParser();
      const timingCallback = (message: string) => {
        webviewPanel.webview.postMessage({
          type: 'timingUpdate',
          message: message,
          timestamp: performance.now(),
        });
      };

      const parsedData = await offParser.parse(offData, timingCallback);
      const parseTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `🎯 Extension: OFF parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
        timestamp: parseTime,
      });

      // Send parsed OFF data to webview
      webviewPanel.webview.postMessage({
        type: 'offData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: offData.byteLength,
        data: parsedData,
      });

      return; // Exit early for OFF files
    }

    if (isGltfFile) {
      // Handle GLTF/GLB file
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: '🚀 Extension: Starting GLTF/GLB file processing...',
        timestamp: loadStartTime,
      });

      const gltfData = await vscode.workspace.fs.readFile(documentUri);
      const fileReadTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `📁 Extension: GLTF/GLB file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
        timestamp: fileReadTime,
      });

      const gltfParser = new GltfParser();
      const timingCallback = (message: string) => {
        webviewPanel.webview.postMessage({
          type: 'timingUpdate',
          message: message,
          timestamp: performance.now(),
        });
      };

      const parsedData = await gltfParser.parse(gltfData, timingCallback);
      const parseTime = performance.now();
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `🎯 Extension: GLTF/GLB parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
        timestamp: parseTime,
      });

      // Send parsed GLTF/GLB data to webview
      webviewPanel.webview.postMessage({
        type: 'gltfData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: gltfData.byteLength,
        data: parsedData,
      });

      return; // Exit early for GLTF/GLB files
    }

    if (isKittiBinFile) {
      // Handle KITTI LiDAR .bin scans - parse in the extension host and send
      // typed arrays to the webview
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: '🚀 Extension: Starting KITTI BIN file processing...',
        timestamp: loadStartTime,
      });

      const loadStart = performance.now();
      const binBytes = await readFileFast(documentUri);
      const kittiParser = new KittiBinParser();
      const kittiParsed = await kittiParser.parse(binBytes, (msg: string) => {
        webviewPanel.webview.postMessage({
          type: 'timingUpdate',
          message: msg,
          timestamp: performance.now(),
        });
      });
      host.logPerf(
        `⏱️ PERF[kitti-bin/ext] load ${(performance.now() - loadStart).toFixed(1)}ms (${kittiParsed.vertexCount} pts) for ${path.basename(documentUri.fsPath)}`
      );

      webviewPanel.webview.postMessage({
        type: 'kittiBinData',
        fileName: path.basename(documentUri.fsPath),
        shortPath: host.getShortPath(documentUri.fsPath),
        fileSizeInBytes: binBytes.byteLength,
        data: kittiParsed,
      });

      return; // Exit early for KITTI BIN files
    }

    if (isXyzVariant) {
      // Handle XYZN/XYZRGB variants - send to webview for processing
      webviewPanel.webview.postMessage({
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

      if (ENABLE_XYZ_STREAMING && documentUri.scheme === 'file') {
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
        xyzParsed = wasmParsed ?? new XyzVariantParser().parse(xyzData, xyzVariant);
        xyzMode = wasmParsed ? 'wasm' : 'js';
      }
      host.logPerf(
        `⏱️ PERF[xyz/ext] load ${(performance.now() - loadStart).toFixed(1)}ms (${xyzParsed.vertexCount} pts, ${xyzMode}) for ${path.basename(documentUri.fsPath)}`
      );

      webviewPanel.webview.postMessage({
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

        webviewPanel.webview.postMessage({
          type: 'poseData',
          fileName: path.basename(documentUri.fsPath),
          shortPath: host.getShortPath(documentUri.fsPath),
          data: parsed,
        });
        return; // Exit early for JSON pose files
      } catch (err) {
        webviewPanel.webview.postMessage({
          type: 'loadingError',
          fileName: path.basename(documentUri.fsPath),
          fileType: 'JSON',
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }
    }

    // Send timing updates to webview for visibility
    webviewPanel.webview.postMessage({
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
          const streamed = await streamParseFile(documentUri.fsPath, 'ply');
          if (streamed) {
            let plyBytes = head.byteLength;
            try {
              plyBytes = fs.statSync(documentUri.fsPath).size;
            } catch {
              /* size is best-effort for logging only */
            }
            host.logPerf(
              `⏱️ PERF[ply/ext] load ${(performance.now() - loadStartTime).toFixed(1)}ms (${streamed.vertexCount} pts, wasm-stream) for ${path.basename(documentUri.fsPath)}`
            );
            webviewPanel.webview.postMessage({
              type: 'xyzVariantData',
              fileName: path.basename(documentUri.fsPath),
              shortPath: host.getShortPath(documentUri.fsPath),
              fileSizeInBytes: plyBytes,
              data: streamed,
              variant: 'ply',
              parseMode: 'wasm-stream',
            });
            return;
          }
        }
      } catch {
        /* fall through to the whole-file path */
      }
    }

    const spatialData = await vscode.workspace.fs.readFile(documentUri);
    const fileReadTime = performance.now();
    webviewPanel.webview.postMessage({
      type: 'timing',
      phase: 'read',
      kind: 'ply',
      ms: +(fileReadTime - loadStartTime).toFixed(1),
    });

    const parser = new PlyParser();
    webviewPanel.webview.postMessage({
      type: 'timingUpdate',
      message: '🚀 Extension: ULTIMATE - Starting header-only parsing...',
      timestamp: performance.now(),
    });

    // Create timing callback that forwards to webview
    const timingCallback = (message: string) => {
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: message,
        timestamp: performance.now(),
      });
    };

    // Detect format first using shared functionality
    const isBinary = isPlyBinary(spatialData);

    if (isBinary) {
      // Binary PLY - use ULTIMATE parsing
      const headerResult = await parser.parseHeaderOnly(spatialData, timingCallback);
      const parsedData = headerResult.headerInfo;
      const parseTime = performance.now();
      webviewPanel.webview.postMessage({
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

      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: '🚀 Extension: Starting binary data conversion...',
        timestamp: performance.now(),
      });

      // ULTIMATE: Send raw binary data for webview-side parsing
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: '🚀 Extension: ULTIMATE - Sending raw binary data...',
        timestamp: performance.now(),
      });

      // Send raw binary data + header info
      // Extra logging to aid debugging face offsets/types
      // Log face types once for debugging
      // concise header info for debugging (once)
      webviewPanel.webview.postMessage({
        type: 'timingUpdate',
        message: `Header face types: count=${headerResult.faceCountType || 'n/a'}, index=${headerResult.faceIndexType || 'n/a'}`,
        timestamp: performance.now(),
      });
      // Transfer-via-fetch: send only header metadata + a webview URI for
      // the file. The webview fetches the bytes directly, avoiding the
      // multi-hundred-ms structured-clone of the full vertex buffer. On a
      // fetch failure the webview asks the extension to resend over
      // postMessage (see the 'plyFetchFailed' handler, which re-reads).
      webviewPanel.webview.postMessage({
        type: 'ultimateRawBinaryUri',
        messageType: 'multiSpatialData',
        postedAt: Date.now(),
        loadStartedAt: host.getCurrentLoadStartedAt(),
        fileUri: webviewPanel.webview.asWebviewUri(documentUri).toString(),
        docUri: documentUri.toString(),
        binaryDataStart: headerResult.binaryDataStart,
        fileName: parsedData.fileName,
        shortPath: parsedData.shortPath,
        fileSizeInBytes: spatialData.byteLength,
        vertexCount: parsedData.vertexCount,
        faceCount: parsedData.faceCount,
        hasColors: parsedData.hasColors,
        hasNormals: parsedData.hasNormals,
        hasIntensity: parsedData.hasIntensity,
        format: parsedData.format,
        comments: parsedData.comments,
        vertexStride: headerResult.vertexStride,
        propertyOffsets: Array.from(headerResult.propertyOffsets.entries()),
        littleEndian: headerResult.headerInfo.format === 'binary_little_endian',
        faceCountType: headerResult.faceCountType,
        faceIndexType: headerResult.faceIndexType,
      });
    } else {
      // ASCII PLY. Try the Rust/WASM parser first — it handles point clouds
      // (no faces) and returns null for meshes or on any failure, so those
      // transparently fall through to the JS parser below.
      const plyWasm = parseAsciiPlyWasm(spatialData);
      if (plyWasm) {
        host.logPerf(
          `⏱️ PERF[ply/ext] parse ${(performance.now() - fileReadTime).toFixed(1)}ms (${plyWasm.vertexCount} pts, wasm) for ${path.basename(documentUri.fsPath)}`
        );
        webviewPanel.webview.postMessage({
          type: 'xyzVariantData',
          fileName: path.basename(documentUri.fsPath),
          shortPath: host.getShortPath(documentUri.fsPath),
          fileSizeInBytes: spatialData.byteLength,
          data: plyWasm,
          variant: 'ply',
          parseMode: 'wasm',
        });
        return; // handled by the fast path
      }
      console.log(
        `📝 ASCII PLY detected: ${path.basename(documentUri.fsPath)} - using traditional parsing`
      );
      const parsedData = await parser.parse(spatialData, timingCallback);
      const parseTime = performance.now();
      const isXyz = /\.xyz$/i.test(documentUri.fsPath);
      host.logPerf(
        `⏱️ PERF[${isXyz ? 'xyz' : 'ply'}/ext] parse ${(parseTime - fileReadTime).toFixed(1)}ms (${parsedData.vertexCount} pts) for ${path.basename(documentUri.fsPath)}`
      );
      webviewPanel.webview.postMessage({
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
      (parsedData as any).fileSizeInBytes = spatialData.byteLength;

      // Send via traditional method (will use binary transfer if possible)
      await sendSpatialDataToWebview(webviewPanel, [parsedData], 'multiSpatialData');
    }
    const totalTime = performance.now();
    webviewPanel.webview.postMessage({
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
    webviewPanel.webview.postMessage({
      type: 'loadingError',
      fileName: path.basename(documentUri.fsPath),
      fileType: errFileType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
