import * as vscode from 'vscode';
import * as path from 'path';
import { PlyParser } from './plyParser';
import { ObjParser } from './objParser';
import { MtlParser } from './mtlParser';

export class PlyEditorProvider implements vscode.CustomReadonlyEditorProvider {
    private static readonly viewType = 'plyViewer.plyEditor';

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
        const isDepthImage = isTifFile || filePath.endsWith('.png') || filePath.endsWith('.exr') || filePath.endsWith('.pfm') || filePath.endsWith('.npy') || filePath.endsWith('.npz') || filePath.endsWith('.mat') || filePath.endsWith('.h5');
        const isObjFile = filePath.endsWith('.obj');
        const isJsonFile = filePath.endsWith('.json');
        
        // Show UI immediately before any file processing
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        
                // Send immediate message to show loading state
        webviewPanel.webview.postMessage({
            type: 'startLoading',
            fileName: path.basename(document.uri.fsPath),
                    isTifFile: isTifFile,
            isObjFile: isObjFile
        });

        // Load and parse file asynchronously (don't await - let UI show first)
        setImmediate(async () => {
            try {
                const loadStartTime = performance.now();
                const wallStart = new Date().toISOString();
                
                if (isDepthImage) {
                    // Handle Depth/Disparity files for point cloud conversion
                    webviewPanel.webview.postMessage({
                        type: 'timingUpdate',
                        message: '🚀 Extension: Starting depth file processing for point cloud conversion...',
                        timestamp: loadStartTime
                    });
                    
                    // Read file and send for webview processing
                    const depthData = await vscode.workspace.fs.readFile(document.uri);
                    const fileReadTime = performance.now();
                    webviewPanel.webview.postMessage({ type: 'timing', phase: 'read', kind: 'depth', ms: +(fileReadTime - loadStartTime).toFixed(1) });
                    
                    // Send data to webview for conversion
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
                }
            }
        );
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
        const files = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Point Cloud & Pose Files': ['ply', 'xyz', 'obj', 'tif', 'tiff', 'json'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'PLY Files': ['ply'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'XYZ Files': ['xyz'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'OBJ Wireframes': ['obj'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'TIF Depth Images': ['tif', 'tiff'],
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Pose JSON': ['json']
            },
            title: 'Select point cloud files to add'
        });

        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                try {
                    const fileStartTime = performance.now();
                    const fileName = path.basename(files[i].fsPath);
                    const fileExtension = path.extname(files[i].fsPath).toLowerCase();
                    console.log(`🚀 ULTIMATE: Processing add file ${fileName} (${fileExtension})`);
                    
                    // Handle different file types
                    if (['.tif','.tiff','.png','.exr','.pfm','.npy','.npz','.mat','.h5'].includes(fileExtension)) {
                        const depthData = await vscode.workspace.fs.readFile(files[i]);
                        webviewPanel.webview.postMessage({
                            type: 'depthData',
                            fileName: fileName,
                            data: depthData.buffer.slice(depthData.byteOffset, depthData.byteOffset + depthData.byteLength),
                            isAddFile: true
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

                    // Unsupported file type
                    vscode.window.showWarningMessage(`Unsupported file type: ${fileExtension}. Supported types: .ply, .xyz, .obj, .tif, .tiff, .json`);
                    
                } catch (error) {
                    console.error(`Failed to load file ${files[i].fsPath}:`, error);
                    vscode.window.showErrorMessage(`Failed to load file ${files[i].fsPath}: ${error}`);
                }
            }
        }
    }

    private convertTypedArraysToVertices(parsedData: any): void {
        // Emergency fallback: convert TypedArrays back to vertex objects for chunking
        const positions = parsedData.positionsArray as Float32Array;
        const colors = parsedData.colorsArray as Uint8Array | null;
        const normals = parsedData.normalsArray as Float32Array | null;
        
        parsedData.vertices = new Array(parsedData.vertexCount);
        for (let i = 0; i < parsedData.vertexCount; i++) {
            const i3 = i * 3;
            const vertex: any = {
                x: positions[i3],
                y: positions[i3 + 1],
                z: positions[i3 + 2]
            };
            
            if (colors && parsedData.hasColors) {
                vertex.red = colors[i3];
                vertex.green = colors[i3 + 1];
                vertex.blue = colors[i3 + 2];
            }
            
            if (normals && parsedData.hasNormals) {
                vertex.nx = normals[i3];
                vertex.ny = normals[i3 + 1];
                vertex.nz = normals[i3 + 2];
            }
            
            parsedData.vertices[i] = vertex;
        }
        
        // Clean up TypedArray flags
        delete parsedData.useTypedArrays;
        delete parsedData.positionsArray;
        delete parsedData.colorsArray;
        delete parsedData.normalsArray;
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

    private async sendDirectTypedArrays(
        webviewPanel: vscode.WebviewPanel,
        parsedData: any,
        messageType: string
    ): Promise<void> {
        console.log(`🚀 REVOLUTIONARY: Direct TypedArray streaming for ${parsedData.fileName}`);
        
        // Send TypedArrays directly without any conversion or processing
        webviewPanel.webview.postMessage({
            type: 'directTypedArrayData',
            messageType: messageType,
            fileName: parsedData.fileName,
            vertexCount: parsedData.vertexCount,
            faceCount: parsedData.faceCount,
            hasColors: parsedData.hasColors,
            hasNormals: parsedData.hasNormals,
            format: parsedData.format,
            comments: parsedData.comments,
            
            // Direct TypedArray transfer (ArrayBuffer)
            positionsBuffer: parsedData.positionsArray.buffer,
            colorsBuffer: parsedData.colorsArray ? parsedData.colorsArray.buffer : null,
            normalsBuffer: parsedData.normalsArray ? parsedData.normalsArray.buffer : null,
            
            // Metadata for direct BufferAttribute creation
            useDirectBuffers: true
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

    private estimateJsonSize(plyData: any): number {
        // Rough estimation of JSON size to avoid expensive JSON.stringify
        // Each vertex: ~60 bytes (x,y,z,r,g,b + JSON overhead)
        // Each face: ~30 bytes per face
        const vertexSize = plyData.hasColors ? 60 : 36; // With/without colors
        const faceSize = 30;
        const overhead = 1000; // JSON structure overhead
        
        return (plyData.vertexCount * vertexSize) + 
               (plyData.faceCount * faceSize) + 
               overhead;
    }

    private async tryDirectSend(
        webviewPanel: vscode.WebviewPanel,
        plyData: any,
        messageType: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                webviewPanel.webview.postMessage({
                    type: messageType,
                    data: [plyData]
                });
                // If we get here, the send was successful
                resolve();
            } catch (error) {
                reject(error);
            }
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

    private async sendLargeFileInChunks(
        webviewPanel: vscode.WebviewPanel,
        plyData: any,
        messageType: string
    ): Promise<void> {
        const CHUNK_SIZE = 500000; // 500k vertices per chunk
        const totalVertices = plyData.vertexCount;
        const vertices = plyData.vertices;
        
        // Calculate number of chunks
        const numChunks = Math.ceil(totalVertices / CHUNK_SIZE);
        
        // Send start message
        webviewPanel.webview.postMessage({
            type: 'startLargeFile',
            fileName: plyData.fileName,
            totalVertices: totalVertices,
            totalChunks: numChunks,
            hasColors: plyData.hasColors,
            hasNormals: plyData.hasNormals,
            faces: plyData.faces, // Send faces once
            format: plyData.format,
            comments: plyData.comments
        });

        // Send vertex data in chunks
        for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
            const startVertex = chunkIndex * CHUNK_SIZE;
            const endVertex = Math.min(startVertex + CHUNK_SIZE, totalVertices);
            const chunkVertices = vertices.slice(startVertex, endVertex);
            
            webviewPanel.webview.postMessage({
                type: 'largeFileChunk',
                chunkIndex: chunkIndex,
                totalChunks: numChunks,
                vertices: chunkVertices,
                fileName: plyData.fileName
            });
            
            // No artificial delay - let it run at maximum speed
        }
        
        // Send completion message
        webviewPanel.webview.postMessage({
            type: 'largeFileComplete',
            fileName: plyData.fileName,
            messageType: messageType
        });
    }

    private async handleCameraParametersRequest(webviewPanel: vscode.WebviewPanel, message: any): Promise<void> {
        try {
            // Show camera model selection dialog
            const cameraModel = await vscode.window.showQuickPick(
                [
                    { label: 'Pinhole Camera', description: 'Standard perspective projection model', value: 'pinhole' },
                    { label: 'Fisheye Camera', description: 'Wide-angle fisheye projection model', value: 'fisheye' }
                ],
                {
                    placeHolder: 'Select camera model used to capture the depth image',
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
                    { label: 'Euclidean Depth', description: 'Metric depth values (distance from camera center)', value: 'euclidean' },
                    { label: 'Orthogonal Depth', description: 'Z-buffer depth values (Z-coordinate)', value: 'orthogonal' },
                    { label: 'Disparity', description: 'Disparity values (requires baseline parameter)', value: 'disparity' }
                ],
                {
                    placeHolder: 'Select the type of depth data in your image',
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
            const focalLengthInput = await vscode.window.showInputBox({
                prompt: 'Enter the focal length in pixels (e.g., 1000)',
                placeHolder: '1000',
                validateInput: (value: string) => {
                    const num = parseFloat(value);
                    if (isNaN(num) || num <= 0) {
                        return 'Please enter a valid positive number for focal length';
                    }
                    return null;
                },
                ignoreFocusOut: true
            });

            if (!focalLengthInput) {
                webviewPanel.webview.postMessage({
                    type: 'cameraParamsCancelled',
                    requestId: message.requestId
                });
                return;
            }

            const focalLength = parseFloat(focalLengthInput);

            // Show baseline input dialog if disparity is selected
            let baseline: number | undefined;
            if (depthType.value === 'disparity') {
                const baselineInput = await vscode.window.showInputBox({
                    prompt: 'Enter the baseline in millimeters (e.g., 120.0)',
                    placeHolder: '120.0',
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
                focalLength: focalLength,
                depthType: depthType.value,
                baseline: baseline,
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
                console.log(`💾 Saving PLY file to: ${saveUri.fsPath}`);
                
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
                console.log(`✅ PLY file saved successfully: ${saveUri.fsPath}`);
                
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
            
            // Show open dialog for color images
            const files = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'Image Files': ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tif', 'tiff'],
                    'All Files': ['*']
                },
                title: 'Select color image file'
            });

            if (files && files.length > 0) {
                const selectedFile = files[0];
                console.log(`📷 Selected color image: ${selectedFile.fsPath}`);
                
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
                
                console.log(`✅ Color image data sent to webview: ${fileName}`);
                
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
            // Show file picker for MTL files
            const files = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'MTL Material Files': ['mtl']
                },
                title: 'Select MTL material file'
            });

            if (files && files.length > 0) {
                const mtlFile = files[0];
                console.log(`Loading MTL file: ${mtlFile.fsPath}`);
                
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
                
                console.log(`MTL file ${path.basename(mtlFile.fsPath)} sent to webview for file index ${message.fileIndex}`);
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