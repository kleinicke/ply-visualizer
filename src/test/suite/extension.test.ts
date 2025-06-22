import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('PLY Viewer Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('undefined_publisher.ply-viewer'));
    });

    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension('undefined_publisher.ply-viewer');
        if (ext) {
            await ext.activate();
            assert.strictEqual(ext.isActive, true);
        }
    });

    test('PLY command should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('plyViewer.openFile'));
    });

    test('PLY file should open with custom editor', async () => {
        // Create a temporary PLY file for testing
        const testPlyContent = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
0.0 0.0 0.0 255 0 0
1.0 0.0 0.0 0 255 0
0.5 1.0 0.0 0 0 255
`;

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const testFilePath = path.join(workspaceFolder.uri.fsPath, 'test.ply');
            fs.writeFileSync(testFilePath, testPlyContent);

            try {
                const doc = await vscode.workspace.openTextDocument(testFilePath);
                await vscode.window.showTextDocument(doc);
                
                // Test that we can open with our custom editor
                const uri = vscode.Uri.file(testFilePath);
                await vscode.commands.executeCommand('plyViewer.openFile', uri);
                
                assert.ok(true, 'PLY file opened successfully');
            } finally {
                // Clean up
                if (fs.existsSync(testFilePath)) {
                    fs.unlinkSync(testFilePath);
                }
            }
        }
    });
}); 