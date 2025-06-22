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

        // Load and parse PLY file
        try {
            const plyData = await vscode.workspace.fs.readFile(document.uri);
            const parser = new PlyParser();
            const parsedData = await parser.parse(plyData);

            // Send parsed data to webview
            webviewPanel.webview.postMessage({
                type: 'plyData',
                data: parsedData
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load PLY file: ${error}`);
        }

        // Handle messages from webview
        webviewPanel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'error':
                        vscode.window.showErrorMessage(message.message);
                        break;
                    case 'info':
                        vscode.window.showInformationMessage(message.message);
                        break;
                }
            }
        );
    }

    public async setupMultiViewer(panel: vscode.WebviewPanel, files: vscode.Uri[]): Promise<void> {
        panel.webview.html = this.getHtmlForWebview(panel.webview, true);

        // Load and parse all PLY files
        const allPlyData = [];
        for (let i = 0; i < files.length; i++) {
            try {
                const plyData = await vscode.workspace.fs.readFile(files[i]);
                const parser = new PlyParser();
                const parsedData = await parser.parse(plyData);
                
                // Add file info
                parsedData.fileName = path.basename(files[i].fsPath);
                parsedData.fileIndex = i;
                
                allPlyData.push(parsedData);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load PLY file ${files[i].fsPath}: ${error}`);
            }
        }

        // Send all parsed data to webview
        panel.webview.postMessage({
            type: 'multiPlyData',
            data: allPlyData
        });

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'error':
                        vscode.window.showErrorMessage(message.message);
                        break;
                    case 'info':
                        vscode.window.showInformationMessage(message.message);
                        break;
                }
            }
        );
    }

    private getHtmlForWebview(webview: vscode.Webview, isMultiViewer: boolean = false): string {
        // Get the local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        // Get path to Three.js library (copied to media folder)
        const threePathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'three.min.js');
        const threeUri = webview.asWebviewUri(threePathOnDisk);

        // Get path to OrbitControls
        const orbitControlsPathOnDisk = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'three-orbit-controls.js');
        const orbitControlsUri = webview.asWebviewUri(orbitControlsPathOnDisk);

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
                    <h4>${isMultiViewer ? 'Multi-File Information' : 'File Information'}</h4>
                    <div id="file-stats"></div>
                    ${isMultiViewer ? '<div id="file-list"></div>' : ''}
                    <div class="controls">
                        <button id="reset-camera">Reset Camera</button>
                        <button id="toggle-wireframe">Toggle Wireframe</button>
                        <button id="toggle-points">Toggle Points</button>
                        ${isMultiViewer ? '<button id="toggle-all">Toggle All</button>' : ''}
                    </div>
                </div>
                <div id="viewer-container">
                    <canvas id="three-canvas"></canvas>
                </div>
                
                <script nonce="${nonce}">
                    // Check if Three.js loaded successfully
                    console.log('Loading Three.js from: ${threeUri}');
                </script>
                <script nonce="${nonce}" src="${threeUri}" onerror="console.error('Failed to load Three.js from ${threeUri}')"></script>
                <script nonce="${nonce}">
                    // Check if Three.js is available
                    if (typeof THREE === 'undefined') {
                        console.error('THREE is not defined after loading three.js');
                        document.getElementById('loading').classList.add('hidden');
                        document.getElementById('error-message').textContent = 'Failed to load Three.js library. Please check the console for more details.';
                        document.getElementById('error').classList.remove('hidden');
                    } else {
                        console.log('Three.js loaded successfully, version:', THREE.REVISION);
                    }
                </script>
                <script nonce="${nonce}" src="${orbitControlsUri}"></script>
                <script nonce="${nonce}">
                    // Final check before loading main script
                    if (typeof THREE === 'undefined') {
                        console.error('THREE still not defined before loading main script');
                    }
                </script>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
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