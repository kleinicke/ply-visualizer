import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DatasetManager } from './dataset/datasetManager';
import { PlyParser } from '../engine/src/parsers/plyParser';
import { ObjParser } from '../engine/src/parsers/objParser';
import { MtlParser } from '../engine/src/parsers/mtlParser';
import { StlParser } from '../engine/src/parsers/stlParser';
import { PcdParser } from '../engine/src/parsers/pcdParser';
import { PtsParser } from '../engine/src/parsers/ptsParser';
import { OffParser } from '../engine/src/parsers/offParser';
import { GltfParser } from '../engine/src/parsers/gltfParser';
import { sendUltimateRawBinary } from './providerHandlers/binaryTransfer';
import {
  handleCameraParametersRequest,
  handleCameraParametersWithScaleRequest,
} from './providerHandlers/cameraParamsHandlers';
import {
  handleAddFile,
  handleAddFileFromPath,
  handleDroppedFilesFromWebview,
  type AddFileHost,
} from './providerHandlers/addFileHandlers';
import { loadDocumentContent, type DocumentLoaderHost } from './providerHandlers/documentLoader';

// Shared file handling functionality
import { detectFileType, detectFileTypeWithContent, isPlyBinary } from '../engine/src/fileHandler';

export class PointCloudEditorProvider implements vscode.CustomReadonlyEditorProvider {
  private static readonly viewType = 'plyViewer.plyEditor';
  private activePanels = new Set<vscode.WebviewPanel>();
  private pathToPanel = new Map<string, vscode.WebviewPanel>();
  private panelToPath = new Map<vscode.WebviewPanel, string>();
  private datasetManager: DatasetManager;
  private readonly perfChannel: vscode.OutputChannel;
  private perfChannelRevealed = false;
  // Wall-clock epoch (Date.now) when the current file's load began. Stamped onto
  // every outgoing *Data message so the webview can report one consistent
  // end-to-end timing line (read+parse / transfer / build / total).
  private currentLoadStartedAt = 0;
  private readonly addFileHost: AddFileHost = {
    getShortPath: filePath => this.getShortPath(filePath),
    logPerf: line => this.logPerf(line),
    setLoadStartedAt: ts => {
      this.currentLoadStartedAt = ts;
    },
    tryAutoLoadMtl: (webviewPanel, objUri, parsedObjData, fileIndex) =>
      this.tryAutoLoadMtl(webviewPanel, objUri, parsedObjData, fileIndex),
  };
  private readonly documentLoaderHost: DocumentLoaderHost = {
    getShortPath: filePath => this.getShortPath(filePath),
    logPerf: line => this.logPerf(line),
    getCurrentLoadStartedAt: () => this.currentLoadStartedAt,
    tryAutoLoadMtl: (webviewPanel, objUri, parsedObjData, fileIndex) =>
      this.tryAutoLoadMtl(webviewPanel, objUri, parsedObjData, fileIndex),
    getSceneMetadata: fsPath => this.datasetManager.getSceneMetadata(fsPath),
  };

  constructor(private readonly context: vscode.ExtensionContext) {
    this.datasetManager = new DatasetManager(context);
    this.perfChannel = vscode.window.createOutputChannel('3D Visualizer');
    context.subscriptions.push(this.perfChannel);
  }

  /**
   * Wrap a panel's postMessage once so every data-bearing message (type ending
   * in "Data") is stamped with a wall-clock `postedAt` just before it is sent.
   * This lets the webview measure the cross-process transfer cost for ALL
   * formats without editing each of the ~30 send sites. Best-effort: if the
   * property can't be reassigned, transfer timing is simply omitted.
   */
  private stampTransferTimestamps(webviewPanel: vscode.WebviewPanel): void {
    try {
      const webview = webviewPanel.webview;
      const original = webview.postMessage.bind(webview);
      (webview as any).postMessage = (msg: any) => {
        if (
          msg &&
          typeof msg === 'object' &&
          typeof msg.type === 'string' &&
          msg.type.endsWith('Data')
        ) {
          if (msg.postedAt === undefined) {
            msg.postedAt = Date.now();
          }
          if (msg.loadStartedAt === undefined && this.currentLoadStartedAt) {
            msg.loadStartedAt = this.currentLoadStartedAt;
          }
        }
        return original(msg);
      };
    } catch {
      /* transfer timing is optional; never block loading over it */
    }
  }

  /** Append a timestamped line to the "3D Visualizer" Output channel. */
  private logPerf(line: string): void {
    // The webview emits the single authoritative end-to-end timing line per load
    // (read+parse · transfer · build · total). The extension's intermediate
    // `…/ext` measurements stay console-only so the Output channel isn't doubled.
    if (line.includes('/ext]')) {
      console.log(line);
      return;
    }
    const t = new Date();
    const ts = `${t.toTimeString().split(' ')[0]}.${t
      .getMilliseconds()
      .toString()
      .padStart(3, '0')}`;
    this.perfChannel.appendLine(`[${ts}] ${line}`);
    // Reveal the panel once per session (without stealing editor focus) so the
    // timing output is discoverable; afterwards it stays where the user put it.
    if (!this.perfChannelRevealed) {
      this.perfChannelRevealed = true;
      this.perfChannel.show(true);
    }
  }

  /**
   * Creates a short path showing grandparent/parent/filename for tooltip display
   */
  private getShortPath(filePath: string): string {
    const parts = filePath.split(/[\\/]/);
    // Get up to 3 parts: grandparent/parent/filename
    const relevantParts = parts.slice(-3);
    return relevantParts.join('/');
  }

  public async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Promise<SpatialDocument> {
    return new SpatialDocument(uri);
  }

  public async resolveCustomEditor(
    document: SpatialDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    this.activePanels.add(webviewPanel);
    this.pathToPanel.set(document.uri.fsPath, webviewPanel);
    this.panelToPath.set(webviewPanel, document.uri.fsPath);
    this.stampTransferTimestamps(webviewPanel);
    webviewPanel.onDidDispose(() => {
      this.activePanels.delete(webviewPanel);
      this.pathToPanel.delete(document.uri.fsPath);
      this.panelToPath.delete(webviewPanel);
    });
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'engine', 'media'),
        vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview'),
        // The document's directory so the webview can fetch the file bytes
        // directly (transfer-via-fetch), avoiding the postMessage copy for
        // large binary PLYs.
        vscode.Uri.joinPath(document.uri, '..'),
      ],
    };

    // Check file type using shared functionality with content analysis
    const fileName = path.basename(document.uri.fsPath);
    let fileType = detectFileType(fileName);

    // For NPY files, read the file and perform content-based detection
    if (fileType?.extension === 'npy') {
      try {
        const fileData = await vscode.workspace.fs.readFile(document.uri);
        fileType = detectFileTypeWithContent(fileName, fileData);
        console.log(
          `VS Code NPY analysis: ${fileName} -> category: ${fileType?.category}, isDepthFile: ${fileType?.isDepthFile}`
        );
      } catch (error) {
        console.warn('Failed to read NPY file for content analysis:', error);
      }
    }

    // Legacy boolean flags for existing message structure
    const isTifFile = fileType?.extension === 'tif' || fileType?.extension === 'tiff';
    const isPfmFile = fileType?.extension === 'pfm';
    const isNpyFile = fileType?.extension === 'npy' || fileType?.extension === 'npz';
    const isPngFile = fileType?.extension === 'png';
    const isExrFile = fileType?.extension === 'exr';
    const isDepthFile = fileType?.isDepthFile || false;
    const isObjFile = fileType?.extension === 'obj';
    const isStlFile = fileType?.extension === 'stl';
    const isPcdFile = fileType?.extension === 'pcd';
    const isPtsFile = fileType?.extension === 'pts';
    const isOffFile = fileType?.extension === 'off';
    const isGltfFile = fileType?.extension === 'gltf' || fileType?.extension === 'glb';
    const isXyzVariant =
      fileType?.extension === 'xyzn' ||
      fileType?.extension === 'xyzrgb' ||
      fileType?.extension === 'xyz';
    const isJsonFile = fileType?.extension === 'json';
    const isNpyPointCloud = fileType?.extension === 'npy' && fileType?.category === 'pointCloud';

    // Show UI immediately before any file processing
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Anchor the load's wall-clock start for the unified end-to-end timing line.
    this.currentLoadStartedAt = Date.now();

    // Send immediate message to show loading state
    webviewPanel.webview.postMessage({
      type: 'startLoading',
      fileName: path.basename(document.uri.fsPath),
      isTifFile: isTifFile,
      isPfmFile: isPfmFile,
      isNpyFile: isNpyFile,
      isPngFile: isPngFile,
      isExrFile: isExrFile,
      isDepthFile: isDepthFile,
      isObjFile: isObjFile,
      isStlFile: isStlFile,
      isPcdFile: isPcdFile,
      isPtsFile: isPtsFile,
      isOffFile: isOffFile,
      isGltfFile: isGltfFile,
      isXyzVariant: isXyzVariant,
    });

    // Proactively send default depth settings before any depth processing
    // to ensure the webview uses the latest saved defaults during initial conversion
    await this.handleRequestDefaultDepthSettings(webviewPanel);

    // Load and parse file asynchronously (don't await - let UI show first)
    setImmediate(() =>
      loadDocumentContent(this.documentLoaderHost, document.uri, webviewPanel, {
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
        isOffFile,
        isGltfFile,
        isXyzVariant,
        isJsonFile,
      })
    );

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'error':
          vscode.window.showErrorMessage(message.message);
          break;
        case 'info':
          vscode.window.showInformationMessage(message.message);
          break;
        case 'perfLog':
          this.logPerf(message.line);
          break;
        case 'plyFetchFailed':
          await this.handlePlyFetchFallback(message);
          break;
        case 'addFile':
          await handleAddFile(this.addFileHost, webviewPanel, this.panelToPath.get(webviewPanel));
          break;
        case 'removeFile':
          webviewPanel.webview.postMessage({
            type: 'fileRemoved',
            fileIndex: message.fileIndex,
          });
          break;
        case 'requestCameraParams':
          // Request camera parameters for TIF conversion
          await handleCameraParametersRequest(this.context, webviewPanel, message);
          break;
        case 'requestCameraParamsWithScale':
          // Request camera parameters with scale factor for PNG conversion
          await handleCameraParametersWithScaleRequest(this.context, webviewPanel, message);
          break;
        case 'savePlyFile':
          // Handle PLY file save request
          await this.handleSaveSpatialFile(webviewPanel, message);
          break;
        case 'saveScreenshot':
          await this.handleSaveScreenshot(message);
          break;
        case 'selectColorImage':
          await this.handleSelectColorImage(webviewPanel, message);
          break;
        case 'loadMtl':
          await this.handleLoadMtl(webviewPanel, message);
          break;
        case 'saveDefaultDepthSettings':
          await this.handleSaveDefaultDepthSettings(message);
          break;
        case 'saveCameraConvention':
          await this.context.globalState.update('defaultCameraConvention', message.convention);
          break;
        case 'requestDefaultDepthSettings':
          await this.handleRequestDefaultDepthSettings(webviewPanel);
          break;
        case 'selectCalibrationFile':
          await this.handleSelectCalibrationFile(webviewPanel, message);
          break;
        case 'sequence:requestFile':
          await this.handleSequenceRequestFile(webviewPanel, message);
          break;
        case 'addFileFromPath':
          await handleAddFileFromPath(this.addFileHost, webviewPanel, message.path as string);
          break;
        case 'addDroppedFiles':
          await handleDroppedFilesFromWebview(this.addFileHost, webviewPanel, message.files || []);
          break;
        case 'requestDatasetTexture':
          await this.handleRequestDatasetTexture(webviewPanel, message);
          break;
        case 'loadDatasetCalibration':
          await this.loadCalibrationFileAutomatically(
            webviewPanel,
            message.calibrationPath,
            message.fileIndex
          );
          break;
        case 'loadDatasetImage':
          await this.loadColorImageAutomatically(
            webviewPanel,
            message.imagePath,
            message.fileIndex
          );
          break;
      }
    });
  }

  // Start sequence playback in current active webview with background loading hint
  public startSequence(filePaths: string[], wildcard: string): void {
    for (const panel of this.activePanels) {
      panel.webview.postMessage({
        type: 'sequence:init',
        files: filePaths,
        wildcard: wildcard,
      });
      break;
    }
  }

  // Start sequence in the specific panel for a given file path (ensures correct target)
  public startSequenceFor(targetFsPath: string, filePaths: string[], wildcard: string): void {
    const panel = this.pathToPanel.get(targetFsPath);
    if (panel) {
      panel.webview.postMessage({ type: 'sequence:init', files: filePaths, wildcard });
      return;
    }
    // Fallback: use last known active panel if mapping not present
    this.startSequence(filePaths, wildcard);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Read the shared index.html file (single source of truth)
    const htmlPath = vscode.Uri.joinPath(this.context.extensionUri, 'engine', 'index.html');
    const htmlPathOnDisk = htmlPath.fsPath;
    let html = fs.readFileSync(htmlPathOnDisk, 'utf8');

    // Get URIs for VSCode webview resources
    const scriptPathOnDisk = vscode.Uri.joinPath(
      this.context.extensionUri,
      'out',
      'webview',
      'main.js'
    );
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk).toString();

    const stylePathOnDisk = vscode.Uri.joinPath(
      this.context.extensionUri,
      'engine',
      'media',
      'style.css'
    );
    const styleUri = webview.asWebviewUri(stylePathOnDisk).toString();

    const geotiffPathOnDisk = vscode.Uri.joinPath(
      this.context.extensionUri,
      'engine',
      'media',
      'geotiff.min.js'
    );
    const geotiffUri = webview.asWebviewUri(geotiffPathOnDisk).toString();

    // Rust/WASM TIFF decoder (drop-in accelerator for geotiff.js, mirrors the
    // tiff-visualizer sister extension). The glue defines a global wasm_bindgen;
    // the webview fetches the .wasm binary from this URI at init time.
    const tiffWasmGlueOnDisk = vscode.Uri.joinPath(
      this.context.extensionUri,
      'engine',
      'media',
      'wasm',
      'tiff_wasm.js'
    );
    const tiffWasmGlueUri = webview.asWebviewUri(tiffWasmGlueOnDisk).toString();
    const tiffWasmBinaryOnDisk = vscode.Uri.joinPath(
      this.context.extensionUri,
      'engine',
      'media',
      'wasm',
      'tiff_wasm_bg.wasm'
    );
    const tiffWasmBinaryUri = webview.asWebviewUri(tiffWasmBinaryOnDisk).toString();

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    // VSCode-specific modifications to the HTML:
    // 1. Add Content Security Policy. 'wasm-unsafe-eval' is required to compile
    //    the TIFF decoder WebAssembly module; connect-src already allows
    //    fetching the .wasm binary from the webview resource origin.
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; connect-src ${webview.cspSource} https:; worker-src ${webview.cspSource} blob:; script-src 'nonce-${nonce}' ${webview.cspSource} 'wasm-unsafe-eval'; img-src ${webview.cspSource} https: blob: data:; font-src ${webview.cspSource};">`;
    html = html.replace('<meta name="viewport"', `${cspMeta}\n    <meta name="viewport"`);

    // 2. Replace resource URLs with webview URIs
    html = html.replace(/href="media\/style\.css"/, `href="${styleUri}"`);
    html = html.replace(/src="media\/geotiff\.min\.js"/, `nonce="${nonce}" src="${geotiffUri}"`);
    html = html.replace(
      /src="media\/wasm\/tiff_wasm\.js"/,
      `nonce="${nonce}" src="${tiffWasmGlueUri}"`
    );
    // Point the webview at the webview-resource URI for the .wasm binary.
    html = html.replace(
      /window\.__GEOTIFF_URL__ = window\.__GEOTIFF_URL__ \|\| 'media\/geotiff\.min\.js';/,
      `window.__GEOTIFF_URL__ = '${geotiffUri}';`
    );
    html = html.replace(
      /window\.__TIFF_WASM_GLUE_URL__ = window\.__TIFF_WASM_GLUE_URL__ \|\| 'media\/wasm\/tiff_wasm\.js';/,
      `window.__TIFF_WASM_GLUE_URL__ = '${tiffWasmGlueUri}';`
    );
    html = html.replace(
      /window\.__TIFF_WASM_URL__ = window\.__TIFF_WASM_URL__ \|\| 'media\/wasm\/tiff_wasm_bg\.wasm';/,
      `window.__TIFF_WASM_URL__ = '${tiffWasmBinaryUri}';`
    );
    // Add the nonce to the inline bootstrap script that sets __TIFF_WASM_URL__.
    html = html.replace(
      /<script>\s*\n\s*\/\/ Default WASM binary location/,
      `<script nonce="${nonce}">\n      // Default WASM binary location`
    );
    html = html.replace(/src="bundle\.js"/, `nonce="${nonce}" src="${scriptUri}"`);

    // 3. Remove browser-specific elements (file input, navigation links)
    // Note: Theme selector is now handled by JS (checking isVSCode) rather than removing HTML
    html = html.replace(
      /<input[^>]*id="hiddenFileInput"[^>]*>/,
      '<!-- File input removed in VSCode -->'
    );
    html = html.replace(/<div class="bottom-right-nav">[\s\S]*?<\/div>/, '');

    return html;
  }

  private async handleSequenceRequestFile(
    webviewPanel: vscode.WebviewPanel,
    message: { path: string; index: number; requestId?: string }
  ): Promise<void> {
    const fileUri = vscode.Uri.file(message.path);
    const fileName = path.basename(fileUri.fsPath);
    const ext = path.extname(fileUri.fsPath).toLowerCase();
    try {
      if (ext === '.ply') {
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        const parser = new PlyParser();
        const isBinary = isPlyBinary(bytes);
        if (isBinary) {
          const header = await parser.parseHeaderOnly(bytes);
          header.headerInfo.fileName = fileName;
          // Mirror original transfer semantics to avoid DataView bounds issues
          const binaryVertexData = bytes.slice(header.binaryDataStart);
          const rawBinaryData = binaryVertexData.buffer.slice(
            binaryVertexData.byteOffset,
            binaryVertexData.byteOffset + binaryVertexData.byteLength
          );
          webviewPanel.webview.postMessage({
            type: 'sequence:file:ultimate',
            index: message.index,
            requestId: message.requestId,
            fileName: fileName,
            rawBinaryData,
            vertexCount: header.headerInfo.vertexCount,
            faceCount: header.headerInfo.faceCount,
            hasColors: header.headerInfo.hasColors,
            hasNormals: header.headerInfo.hasNormals,
            hasIntensity: header.headerInfo.hasIntensity,
            format: header.headerInfo.format,
            comments: header.headerInfo.comments,
            vertexStride: header.vertexStride,
            propertyOffsets: Array.from(header.propertyOffsets.entries()),
            littleEndian: header.headerInfo.format === 'binary_little_endian',
            faceCountType: header.faceCountType,
            faceIndexType: header.faceIndexType,
          });
        } else {
          const parsed = await parser.parse(bytes);
          webviewPanel.webview.postMessage({
            type: 'sequence:file:ply',
            index: message.index,
            requestId: message.requestId,
            fileName,
            data: parsed,
          });
        }
        return;
      }
      if (ext === '.xyz') {
        const xyz = await vscode.workspace.fs.readFile(fileUri);
        webviewPanel.webview.postMessage({
          type: 'sequence:file:xyz',
          index: message.index,
          requestId: message.requestId,
          fileName,
          data: xyz.buffer.slice(xyz.byteOffset, xyz.byteOffset + xyz.byteLength),
        });
        return;
      }
      if (ext === '.obj') {
        const objBytes = await vscode.workspace.fs.readFile(fileUri);
        const objParser = new ObjParser();
        const parsed = await objParser.parse(objBytes);
        webviewPanel.webview.postMessage({
          type: 'sequence:file:obj',
          index: message.index,
          requestId: message.requestId,
          fileName,
          data: parsed,
        });
        return;
      }
      if (ext === '.stl') {
        const stlBytes = await vscode.workspace.fs.readFile(fileUri);
        const stlParser = new StlParser();
        const parsed = await stlParser.parse(stlBytes);
        webviewPanel.webview.postMessage({
          type: 'sequence:file:stl',
          index: message.index,
          requestId: message.requestId,
          fileName,
          data: parsed,
        });
        return;
      }
      if (ext === '.pcd') {
        const pcdBytes = await vscode.workspace.fs.readFile(fileUri);
        const pcdParser = new PcdParser();
        const parsed = await pcdParser.parse(pcdBytes);
        webviewPanel.webview.postMessage({
          type: 'sequence:file:pcd',
          index: message.index,
          requestId: message.requestId,
          fileName,
          data: parsed,
        });
        return;
      }
      if (ext === '.pts') {
        const ptsBytes = await vscode.workspace.fs.readFile(fileUri);
        const ptsParser = new PtsParser();
        const parsed = await ptsParser.parse(ptsBytes);
        webviewPanel.webview.postMessage({
          type: 'sequence:file:pts',
          index: message.index,
          requestId: message.requestId,
          fileName,
          data: parsed,
        });
        return;
      }
      if (ext === '.off') {
        const offBytes = await vscode.workspace.fs.readFile(fileUri);
        const offParser = new OffParser();
        const parsed = await offParser.parse(offBytes);
        webviewPanel.webview.postMessage({
          type: 'sequence:file:off',
          index: message.index,
          requestId: message.requestId,
          fileName,
          data: parsed,
        });
        return;
      }
      if (ext === '.gltf' || ext === '.glb') {
        const gltfBytes = await vscode.workspace.fs.readFile(fileUri);
        const gltfParser = new GltfParser();
        const parsed = await gltfParser.parse(gltfBytes);
        webviewPanel.webview.postMessage({
          type: 'sequence:file:gltf',
          index: message.index,
          requestId: message.requestId,
          fileName,
          data: parsed,
        });
        return;
      }
      if (ext === '.xyzn' || ext === '.xyzrgb') {
        const xyzBytes = await vscode.workspace.fs.readFile(fileUri);
        webviewPanel.webview.postMessage({
          type: 'sequence:file:xyzvariant',
          index: message.index,
          requestId: message.requestId,
          fileName,
          data: xyzBytes.buffer.slice(
            xyzBytes.byteOffset,
            xyzBytes.byteOffset + xyzBytes.byteLength
          ),
          variant: ext.substring(1),
        });
        return;
      }
      if (
        ext === '.tif' ||
        ext === '.tiff' ||
        ext === '.pfm' ||
        ext === '.npy' ||
        ext === '.npz' ||
        ext === '.png' ||
        ext === '.exr'
      ) {
        const depthBytes = await vscode.workspace.fs.readFile(fileUri);
        webviewPanel.webview.postMessage({
          type: 'sequence:file:depth',
          index: message.index,
          requestId: message.requestId,
          fileName,
          data: depthBytes.buffer.slice(
            depthBytes.byteOffset,
            depthBytes.byteOffset + depthBytes.byteLength
          ),
        });
        return;
      }
      webviewPanel.webview.postMessage({
        type: 'sequence:file:error',
        index: message.index,
        requestId: message.requestId,
        fileName,
        error: `Unsupported file type: ${ext}`,
      });
    } catch (err) {
      webviewPanel.webview.postMessage({
        type: 'sequence:file:error',
        index: message.index,
        requestId: message.requestId,
        fileName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Fallback for transfer-via-fetch: the webview couldn't fetch the file
   * directly, so resend the vertex bytes over postMessage (the original path).
   * Uses the retained header + bytes when available, otherwise re-reads.
   */
  private async handlePlyFetchFallback(message: any): Promise<void> {
    const key = message.docUri as string;
    this.logPerf(`⏱️ PERF[ply/ext] fetch fallback → postMessage for ${message.fileName || key}`);
    try {
      const uri = vscode.Uri.parse(key);
      const panel = this.pathToPanel.get(uri.fsPath);
      if (!panel) {
        return;
      }
      // Re-read and reparse from the URI, then resend over the proven path.
      const bytes = await vscode.workspace.fs.readFile(uri);
      const parser = new PlyParser();
      const headerResult = await parser.parseHeaderOnly(bytes);
      const parsedData = headerResult.headerInfo;
      parsedData.fileName = path.basename(uri.fsPath);
      parsedData.shortPath = this.getShortPath(uri.fsPath);
      parsedData.fileIndex = 0;
      await sendUltimateRawBinary(
        panel,
        parsedData,
        headerResult,
        bytes,
        message.messageType || 'multiSpatialData',
        this.logPerf.bind(this)
      );
    } catch (error) {
      console.error('PLY fetch fallback failed:', error);
    }
  }

  private async handleSaveSpatialFile(
    webviewPanel: vscode.WebviewPanel,
    message: any
  ): Promise<void> {
    try {
      console.log(`📁 Handling PLY save request for: ${message.defaultFileName}`);

      // Show save dialog
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(message.defaultFileName),
        filters: {
          'PLY Files': ['ply'],
          'All Files': ['*'],
        },
      });

      if (saveUri) {
        // User selected a location, write the file
        const plyContent = Buffer.from(message.content, 'utf8');
        await vscode.workspace.fs.writeFile(saveUri, plyContent);

        // Send success response back to webview
        webviewPanel.webview.postMessage({
          type: 'savePlyFileResult',
          success: true,
          filePath: saveUri.fsPath,
          fileIndex: message.fileIndex,
        });

        // Show success message to user
        vscode.window.showInformationMessage(
          `PLY file saved successfully: ${path.basename(saveUri.fsPath)}`
        );
        console.log(
          `💾 Saving PLY file to: ${saveUri.fsPath}\n✅ PLY file saved successfully: ${saveUri.fsPath}`
        );
      } else {
        // User cancelled the save dialog
        console.log('🚫 User cancelled PLY save dialog');
        webviewPanel.webview.postMessage({
          type: 'savePlyFileResult',
          success: false,
          cancelled: true,
          fileIndex: message.fileIndex,
        });
      }
    } catch (error) {
      console.error('❌ Error saving PLY file:', error);

      // Send error response back to webview
      webviewPanel.webview.postMessage({
        type: 'savePlyFileResult',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fileIndex: message.fileIndex,
      });

      // Show error message to user
      vscode.window.showErrorMessage(
        `Failed to save PLY file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleSaveScreenshot(message: any): Promise<void> {
    try {
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(message.defaultFileName),
        filters: {
          'PNG Images': ['png'],
          'All Files': ['*'],
        },
      });
      if (!saveUri) {
        return;
      }
      await vscode.workspace.fs.writeFile(saveUri, Buffer.from(message.dataBase64, 'base64'));
      vscode.window.showInformationMessage(`Screenshot saved: ${path.basename(saveUri.fsPath)}`);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save screenshot: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleSelectColorImage(
    webviewPanel: vscode.WebviewPanel,
    message: any
  ): Promise<void> {
    try {
      console.log(`📁 Handling color image selection for file index: ${message.fileIndex}`);

      // Get current file directory for default location
      const currentFilePath = this.panelToPath.get(webviewPanel);
      const defaultUri = currentFilePath
        ? vscode.Uri.file(path.dirname(currentFilePath))
        : undefined;

      // Show open dialog for color images
      const files = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          'Image Files': ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tif', 'tiff'],
          'All Files': ['*'],
        },
        title: 'Select color image file',
        defaultUri: defaultUri,
      });

      if (files && files.length > 0) {
        const selectedFile = files[0];
        // Read the file data
        const fileData = await vscode.workspace.fs.readFile(selectedFile);
        const fileName = path.basename(selectedFile.fsPath);
        const fileExtension = path.extname(selectedFile.fsPath).toLowerCase();

        // Determine MIME type
        let mimeType = 'application/octet-stream';
        switch (fileExtension) {
          case '.png':
            mimeType = 'image/png';
            break;
          case '.jpg':
          case '.jpeg':
            mimeType = 'image/jpeg';
            break;
          case '.bmp':
            mimeType = 'image/bmp';
            break;
          case '.gif':
            mimeType = 'image/gif';
            break;
          case '.tif':
          case '.tiff':
            mimeType = 'image/tiff';
            break;
        }

        // Send file data back to webview
        webviewPanel.webview.postMessage({
          type: 'colorImageData',
          fileIndex: message.fileIndex,
          data: fileData.buffer.slice(
            fileData.byteOffset,
            fileData.byteOffset + fileData.byteLength
          ),
          fileName: fileName,
          mimeType: mimeType,
        });

        console.log(
          `📷 Selected color image: ${selectedFile.fsPath}\n✅ Color image data sent to webview: ${fileName}`
        );
      } else {
        console.log('🚫 User cancelled color image selection');
        // Optionally send cancellation message to webview
      }
    } catch (error) {
      console.error('❌ Error selecting color image:', error);
      vscode.window.showErrorMessage(
        `Failed to select color image: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleRequestDatasetTexture(
    webviewPanel: vscode.WebviewPanel,
    message: any
  ): Promise<void> {
    try {
      console.log(`🖼️ Loading dataset texture: ${message.texturePath} for ${message.sceneName}`);

      // Read the texture file
      const textureUri = vscode.Uri.file(message.texturePath);
      const textureData = await vscode.workspace.fs.readFile(textureUri);
      const fileName = path.basename(message.texturePath);

      // Send texture data to webview
      webviewPanel.webview.postMessage({
        type: 'datasetTexture',
        fileName: fileName,
        sceneName: message.sceneName,
        data: textureData.buffer.slice(
          textureData.byteOffset,
          textureData.byteOffset + textureData.byteLength
        ),
      });

      console.log(`✅ Dataset texture loaded: ${fileName} for ${message.sceneName}`);
    } catch (error) {
      console.error('❌ Error loading dataset texture:', error);
      vscode.window.showErrorMessage(
        `Failed to load dataset texture: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Helper function to load calibration file programmatically (no dialog)
  private async loadCalibrationFileAutomatically(
    webviewPanel: vscode.WebviewPanel,
    calibPath: string,
    fileIndex: number
  ): Promise<void> {
    try {
      console.log(`📁 Auto-loading calibration file: ${calibPath}`);

      // Read the calibration file data
      const fileData = await vscode.workspace.fs.readFile(vscode.Uri.file(calibPath));
      const fileName = path.basename(calibPath);
      const fileContent = Buffer.from(fileData).toString('utf-8');

      // Send calibration file data to webview (same format as manual selection)
      webviewPanel.webview.postMessage({
        type: 'calibrationFileSelected',
        fileIndex: fileIndex,
        fileName: fileName,
        content: fileContent,
      });

      console.log(`✅ Auto-loaded calibration file: ${fileName} for file index ${fileIndex}`);
    } catch (error) {
      console.error('❌ Error auto-loading calibration file:', error);
      throw error;
    }
  }

  // Helper function to load color image programmatically (no dialog)
  private async loadColorImageAutomatically(
    webviewPanel: vscode.WebviewPanel,
    imagePath: string,
    fileIndex: number
  ): Promise<void> {
    try {
      console.log(`📷 Auto-loading color image: ${imagePath}`);

      // Read the image file data
      const fileData = await vscode.workspace.fs.readFile(vscode.Uri.file(imagePath));
      const fileName = path.basename(imagePath);

      // Determine MIME type based on extension
      const ext = path.extname(fileName).toLowerCase();
      let mimeType = 'image/png';
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg';
          break;
        case '.png':
          mimeType = 'image/png';
          break;
        case '.gif':
          mimeType = 'image/gif';
          break;
        case '.tif':
        case '.tiff':
          mimeType = 'image/tiff';
          break;
      }

      // Send image data to webview (same format as manual selection)
      webviewPanel.webview.postMessage({
        type: 'colorImageData',
        fileIndex: fileIndex,
        data: fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength),
        fileName: fileName,
        mimeType: mimeType,
      });

      console.log(`✅ Auto-loaded color image: ${fileName} for file index ${fileIndex}`);
    } catch (error) {
      console.error('❌ Error auto-loading color image:', error);
      throw error;
    }
  }

  private async handleLoadMtl(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
    try {
      // Get current file directory for default location
      const currentFilePath = this.panelToPath.get(webviewPanel);
      const defaultUri = currentFilePath
        ? vscode.Uri.file(path.dirname(currentFilePath))
        : undefined;

      // Show file picker for MTL files
      const files = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          'MTL Material Files': ['mtl'],
        },
        title: 'Select MTL material file',
        defaultUri: defaultUri,
      });

      if (files && files.length > 0) {
        const mtlFile = files[0];
        // Read and parse MTL file
        const mtlData = await vscode.workspace.fs.readFile(mtlFile);
        const mtlParser = new MtlParser();
        const parsedMtl = await mtlParser.parse(mtlData);

        // Convert Map to plain object for serialization
        const materialsObj: { [key: string]: any } = {};
        if (parsedMtl.materials) {
          parsedMtl.materials.forEach((material, name) => {
            materialsObj[name] = material;
          });
        }

        const serializedMtl = {
          materials: materialsObj,
          materialCount: parsedMtl.materials ? parsedMtl.materials.size : 0,
          fileName: parsedMtl.fileName,
        };

        // Send MTL data to webview
        webviewPanel.webview.postMessage({
          type: 'mtlData',
          fileIndex: message.fileIndex,
          fileName: path.basename(mtlFile.fsPath),
          data: serializedMtl,
        });

        console.log(
          `Loading MTL file: ${mtlFile.fsPath}\nMTL file ${path.basename(mtlFile.fsPath)} sent to webview for file index ${message.fileIndex}`
        );
      }
    } catch (error) {
      console.error('Error loading MTL file:', error);
      vscode.window.showErrorMessage(
        `Failed to load MTL file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async tryAutoLoadMtl(
    webviewPanel: vscode.WebviewPanel,
    objUri: vscode.Uri,
    parsedData: any,
    fileIndex: number
  ): Promise<void> {
    try {
      const objDir = path.dirname(objUri.fsPath);
      const objBaseName = path.basename(objUri.fsPath, '.obj');
      let mtlPath: string | null = null;

      // 1. First try: MTL file explicitly referenced in OBJ
      if (parsedData.materialFile) {
        const referencedMtlPath = path.join(objDir, parsedData.materialFile);
        try {
          const mtlUri = vscode.Uri.file(referencedMtlPath);
          await vscode.workspace.fs.stat(mtlUri); // Check if file exists
          mtlPath = referencedMtlPath;
          console.log(`🎨 Auto-loading referenced MTL: ${parsedData.materialFile}`);
        } catch {
          // Referenced MTL file doesn't exist, will try same-name fallback
        }
      }

      // 2. Second try: Same-name MTL file (fallback)
      if (!mtlPath) {
        const sameNameMtlPath = path.join(objDir, `${objBaseName}.mtl`);
        try {
          const mtlUri = vscode.Uri.file(sameNameMtlPath);
          await vscode.workspace.fs.stat(mtlUri); // Check if file exists
          mtlPath = sameNameMtlPath;
          console.log(`🎨 Auto-loading same-name MTL: ${objBaseName}.mtl`);
        } catch {
          // Same-name MTL file doesn't exist either
        }
      }

      // 3. Load MTL file if found
      if (mtlPath) {
        const mtlUri = vscode.Uri.file(mtlPath);
        const mtlData = await vscode.workspace.fs.readFile(mtlUri);
        const mtlParser = new MtlParser();
        const parsedMtl = await mtlParser.parse(mtlData);

        // Convert Map to plain object for serialization
        const materialsObj: { [key: string]: any } = {};
        if (parsedMtl.materials) {
          parsedMtl.materials.forEach((material, name) => {
            materialsObj[name] = material;
          });
        }

        const serializedMtl = {
          materials: materialsObj,
          materialCount: parsedMtl.materials ? parsedMtl.materials.size : 0,
          fileName: parsedMtl.fileName,
        };

        // Send MTL data to webview
        webviewPanel.webview.postMessage({
          type: 'mtlData',
          fileIndex: fileIndex,
          fileName: path.basename(mtlPath),
          data: serializedMtl,
          autoLoaded: true, // Flag to indicate this was auto-loaded
        });

        console.log(
          `✅ Auto-loaded MTL: ${path.basename(mtlPath)} for ${path.basename(objUri.fsPath)}`
        );
      }
    } catch (error) {
      // Silently fail - no error messages for auto-loading as requested
      console.log(`ℹ️ No MTL file found for ${path.basename(objUri.fsPath)}`);
    }
  }

  private async handleSaveDefaultDepthSettings(message: any): Promise<void> {
    try {
      // Save default settings to extension global state
      await this.context.globalState.update('defaultDepthSettings', message.settings);
      console.log('Saved default depth settings to global state:', message.settings);
    } catch (error) {
      console.error('Failed to save default depth settings:', error);
    }
  }

  private async handleRequestDefaultDepthSettings(
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    try {
      // Load default settings from extension global state
      const savedSettings = this.context.globalState.get('defaultDepthSettings') as any;

      // Filter out cx/cy from saved settings as they should be auto-calculated per image
      const filteredSettings = savedSettings
        ? {
            fx: savedSettings.fx || 1000,
            fy: savedSettings.fy,
            cameraModel: savedSettings.cameraModel,
            depthType: savedSettings.depthType,
            baseline: savedSettings.baseline,
            convention: savedSettings.convention,
            pngScaleFactor: savedSettings.pngScaleFactor,
            // Explicitly exclude cx and cy
          }
        : {
            fx: 1000,
            fy: undefined,
            cameraModel: 'pinhole-ideal',
            depthType: 'euclidean',
            convention: 'opengl',
          };

      const viewConvention = this.context.globalState.get('defaultCameraConvention') as
        | string
        | undefined;

      // Send settings back to webview
      webviewPanel.webview.postMessage({
        type: 'defaultDepthSettings',
        settings: filteredSettings,
        viewConvention,
      });

      console.log(
        'Sent default depth settings to webview:',
        filteredSettings,
        'viewConvention:',
        viewConvention
      );
    } catch (error) {
      console.error('Failed to load default depth settings:', error);
      // Send default fallback settings
      webviewPanel.webview.postMessage({
        type: 'defaultDepthSettings',
        settings: {
          fx: 1000,
          fy: undefined,
          cameraModel: 'pinhole-ideal',
          depthType: 'euclidean',
          convention: 'opengl',
        },
      });
    }
  }

  private async handleSelectCalibrationFile(
    webviewPanel: vscode.WebviewPanel,
    message: any
  ): Promise<void> {
    try {
      console.log(`📁 Handling calibration file selection for file index: ${message.fileIndex}`);

      // Get current file directory for default location
      const currentFilePath = this.panelToPath.get(webviewPanel);
      const defaultUri = currentFilePath
        ? vscode.Uri.file(path.dirname(currentFilePath))
        : undefined;

      // Show open dialog for calibration files
      const files = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          'Calibration Files': ['json', 'yaml', 'yml', 'xml', 'txt', 'ini'],
          'All Files': ['*'],
        },
        title: 'Select calibration file',
        defaultUri: defaultUri,
      });

      if (files && files.length > 0) {
        const selectedFile = files[0];

        // Read the file data
        const fileData = await vscode.workspace.fs.readFile(selectedFile);
        const fileName = path.basename(selectedFile.fsPath);
        const fileContent = Buffer.from(fileData).toString('utf-8');

        // Send calibration file data to webview
        webviewPanel.webview.postMessage({
          type: 'calibrationFileSelected',
          fileIndex: message.fileIndex,
          fileName: fileName,
          content: fileContent,
        });

        console.log(
          `📄 Selected calibration file: ${selectedFile.fsPath}\n✅ Calibration file ${fileName} sent to webview for file index ${message.fileIndex}`
        );
      }
    } catch (error) {
      console.error('Error selecting calibration file:', error);
      vscode.window.showErrorMessage(
        `Failed to select calibration file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

class SpatialDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}

  dispose(): void {
    // Clean up document resources
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
