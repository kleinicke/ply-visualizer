import * as vscode from 'vscode';
import * as path from 'path';

export class TifConverter {
    private webviewPanel: vscode.WebviewPanel | null = null;

    constructor(private readonly context: vscode.ExtensionContext) {}

    public async convertTifToPointCloud(
        tifUri: vscode.Uri,
        cameraType: 'equidistant' | 'pinhole',
        focalLength: number,
        addToExisting: boolean = false,
        noiseThreshold: number | null = null
    ): Promise<void> {
        try {
            // Create a new webview panel for TIF conversion
            this.webviewPanel = vscode.window.createWebviewPanel(
                'tifConverter',
                `TIF to Point Cloud Converter`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                        vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview')
                    ]
                }
            );

            // Set up the webview HTML
            this.webviewPanel.webview.html = this.getHtmlForWebview(this.webviewPanel.webview);

            // Read the TIF file
            const tifData = await vscode.workspace.fs.readFile(tifUri);
            const fileName = path.basename(tifUri.fsPath);

            // Send the TIF data to the webview for conversion
            this.webviewPanel.webview.postMessage({
                type: 'convertTif',
                tifData: Array.from(tifData), // Convert to regular array for JSON serialization
                fileName: fileName,
                cameraType: cameraType,
                focalLength: focalLength,
                addToExisting: addToExisting,
                noiseThreshold: noiseThreshold
            });

            // Handle messages from the webview
            this.webviewPanel.webview.onDidReceiveMessage(async (message) => {
                switch (message.type) {
                                    case 'conversionComplete':
                    await this.handleConversionComplete(message.pointCloudData, fileName, message.addToExisting || false);
                    break;
                    case 'conversionError':
                        vscode.window.showErrorMessage(`TIF conversion failed: ${message.error}`);
                        break;
                    case 'progress':
                        // Update progress if needed
                        break;
                }
            });

        } catch (error) {
            console.error('TIF conversion error:', error);
            vscode.window.showErrorMessage(
                `Failed to start TIF conversion: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async handleConversionComplete(pointCloudData: any, originalFileName: string, addToExisting: boolean): Promise<void> {
        try {
            if (addToExisting) {
                // Send the point cloud data directly to an existing PLY visualizer
                await this.sendToExistingVisualizer(pointCloudData, originalFileName);
            } else {
                // Create a temporary PLY file and open it
                const tempPlyUri = vscode.Uri.joinPath(
                    vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(''),
                    `${originalFileName.replace(/\.(tif|tiff)$/i, '')}_converted.ply`
                );

                // Convert to PLY format
                const plyContent = this.convertToPlyFormat(pointCloudData);
                await vscode.workspace.fs.writeFile(tempPlyUri, Buffer.from(plyContent, 'utf8'));

                // Open the converted PLY file
                await vscode.commands.executeCommand('vscode.openWith', tempPlyUri, 'plyViewer.plyEditor');
            }

            vscode.window.showInformationMessage(
                `Successfully converted ${originalFileName} to point cloud with ${pointCloudData.vertexCount} vertices!`
            );

            // Close the converter webview
            if (this.webviewPanel) {
                this.webviewPanel.dispose();
                this.webviewPanel = null;
            }

        } catch (error) {
            console.error('Error handling conversion complete:', error);
            vscode.window.showErrorMessage(
                `Failed to save converted point cloud: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    private async sendToExistingVisualizer(pointCloudData: any, originalFileName: string): Promise<void> {
        // Try to find an existing PLY visualizer panel
        const panels = vscode.window.visibleTextEditors.filter(editor => 
            editor.document.uri.scheme === 'plyViewer.plyEditor'
        );

        if (panels.length > 0) {
            // Send the point cloud data to the first available PLY visualizer
            const panel = panels[0];
            // Note: This would require additional message handling in the webview
            // For now, we'll create a new file but with a different naming convention
            const tempPlyUri = vscode.Uri.joinPath(
                vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(''),
                `${originalFileName.replace(/\.(tif|tiff)$/i, '')}_added.ply`
            );

            const plyContent = this.convertToPlyFormat(pointCloudData);
            await vscode.workspace.fs.writeFile(tempPlyUri, Buffer.from(plyContent, 'utf8'));
            
            // Open in the same editor type
            await vscode.commands.executeCommand('vscode.openWith', tempPlyUri, 'plyViewer.plyEditor');
        } else {
            // No existing visualizer, create a new one
            const tempPlyUri = vscode.Uri.joinPath(
                vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(''),
                `${originalFileName.replace(/\.(tif|tiff)$/i, '')}_converted.ply`
            );

            const plyContent = this.convertToPlyFormat(pointCloudData);
            await vscode.workspace.fs.writeFile(tempPlyUri, Buffer.from(plyContent, 'utf8'));
            await vscode.commands.executeCommand('vscode.openWith', tempPlyUri, 'plyViewer.plyEditor');
        }
    }

    private convertToPlyFormat(pointCloudData: any): string {
        let plyContent = `ply
format ascii 1.0
comment Converted from TIF file
comment ${pointCloudData.comments.join('\ncomment ')}

element vertex ${pointCloudData.vertexCount}
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue

element face 0
property list uchar int vertex_indices

end_header
`;

        // Add vertices
        for (const vertex of pointCloudData.vertices) {
            plyContent += `${vertex.x} ${vertex.y} ${vertex.z} ${vertex.red || 128} ${vertex.green || 128} ${vertex.blue || 128}\n`;
        }

        return plyContent;
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        // Get the local path to bundled webview script
        const scriptPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'main.js');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        const stylePathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'style.css');
        const styleUri = webview.asWebviewUri(stylePathOnDisk);

        const geotiffPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'geotiff.min.js');
        const geotiffUri = webview.asWebviewUri(geotiffPathOnDisk);

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>TIF to Point Cloud Converter</title>
            </head>
            <body>
                <div id="loading" class="loading">
                    <div class="spinner"></div>
                    <p>Converting TIF to point cloud...</p>
                    <p id="progress-message">Initializing...</p>
                </div>
                <div id="error" class="error hidden">
                    <h3>Error converting TIF file</h3>
                    <p id="error-message"></p>
                </div>
                <div id="success" class="success hidden">
                    <h3>Conversion Complete!</h3>
                    <p id="success-message"></p>
                </div>
                
                <!-- Required elements for PLY Visualizer initialization -->
                <div id="info-panel" class="info-panel" style="visibility: hidden;">
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
                </div>
                <div id="viewer-container" style="visibility: hidden;">
                    <canvas id="three-canvas"></canvas>
                </div>
                
                <script nonce="${nonce}" src="${geotiffUri}"></script>
                <script nonce="${nonce}" src="${scriptUri}"></script>
                <script nonce="${nonce}">
                    // TIF conversion logic will be handled in the main.js file
                    // This is just a placeholder for the webview structure
                </script>
            </body>
            </html>`;
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