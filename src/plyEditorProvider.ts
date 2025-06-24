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

            // Send as array to start multi-file mode immediately
            webviewPanel.webview.postMessage({
                type: 'multiPlyData',
                data: [parsedData]
            });
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
                webviewPanel.webview.postMessage({
                    type: 'addFiles',
                    data: newPlyData
                });
            }
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