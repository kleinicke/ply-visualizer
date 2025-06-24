import * as vscode from 'vscode';
import * as path from 'path';
import { PlyParser } from './plyParser';

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

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        // Load and parse initial PLY file
        try {
            const plyData = await vscode.workspace.fs.readFile(document.uri);
            const parser = new PlyParser();
            const parsedData = await parser.parse(plyData);
            
            // Add file info
            parsedData.fileName = path.basename(document.uri.fsPath);
            parsedData.fileIndex = 0;

            // Try binary transfer first, fallback to chunking for very large files
            try {
                await this.sendPlyDataToWebview(webviewPanel, [parsedData], 'multiPlyData');
            } catch (transferError) {
                console.log(`Binary transfer failed for initial file, falling back to chunking...`);
                await this.sendLargeFileInChunksOptimized(webviewPanel, parsedData, 'multiPlyData');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load PLY file: ${error}`);
        }

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

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">
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
                    <h3>Error loading PLY file</h3>
                    <p id="error-message"></p>
                </div>
                <div id="info-panel" class="info-panel">
                    <div class="panel-section">
                        <h4>File Management</h4>
                        <div class="file-controls">
                            <button id="add-file" class="primary-button">+ Add PLY File</button>
                        </div>
                        <div id="file-list"></div>
                    </div>
                    
                    <div class="panel-section">
                        <h4>Statistics</h4>
                        <div id="file-stats"></div>
                    </div>
                    
                    <div class="panel-section">
                        <h4>View Controls</h4>
                        <div class="controls">
                            <button id="reset-camera">Reset Camera</button>
                            <button id="toggle-wireframe">Toggle Wireframe</button>
                            <button id="toggle-points">Toggle Points</button>
                            <button id="toggle-axes">Toggle Axes</button>
                            <button id="toggle-all">Toggle All Visibility</button>
                        </div>
                    </div>
                </div>
                <div id="viewer-container">
                    <canvas id="three-canvas"></canvas>
                </div>
                
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
                'PLY Files': ['ply']
            },
            title: 'Select PLY files to add'
        });

        if (files && files.length > 0) {
            const newPlyData = [];
            for (let i = 0; i < files.length; i++) {
                try {
                    const plyData = await vscode.workspace.fs.readFile(files[i]);
                    const parser = new PlyParser();
                    const parsedData = await parser.parse(plyData);
                    
                    // Add file info
                    parsedData.fileName = path.basename(files[i].fsPath);
                    parsedData.fileIndex = i; // This will be reassigned in the webview
                    
                    newPlyData.push(parsedData);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to load PLY file ${files[i].fsPath}: ${error}`);
                }
            }

            if (newPlyData.length > 0) {
                await this.sendPlyDataToWebview(webviewPanel, newPlyData, 'addFiles');
            }
        }
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
        // Convert PLY data to binary ArrayBuffers for maximum transfer speed
        const vertices = plyData.vertices;
        const vertexCount = plyData.vertexCount;
        const hasColors = plyData.hasColors;
        const hasNormals = plyData.hasNormals;
        
        // Create typed arrays for vertices (always 3 floats: x, y, z)
        const positionBuffer = new Float32Array(vertexCount * 3);
        let colorBuffer: Uint8Array | null = null;
        let normalBuffer: Float32Array | null = null;
        
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