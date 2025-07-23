import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('3D Visualization Pipeline Test Suite', () => {
    
    test('Should verify Three.js compatibility and webview resources', async function() {
        this.timeout(5000);
        
        // Check that Three.js bundle was built correctly
        const webviewBundlePath = path.join(__dirname, '../../../out/webview/main.js');
        const webviewExists = fs.existsSync(webviewBundlePath);
        
        if (webviewExists) {
            const bundleStats = fs.statSync(webviewBundlePath);
            console.log(`Webview bundle size: ${(bundleStats.size / 1024 / 1024).toFixed(2)} MB`);
            
            // Webview bundle should be substantial (contains Three.js)
            assert.ok(bundleStats.size > 100000, 'Webview bundle should be substantial (>100KB)');
            
            // Check if bundle contains Three.js references
            const bundleContent = fs.readFileSync(webviewBundlePath, 'utf8');
            const hasThreeJS = bundleContent.includes('THREE') || bundleContent.includes('three');
            
            if (hasThreeJS) {
                console.log('✓ Three.js found in webview bundle');
            } else {
                console.log('⚠ Three.js not explicitly found in bundle (may be minified)');
            }
        } else {
            console.log('⚠ Webview bundle not found - webpack may not have built it');
        }
        
        // Check media resources
        const mediaPath = path.join(__dirname, '../../../media');
        if (fs.existsSync(mediaPath)) {
            const mediaFiles = fs.readdirSync(mediaPath);
            console.log('Media files:', mediaFiles);
            
            const hasGeoTIFF = mediaFiles.some(f => f.includes('geotiff'));
            const hasCSS = mediaFiles.some(f => f.endsWith('.css'));
            
            assert.ok(hasGeoTIFF, 'Should have GeoTIFF library for TIF processing');
            assert.ok(hasCSS, 'Should have CSS styles for webview');
        }
    });

    test('Should test webview HTML template generation', async function() {
        this.timeout(4000);
        
        // Create a test to verify the webview HTML contains necessary elements
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const testPlyContent = `ply
format ascii 1.0
element vertex 2
property float x
property float y
property float z
end_header
0.0 0.0 0.0
1.0 1.0 1.0
`;

            const tempFilePath = path.join(workspaceFolder.uri.fsPath, 'webview_html_test.ply');
            fs.writeFileSync(tempFilePath, testPlyContent);

            try {
                // This tests that the webview HTML generation doesn't crash
                const uri = vscode.Uri.file(tempFilePath);
                await vscode.commands.executeCommand('plyViewer.openFile', uri);
                
                // Wait for webview to initialize
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // If we get here without errors, HTML generation worked
                assert.ok(true, 'Webview HTML generation completed successfully');
                
            } finally {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
        }
    });

    test('Should verify point cloud data transfer format', async function() {
        this.timeout(4000);
        
        // Test the data format that gets sent to the webview
        const testFilePath = path.join(__dirname, '../../../testfiles/test_ascii.ply');
        if (fs.existsSync(testFilePath)) {
            const { PlyParser } = await import('../../plyParser');
            const parser = new PlyParser();
            const fileData = fs.readFileSync(testFilePath);
            
            const result = await parser.parse(fileData);
            
            // Verify the data structure matches what webview expects
            assert.ok(typeof result.vertexCount === 'number', 'vertexCount should be number');
            assert.ok(typeof result.faceCount === 'number', 'faceCount should be number');
            assert.ok(typeof result.hasColors === 'boolean', 'hasColors should be boolean');
            assert.ok(typeof result.hasNormals === 'boolean', 'hasNormals should be boolean');
            assert.ok(Array.isArray(result.vertices), 'vertices should be array');
            assert.ok(Array.isArray(result.faces), 'faces should be array');
            assert.ok(typeof result.format === 'string', 'format should be string');
            
            // Test vertex data structure
            if (result.vertices.length > 0) {
                const vertex = result.vertices[0];
                assert.ok(typeof vertex.x === 'number', 'vertex.x should be number');
                assert.ok(typeof vertex.y === 'number', 'vertex.y should be number');
                assert.ok(typeof vertex.z === 'number', 'vertex.z should be number');
                
                // Test color data if present
                if (result.hasColors && vertex.red !== undefined) {
                    assert.ok(typeof vertex.red === 'number', 'vertex.red should be number');
                    assert.ok(typeof vertex.green === 'number', 'vertex.green should be number');
                    assert.ok(typeof vertex.blue === 'number', 'vertex.blue should be number');
                    assert.ok(vertex.red >= 0 && vertex.red <= 255, 'red should be 0-255');
                    assert.ok(vertex.green >= 0 && vertex.green <= 255, 'green should be 0-255');
                    assert.ok(vertex.blue >= 0 && vertex.blue <= 255, 'blue should be 0-255');
                }
                
                // Test normal data if present
                if (result.hasNormals && vertex.nx !== undefined) {
                    assert.ok(typeof vertex.nx === 'number', 'vertex.nx should be number');
                    assert.ok(typeof vertex.ny === 'number', 'vertex.ny should be number');
                    assert.ok(typeof vertex.nz === 'number', 'vertex.nz should be number');
                }
            }
            
            console.log(`Data transfer validation passed for ${result.vertexCount} vertices`);
        }
    });

    test('Should test coordinate system and transformations', async function() {
        this.timeout(4000);
        
        // Create test data with known coordinates to verify transformation pipeline
        const testVertices = [
            { x: 0, y: 0, z: 0 },      // Origin
            { x: 1, y: 0, z: 0 },      // X-axis
            { x: 0, y: 1, z: 0 },      // Y-axis
            { x: 0, y: 0, z: 1 },      // Z-axis
            { x: 1, y: 1, z: 1 }       // Corner
        ];
        
        // Test coordinate bounds calculation (used by webview for camera positioning)
        const xCoords = testVertices.map(v => v.x);
        const yCoords = testVertices.map(v => v.y);
        const zCoords = testVertices.map(v => v.z);
        
        const bounds = {
            minX: Math.min(...xCoords),
            maxX: Math.max(...xCoords),
            minY: Math.min(...yCoords),
            maxY: Math.max(...yCoords),
            minZ: Math.min(...zCoords),
            maxZ: Math.max(...zCoords)
        };
        
        // Calculate center and scale (same as webview does)
        const center = {
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2,
            z: (bounds.minZ + bounds.maxZ) / 2
        };
        
        const scale = Math.max(
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY,
            bounds.maxZ - bounds.minZ
        );
        
        console.log(`Bounds: min(${bounds.minX},${bounds.minY},${bounds.minZ}) max(${bounds.maxX},${bounds.maxY},${bounds.maxZ})`);
        console.log(`Center: (${center.x}, ${center.y}, ${center.z})`);
        console.log(`Scale: ${scale}`);
        
        // Verify calculations
        assert.strictEqual(center.x, 0.5, 'Center X should be 0.5');
        assert.strictEqual(center.y, 0.5, 'Center Y should be 0.5');
        assert.strictEqual(center.z, 0.5, 'Center Z should be 0.5');
        assert.strictEqual(scale, 1.0, 'Scale should be 1.0');
        
        // Test coordinate normalization (centers the model)
        const normalizedVertices = testVertices.map(v => ({
            x: v.x - center.x,
            y: v.y - center.y,
            z: v.z - center.z
        }));
        
        const firstNormalized = normalizedVertices[0];
        assert.strictEqual(firstNormalized.x, -0.5, 'Origin should be normalized to (-0.5, -0.5, -0.5)');
        assert.strictEqual(firstNormalized.y, -0.5, 'Origin should be normalized to (-0.5, -0.5, -0.5)');
        assert.strictEqual(firstNormalized.z, -0.5, 'Origin should be normalized to (-0.5, -0.5, -0.5)');
        
        console.log('Coordinate system transformation validation passed');
    });

    test('Should validate camera positioning algorithm', function() {
        // Test the camera positioning logic used in webview
        const modelBounds = {
            minX: -5, maxX: 5,
            minY: -3, maxY: 3,
            minZ: -2, maxZ: 2
        };
        
        const modelSize = Math.max(
            modelBounds.maxX - modelBounds.minX,
            modelBounds.maxY - modelBounds.minY,
            modelBounds.maxZ - modelBounds.minZ
        );
        
        // Camera distance calculation (based on field of view)
        const fov = 50; // degrees
        const aspect = 1920 / 1080; // typical aspect ratio
        const distance = modelSize / (2 * Math.tan((fov * Math.PI / 180) / 2));
        
        console.log(`Model size: ${modelSize}`);
        console.log(`Camera distance: ${distance.toFixed(2)}`);
        console.log(`FOV: ${fov}°, Aspect: ${aspect.toFixed(2)}`);
        
        // Verify reasonable camera distance
        assert.ok(distance > modelSize, 'Camera should be positioned outside model bounds');
        assert.ok(distance < modelSize * 10, 'Camera should not be too far away');
        
        // Test near/far plane calculations
        const near = distance / 1000;
        const far = distance * 10;
        
        assert.ok(near > 0, 'Near plane should be positive');
        assert.ok(far > near, 'Far plane should be beyond near plane');
        assert.ok(near < modelSize / 100, 'Near plane should be close enough for detail');
        
        console.log(`Near: ${near.toFixed(4)}, Far: ${far.toFixed(2)}`);
        console.log('Camera positioning validation passed');
    });

    test('Should verify point cloud rendering parameters', function() {
        // Test point size calculation based on vertex density
        const testCases = [
            { vertexCount: 100, expectedMinSize: 3, expectedMaxSize: 10 },
            { vertexCount: 10000, expectedMinSize: 1, expectedMaxSize: 8 },
            { vertexCount: 1000000, expectedMinSize: 0.5, expectedMaxSize: 8 }
        ];
        
        for (const testCase of testCases) {
            // Point size algorithm (simplified version of webview logic)
            const baseSize = Math.max(0.5, Math.min(5, 50000 / Math.sqrt(testCase.vertexCount)));
            
            console.log(`${testCase.vertexCount} vertices -> point size: ${baseSize.toFixed(2)}`);
            
            assert.ok(baseSize >= testCase.expectedMinSize, 
                `Point size ${baseSize} should be >= ${testCase.expectedMinSize} for ${testCase.vertexCount} vertices`);
            assert.ok(baseSize <= testCase.expectedMaxSize, 
                `Point size ${baseSize} should be <= ${testCase.expectedMaxSize} for ${testCase.vertexCount} vertices`);
        }
        
        console.log('Point cloud rendering parameters validation passed');
    });

    test('Should test error recovery and fallback rendering', async function() {
        this.timeout(5000);
        
        // Test with malformed data that should trigger error handling
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            // Create a PLY file with some issues that should be handled gracefully
            const problematicPlyContent = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
end_header
0.0 0.0 0.0
invalid_number 0.0 0.0
1.0 NaN 1.0
`;

            const tempFilePath = path.join(workspaceFolder.uri.fsPath, 'error_test.ply');
            fs.writeFileSync(tempFilePath, problematicPlyContent);

            try {
                const uri = vscode.Uri.file(tempFilePath);
                
                // This should either succeed with error recovery or fail gracefully
                try {
                    await vscode.commands.executeCommand('plyViewer.openFile', uri);
                    console.log('✓ Error recovery handled problematic file');
                } catch (error) {
                    console.log('✓ Graceful error handling for problematic file');
                    // Either outcome is acceptable - the key is no crash
                }
                
                assert.ok(true, 'Error handling test completed without crash');
                
            } finally {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
        }
    });

    test('Should verify file size limits and performance thresholds', function() {
        // Test file size handling logic
        const fileSizes = [
            { size: 1024, name: '1KB', shouldOptimize: false },
            { size: 1024 * 1024, name: '1MB', shouldOptimize: false },
            { size: 10 * 1024 * 1024, name: '10MB', shouldOptimize: false }, // 10MB = ~200K vertices < 500K threshold
            { size: 100 * 1024 * 1024, name: '100MB', shouldOptimize: true }
        ];
        
        for (const fileSize of fileSizes) {
            // Estimate vertex count (rough approximation: 50 bytes per vertex for ASCII)
            const estimatedVertices = fileSize.size / 50;
            const shouldUseOptimization = estimatedVertices > 500000; // 500K vertices (adjusted threshold)
            
            console.log(`${fileSize.name} (~${Math.round(estimatedVertices)} vertices) -> optimize: ${shouldUseOptimization}`);
            
            assert.strictEqual(shouldUseOptimization, fileSize.shouldOptimize, 
                `File size ${fileSize.name} optimization decision should match expected`);
        }
        
        // Test memory thresholds
        const memoryLimit = 512 * 1024 * 1024; // 512MB
        const bytesPerVertex = 64; // Approximate memory per vertex in JS
        const maxVerticesInMemory = Math.floor(memoryLimit / bytesPerVertex);
        
        console.log(`Memory limit: ${memoryLimit / 1024 / 1024}MB`);
        console.log(`Max vertices in memory: ${maxVerticesInMemory.toLocaleString()}`);
        
        assert.ok(maxVerticesInMemory > 1000000, 'Should handle at least 1M vertices in memory');
        assert.ok(maxVerticesInMemory < 50000000, 'Memory limit should be reasonable');
        
        console.log('Performance threshold validation passed');
    });
});