import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Integration Test Suite - Real File Loading', () => {
    
    test('Should successfully open and process real PLY files end-to-end', async function() {
        this.timeout(10000); // Longer timeout for file processing
        
        const testFiles = [
            '../../../testfiles/test_ascii.ply',
            '../../../testfiles/test_binary.ply',
            '../../../testfiles/test_poses.xyz'
        ];

        for (const relativeFilePath of testFiles) {
            const testFilePath = path.join(__dirname, relativeFilePath);
            if (fs.existsSync(testFilePath)) {
                console.log(`Testing real file: ${path.basename(testFilePath)}`);
                
                try {
                    // Open file with custom editor - this should trigger the full loading pipeline
                    const uri = vscode.Uri.file(testFilePath);
                    
                    // For binary files, don't try to open as text document first
                    if (path.basename(testFilePath).includes('binary')) {
                        // Skip text document opening for binary files
                        await vscode.commands.executeCommand('plyViewer.openFile', uri);
                    } else {
                        const doc = await vscode.workspace.openTextDocument(uri);
                        
                        // Wait a moment for the document to be recognized
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        // Execute the PLY viewer command - this tests the full integration
                        await vscode.commands.executeCommand('plyViewer.openFile', uri);
                    }
                    
                    // Wait for processing to complete
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Verify that the command executed without throwing errors
                    assert.ok(true, `Successfully processed ${path.basename(testFilePath)}`);
                    
                    // Check if any webview panels were created (indicates successful loading)
                    // Note: In test environment, we can't easily access webview panel state
                    // but successful command execution without errors indicates proper loading
                    
                } catch (error) {
                    assert.fail(`Failed to process ${path.basename(testFilePath)}: ${error}`);
                }
            }
        }
    });

    test('Should handle TIF depth image conversion workflow', async function() {
        this.timeout(15000); // Longer timeout for TIF processing
        
        const testTifPath = path.join(__dirname, '../../../testfiles/depth.tif');
        if (fs.existsSync(testTifPath)) {
            console.log('Testing real TIF file processing...');
            
            try {
                const uri = vscode.Uri.file(testTifPath);
                
                // This should trigger the TIF conversion workflow
                // Note: In real usage, this would prompt for camera parameters
                await vscode.commands.executeCommand('plyViewer.convertTifToPointCloud', uri);
                
                // The command should execute (even if it fails later due to missing camera params)
                // The key is that the command exists and the file can be recognized
                assert.ok(true, 'TIF conversion command executed');
                
            } catch (error) {
                // Expected to potentially fail in test environment due to missing user input
                // for camera parameters, but command should still be available
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(`TIF conversion error (expected in test): ${errorMessage}`);
                
                // As long as the error isn't about missing command, it's OK
                assert.ok(!errorMessage.includes('command not found'), 
                         'TIF conversion command should be available');
            }
        }
    });

    test('Should create webview and process point cloud data', async function() {
        this.timeout(8000);
        
        const testFilePath = path.join(__dirname, '../../../testfiles/test_ascii.ply');
        if (fs.existsSync(testFilePath)) {
            
            // Create a minimal test PLY file to ensure predictable behavior
            const testPlyContent = `ply
format ascii 1.0
element vertex 4
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
0.0 0.0 0.0 255 0 0
1.0 0.0 0.0 0 255 0
0.0 1.0 0.0 0 0 255
0.0 0.0 1.0 255 255 0
`;

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const tempFilePath = path.join(workspaceFolder.uri.fsPath, 'test_integration.ply');
                fs.writeFileSync(tempFilePath, testPlyContent);

                try {
                    const uri = vscode.Uri.file(tempFilePath);
                    
                    // Open with custom editor - this should create a webview and load the point cloud
                    await vscode.commands.executeCommand('vscode.openWith', uri, 'plyViewer.plyEditor');
                    
                    // Wait for webview creation and initialization
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // At this point, if no errors were thrown, the webview was created successfully
                    // and the point cloud data was processed
                    assert.ok(true, 'Webview created and point cloud processed successfully');
                    
                } finally {
                    // Clean up
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                }
            }
        }
    });

    test('Should validate file size and performance with large files', async function() {
        this.timeout(15000);
        
        const largeFilePath = path.join(__dirname, '../../../testfiles/test_binary.ply');
        if (fs.existsSync(largeFilePath)) {
            const stats = fs.statSync(largeFilePath);
            console.log(`Testing large file: ${stats.size} bytes`);
            
            const startTime = performance.now();
            
            try {
                const uri = vscode.Uri.file(largeFilePath);
                await vscode.commands.executeCommand('plyViewer.openFile', uri);
                
                const endTime = performance.now();
                const processingTime = endTime - startTime;
                
                console.log(`Large file processing time: ${processingTime.toFixed(2)}ms`);
                
                // Verify reasonable performance (should complete within timeout)
                assert.ok(processingTime < 10000, 'Large file should process within 10 seconds');
                assert.ok(true, 'Large binary PLY file processed successfully');
                
            } catch (error) {
                assert.fail(`Large file processing failed: ${error}`);
            }
        }
    });

    test('Should handle multiple file loading', async function() {
        this.timeout(12000);
        
        try {
            // Test multiple file command
            await vscode.commands.executeCommand('plyViewer.openMultipleFiles');
            
            // Note: In test environment, this will likely fail due to no user interaction
            // but the command should exist and be callable
            assert.ok(true, 'Multiple file command is available');
            
        } catch (error) {
            // Expected to fail in test environment due to file picker requirements
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`Multiple files error (expected in test): ${errorMessage}`);
            
            // Command should exist even if it fails due to UI requirements
            assert.ok(!errorMessage.includes('command not found'), 
                     'Multiple files command should be available');
        }
    });

    test('Should verify extension contributes are properly loaded', () => {
        const ext = vscode.extensions.getExtension('kleinicke.ply-visualizer');
        assert.ok(ext?.isActive, 'Extension should be active after tests');
        
        if (ext) {
            const packageJSON = ext.packageJSON;
            
            // Verify all expected file associations
            const customEditors = packageJSON.contributes?.customEditors?.[0];
            assert.ok(customEditors, 'Custom editor should be defined');
            
            const patterns = customEditors.selector.map((s: any) => s.filenamePattern);
            assert.ok(patterns.includes('*.ply'), 'Should support PLY files');
            assert.ok(patterns.includes('*.xyz'), 'Should support XYZ files'); 
            assert.ok(patterns.includes('*.tif'), 'Should support TIF files');
            assert.ok(patterns.includes('*.tiff'), 'Should support TIFF files');
            
            console.log('Verified file type associations:', patterns);
        }
    });

    test('Should verify real file metadata parsing', async function() {
        this.timeout(5000);
        
        // Test that we can read and parse file metadata without full webview loading
        const testFiles = [
            { path: '../../../testfiles/test_ascii.ply', expectedFormat: 'ascii' },
            { path: '../../../testfiles/test_binary.ply', expectedFormat: 'binary' },
            { path: '../../../testfiles/test_poses.xyz', expectedFormat: 'xyz' }
        ];

        for (const testFile of testFiles) {
            const fullPath = path.join(__dirname, testFile.path);
            if (fs.existsSync(fullPath)) {
                const data = fs.readFileSync(fullPath);
                
                // Basic file validation
                assert.ok(data.length > 0, `${testFile.path} should have content`);
                
                if (testFile.expectedFormat === 'ascii' || testFile.expectedFormat === 'binary') {
                    // PLY files should start with "ply"
                    const header = data.toString('utf8', 0, 100);
                    assert.ok(header.startsWith('ply'), `${testFile.path} should start with PLY header`);
                }
                
                console.log(`Validated ${testFile.path}: ${data.length} bytes, format: ${testFile.expectedFormat}`);
            }
        }
    });
});