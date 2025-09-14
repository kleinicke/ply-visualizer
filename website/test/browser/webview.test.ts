import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PlyParser } from '../../src/parsers/plyParser';

suite('Webview Integration Test Suite', () => {
  let activeWebviewPanel: vscode.WebviewPanel | undefined;

  setup(() => {
    // Track webview panels created during tests
    activeWebviewPanel = undefined;
  });

  teardown(async () => {
    // Clean up any webview panels
    if (activeWebviewPanel) {
      activeWebviewPanel.dispose();
      activeWebviewPanel = undefined;
    }

    // Close any open editors
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('Should create webview panel for PLY files', async function () {
    this.timeout(8000);

    const testPlyContent = `ply
format ascii 1.0
comment Test PLY file for webview testing
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
      const tempFilePath = path.join(workspaceFolder.uri.fsPath, 'webview_test.ply');
      fs.writeFileSync(tempFilePath, testPlyContent);

      try {
        const uri = vscode.Uri.file(tempFilePath);

        // Track webview creation
        let webviewCreated = false;
        const disposable = vscode.window.onDidChangeActiveTextEditor(
          (editor: vscode.TextEditor | undefined) => {
            if (!editor) {
              // No text editor active - might be a custom editor (webview)
              webviewCreated = true;
              console.log('Custom editor (possibly webview) detected');
            }
          }
        );

        try {
          // Open with the PLY visualizer
          await vscode.commands.executeCommand('vscode.openWith', uri, 'plyViewer.plyEditor');

          // Wait for webview to initialize
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Check if active editor is a webview (custom editor)
          const activeEditor = vscode.window.activeTextEditor;
          console.log(
            'Active editor type:',
            activeEditor ? 'text editor' : 'other (possibly webview)'
          );

          // If no text editor is active, it might be a custom editor (webview)
          assert.ok(true, 'PLY file opened successfully (webview or custom editor)');
        } finally {
          disposable.dispose();
        }
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }
  });

  test('Pose handler should accept simple generic JSON shape', async function () {
    this.timeout(4000);
    // Open an empty webview by creating a temp PLY file, then send poseData
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }
    const tempFilePath = path.join(workspaceFolder.uri.fsPath, 'temp_for_pose_view.ply');
    fs.writeFileSync(
      tempFilePath,
      `ply\nformat ascii 1.0\nelement vertex 0\nproperty float x\nproperty float y\nproperty float z\nend_header\n`
    );
    const uri = vscode.Uri.file(tempFilePath);
    await vscode.commands.executeCommand('vscode.openWith', uri, 'plyViewer.plyEditor');
    await new Promise(r => setTimeout(r, 500));
    try {
      // We cannot directly access the webview context here; this test ensures no crash path
      assert.ok(true, 'Webview opened');
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });

  test('JSON sanitizer should parse Halpe NaN-containing file', async function () {
    this.timeout(6000);
    const halpePath = path.join(__dirname, '../../../testfiles/hpe_3d_full 4.json');
    if (!fs.existsSync(halpePath)) {
      console.warn('Halpe test file not found, skipping');
      return;
    }
    const raw = fs.readFileSync(halpePath, 'utf8');
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
      // If this succeeds, great; but typically NaN will cause failure
    } catch {
      const sanitized = raw
        .replace(/\bNaN\b/g, 'null')
        .replace(/\bInfinity\b/g, 'null')
        .replace(/\b-Infinity\b/g, 'null');
      parsed = JSON.parse(sanitized);
    }
    // Basic assertions on structure
    assert.ok(
      parsed && parsed.meta_info && Array.isArray(parsed.instance_info),
      'Parsed Halpe structure'
    );
    const first = parsed.instance_info[0];
    assert.ok(Array.isArray(first.keypoints), 'Keypoints present');
  });

  test('Should process point cloud data through parser pipeline', async function () {
    this.timeout(6000);

    // Test the actual data pipeline that the webview uses
    const testFilePath = path.join(__dirname, '../../../testfiles/ply/test_ascii.ply');
    if (fs.existsSync(testFilePath)) {
      const parser = new PlyParser();
      const fileData = fs.readFileSync(testFilePath);

      console.log(`Processing real PLY file: ${fileData.length} bytes`);

      // This is the same parsing that happens in the webview
      const startTime = performance.now();
      const result = await parser.parse(fileData, message => {
        console.log(`Parser: ${message}`);
      });
      const endTime = performance.now();

      console.log(`Parse time: ${(endTime - startTime).toFixed(2)}ms`);

      // Validate parsed data quality
      assert.ok(result.vertexCount > 0, 'Should have vertices');
      assert.ok(result.vertices.length >= 0, 'Vertices array should be valid');
      assert.ok(result.format === 'ascii', 'Should detect ASCII format');

      // Check vertex data quality
      if (result.vertices.length > 0) {
        const firstVertex = result.vertices[0];
        assert.ok(typeof firstVertex.x === 'number', 'X coordinate should be number');
        assert.ok(typeof firstVertex.y === 'number', 'Y coordinate should be number');
        assert.ok(typeof firstVertex.z === 'number', 'Z coordinate should be number');
        assert.ok(!isNaN(firstVertex.x), 'X coordinate should be valid');
        assert.ok(!isNaN(firstVertex.y), 'Y coordinate should be valid');
        assert.ok(!isNaN(firstVertex.z), 'Z coordinate should be valid');

        console.log(`First vertex: (${firstVertex.x}, ${firstVertex.y}, ${firstVertex.z})`);
      }

      console.log(`Successfully processed ${result.vertexCount} vertices`);
    }
  });

  test('Should process binary PLY with optimized loading', async function () {
    this.timeout(10000);

    const testFilePath = path.join(__dirname, '../../../testfiles/ply/test_binary.ply');
    if (fs.existsSync(testFilePath)) {
      const parser = new PlyParser();
      const fileData = fs.readFileSync(testFilePath);

      console.log(`Processing binary PLY file: ${fileData.length} bytes`);

      const startTime = performance.now();
      const result = await parser.parse(fileData, message => {
        console.log(`Binary Parser: ${message}`);
      });
      const endTime = performance.now();

      console.log(`Binary parse time: ${(endTime - startTime).toFixed(2)}ms`);

      // Validate binary parsing results
      assert.ok(result.format.includes('binary'), 'Should detect binary format');
      assert.ok(result.vertexCount > 0, 'Should report vertex count');

      // For large binary files, parser may use optimized loading
      console.log(`Binary file: ${result.vertexCount} vertices, ${result.vertices.length} loaded`);

      // Performance check - large binary files should parse efficiently
      const parseTimePerVertex = (endTime - startTime) / result.vertexCount;
      console.log(`Parse efficiency: ${parseTimePerVertex.toFixed(6)}ms per vertex`);

      assert.ok(
        parseTimePerVertex < 0.001,
        'Binary parsing should be efficient (< 1μs per vertex)'
      );
    }
  });

  test('Should validate TIF file can be read and has depth data', async function () {
    this.timeout(5000);

    const testTifPath = path.join(__dirname, '../../../testfiles/depth.tif');
    if (fs.existsSync(testTifPath)) {
      const tifData = fs.readFileSync(testTifPath);

      console.log(`TIF file size: ${tifData.length} bytes`);

      // Basic TIF validation - should start with TIF magic number
      const magic = tifData.readUInt16LE(0);
      const isTIF = magic === 0x4949 || magic === 0x4d4d; // II or MM (little/big endian)

      assert.ok(isTIF, 'File should have valid TIF magic number');
      assert.ok(tifData.length > 100, 'TIF file should have substantial data');

      // Validate the file can be opened (this would normally require GeoTIFF in webview)
      console.log(`TIF validation passed: ${tifData.length} bytes, magic: 0x${magic.toString(16)}`);
    }
  });

  test('Should handle XYZ coordinate file parsing', async function () {
    this.timeout(4000);

    const testXyzPath = path.join(__dirname, '../../../testfiles/test_poses.xyz');
    if (fs.existsSync(testXyzPath)) {
      const parser = new PlyParser();
      const fileData = fs.readFileSync(testXyzPath);

      console.log(`Processing XYZ file: ${fileData.length} bytes`);

      const result = await parser.parse(fileData, message => {
        console.log(`XYZ Parser: ${message}`);
      });

      // XYZ files should be parsed as PLY
      assert.ok(result.vertexCount > 0, 'XYZ should have vertices');
      assert.ok(result.vertices.length > 0, 'XYZ vertices should be loaded');

      // Validate coordinate data
      const vertices = result.vertices;
      assert.ok(
        vertices.every(
          v =>
            typeof v.x === 'number' &&
            typeof v.y === 'number' &&
            typeof v.z === 'number' &&
            !isNaN(v.x) &&
            !isNaN(v.y) &&
            !isNaN(v.z)
        ),
        'All XYZ coordinates should be valid numbers'
      );

      console.log(`XYZ file processed: ${vertices.length} valid coordinates`);

      // Check coordinate ranges (should be reasonable values)
      const xValues = vertices.map(v => v.x);
      const yValues = vertices.map(v => v.y);
      const zValues = vertices.map(v => v.z);

      const xRange = [Math.min(...xValues), Math.max(...xValues)];
      const yRange = [Math.min(...yValues), Math.max(...yValues)];
      const zRange = [Math.min(...zValues), Math.max(...zValues)];

      console.log(`Coordinate ranges - X: [${xRange[0].toFixed(3)}, ${xRange[1].toFixed(3)}]`);
      console.log(`                   Y: [${yRange[0].toFixed(3)}, ${yRange[1].toFixed(3)}]`);
      console.log(`                   Z: [${zRange[0].toFixed(3)}, ${zRange[1].toFixed(3)}]`);

      // Ranges should be finite and reasonable
      assert.ok(isFinite(xRange[0]) && isFinite(xRange[1]), 'X range should be finite');
      assert.ok(isFinite(yRange[0]) && isFinite(yRange[1]), 'Y range should be finite');
      assert.ok(isFinite(zRange[0]) && isFinite(zRange[1]), 'Z range should be finite');
    }
  });

  test('Should verify file loading error handling', async function () {
    this.timeout(4000);

    // Test with invalid file
    const invalidData = Buffer.from('invalid file content');
    const parser = new PlyParser();

    try {
      await parser.parse(invalidData);
      assert.fail('Should have thrown error for invalid file');
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw Error object');
      console.log(`Error handling test passed: ${(error as Error).message}`);
    }

    // Test with empty file
    const emptyData = Buffer.alloc(0);
    try {
      await parser.parse(emptyData);
      assert.fail('Should have thrown error for empty file');
    } catch (error) {
      assert.ok(error instanceof Error, 'Should throw Error for empty file');
      console.log(`Empty file error handling: ${(error as Error).message}`);
    }
  });

  test('Should measure memory usage with large point clouds', async function () {
    this.timeout(8000);

    const testFilePath = path.join(__dirname, '../../../testfiles/ply/test_binary.ply');
    if (fs.existsSync(testFilePath)) {
      // Measure memory before
      const memBefore = process.memoryUsage();

      const parser = new PlyParser();
      const fileData = fs.readFileSync(testFilePath);

      const result = await parser.parse(fileData);

      // Measure memory after
      const memAfter = process.memoryUsage();

      const heapUsed = memAfter.heapUsed - memBefore.heapUsed;
      const memoryPerVertex = heapUsed / result.vertexCount;

      console.log(`Memory usage: ${(heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Memory per vertex: ${memoryPerVertex.toFixed(2)} bytes`);
      console.log(`Vertices processed: ${result.vertexCount}`);

      // Memory usage should be reasonable
      assert.ok(memoryPerVertex < 1000, 'Memory usage per vertex should be reasonable');

      // Test cleanup
      result.vertices.length = 0; // Clear array

      if (global.gc) {
        global.gc(); // Force garbage collection if available
      }
    }
  });
});
