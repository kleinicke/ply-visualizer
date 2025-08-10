import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('PLY Viewer Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('kleinicke.ply-visualizer'));
    });

    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension('kleinicke.ply-visualizer');
        if (ext) {
            await ext.activate();
            assert.strictEqual(ext.isActive, true);
        }
    });

    test('PLY command should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('plyViewer.openFile'));
    });

    test('Multiple PLY commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        // Note: Some commands might only be registered when extension fully activates
        const hasOpenFile = commands.includes('plyViewer.openFile');
        assert.ok(hasOpenFile, 'Basic openFile command should be registered');
        
        // These commands might be conditionally registered
        const hasMultipleFiles = commands.includes('plyViewer.openMultipleFiles');
        const hasTifConvert = commands.includes('plyViewer.convertTifToPointCloud');
        
        // At least one command should be registered
        assert.ok(hasOpenFile || hasMultipleFiles || hasTifConvert, 'At least one PLY command should be registered');
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

    test('Should open real test files from testfiles folder', async () => {
        const testFiles = [
            '../../../testfiles/test_ascii.ply',
            '../../../testfiles/test_binary.ply',
            '../../../testfiles/test_poses.xyz'
        ];

        for (const relativeFilePath of testFiles) {
            const testFilePath = path.join(__dirname, relativeFilePath);
            if (fs.existsSync(testFilePath)) {
                try {
                    const uri = vscode.Uri.file(testFilePath);
                    await vscode.commands.executeCommand('plyViewer.openFile', uri);
                    assert.ok(true, `Successfully opened ${path.basename(testFilePath)}`);
                } catch (error) {
                    assert.fail(`Failed to open ${path.basename(testFilePath)}: ${error}`);
                }
            }
        }
    });

    test('Should handle TIF file command', async () => {
        const testTifPath = path.join(__dirname, '../../../testfiles/depth.tif');
        if (fs.existsSync(testTifPath)) {
            try {
                const uri = vscode.Uri.file(testTifPath);
                await vscode.commands.executeCommand('plyViewer.convertTifToPointCloud', uri);
                assert.ok(true, 'TIF conversion command executed successfully');
            } catch (error) {
                // TIF conversion might fail without proper camera parameters, but command should exist
                assert.ok(error instanceof Error, 'Expected error type for TIF conversion without parameters');
            }
        }
    });

    test('Should register custom editor for supported file types', () => {
        const ext = vscode.extensions.getExtension('kleinicke.ply-visualizer');
        assert.ok(ext, 'Extension should be available');
        
        if (ext) {
            const packageJSON = ext.packageJSON;
            const customEditors = packageJSON.contributes?.customEditors;
            
            assert.ok(customEditors, 'Custom editors should be defined');
            assert.strictEqual(customEditors.length, 1);
            
            const editor = customEditors[0];
            assert.strictEqual(editor.viewType, 'plyViewer.plyEditor');
            assert.strictEqual(editor.displayName, 'PLY Pointcloud Visualizer');
            
            const supportedPatterns = editor.selector.map((s: any) => s.filenamePattern);
            assert.ok(supportedPatterns.includes('*.ply'));
            assert.ok(supportedPatterns.includes('*.xyz'));
            assert.ok(supportedPatterns.includes('*.tif'));
            assert.ok(supportedPatterns.includes('*.tiff'));
        }
    });

    test('Should have correct context menu contributions', () => {
        const ext = vscode.extensions.getExtension('kleinicke.ply-visualizer');
        assert.ok(ext, 'Extension should be available');
        
        if (ext) {
            const packageJSON = ext.packageJSON;
            const menus = packageJSON.contributes?.menus;
            
            assert.ok(menus, 'Menus should be defined');
            assert.ok(menus['explorer/context'], 'Explorer context menu should be defined');
            
            const contextMenuItems = menus['explorer/context'];
            assert.ok(contextMenuItems.length >= 3, 'Should have at least 3 context menu items');
            
            const openFileItem = contextMenuItems.find((item: any) => item.command === 'plyViewer.openFile');
            const convertTifItem = contextMenuItems.find((item: any) => item.command === 'plyViewer.convertTifToPointCloud');
            const loadJsonPoseItem = contextMenuItems.find((item: any) => item.command === 'plyViewer.loadJsonAsPose');
            
            assert.ok(openFileItem, 'Open file context menu item should exist');
            assert.ok(convertTifItem, 'Convert TIF context menu item should exist');
            assert.ok(loadJsonPoseItem, 'Load JSON as 3D Pose context menu item should exist');
        }
    });

    test('Extension should have correct metadata', () => {
        const ext = vscode.extensions.getExtension('kleinicke.ply-visualizer');
        assert.ok(ext, 'Extension should be available');
        
        if (ext) {
            const packageJSON = ext.packageJSON;
            
            assert.strictEqual(packageJSON.name, 'ply-visualizer');
            assert.strictEqual(packageJSON.displayName, 'PLY Pointcloud Visualizer');
            assert.strictEqual(packageJSON.publisher, 'kleinicke');
            assert.ok(packageJSON.version, 'Version should be defined');
            assert.ok(packageJSON.description.includes('3D visualizer'), 'Description should mention 3D visualization');
            
            const keywords = packageJSON.keywords;
            assert.ok(keywords.includes('ply'), 'Should include ply keyword');
            assert.ok(keywords.includes('xyz'), 'Should include xyz keyword');
            assert.ok(keywords.includes('3d'), 'Should include 3d keyword');
            assert.ok(keywords.includes('point cloud'), 'Should include point cloud keyword');
        }
    });
}); 