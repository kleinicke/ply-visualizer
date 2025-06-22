import * as vscode from 'vscode';
import { PlyEditorProvider } from './plyEditorProvider';

export function activate(context: vscode.ExtensionContext) {
    // Register the PLY editor provider
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'plyViewer.plyEditor',
            new PlyEditorProvider(context),
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        )
    );

    // Register command for opening PLY files
    context.subscriptions.push(
        vscode.commands.registerCommand('plyViewer.openFile', (uri: vscode.Uri) => {
            vscode.commands.executeCommand('vscode.openWith', uri, 'plyViewer.plyEditor');
        })
    );

    // Register command for opening multiple PLY files
    context.subscriptions.push(
        vscode.commands.registerCommand('plyViewer.openMultipleFiles', async () => {
            const files = await vscode.window.showOpenDialog({
                canSelectMany: true,
                filters: {
                    'PLY Files': ['ply']
                },
                title: 'Select PLY files to compare'
            });

            if (files && files.length > 0) {
                // Create a new webview panel for multi-file viewing
                const panel = vscode.window.createWebviewPanel(
                    'plyMultiViewer',
                    `PLY Multi-Viewer (${files.length} files)`,
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        localResourceRoots: [
                            vscode.Uri.joinPath(context.extensionUri, 'media'),
                            vscode.Uri.joinPath(context.extensionUri, 'out', 'webview')
                        ]
                    }
                );

                const provider = new PlyEditorProvider(context);
                await (provider as any).setupMultiViewer(panel, files);
            }
        })
    );

    console.log('PLY Visualizer extension is now active!');
}

export function deactivate() {
    console.log('PLY Visualizer extension is now deactivated!');
} 