import * as vscode from 'vscode';
import * as path from 'path';
import { PlyParser } from './plyParser';
import { ObjParser } from './objParser';
import { MtlParser } from './mtlParser';
import { StlParser } from './stlParser';
import { PcdParser } from './pcdParser';
import { PtsParser } from './ptsParser';
import { OffParser } from './offParser';
import { GltfParser } from './gltfParser';

export class PointCloudEditorProvider implements vscode.CustomReadonlyEditorProvider {
    private static readonly viewType = 'plyViewer.plyEditor';
    private activePanels = new Set<vscode.WebviewPanel>();
    private pathToPanel = new Map<string, vscode.WebviewPanel>();
    private panelToPath = new Map<vscode.WebviewPanel, string>();

    constructor(private readonly context: vscode.ExtensionContext) {}

    public async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        token: vscode.CancellationToken
    ): Promise<PlyDocument> {
        return new PlyDocument(uri);
    }

    public async resolveCustomEditor(
        document: PlyDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        this.activePanels.add(webviewPanel);
        this.pathToPanel.set(document.uri.fsPath, webviewPanel);
        this.panelToPath.set(webviewPanel, document.uri.fsPath);
        webviewPanel.onDidDispose(() => {
            this.activePanels.delete(webviewPanel);
            this.pathToPanel.delete(document.uri.fsPath);
            this.panelToPath.delete(webviewPanel);
        });
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview')
            ]
        };

        // Check file type
        const filePath = document.uri.fsPath.toLowerCase();
        const isTifFile = filePath.endsWith('.tif') || filePath.endsWith('.tiff');
        const isPfmFile = filePath.endsWith('.pfm');
        const isNpyFile = filePath.endsWith('.npy') || filePath.endsWith('.npz');
        const isPngFile = filePath.endsWith('.png');
        const isExrFile = filePath.endsWith('.exr');
        const isDepthFile = isTifFile || isPfmFile || isNpyFile || isPngFile || isExrFile;
        const isObjFile = filePath.endsWith('.obj');
        const isStlFile = filePath.endsWith('.stl');
        const isPcdFile = filePath.endsWith('.pcd');
        const isPtsFile = filePath.endsWith('.pts');
        const isOffFile = filePath.endsWith('.off');
        const isGltfFile = filePath.endsWith('.gltf') || filePath.endsWith('.glb');
        const isXyzVariant = filePath.endsWith('.xyzn') || filePath.endsWith('.xyzrgb');
        const isJsonFile = filePath.endsWith('.json');
        
        // Show UI immediately before any file processing
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        
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
            isXyzVariant: isXyzVariant
        });

        // Proactively send default depth settings before any depth processing
        // to ensure the webview uses the latest saved defaults during initial conversion
        await this.handleRequestDefaultDepthSettings(webviewPanel);

        // Load and parse file asynchronously (don't await - let UI show first)
        setImmediate(async () => {
            try {
                const loadStartTime = performance.now();
                const wallStart = new Date().toISOString();
                
                if (isDepthFile) {
                    // Handle depth files (TIF, PFM, NPY, NPZ, PNG, EXR) for point cloud conversion
                    const fileType = isPfmFile ? 'PFM' : isNpyFile ? 'NPY' : isPngFile ? 'PNG' : isExrFile ? 'EXR' : 'TIF';
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `🚀 Extension: Starting ${fileType} file processing for depth conversion...`,
                        timestamp: loadStartTime
                    });
                    
                    // Read depth file and send for webview processing
                    const depthData = await vscode.workspace.fs.readFile(document.uri);
                    const fileReadTime = performance.now();
                    webviewPanel.webview.postMessage({ type: 'timing', phase: 'read', kind: 'depth', ms: +(fileReadTime - loadStartTime).toFixed(1) });
                    
                    // Send depth data to webview for conversion
                    webviewPanel.webview.postMessage({
                        type: 'depthData',
                        fileName: path.basename(document.uri.fsPath),
                        data: depthData.buffer.slice(depthData.byteOffset, depthData.byteOffset + depthData.byteLength)
                    });
                    
                    return; // Exit early for depth files
                }

                if (isObjFile) {
                    // Handle OBJ file
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: '🚀 Extension: Starting OBJ file processing...',
                        timestamp: loadStartTime
                    });
                    
                    const objData = await vscode.workspace.fs.readFile(document.uri);
                    const fileReadTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `📁 Extension: OBJ file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
                        timestamp: fileReadTime
                    });
                    
                    const objParser = new ObjParser();
                    const timingCallback = (message: string) => {
                        webviewPanel.webview.postMessage({
                            type: 'timingUpdate',
                            message: message,
                            timestamp: performance.now()
                        });
                    };
                    
                    const parsedData = await objParser.parse(objData, timingCallback);
                    const parseTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `🎯 Extension: OBJ parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
                        timestamp: parseTime
                    });
                    
                    // Send parsed OBJ data to webview
                    webviewPanel.webview.postMessage({
                        type: 'objData',
                        fileName: path.basename(document.uri.fsPath),
                        data: parsedData
                    });
                    
                    // Try to auto-load MTL file
                    await this.tryAutoLoadMtl(webviewPanel, document.uri, parsedData, 0);
                    
                    return; // Exit early for OBJ files
                }

                if (isStlFile) {
                    // Handle STL file
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: '🚀 Extension: Starting STL file processing...',
                        timestamp: loadStartTime
                    });
                    
                    const stlData = await vscode.workspace.fs.readFile(document.uri);
                    const fileReadTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `📁 Extension: STL file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
                        timestamp: fileReadTime
                    });
                    
                    const stlParser = new StlParser();
                    const timingCallback = (message: string) => {
                        webviewPanel.webview.postMessage({
                            type: 'timingUpdate',
                            message: message,
                            timestamp: performance.now()
                        });
                    };
                    
                    const parsedData = await stlParser.parse(stlData, timingCallback);
                    const parseTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `🎯 Extension: STL parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
                        timestamp: parseTime
                    });
                    
                    // Send parsed STL data to webview
                    webviewPanel.webview.postMessage({
                        type: 'stlData',
                        fileName: path.basename(document.uri.fsPath),
                        data: parsedData
                    });
                    
                    return; // Exit early for STL files
                }

                if (isPcdFile) {
                    // Handle PCD file
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: '🚀 Extension: Starting PCD file processing...',
                        timestamp: loadStartTime
                    });
                    
                    const pcdData = await vscode.workspace.fs.readFile(document.uri);
                    const fileReadTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `📁 Extension: PCD file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
                        timestamp: fileReadTime
                    });
                    
                    const pcdParser = new PcdParser();
                    const timingCallback = (message: string) => {
                        webviewPanel.webview.postMessage({
                            type: 'timingUpdate',
                            message: message,
                            timestamp: performance.now()
                        });
                    };
                    
                    const parsedData = await pcdParser.parse(pcdData, timingCallback);
                    const parseTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `🎯 Extension: PCD parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
                        timestamp: parseTime
                    });
                    
                    // Send parsed PCD data to webview
                    webviewPanel.webview.postMessage({
                        type: 'pcdData',
                        fileName: path.basename(document.uri.fsPath),
                        data: parsedData
                    });
                    
                    return; // Exit early for PCD files
                }

                if (isPtsFile) {
                    // Handle PTS file
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: '🚀 Extension: Starting PTS file processing...',
                        timestamp: loadStartTime
                    });
                    
                    const ptsData = await vscode.workspace.fs.readFile(document.uri);
                    const fileReadTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `📁 Extension: PTS file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
                        timestamp: fileReadTime
                    });
                    
                    const ptsParser = new PtsParser();
                    const timingCallback = (message: string) => {
                        webviewPanel.webview.postMessage({
                            type: 'timingUpdate',
                            message: message,
                            timestamp: performance.now()
                        });
                    };
                    
                    const parsedData = await ptsParser.parse(ptsData, timingCallback);
                    const parseTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `🎯 Extension: PTS parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
                        timestamp: parseTime
                    });
                    
                    // Send parsed PTS data to webview
                    webviewPanel.webview.postMessage({
                        type: 'ptsData',
                        fileName: path.basename(document.uri.fsPath),
                        data: parsedData
                    });
                    
                    return; // Exit early for PTS files
                }

                if (isOffFile) {
                    // Handle OFF file
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: '🚀 Extension: Starting OFF file processing...',
                        timestamp: loadStartTime
                    });
                    
                    const offData = await vscode.workspace.fs.readFile(document.uri);
                    const fileReadTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `📁 Extension: OFF file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
                        timestamp: fileReadTime
                    });
                    
                    const offParser = new OffParser();
                    const timingCallback = (message: string) => {
                        webviewPanel.webview.postMessage({
                            type: 'timingUpdate',
                            message: message,
                            timestamp: performance.now()
                        });
                    };
                    
                    const parsedData = await offParser.parse(offData, timingCallback);
                    const parseTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `🎯 Extension: OFF parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
                        timestamp: parseTime
                    });
                    
                    // Send parsed OFF data to webview
                    webviewPanel.webview.postMessage({
                        type: 'offData',
                        fileName: path.basename(document.uri.fsPath),
                        data: parsedData
                    });
                    
                    return; // Exit early for OFF files
                }

                if (isGltfFile) {
                    // Handle GLTF/GLB file
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: '🚀 Extension: Starting GLTF/GLB file processing...',
                        timestamp: loadStartTime
                    });
                    
                    const gltfData = await vscode.workspace.fs.readFile(document.uri);
                    const fileReadTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `📁 Extension: GLTF/GLB file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
                        timestamp: fileReadTime
                    });
                    
                    const gltfParser = new GltfParser();
                    const timingCallback = (message: string) => {
                        webviewPanel.webview.postMessage({
                            type: 'timingUpdate',
                            message: message,
                            timestamp: performance.now()
                        });
                    };
                    
                    const parsedData = await gltfParser.parse(gltfData, timingCallback);
                    const parseTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `🎯 Extension: GLTF/GLB parsing took ${(parseTime - fileReadTime).toFixed(1)}ms`,
                        timestamp: parseTime
                    });
                    
                    // Send parsed GLTF/GLB data to webview
                    webviewPanel.webview.postMessage({
                        type: 'gltfData',
                        fileName: path.basename(document.uri.fsPath),
                        data: parsedData
                    });
                    
                    return; // Exit early for GLTF/GLB files
                }

                if (isXyzVariant) {
                    // Handle XYZN/XYZRGB variants - send to webview for processing
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: '🚀 Extension: Starting XYZ variant file processing...',
                        timestamp: loadStartTime
                    });
                    
                    const xyzData = await vscode.workspace.fs.readFile(document.uri);
                    const fileReadTime = performance.now();
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `📁 Extension: XYZ variant file read took ${(fileReadTime - loadStartTime).toFixed(1)}ms`,
                        timestamp: fileReadTime
                    });
                    
                    // Send XYZ variant data to webview for parsing
                    webviewPanel.webview.postMessage({
                        type: 'xyzVariantData',
                        fileName: path.basename(document.uri.fsPath),
                        data: xyzData.buffer.slice(xyzData.byteOffset, xyzData.byteOffset + xyzData.byteLength),
                        variant: filePath.endsWith('.xyzn') ? 'xyzn' : 'xyzrgb'
                    });
                    
                    return; // Exit early for XYZ variant files
                }

                // Handle JSON pose files
                if (isJsonFile) {
                    try {
                        const jsonBytes = await vscode.workspace.fs.readFile(document.uri);
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
                            fileName: path.basename(document.uri.fsPath),
                            data: parsed
                        });
                        return; // Exit early for JSON pose files
                    } catch (err) {
                        webviewPanel.webview.postMessage({
                            type: 'loadingError',
                            error: err instanceof Error ? err.message : String(err)
                        });
                        return;
                    }
                }

                // Send timing updates to webview for visibility
                webviewPanel.webview.postMessage({ type: 'timing', phase: 'start', kind: 'ply', at: wallStart });
                
                const plyData = await vscode.workspace.fs.readFile(document.uri);
                const fileReadTime = performance.now();
                webviewPanel.webview.postMessage({ type: 'timing', phase: 'read', kind: 'ply', ms: +(fileReadTime - loadStartTime).toFixed(1) });
                
                const parser = new PlyParser();
                webviewPanel.webview.postMessage({
                    type: 'timingUpdate',
                    message: '🚀 Extension: ULTIMATE - Starting header-only parsing...',
                    timestamp: performance.now()
                });
                
                // Create timing callback that forwards to webview
                const timingCallback = (message: string) => {
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: message,
                        timestamp: performance.now()
                    });
                };
                
                // Detect format first
                const decoder = new TextDecoder('utf-8');
                const headerPreview = decoder.decode(plyData.slice(0, 1024));
                const isBinary = headerPreview.includes('binary_little_endian') || headerPreview.includes('binary_big_endian');
                
                if (isBinary) {
                    // Binary PLY - use ULTIMATE parsing
                    const headerResult = await parser.parseHeaderOnly(plyData, timingCallback);
                    const parsedData = headerResult.headerInfo;
                    const parseTime = performance.now();
                    webviewPanel.webview.postMessage({ type: 'timing', phase: 'parse', kind: 'ply', format: parsedData.format, ms: +(parseTime - fileReadTime).toFixed(1) });
                    
                    // Add file info
                    parsedData.fileName = path.basename(document.uri.fsPath);
                    parsedData.fileIndex = 0;

                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: '🚀 Extension: Starting binary data conversion...',
                        timestamp: performance.now()
                    });

                    // ULTIMATE: Send raw binary data for webview-side parsing
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: '🚀 Extension: ULTIMATE - Sending raw binary data...',
                        timestamp: performance.now()
                    });
                    
                    // Send raw binary data + header info
                    // Extra logging to aid debugging face offsets/types
                    // Log face types once for debugging
                    // concise header info for debugging (once)
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: `Header face types: count=${headerResult.faceCountType || 'n/a'}, index=${headerResult.faceIndexType || 'n/a'}`,
                        timestamp: performance.now()
                    });
                    await this.sendUltimateRawBinary(webviewPanel, parsedData, headerResult, plyData, 'multiPlyData');
                } else {
                    // ASCII PLY - use traditional parsing
                    console.log(`📝 ASCII PLY detected: ${path.basename(document.uri.fsPath)} - using traditional parsing`);
                    const parsedData = await parser.parse(plyData, timingCallback);
                    const parseTime = performance.now();
                    webviewPanel.webview.postMessage({ type: 'timing', phase: 'parse', kind: 'ply', format: parsedData.format, ms: +(parseTime - fileReadTime).toFixed(1) });
                    
                    // Add file info
                    parsedData.fileName = path.basename(document.uri.fsPath);
                    parsedData.fileIndex = 0;

                    // Send via traditional method (will use binary transfer if possible)
                    await this.sendPlyDataToWebview(webviewPanel, [parsedData], 'multiPlyData');
                }
                const totalTime = performance.now();
                webviewPanel.webview.postMessage({ type: 'timing', phase: 'total', kind: 'ply', ms: +(totalTime - loadStartTime).toFixed(1), at: new Date().toISOString() });
            } catch (error) {
                console.error(`Extension: PLY processing failed:`, error);
                webviewPanel.webview.postMessage({
                    type: 'loadingError',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        });

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'error':
                        vscode.window.showErrorMessage(message.message);
                        break;
                    case 'info':
                        vscode.window.showInformationMessage(message.message);
                        break;
                    case 'addFile':
                        await this.handleAddFile(webviewPanel);
                        break;
                    case 'removeFile':
                        webviewPanel.webview.postMessage({
                            type: 'fileRemoved',
                            fileIndex: message.fileIndex
                        });
                        break;
                    case 'requestCameraParams':
                        // Request camera parameters for TIF conversion
                        await this.handleCameraParametersRequest(webviewPanel, message);
                        break;
                    case 'requestCameraParamsWithScale':
                        // Request camera parameters with scale factor for PNG conversion
                        await this.handleCameraParametersWithScaleRequest(webviewPanel, message);
                        break;
                    case 'savePlyFile':
                        // Handle PLY file save request
                        await this.handleSavePlyFile(webviewPanel, message);
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
                        await this.handleAddFileFromPath(webviewPanel, message.path as string);
                        break;
                }
            }
        );
    }

    // Start sequence playback in current active webview with background loading hint
    public startSequence(filePaths: string[], wildcard: string): void {
        for (const panel of this.activePanels) {
            panel.webview.postMessage({
                type: 'sequence:init',
                files: filePaths,
                wildcard: wildcard
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
        // Get the local path to bundled webview script
        const scriptPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'main.js');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        const stylePathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'style.css');
        const styleUri = webview.asWebviewUri(stylePathOnDisk);

        // Add GeoTIFF library for TIF support
        const geotiffPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'geotiff.min.js');
        const geotiffUri = webview.asWebviewUri(geotiffPathOnDisk).toString();

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: blob: data:; font-src ${webview.cspSource};">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>PLY Visualizer</title>
            </head>
            <body>
                <div id="loading" class="loading">
                    <div class="spinner"></div>
                    <p>Loading PLY file...</p>
                </div>
                <div id="error" class="error hidden">
                    <div class="error-header">
                        <h3>Error</h3>
                        <button id="error-close" class="error-close-btn" title="Close error message">✕</button>
                    </div>
                    <p id="error-message"></p>
                </div>
                
                <!-- Main UI Panel -->
                <div id="main-ui-panel" class="main-ui-panel">
                    <!-- Tab Navigation -->
                    <div class="tab-navigation">
                        <button class="tab-button active" data-tab="files">Files</button>
                        <button class="tab-button" data-tab="camera">Camera</button>
                        <button class="tab-button" data-tab="controls">Controls</button>
                        <button class="tab-button" data-tab="info">Info</button>
                    </div>
                    
                    <!-- Tab Content -->
                    <div class="tab-content">
                        <!-- Files Tab -->
                        <div id="files-tab" class="tab-panel active">
                            <div class="panel-section">
                                <h4>File Management</h4>
                                <div class="file-controls">
                                    <button id="add-file" class="primary-button">+ Add Point Cloud</button>
                                </div>
                                <div id="file-list"></div>
                            </div>
                        </div>
                        
                        <!-- Camera Tab -->
                        <div id="camera-tab" class="tab-panel">
                            <div class="panel-section">
                                <h4>Camera Settings</h4>
                                <div id="camera-controls-panel"></div>
                            </div>
                        </div>
                        
                        <!-- Controls Tab -->
                        <div id="controls-tab" class="tab-panel">
                            <div class="panel-section">
                                <h4>View Controls</h4>
                                <div class="control-buttons">
                                    <button id="fit-camera" class="control-button">Fit to View <span class="button-shortcut">F</span></button>
                                    <button id="reset-camera" class="control-button">Reset Camera <span class="button-shortcut">R</span></button>
                                    <button id="toggle-axes" class="control-button">Toggle Axes <span class="button-shortcut">A</span></button>
                                    <button id="toggle-cameras" class="control-button active">Show Cameras</button>
                                    <button id="set-rotation-origin" class="control-button">Set Rotation Center to Origin <span class="button-shortcut">W</span></button>
                                </div>
                            </div>
                            <div class="panel-section">
                                <h4>Camera Conventions</h4>
                                <div class="control-buttons camera-conventions">
                                    <button id="opencv-convention" class="control-button">OpenCV (Y down) <span class="button-shortcut">C</span></button>
                                    <button id="opengl-convention" class="control-button">OpenGL (Y up) <span class="button-shortcut">B</span></button>
                                </div>
                            </div>
                            <div class="panel-section">
                                <h4>Control Type</h4>
                                <div class="control-buttons">
                                    <button id="trackball-controls" class="control-button">Trackball <span class="button-shortcut">T</span></button>
                                    <button id="orbit-controls" class="control-button">Orbit <span class="button-shortcut">O</span></button>
                                    <button id="inverse-trackball-controls" class="control-button">Inverse <span class="button-shortcut">I</span></button>
                                    <button id="arcball-controls" class="control-button">Arcball <span class="button-shortcut">K</span></button>
                                </div>
                            </div>
                            <!-- Arcball settings UI removed per request -->
                            <div class="panel-section">
                                <h4>Color & Lighting</h4>
                                <div class="control-buttons">
                                    <button id="toggle-gamma-correction" class="control-button">Toggle Gamma Correction <span class="button-shortcut">G</span></button>
                                </div>
                                <p class="setting-description">Gamma affects original vertex colors. Unlit PLY ignores scene lights. Choose Normal or Flat lighting for scene illumination.</p>
                                <div class="control-buttons">
                                    <button id="toggle-unlit-ply" class="control-button">Use Unlit PLY (Uniform)</button>
                                    <button id="use-normal-lighting" class="control-button">Use Normal Lighting</button>
                                    <button id="use-flat-lighting" class="control-button">Use Flat Lighting</button>
                                </div>
                                <p class="setting-description">Shading options are only effecting PLY files with faces.</p>
                            </div>
                        </div>
                        
                        <!-- Info Tab -->
                        <div id="info-tab" class="tab-panel">
                            <div class="panel-section">
                                <h4>Statistics</h4>
                                <div id="file-stats"></div>
                            </div>
                            <div class="panel-section">
                                <h4>Keyboard Shortcuts</h4>
                                <div class="shortcuts-list">
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">Double-click</span>
                                        <span class="shortcut-desc">Set rotation center</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">Shift + Click</span>
                                        <span class="shortcut-desc">Solo point cloud</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">Mouse wheel</span>
                                        <span class="shortcut-desc">Zoom</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">Drag</span>
                                        <span class="shortcut-desc">Rotate/Pan</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">F</span>
                                        <span class="shortcut-desc">Fit to view</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">R</span>
                                        <span class="shortcut-desc">Reset camera</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">A</span>
                                        <span class="shortcut-desc">Toggle axes</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">C</span>
                                        <span class="shortcut-desc">OpenCV convention (Y down)</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">B</span>
                                        <span class="shortcut-desc">OpenGL convention (Y up)</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">T</span>
                                        <span class="shortcut-desc">Trackball controls</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">O</span>
                                        <span class="shortcut-desc">Orbit controls</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">I</span>
                                        <span class="shortcut-desc">Inverse trackball</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">X/Y/Z</span>
                                        <span class="shortcut-desc">Set up vector</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">W</span>
                                        <span class="shortcut-desc">Set rotation center to origin</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">G</span>
                                        <span class="shortcut-desc">Toggle gamma correction</span>
                                    </div>
                                    <div class="shortcut-item">
                                        <span class="shortcut-key">H</span>
                                        <span class="shortcut-desc">Show this help</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                
                <!-- Sequence Overlay (hidden by default) -->
                <div id="sequence-overlay" class="sequence-overlay hidden">
                    <div class="seq-row">
                        <input id="seq-wildcard" type="text" readonly placeholder="Wildcard" class="seq-wildcard" />
                        <button id="seq-play" class="seq-btn">▶</button>
                        <button id="seq-pause" class="seq-btn">⏸</button>
                        <button id="seq-stop" class="seq-btn">⏹</button>
                        <button id="seq-prev" class="seq-btn">◀</button>
                        <button id="seq-next" class="seq-btn">▶</button>
                        <input id="seq-slider" type="range" min="0" max="0" value="0" class="seq-slider" />
                        <span id="seq-label" class="seq-label">0 / 0</span>
                    </div>
                </div>

                <div id="viewer-container">
                    <canvas id="three-canvas"></canvas>
                </div>
                
                <script nonce="${nonce}" src="${geotiffUri}"></script>
                <!-- Load bundled webview script with Three.js -->
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private async handleAddFile(webviewPanel: vscode.WebviewPanel): Promise<void> {
        // Get current file directory for default location
        const currentFilePath = this.panelToPath.get(webviewPanel);
        const defaultUri = currentFilePath ? vscode.Uri.file(path.dirname(currentFilePath)) : undefined;
        
        const files = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Point Cloud & Pose Files': ['ply', 'xyz', 'xyzn', 'xyzrgb', 'obj', 'stl', 'pcd', 'pts', 'off', 'gltf', 'glb', 'tif', 'tiff', 'pfm', 'npy', 'npz', 'png', 'exr', 'json'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'PLY Files': ['ply'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'XYZ Files': ['xyz'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'OBJ Files': ['obj'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'STL Files': ['stl'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'PCD Files': ['pcd'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'PTS Files': ['pts'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'OFF Files': ['off'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'GLTF Files': ['gltf', 'glb'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Depth Images': ['tif', 'tiff', 'pfm', 'npy', 'npz', 'png', 'exr'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Pose JSON': ['json']
            },
            title: 'Select point cloud files to add',
            defaultUri: defaultUri
        });

        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                try {
                    const fileStartTime = performance.now();
                    const fileName = path.basename(files[i].fsPath);
                    const fileExtension = path.extname(files[i].fsPath).toLowerCase();
                    console.log(`🚀 ULTIMATE: Processing add file ${fileName} (${fileExtension})`);
                    
                    // Handle different file types
                    if (fileExtension === '.tif' || fileExtension === '.tiff' || fileExtension === '.pfm' || fileExtension === '.npy' || fileExtension === '.npz' || fileExtension === '.png' || fileExtension === '.exr') {
                        // Handle depth files for conversion
                        const depthData = await vscode.workspace.fs.readFile(files[i]);
                        
                        // Send depth data to webview for conversion
                        webviewPanel.webview.postMessage({
                            type: 'depthData',
                            fileName: fileName,
                            data: depthData.buffer.slice(depthData.byteOffset, depthData.byteOffset + depthData.byteLength),
                            isAddFile: true // Flag to indicate this is from "Add Point Cloud"
                        });
                        
                        console.log(`🎯 Depth Add File: ${fileName} sent for processing`);
                        continue;
                    }
                    
                    // Handle PLY files (existing logic)
                    if (fileExtension === '.ply') {
                        // Read file data
                        const plyData = await vscode.workspace.fs.readFile(files[i]);
                        const fileReadTime = performance.now();
                        
                        // Parse file (detect format first)
                        const parser = new PlyParser();
                        
                        // Quick format detection
                        const decoder = new TextDecoder('utf-8');
                        const headerPreview = decoder.decode(plyData.slice(0, 1024));
                        const isBinary = headerPreview.includes('binary_little_endian') || headerPreview.includes('binary_big_endian');
                        
                        if (isBinary) {
                            // Use ultimate binary transfer for binary PLY files
                            const headerResult = await parser.parseHeaderOnly(plyData);
                            const parseTime = performance.now();
                            
                            // Add file info
                            headerResult.headerInfo.fileName = fileName;
                            headerResult.headerInfo.fileIndex = i;
                            
                            // Send ultimate raw binary data
                            await this.sendUltimateRawBinary(
                                webviewPanel, 
                                headerResult.headerInfo, 
                                headerResult, 
                                plyData, 
                                'addFiles'
                            );
                        } else {
                            // Use traditional parsing for ASCII PLY files
                            console.log(`📝 ASCII PLY detected: ${fileName} - using traditional parsing`);
                            const parsedData = await parser.parse(plyData);
                            const parseTime = performance.now();
                            
                            // Add file info
                            parsedData.fileName = fileName;
                            parsedData.fileIndex = i;
                            
                            // Send via traditional method (will use binary transfer if possible)
                            await this.sendPlyDataToWebview(webviewPanel, [parsedData], 'addFiles');
                        }
                        
                        const totalTime = performance.now();
                        console.log(`🎯 ULTIMATE Add PLY File: ${fileName} processed in ${(totalTime - fileStartTime).toFixed(1)}ms`);
                        continue;
                    }
                    
                    // Handle XYZ files
                    if (fileExtension === '.xyz') {
                        const xyzData = await vscode.workspace.fs.readFile(files[i]);
                        
                        // Send XYZ data to webview for parsing
                        webviewPanel.webview.postMessage({
                            type: 'xyzData',
                            fileName: fileName,
                            data: xyzData.buffer.slice(xyzData.byteOffset, xyzData.byteOffset + xyzData.byteLength),
                            isAddFile: true
                        });
                        
                        console.log(`🎯 XYZ Add File: ${fileName} sent for processing`);
                        continue;
                    }
                    
                    // Handle OBJ files
                    if (fileExtension === '.obj') {
                        const objData = await vscode.workspace.fs.readFile(files[i]);
                        const objParser = new ObjParser();
                        const parsedData = await objParser.parse(objData);
                        
                        webviewPanel.webview.postMessage({
                            type: 'objData',
                            fileName: fileName,
                            data: parsedData,
                            isAddFile: true
                        });
                        
                        // Try to auto-load MTL file for added OBJ files
                        await this.tryAutoLoadMtl(webviewPanel, files[i], parsedData, i);
                        
                        console.log(`🎯 OBJ Add File: ${fileName} sent for processing`);
                        continue;
                    }
                    
                    // Handle STL files
                    if (fileExtension === '.stl') {
                        const stlData = await vscode.workspace.fs.readFile(files[i]);
                        const stlParser = new StlParser();
                        const parsedData = await stlParser.parse(stlData);
                        
                        webviewPanel.webview.postMessage({
                            type: 'stlData',
                            fileName: fileName,
                            data: parsedData,
                            isAddFile: true
                        });
                        
                        console.log(`🎯 STL Add File: ${fileName} sent for processing`);
                        continue;
                    }
                    
                    // Handle JSON pose files
                    if (fileExtension === '.json') {
                        try {
                            const jsonBytes = await vscode.workspace.fs.readFile(files[i]);
                            const jsonText = Buffer.from(jsonBytes).toString('utf-8');
                            // Try standard parse first, then sanitize fallback
                            let parsed: any;
                            try {
                                parsed = JSON.parse(jsonText);
                            } catch (e) {
                                const sanitizedText = jsonText
                                    .replace(/\bNaN\b/g, 'null')
                                    .replace(/\bInfinity\b/g, 'null')
                                    .replace(/\b-Infinity\b/g, 'null');
                                parsed = JSON.parse(sanitizedText);
                            }
                            webviewPanel.webview.postMessage({
                                type: 'poseData',
                                fileName: fileName,
                                data: parsed,
                                isAddFile: true
                            });
                            console.log(`🎯 JSON Pose Add File: ${fileName} sent for processing`);
                        } catch (err) {
                            vscode.window.showErrorMessage(`Failed to load JSON pose ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
                        }
                        continue;
                    }

                    // Handle PCD files
                    if (fileExtension === '.pcd') {
                        const pcdData = await vscode.workspace.fs.readFile(files[i]);
                        const pcdParser = new PcdParser();
                        const parsedData = await pcdParser.parse(pcdData);
                        
                        webviewPanel.webview.postMessage({
                            type: 'pcdData',
                            fileName: fileName,
                            data: parsedData,
                            isAddFile: true
                        });
                        
                        console.log(`🎯 PCD Add File: ${fileName} sent for processing`);
                        continue;
                    }

                    // Handle PTS files
                    if (fileExtension === '.pts') {
                        const ptsData = await vscode.workspace.fs.readFile(files[i]);
                        const ptsParser = new PtsParser();
                        const parsedData = await ptsParser.parse(ptsData);
                        
                        webviewPanel.webview.postMessage({
                            type: 'ptsData',
                            fileName: fileName,
                            data: parsedData,
                            isAddFile: true
                        });
                        
                        console.log(`🎯 PTS Add File: ${fileName} sent for processing`);
                        continue;
                    }

                    // Handle OFF files
                    if (fileExtension === '.off') {
                        const offData = await vscode.workspace.fs.readFile(files[i]);
                        const offParser = new OffParser();
                        const parsedData = await offParser.parse(offData);
                        
                        webviewPanel.webview.postMessage({
                            type: 'offData',
                            fileName: fileName,
                            data: parsedData,
                            isAddFile: true
                        });
                        
                        console.log(`🎯 OFF Add File: ${fileName} sent for processing`);
                        continue;
                    }

                    // Handle GLTF/GLB files
                    if (fileExtension === '.gltf' || fileExtension === '.glb') {
                        const gltfData = await vscode.workspace.fs.readFile(files[i]);
                        const gltfParser = new GltfParser();
                        const parsedData = await gltfParser.parse(gltfData);
                        
                        webviewPanel.webview.postMessage({
                            type: 'gltfData',
                            fileName: fileName,
                            data: parsedData,
                            isAddFile: true
                        });
                        
                        console.log(`🎯 GLTF/GLB Add File: ${fileName} sent for processing`);
                        continue;
                    }

                    // Handle XYZN/XYZRGB variants
                    if (fileExtension === '.xyzn' || fileExtension === '.xyzrgb') {
                        const xyzData = await vscode.workspace.fs.readFile(files[i]);
                        
                        webviewPanel.webview.postMessage({
                            type: 'xyzVariantData',
                            fileName: fileName,
                            data: xyzData.buffer.slice(xyzData.byteOffset, xyzData.byteOffset + xyzData.byteLength),
                            variant: fileExtension.substring(1), // Remove the dot
                            isAddFile: true
                        });
                        
                        console.log(`🎯 XYZ Variant Add File: ${fileName} sent for processing`);
                        continue;
                    }

                    // Unsupported file type
                    vscode.window.showWarningMessage(`Unsupported file type: ${fileExtension}. Supported types: .ply, .xyz, .xyzn, .xyzrgb, .obj, .stl, .pcd, .pts, .off, .gltf, .glb, .tif, .tiff, .pfm, .npy, .npz, .png, .exr, .json`);
                    
                } catch (error) {
                    console.error(`Failed to load file ${files[i].fsPath}:`, error);
                    vscode.window.showErrorMessage(`Failed to load file ${files[i].fsPath}: ${error}`);
                }
            }
        }
    }

    private async handleAddFileFromPath(webviewPanel: vscode.WebviewPanel, filePathStr: string): Promise<void> {
        try {
            const fileUri = vscode.Uri.file(filePathStr);
            const fileName = path.basename(fileUri.fsPath);
            const ext = path.extname(fileUri.fsPath).toLowerCase();

            if (ext === '.tif' || ext === '.tiff' || ext === '.pfm' || ext === '.npy' || ext === '.npz' || ext === '.png' || ext === '.exr') {
                const depthData = await vscode.workspace.fs.readFile(fileUri);
                webviewPanel.webview.postMessage({
                    type: 'depthData', fileName, data: depthData.buffer.slice(depthData.byteOffset, depthData.byteOffset + depthData.byteLength), isAddFile: true
                });
                return;
            }
            if (ext === '.ply') {
                const plyData = await vscode.workspace.fs.readFile(fileUri);
                const parser = new PlyParser();
                const decoder = new TextDecoder('utf-8');
                const headerPreview = decoder.decode(plyData.slice(0, 1024));
                const isBinary = headerPreview.includes('binary_little_endian') || headerPreview.includes('binary_big_endian');
                if (isBinary) {
                    const headerResult = await parser.parseHeaderOnly(plyData);
                    headerResult.headerInfo.fileName = fileName;
                    await this.sendUltimateRawBinary(webviewPanel, headerResult.headerInfo, headerResult, plyData, 'addFiles');
                } else {
                    const parsedData = await parser.parse(plyData);
                    parsedData.fileName = fileName;
                    await this.sendPlyDataToWebview(webviewPanel, [parsedData], 'addFiles');
                }
                return;
            }
            if (ext === '.xyz') {
                const xyzData = await vscode.workspace.fs.readFile(fileUri);
                webviewPanel.webview.postMessage({
                    type: 'xyzData', fileName, data: xyzData.buffer.slice(xyzData.byteOffset, xyzData.byteOffset + xyzData.byteLength), isAddFile: true
                });
                return;
            }
            if (ext === '.obj') {
                const objData = await vscode.workspace.fs.readFile(fileUri);
                const objParser = new ObjParser();
                const parsedData = await objParser.parse(objData);
                webviewPanel.webview.postMessage({ type: 'objData', fileName, data: parsedData, isAddFile: true });
                await this.tryAutoLoadMtl(webviewPanel, fileUri, parsedData, 0);
                return;
            }
            if (ext === '.stl') {
                const stlData = await vscode.workspace.fs.readFile(fileUri);
                const stlParser = new StlParser();
                const parsedData = await stlParser.parse(stlData);
                webviewPanel.webview.postMessage({ type: 'stlData', fileName, data: parsedData, isAddFile: true });
                return;
            }
            if (ext === '.pcd') {
                const pcdData = await vscode.workspace.fs.readFile(fileUri);
                const pcdParser = new PcdParser();
                const parsedData = await pcdParser.parse(pcdData);
                webviewPanel.webview.postMessage({ type: 'pcdData', fileName, data: parsedData, isAddFile: true });
                return;
            }
            if (ext === '.pts') {
                const ptsData = await vscode.workspace.fs.readFile(fileUri);
                const ptsParser = new PtsParser();
                const parsedData = await ptsParser.parse(ptsData);
                webviewPanel.webview.postMessage({ type: 'ptsData', fileName, data: parsedData, isAddFile: true });
                return;
            }
            if (ext === '.off') {
                const offData = await vscode.workspace.fs.readFile(fileUri);
                const offParser = new OffParser();
                const parsedData = await offParser.parse(offData);
                webviewPanel.webview.postMessage({ type: 'offData', fileName, data: parsedData, isAddFile: true });
                return;
            }
            if (ext === '.gltf' || ext === '.glb') {
                const gltfData = await vscode.workspace.fs.readFile(fileUri);
                const gltfParser = new GltfParser();
                const parsedData = await gltfParser.parse(gltfData);
                webviewPanel.webview.postMessage({ type: 'gltfData', fileName, data: parsedData, isAddFile: true });
                return;
            }
            if (ext === '.xyzn' || ext === '.xyzrgb') {
                const xyzData = await vscode.workspace.fs.readFile(fileUri);
                webviewPanel.webview.postMessage({
                    type: 'xyzVariantData', fileName, data: xyzData.buffer.slice(xyzData.byteOffset, xyzData.byteOffset + xyzData.byteLength), 
                    variant: ext.substring(1), isAddFile: true
                });
                return;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add file from path: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleSequenceRequestFile(webviewPanel: vscode.WebviewPanel, message: { path: string; index: number; requestId?: string }): Promise<void> {
        const fileUri = vscode.Uri.file(message.path);
        const fileName = path.basename(fileUri.fsPath);
        const ext = path.extname(fileUri.fsPath).toLowerCase();
        try {
            if (ext === '.ply') {
                const bytes = await vscode.workspace.fs.readFile(fileUri);
                const parser = new PlyParser();
                const decoder = new TextDecoder('utf-8');
                const headerPreview = decoder.decode(bytes.slice(0, 1024));
                const isBinary = headerPreview.includes('binary_little_endian') || headerPreview.includes('binary_big_endian');
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
                        format: header.headerInfo.format,
                        comments: header.headerInfo.comments,
                        vertexStride: header.vertexStride,
                        propertyOffsets: Array.from(header.propertyOffsets.entries()),
                        littleEndian: header.headerInfo.format === 'binary_little_endian',
                        faceCountType: header.faceCountType,
                        faceIndexType: header.faceIndexType
                    });
                } else {
                    const parsed = await parser.parse(bytes);
                    webviewPanel.webview.postMessage({ type: 'sequence:file:ply', index: message.index, requestId: message.requestId, fileName, data: parsed });
                }
                return;
            }
            if (ext === '.xyz') {
                const xyz = await vscode.workspace.fs.readFile(fileUri);
                webviewPanel.webview.postMessage({ type: 'sequence:file:xyz', index: message.index, requestId: message.requestId, fileName, data: xyz.buffer.slice(xyz.byteOffset, xyz.byteOffset + xyz.byteLength) });
                return;
            }
            if (ext === '.obj') {
                const objBytes = await vscode.workspace.fs.readFile(fileUri);
                const objParser = new ObjParser();
                const parsed = await objParser.parse(objBytes);
                webviewPanel.webview.postMessage({ type: 'sequence:file:obj', index: message.index, requestId: message.requestId, fileName, data: parsed });
                return;
            }
            if (ext === '.stl') {
                const stlBytes = await vscode.workspace.fs.readFile(fileUri);
                const stlParser = new StlParser();
                const parsed = await stlParser.parse(stlBytes);
                webviewPanel.webview.postMessage({ type: 'sequence:file:stl', index: message.index, requestId: message.requestId, fileName, data: parsed });
                return;
            }
            if (ext === '.pcd') {
                const pcdBytes = await vscode.workspace.fs.readFile(fileUri);
                const pcdParser = new PcdParser();
                const parsed = await pcdParser.parse(pcdBytes);
                webviewPanel.webview.postMessage({ type: 'sequence:file:pcd', index: message.index, requestId: message.requestId, fileName, data: parsed });
                return;
            }
            if (ext === '.pts') {
                const ptsBytes = await vscode.workspace.fs.readFile(fileUri);
                const ptsParser = new PtsParser();
                const parsed = await ptsParser.parse(ptsBytes);
                webviewPanel.webview.postMessage({ type: 'sequence:file:pts', index: message.index, requestId: message.requestId, fileName, data: parsed });
                return;
            }
            if (ext === '.off') {
                const offBytes = await vscode.workspace.fs.readFile(fileUri);
                const offParser = new OffParser();
                const parsed = await offParser.parse(offBytes);
                webviewPanel.webview.postMessage({ type: 'sequence:file:off', index: message.index, requestId: message.requestId, fileName, data: parsed });
                return;
            }
            if (ext === '.gltf' || ext === '.glb') {
                const gltfBytes = await vscode.workspace.fs.readFile(fileUri);
                const gltfParser = new GltfParser();
                const parsed = await gltfParser.parse(gltfBytes);
                webviewPanel.webview.postMessage({ type: 'sequence:file:gltf', index: message.index, requestId: message.requestId, fileName, data: parsed });
                return;
            }
            if (ext === '.xyzn' || ext === '.xyzrgb') {
                const xyzBytes = await vscode.workspace.fs.readFile(fileUri);
                webviewPanel.webview.postMessage({ type: 'sequence:file:xyzvariant', index: message.index, requestId: message.requestId, fileName, data: xyzBytes.buffer.slice(xyzBytes.byteOffset, xyzBytes.byteOffset + xyzBytes.byteLength), variant: ext.substring(1) });
                return;
            }
            if (ext === '.tif' || ext === '.tiff' || ext === '.pfm' || ext === '.npy' || ext === '.npz' || ext === '.png' || ext === '.exr') {
                const depthBytes = await vscode.workspace.fs.readFile(fileUri);
                webviewPanel.webview.postMessage({ type: 'sequence:file:depth', index: message.index, requestId: message.requestId, fileName, data: depthBytes.buffer.slice(depthBytes.byteOffset, depthBytes.byteOffset + depthBytes.byteLength) });
                return;
            }
            webviewPanel.webview.postMessage({ type: 'sequence:file:error', index: message.index, requestId: message.requestId, fileName, error: `Unsupported file type: ${ext}` });
        } catch (err) {
            webviewPanel.webview.postMessage({ type: 'sequence:file:error', index: message.index, requestId: message.requestId, fileName, error: err instanceof Error ? err.message : String(err) });
        }
    }

    private async sendUltimateRawBinary(
        webviewPanel: vscode.WebviewPanel,
        parsedData: any,
        headerResult: any,
        rawFileData: Uint8Array,
        messageType: string
    ): Promise<void> {
        console.log(`🚀 ULTIMATE: Sending raw binary data for ${parsedData.fileName}`);
        
        // Extract just the binary vertex data
        const binaryVertexData = rawFileData.slice(headerResult.binaryDataStart);
        
        // Send raw binary data + parsing metadata
        webviewPanel.webview.postMessage({
            type: 'ultimateRawBinaryData',
            messageType: messageType,
            fileName: parsedData.fileName,
            vertexCount: parsedData.vertexCount,
            faceCount: parsedData.faceCount,
            hasColors: parsedData.hasColors,
            hasNormals: parsedData.hasNormals,
            format: parsedData.format,
            comments: parsedData.comments,
            
            // Raw binary data + parsing info
            rawBinaryData: binaryVertexData.buffer.slice(
                binaryVertexData.byteOffset,
                binaryVertexData.byteOffset + binaryVertexData.byteLength
            ),
            vertexStride: headerResult.vertexStride,
            propertyOffsets: Array.from(headerResult.propertyOffsets.entries()),
            littleEndian: headerResult.headerInfo.format === 'binary_little_endian',
            faceCountType: headerResult.faceCountType,
            faceIndexType: headerResult.faceIndexType
        });
    }

    private async sendPlyDataToWebview(
        webviewPanel: vscode.WebviewPanel, 
        plyDataArray: any[], 
        messageType: string
    ): Promise<void> {
        for (const plyData of plyDataArray) {
            console.log(`🚀 Binary transfer for ${plyData.fileName} (${plyData.vertexCount} vertices)`);
            const startTime = performance.now();
            
            try {
                await this.sendBinaryData(webviewPanel, plyData, messageType);
                const transferTime = performance.now() - startTime;
                console.log(`⚡ Binary transfer complete: ${transferTime.toFixed(1)}ms`);
            } catch (error) {
                console.log(`⚠️ Binary transfer failed for ${plyData.fileName}, falling back to chunking...`);
                await this.sendLargeFileInChunksOptimized(webviewPanel, plyData, messageType);
            }
        }
    }

    private async sendBinaryData(
        webviewPanel: vscode.WebviewPanel,
        plyData: any,
        messageType: string
    ): Promise<void> {
        // Check if we have direct TypedArrays (ultra-fast path)
        const vertexCount = plyData.vertexCount;
        const hasColors = plyData.hasColors;
        const hasNormals = plyData.hasNormals;
        
        let positionBuffer: Float32Array;
        let colorBuffer: Uint8Array | null = null;
        let normalBuffer: Float32Array | null = null;
        
        if (plyData.useTypedArrays) {
            // Ultra-fast: Use TypedArrays directly (zero-copy)
            console.log(`🚀 Using direct TypedArrays for binary transfer - ZERO COPY!`);
            positionBuffer = plyData.positionsArray;
            colorBuffer = plyData.colorsArray;
            normalBuffer = plyData.normalsArray;
        } else {
            // Fallback: Convert vertex objects to TypedArrays
            console.log(`🔄 Converting vertex objects to TypedArrays for binary transfer...`);
            const vertices = plyData.vertices;
            
            // Create typed arrays for vertices (always 3 floats: x, y, z)
            positionBuffer = new Float32Array(vertexCount * 3);
            
            // Optional color buffer (RGB as bytes: 0-255)
            if (hasColors) {
                colorBuffer = new Uint8Array(vertexCount * 3);
            }
            
            // Optional normal buffer (3 floats: nx, ny, nz)
            if (hasNormals) {
                normalBuffer = new Float32Array(vertexCount * 3);
            }
            
            // Fill the buffers
            for (let i = 0; i < vertexCount; i++) {
                const vertex = vertices[i];
                
                // Position (always present)
                positionBuffer[i * 3] = vertex.x;
                positionBuffer[i * 3 + 1] = vertex.y;
                positionBuffer[i * 3 + 2] = vertex.z;
                
                // Colors (if present)
                if (hasColors && colorBuffer) {
                    colorBuffer[i * 3] = vertex.red || 0;
                    colorBuffer[i * 3 + 1] = vertex.green || 0;
                    colorBuffer[i * 3 + 2] = vertex.blue || 0;
                }
                
                // Normals (if present)
                if (hasNormals && normalBuffer) {
                    normalBuffer[i * 3] = vertex.nx || 0;
                    normalBuffer[i * 3 + 1] = vertex.ny || 0;
                    normalBuffer[i * 3 + 2] = vertex.nz || 0;
                }
            }
        }
        
        // Handle faces if present
        let indexBuffer: Uint32Array | null = null;
        if (plyData.faces && plyData.faces.length > 0) {
            const faces = plyData.faces;
            indexBuffer = new Uint32Array(faces.length * 3); // Assuming triangles
            
            for (let i = 0; i < faces.length; i++) {
                const face = faces[i];
                indexBuffer[i * 3] = face.indices[0];
                indexBuffer[i * 3 + 1] = face.indices[1];
                indexBuffer[i * 3 + 2] = face.indices[2];
            }
        }
        
        // Calculate total binary size
        const totalSize = positionBuffer.byteLength + 
                         (colorBuffer ? colorBuffer.byteLength : 0) +
                         (normalBuffer ? normalBuffer.byteLength : 0) +
                         (indexBuffer ? indexBuffer.byteLength : 0);
        
        console.log(`📦 Binary data: ${(totalSize / 1024 / 1024).toFixed(1)}MB (${vertexCount} vertices)`);
        
        // Send metadata + binary buffers
        webviewPanel.webview.postMessage({
            type: 'binaryPlyData',
            messageType: messageType,
            fileName: plyData.fileName,
            vertexCount: vertexCount,
            faceCount: plyData.faceCount,
            hasColors: hasColors,
            hasNormals: hasNormals,
            format: plyData.format,
            comments: plyData.comments,
            // Binary buffers (will be transferred efficiently)
            positionBuffer: positionBuffer.buffer,
            colorBuffer: colorBuffer ? colorBuffer.buffer : null,
            normalBuffer: normalBuffer ? normalBuffer.buffer : null,
            indexBuffer: indexBuffer ? indexBuffer.buffer : null
        });
    }

    private async sendLargeFileInChunksOptimized(
        webviewPanel: vscode.WebviewPanel,
        plyData: any,
        messageType: string
    ): Promise<void> {
        // ULTRA-AGGRESSIVE chunking for maximum transfer speed
        const CHUNK_SIZE = 1000000; // 1M vertices per chunk!
        const totalVertices = plyData.vertexCount;
        const vertices = plyData.vertices;
        const colors = plyData.colors;
        const normals = plyData.normals;
        const faces = plyData.faces;
        
        const totalChunks = Math.ceil(totalVertices / CHUNK_SIZE);
        console.log(`🚀 Ultra-fast chunking: ${plyData.fileName} (${totalVertices} vertices, ${totalChunks} chunks)`);
        
        const startTime = performance.now();
        let firstChunkTime = 0;
        
        // Send start message
        webviewPanel.webview.postMessage({
            type: 'startLargeFile',
            fileName: plyData.fileName,
            totalVertices: totalVertices,
            totalChunks: totalChunks,
            hasColors: plyData.hasColors,
            hasNormals: plyData.hasNormals,
            faces: faces,
            format: plyData.format,
            comments: plyData.comments,
            messageType: messageType
        });

        // Send chunks with minimal overhead
        for (let i = 0; i < totalChunks; i++) {
            const startIdx = i * CHUNK_SIZE;
            const endIdx = Math.min(startIdx + CHUNK_SIZE, totalVertices);
            const chunkSize = endIdx - startIdx;
            
            // Extract chunk data efficiently
            const chunkVertices = vertices.slice(startIdx, endIdx);
            const chunkColors = colors ? colors.slice(startIdx, endIdx) : undefined;
            const chunkNormals = normals ? normals.slice(startIdx, endIdx) : undefined;
            
            webviewPanel.webview.postMessage({
                type: 'largeFileChunk',
                fileName: plyData.fileName,
                chunkIndex: i,
                totalChunks: totalChunks,
                vertices: chunkVertices,
                colors: chunkColors,
                normals: chunkNormals
            });
            
            if (i === 0) {
                firstChunkTime = performance.now();
            }
            
            // Log only every 5th chunk to reduce console spam
            if (i % 5 === 0 || i === totalChunks - 1) {
                console.log(`Chunk ${i + 1}/${totalChunks} (${chunkSize} vertices)`);
            }
        }
        
        // Send completion message
        webviewPanel.webview.postMessage({
            type: 'largeFileComplete',
            fileName: plyData.fileName,
            messageType: messageType
        });
        
        const totalTime = performance.now() - startTime;
        console.log(`⚡ Ultra-fast transfer complete: ${totalTime.toFixed(1)}ms total, ${firstChunkTime ? (firstChunkTime - startTime).toFixed(1) : 0}ms to first chunk`);
    }

    private async handleCameraParametersRequest(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            // Load saved default settings (filter out cx/cy as they should be auto-calculated per image)
            const savedSettings = this.context.globalState.get('defaultDepthSettings') as any;
            const defaults = savedSettings ? {
                fx: savedSettings.fx || 1000,
                fy: savedSettings.fy,
                cameraModel: savedSettings.cameraModel || 'pinhole-ideal',
                depthType: savedSettings.depthType || 'euclidean',
                convention: savedSettings.convention || 'opengl',
                baseline: savedSettings.baseline || 50,
                pngScaleFactor: savedSettings.pngScaleFactor || 1000
                // Explicitly exclude cx and cy
            } : {
                fx: 1000,
                fy: undefined,
                cameraModel: 'pinhole-ideal',
                depthType: 'euclidean',
                convention: 'opengl',
                baseline: 50,
                pngScaleFactor: 1000
            };

            console.log('🎯 Using default settings for camera parameters dialog:', defaults);

            // Show option to use defaults directly or customize
            const useDefaults = await vscode.window.showQuickPick(
                [
                    { 
                        label: '⚡ Use Default Settings', 
                        description: `${defaults.cameraModel}, fx=${defaults.fx}px${defaults.fy ? `, fy=${defaults.fy}px` : ''}, ${defaults.depthType}, ${defaults.convention}${defaults.baseline ? `, baseline=${defaults.baseline}mm` : ''}`, 
                        value: 'defaults' 
                    },
                    { 
                        label: '⚙️ Customize Settings', 
                        description: 'Choose settings manually', 
                        value: 'customize' 
                    }
                ],
                {
                    placeHolder: 'Convert depth image to point cloud',
                    ignoreFocusOut: true
                }
            );

            if (!useDefaults) {
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            if (useDefaults.value === 'defaults') {
                // Use saved defaults without showing additional dialogs
                webviewPanel.webview.postMessage({
                    type: 'cameraParams',
                    cameraModel: defaults.cameraModel,
                    fx: defaults.fx,
                    fy: defaults.fy,
                    depthType: defaults.depthType,
                    baseline: defaults.baseline,
                    convention: defaults.convention,
                    requestId: message.requestId
                });
                return;
            }

            // Show camera model selection dialog
            const cameraModel = await vscode.window.showQuickPick(
                [
                    { 
                        label: 'Pinhole Camera', 
                        description: defaults.cameraModel === 'pinhole-ideal' ? 'Standard perspective projection model (Default)' : 'Standard perspective projection model', 
                        value: 'pinhole-ideal' 
                    },
                    { 
                        label: 'Fisheye Camera', 
                        description: defaults.cameraModel === 'fisheye' ? 'Wide-angle fisheye projection model (Default)' : 'Wide-angle fisheye projection model', 
                        value: 'fisheye' 
                    }
                ],
                {
                    placeHolder: `Select camera model used to capture the depth image (Default: ${defaults.cameraModel})`,
                    ignoreFocusOut: true
                }
            );

            if (!cameraModel) {
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            // Show depth type selection dialog
            const depthType = await vscode.window.showQuickPick(
                [
                    { 
                        label: 'Euclidean Depth', 
                        description: defaults.depthType === 'euclidean' ? 'Metric depth values (distance from camera center) (Default)' : 'Metric depth values (distance from camera center)', 
                        value: 'euclidean' 
                    },
                    { 
                        label: 'Orthogonal Depth', 
                        description: defaults.depthType === 'orthogonal' ? 'Z-buffer depth values (Z-coordinate) (Default)' : 'Z-buffer depth values (Z-coordinate)', 
                        value: 'orthogonal' 
                    },
                    { 
                        label: 'Disparity', 
                        description: defaults.depthType === 'disparity' ? 'Disparity values (requires baseline parameter) (Default)' : 'Disparity values (requires baseline parameter)', 
                        value: 'disparity' 
                    }
                ],
                {
                    placeHolder: `Select the type of depth data in your image (Default: ${defaults.depthType})`,
                    ignoreFocusOut: true
                }
            );

            if (!depthType) {
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            // Show focal length input dialog
            const fxInput = await vscode.window.showInputBox({
                prompt: `Enter fx (focal length x) in pixels (Default: ${defaults.fx})`,
                placeHolder: defaults.fx.toString(),
                value: defaults.fx.toString(),
                validateInput: (value: string) => {
                    const num = parseFloat(value);
                    if (isNaN(num) || num <= 0) {
                        return 'Please enter a valid positive number for fx';
                    }
                    return null;
                },
                ignoreFocusOut: true
            });

            if (!fxInput) {
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            const fx = parseFloat(fxInput);

            // Show fy input dialog (optional)
            const fyInput = await vscode.window.showInputBox({
                prompt: `Enter fy (focal length y) in pixels (Default: same as fx = ${fx})`,
                placeHolder: 'Leave empty to use same as fx',
                value: defaults.fy?.toString() || '',
                validateInput: (value: string) => {
                    if (value.trim() === '') return null; // Empty is OK
                    const num = parseFloat(value);
                    if (isNaN(num) || num <= 0) {
                        return 'Please enter a valid positive number for fy, or leave empty';
                    }
                    return null;
                },
                ignoreFocusOut: true
            });

            if (fyInput === undefined) { // User cancelled
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            const fy = fyInput.trim() === '' ? undefined : parseFloat(fyInput);

            // Show coordinate convention selection dialog
            const convention = await vscode.window.showQuickPick(
                [
                    { 
                        label: 'OpenGL Convention (Y-up, Z-backward)', 
                        description: defaults.convention === 'opengl' ? 'Standard 3D graphics convention (Default)' : 'Standard 3D graphics convention', 
                        value: 'opengl' 
                    },
                    { 
                        label: 'OpenCV Convention (Y-down, Z-forward)', 
                        description: defaults.convention === 'opencv' ? 'Computer vision convention (Default)' : 'Computer vision convention', 
                        value: 'opencv' 
                    }
                ],
                {
                    placeHolder: `Select coordinate convention for the resulting point cloud (Default: ${defaults.convention})`,
                    ignoreFocusOut: true
                }
            );

            if (!convention) {
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            // Show baseline input dialog if disparity is selected
            let baseline: number | undefined;
            if (depthType.value === 'disparity') {
                const defaultBaseline = defaults.baseline || 50;
                const baselineInput = await vscode.window.showInputBox({
                    prompt: `Enter the baseline in millimeters (Default: ${defaultBaseline})`,
                    placeHolder: defaultBaseline.toString(),
                    value: defaultBaseline.toString(),
                    validateInput: (value: string) => {
                        const num = parseFloat(value);
                        if (isNaN(num) || num <= 0) {
                            return 'Please enter a valid positive number for baseline';
                        }
                        return null;
                    },
                    ignoreFocusOut: true
                });

                if (!baselineInput) {
                    webviewPanel.webview.postMessage({
                        type: 'cameraParamsCancelled',
                        requestId: message.requestId
                    });
                    return;
                }

                baseline = parseFloat(baselineInput);
            }

            // Send camera parameters to webview
            webviewPanel.webview.postMessage({
                type: 'cameraParams',
                cameraModel: cameraModel.value,
                fx: fx,
                fy: fy,
                depthType: depthType.value,
                baseline: baseline,
                convention: convention.value,
                requestId: message.requestId
            });

        } catch (error) {
            webviewPanel.webview.postMessage({
                type: 'cameraParamsError',
                error: error instanceof Error ? error.message : String(error),
                requestId: message.requestId
            });
        }
    }

    private async handleCameraParametersWithScaleRequest(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            // Load saved default settings (filter out cx/cy as they should be auto-calculated per image)
            const savedSettings = this.context.globalState.get('defaultDepthSettings') as any;
            const defaults = savedSettings ? {
                fx: savedSettings.fx || 1000,
                fy: savedSettings.fy,
                cameraModel: savedSettings.cameraModel || 'pinhole-ideal',
                depthType: savedSettings.depthType || 'euclidean',
                convention: savedSettings.convention || 'opengl',
                baseline: savedSettings.baseline || 50,
                pngScaleFactor: savedSettings.pngScaleFactor || 1000
                // Explicitly exclude cx and cy
            } : {
                fx: 1000,
                fy: undefined,
                cameraModel: 'pinhole-ideal',
                depthType: 'euclidean',
                convention: 'opengl',
                baseline: 50,
                pngScaleFactor: 1000 // Default for PNG: millimeters to meters
            };

            console.log('🎯 Using default settings for PNG camera parameters dialog:', defaults);

            // Show option to use defaults directly or customize
            const useDefaults = await vscode.window.showQuickPick(
                [
                    { 
                        label: '⚡ Use Default Settings', 
                        description: `${defaults.cameraModel}, fx=${defaults.fx}px${defaults.fy ? `, fy=${defaults.fy}px` : ''}, scale=${defaults.pngScaleFactor} (${defaults.pngScaleFactor === 1000 ? 'mm→m' : defaults.pngScaleFactor === 256 ? 'disp÷256' : 'custom'})`, 
                        value: 'defaults' 
                    },
                    { 
                        label: '⚙️ Customize Settings', 
                        description: 'Choose settings manually', 
                        value: 'customize' 
                    }
                ],
                {
                    placeHolder: 'Convert PNG depth image to point cloud',
                    ignoreFocusOut: true
                }
            );

            if (!useDefaults) {
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            if (useDefaults.value === 'defaults') {
                // Use saved defaults without showing additional dialogs
                webviewPanel.webview.postMessage({
                    type: 'cameraParams',
                    cameraModel: defaults.cameraModel,
                    fx: defaults.fx,
                    fy: defaults.fy,
                    depthType: defaults.depthType,
                    baseline: defaults.baseline,
                    convention: defaults.convention,
                    pngScaleFactor: defaults.pngScaleFactor,
                    requestId: message.requestId
                });
                return;
            }

            // Show camera model selection dialog
            const cameraModel = await vscode.window.showQuickPick(
                [
                    { 
                        label: 'Pinhole Camera', 
                        description: defaults.cameraModel === 'pinhole-ideal' ? 'Standard perspective projection model (Default)' : 'Standard perspective projection model', 
                        value: 'pinhole-ideal' 
                    },
                    { 
                        label: 'Fisheye Camera', 
                        description: defaults.cameraModel === 'fisheye' ? 'Wide-angle fisheye projection model (Default)' : 'Wide-angle fisheye projection model', 
                        value: 'fisheye' 
                    }
                ],
                {
                    placeHolder: `Select camera model used to capture the depth image (Default: ${defaults.cameraModel})`,
                    ignoreFocusOut: true
                }
            );

            if (!cameraModel) {
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            // Show scale factor input dialog
            const pngScaleFactorInput = await vscode.window.showInputBox({
                prompt: `Scale factor: depth/disparity is divided to get applied value in meters/disparities (Default: ${defaults.pngScaleFactor})`,
                placeHolder: `${defaults.pngScaleFactor} (1000 for mm, 256 for disparity, 1 for meters)`,
                value: defaults.pngScaleFactor.toString(),
                validateInput: (value: string) => {
                    const num = parseFloat(value);
                    if (isNaN(num) || num <= 0) {
                        return 'Please enter a valid positive number for scale factor';
                    }
                    return null;
                },
                ignoreFocusOut: true
            });

            if (!pngScaleFactorInput) {
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            const pngScaleFactor = parseFloat(pngScaleFactorInput);

            // Show focal length input dialog
            const fxInput = await vscode.window.showInputBox({
                prompt: `Enter fx (focal length x) in pixels (Default: ${defaults.fx})`,
                placeHolder: defaults.fx.toString(),
                value: defaults.fx.toString(),
                validateInput: (value: string) => {
                    const num = parseFloat(value);
                    if (isNaN(num) || num <= 0) {
                        return 'Please enter a valid positive number for fx';
                    }
                    return null;
                },
                ignoreFocusOut: true
            });

            if (!fxInput) {
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            const fx = parseFloat(fxInput);

            // Show fy input dialog (optional)
            const fyInput = await vscode.window.showInputBox({
                prompt: `Enter fy (focal length y) in pixels (Default: same as fx = ${fx})`,
                placeHolder: 'Leave empty to use same as fx',
                value: defaults.fy?.toString() || '',
                validateInput: (value: string) => {
                    if (value.trim() === '') return null; // Empty is OK
                    const num = parseFloat(value);
                    if (isNaN(num) || num <= 0) {
                        return 'Please enter a valid positive number for fy, or leave empty';
                    }
                    return null;
                },
                ignoreFocusOut: true
            });

            if (fyInput === undefined) { // User cancelled
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            const fy = fyInput.trim() === '' ? undefined : parseFloat(fyInput);

            // Show coordinate convention selection dialog
            const convention = await vscode.window.showQuickPick(
                [
                    { 
                        label: 'OpenGL Convention (Y-up, Z-backward)', 
                        description: defaults.convention === 'opengl' ? 'Standard 3D graphics convention (Default)' : 'Standard 3D graphics convention', 
                        value: 'opengl' 
                    },
                    { 
                        label: 'OpenCV Convention (Y-down, Z-forward)', 
                        description: defaults.convention === 'opencv' ? 'Computer vision convention (Default)' : 'Computer vision convention', 
                        value: 'opencv' 
                    }
                ],
                {
                    placeHolder: `Select coordinate convention for the resulting point cloud (Default: ${defaults.convention})`,
                    ignoreFocusOut: true
                }
            );

            if (!convention) {
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            // Send camera parameters to webview
            webviewPanel.webview.postMessage({
                type: 'cameraParams',
                cameraModel: cameraModel.value,
                fx: fx,
                fy: fy,
                depthType: 'euclidean', // Default for PNG
                pngScaleFactor: pngScaleFactor,
                convention: convention.value,
                requestId: message.requestId
            });

        } catch (error) {
            webviewPanel.webview.postMessage({
                type: 'cameraParamsError',
                error: error instanceof Error ? error.message : String(error),
                requestId: message.requestId
            });
        }
    }

    private async handleSavePlyFile(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            console.log(`📁 Handling PLY save request for: ${message.defaultFileName}`);
            
            // Show save dialog
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(message.defaultFileName),
                filters: {
                    'PLY Files': ['ply'],
                    'All Files': ['*']
                }
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
                    fileIndex: message.fileIndex
                });
                
                // Show success message to user
                vscode.window.showInformationMessage(`PLY file saved successfully: ${path.basename(saveUri.fsPath)}`);
                console.log(`💾 Saving PLY file to: ${saveUri.fsPath}\n✅ PLY file saved successfully: ${saveUri.fsPath}`);
                
            } else {
                // User cancelled the save dialog
                console.log('🚫 User cancelled PLY save dialog');
                webviewPanel.webview.postMessage({
                    type: 'savePlyFileResult',
                    success: false,
                    cancelled: true,
                    fileIndex: message.fileIndex
                });
            }
            
        } catch (error) {
            console.error('❌ Error saving PLY file:', error);
            
            // Send error response back to webview
            webviewPanel.webview.postMessage({
                type: 'savePlyFileResult',
                success: false,
                error: error instanceof Error ? error.message : String(error),
                fileIndex: message.fileIndex
            });
            
            // Show error message to user
            vscode.window.showErrorMessage(`Failed to save PLY file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleSelectColorImage(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            console.log(`📁 Handling color image selection for file index: ${message.fileIndex}`);
            
            // Get current file directory for default location
            const currentFilePath = this.panelToPath.get(webviewPanel);
            const defaultUri = currentFilePath ? vscode.Uri.file(path.dirname(currentFilePath)) : undefined;
            
            // Show open dialog for color images
            const files = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'Image Files': ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tif', 'tiff'],
                    'All Files': ['*']
                },
                title: 'Select color image file',
                defaultUri: defaultUri
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
                    data: fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength),
                    fileName: fileName,
                    mimeType: mimeType
                });
                
                console.log(`📷 Selected color image: ${selectedFile.fsPath}\n✅ Color image data sent to webview: ${fileName}`);
                
            } else {
                console.log('🚫 User cancelled color image selection');
                // Optionally send cancellation message to webview
            }
            
        } catch (error) {
            console.error('❌ Error selecting color image:', error);
            vscode.window.showErrorMessage(`Failed to select color image: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleLoadMtl(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            // Get current file directory for default location
            const currentFilePath = this.panelToPath.get(webviewPanel);
            const defaultUri = currentFilePath ? vscode.Uri.file(path.dirname(currentFilePath)) : undefined;
            
            // Show file picker for MTL files
            const files = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'MTL Material Files': ['mtl']
                },
                title: 'Select MTL material file',
                defaultUri: defaultUri
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
                    fileName: parsedMtl.fileName
                };
                
                // Send MTL data to webview
                webviewPanel.webview.postMessage({
                    type: 'mtlData',
                    fileIndex: message.fileIndex,
                    fileName: path.basename(mtlFile.fsPath),
                    data: serializedMtl
                });
                
                console.log(`Loading MTL file: ${mtlFile.fsPath}\nMTL file ${path.basename(mtlFile.fsPath)} sent to webview for file index ${message.fileIndex}`);
            }
        } catch (error) {
            console.error('Error loading MTL file:', error);
            vscode.window.showErrorMessage(`Failed to load MTL file: ${error instanceof Error ? error.message : String(error)}`);
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
                    fileName: parsedMtl.fileName
                };
                
                // Send MTL data to webview
                webviewPanel.webview.postMessage({
                    type: 'mtlData',
                    fileIndex: fileIndex,
                    fileName: path.basename(mtlPath),
                    data: serializedMtl,
                    autoLoaded: true // Flag to indicate this was auto-loaded
                });
                
                console.log(`✅ Auto-loaded MTL: ${path.basename(mtlPath)} for ${path.basename(objUri.fsPath)}`);
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

    private async handleRequestDefaultDepthSettings(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            // Load default settings from extension global state
            const savedSettings = this.context.globalState.get('defaultDepthSettings') as any;
            
            // Filter out cx/cy from saved settings as they should be auto-calculated per image
            const filteredSettings = savedSettings ? {
                fx: savedSettings.fx || 1000,
                fy: savedSettings.fy,
                cameraModel: savedSettings.cameraModel,
                depthType: savedSettings.depthType,
                baseline: savedSettings.baseline,
                convention: savedSettings.convention,
                pngScaleFactor: savedSettings.pngScaleFactor
                // Explicitly exclude cx and cy
            } : {
                fx: 1000,
                fy: undefined,
                cameraModel: 'pinhole-ideal',
                depthType: 'euclidean',
                convention: 'opengl'
            };
            
            // Send settings back to webview
            webviewPanel.webview.postMessage({
                type: 'defaultDepthSettings',
                settings: filteredSettings
            });
            
            console.log('Sent default depth settings to webview:', filteredSettings);
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
                    convention: 'opengl'
                }
            });
        }
    }

    private async handleSelectCalibrationFile(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            console.log(`📁 Handling calibration file selection for file index: ${message.fileIndex}`);
            
            // Get current file directory for default location
            const currentFilePath = this.panelToPath.get(webviewPanel);
            const defaultUri = currentFilePath ? vscode.Uri.file(path.dirname(currentFilePath)) : undefined;
            
            // Show open dialog for calibration files
            const files = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'Calibration Files': ['json', 'yaml', 'yml', 'xml', 'txt', 'ini'],
                    'All Files': ['*']
                },
                title: 'Select calibration file',
                defaultUri: defaultUri
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
                    content: fileContent
                });
                
                console.log(`📄 Selected calibration file: ${selectedFile.fsPath}\n✅ Calibration file ${fileName} sent to webview for file index ${message.fileIndex}`);
            }
        } catch (error) {
            console.error('Error selecting calibration file:', error);
            vscode.window.showErrorMessage(`Failed to select calibration file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

}

class PlyDocument implements vscode.CustomDocument {
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