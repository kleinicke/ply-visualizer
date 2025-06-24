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



    console.log('PLY Visualizer extension is now active!');
}

export function deactivate() {
    console.log('PLY Visualizer extension is now deactivated!');
} 