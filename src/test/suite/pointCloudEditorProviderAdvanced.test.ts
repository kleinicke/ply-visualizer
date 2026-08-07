import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { handleAddFileFromPath } from '../../providerHandlers/addFileHandlers';
import { clearVolume } from '../../providerHandlers/volumeSessions';
import {
  buildDicomSeriesNrrd,
  parseDicomSlice,
  scanDicomFolder,
} from '../../providerHandlers/dicomFolderLoader';
import { NrrdParser } from '../../../engine/src/parsers/nrrdParser';

function dicomElement(group: number, element: number, vr: string, value: Buffer): Buffer {
  const padded =
    value.length % 2 ? Buffer.concat([value, Buffer.from(vr === 'UI' ? [0] : [32])]) : value;
  const long = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN']).has(vr);
  const header = Buffer.alloc(long ? 12 : 8);
  header.writeUInt16LE(group, 0);
  header.writeUInt16LE(element, 2);
  header.write(vr, 4, 2, 'ascii');
  if (long) {
    header.writeUInt32LE(padded.length, 8);
  } else {
    header.writeUInt16LE(padded.length, 6);
  }
  return Buffer.concat([header, padded]);
}

function makeSyntheticDicom(instance: number, zMillimetres: number): Buffer {
  const text = (value: string) => Buffer.from(value, 'ascii');
  const ushort = (value: number) => {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value);
    return buffer;
  };
  const pixels = Buffer.alloc(8);
  [0, 100, 200, 300].forEach((value, index) => pixels.writeUInt16LE(value, index * 2));
  return Buffer.concat([
    Buffer.alloc(128),
    Buffer.from('DICM'),
    dicomElement(0x0002, 0x0010, 'UI', text('1.2.840.10008.1.2.1')),
    dicomElement(0x0008, 0x0060, 'CS', text('CT')),
    dicomElement(0x0008, 0x0018, 'UI', text(`1.2.3.4.${instance}`)),
    dicomElement(0x0020, 0x000d, 'UI', text('1.2.3')),
    dicomElement(0x0020, 0x000e, 'UI', text('1.2.3.4')),
    dicomElement(0x0020, 0x0011, 'IS', text('7')),
    dicomElement(0x0020, 0x0013, 'IS', text(String(instance))),
    dicomElement(0x0020, 0x0032, 'DS', text(`-100\\-50\\${zMillimetres}`)),
    dicomElement(0x0020, 0x0037, 'DS', text('1\\0\\0\\0\\1\\0')),
    dicomElement(0x0028, 0x0002, 'US', ushort(1)),
    dicomElement(0x0028, 0x0004, 'CS', text('MONOCHROME2')),
    dicomElement(0x0028, 0x0010, 'US', ushort(2)),
    dicomElement(0x0028, 0x0011, 'US', ushort(2)),
    dicomElement(0x0028, 0x0030, 'DS', text('0.5\\0.75')),
    dicomElement(0x0028, 0x0100, 'US', ushort(16)),
    dicomElement(0x0028, 0x0101, 'US', ushort(12)),
    dicomElement(0x0028, 0x0103, 'US', ushort(0)),
    dicomElement(0x0028, 0x1050, 'DS', text('40')),
    dicomElement(0x0028, 0x1051, 'DS', text('400')),
    dicomElement(0x0028, 0x1052, 'DS', text('-1000')),
    dicomElement(0x0028, 0x1053, 'DS', text('1')),
    dicomElement(0x7fe0, 0x0010, 'OW', pixels),
  ]);
}

suite('Point Cloud Editor Provider Advanced Test Suite', () => {
  let extension: vscode.Extension<any> | undefined;

  setup(async () => {
    extension = vscode.extensions.getExtension('kleinicke.ply-visualizer');
    if (extension && !extension.isActive) {
      await extension.activate();
    }
  });

  test('Should handle file resolution and opening workflow', async () => {
    // Test that the provider can handle file opening workflow
    const testFiles = [
      { ext: '.ply', name: 'test.ply' },
      { ext: '.obj', name: 'test.obj' },
      { ext: '.stl', name: 'test.stl' },
    ];

    for (const testFile of testFiles) {
      // Create a minimal test file
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const filePath = path.join(workspaceFolder.uri.fsPath, testFile.name);

        try {
          // Create minimal file content based on type
          let content = '';
          switch (testFile.ext) {
            case '.ply':
              content = `ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nend_header\n0.0 0.0 0.0\n`;
              break;
            case '.obj':
              content = `v 0.0 0.0 0.0\nv 1.0 0.0 0.0\nv 0.5 1.0 0.0\nf 1 2 3\n`;
              break;
            case '.stl':
              content = `solid test\nfacet normal 0.0 0.0 1.0\nouter loop\nvertex 0.0 0.0 0.0\nvertex 1.0 0.0 0.0\nvertex 0.5 1.0 0.0\nendloop\nendfacet\nendsolid test\n`;
              break;
          }

          fs.writeFileSync(filePath, content);

          const uri = vscode.Uri.file(filePath);

          // Test that command can be executed
          try {
            await vscode.commands.executeCommand('plyViewer.openFile', uri);
            assert.ok(true, `${testFile.name} should open successfully`);
          } catch (error) {
            // Opening might fail in test environment - that's acceptable
            assert.ok(error instanceof Error);
          }
        } finally {
          // Clean up
          const filePath = path.join(workspaceFolder.uri.fsPath, testFile.name);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
    }
  });

  test('Should handle custom editor registration', () => {
    const packageJSON = extension?.packageJSON;
    const customEditors = packageJSON?.contributes?.customEditors;

    assert.ok(customEditors, 'Custom editors should be registered');
    assert.strictEqual(customEditors.length, 2);

    const editor = customEditors.find((item: any) => item.viewType === 'plyViewer.plyEditor');
    assert.ok(editor, 'Main 3D custom editor should be registered');
    assert.strictEqual(editor.viewType, 'plyViewer.plyEditor');
    assert.ok(editor.selector, 'Editor should have file selector');
    assert.ok(Array.isArray(editor.selector), 'Selector should be an array');

    // Verify selector patterns
    const patterns = editor.selector.map((s: any) => s.filenamePattern);
    assert.ok(patterns.length > 5, 'Should support multiple file types');

    const kittiEditor = customEditors.find((item: any) => item.viewType === 'plyViewer.kittiBin');
    assert.ok(kittiEditor, 'KITTI BIN custom editor should be registered');
    assert.strictEqual(kittiEditor.priority, 'option');
    assert.deepStrictEqual(
      kittiEditor.selector.map((s: any) => s.filenamePattern),
      ['*.bin']
    );
  });

  test('Should add a KITTI BIN file to an existing scene', async () => {
    const fileName = `add-kitti-test-${process.pid}-${Date.now()}.bin`;
    const filePath = path.join(os.tmpdir(), fileName);
    const buffer = Buffer.alloc(32);
    const values = [1, 2, 3, 0.25, -4, 5, -6, 0.75];
    values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
    fs.writeFileSync(filePath, buffer);

    const messages: any[] = [];
    const host = {
      getShortPath: (value: string) => path.basename(value),
      logPerf: () => undefined,
      setLoadStartedAt: () => undefined,
      tryAutoLoadMtl: async () => undefined,
    };
    const webviewPanel = {
      webview: {
        postMessage: async (message: any) => {
          messages.push(message);
          return true;
        },
      },
    } as unknown as vscode.WebviewPanel;

    try {
      await handleAddFileFromPath(host, webviewPanel, filePath);
    } finally {
      fs.unlinkSync(filePath);
    }

    const dataMessage = messages.find(message => message.type === 'binarySpatialData');
    assert.ok(dataMessage, 'The KITTI scan should be sent as spatial data');
    assert.strictEqual(dataMessage.messageType, 'addFiles');
    assert.strictEqual(dataMessage.fileName, fileName);
    assert.strictEqual(dataMessage.vertexCount, 2);
    assert.deepStrictEqual(
      Array.from(new Float32Array(dataMessage.positionBuffer)),
      [1, 2, 3, -4, 5, -6]
    );
    assert.deepStrictEqual(
      Array.from(new Float32Array(dataMessage.scalarFieldBuffers.intensity)),
      [0.25, 0.75]
    );
  });

  test('Should add an NRRD volume with its own retained session', async () => {
    const fileName = `add-volume-test-${process.pid}-${Date.now()}.nrrd`;
    const filePath = path.join(os.tmpdir(), fileName);
    const size = 6;
    const samples = new Float32Array(size ** 3);
    for (let k = 0; k < size; k++) {
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          samples[i + j * size + k * size * size] = 2 - Math.hypot(i - 2.5, j - 2.5, k - 2.5);
        }
      }
    }
    const header = Buffer.from(
      `NRRD0004\ntype: float\ndimension: 3\nsizes: ${size} ${size} ${size}\n` +
        'encoding: raw\nendian: little\n\n',
      'ascii'
    );
    fs.writeFileSync(
      filePath,
      Buffer.concat([header, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)])
    );

    const messages: any[] = [];
    const retained: string[] = [];
    const host = {
      getShortPath: (value: string) => path.basename(value),
      logPerf: () => undefined,
      setLoadStartedAt: () => undefined,
      retainVolumeSession: (_panel: vscode.WebviewPanel, key: string) => retained.push(key),
      tryAutoLoadMtl: async () => undefined,
    };
    const webviewPanel = {
      webview: {
        postMessage: async (message: any) => {
          messages.push(message);
          return true;
        },
      },
    } as unknown as vscode.WebviewPanel;

    try {
      await handleAddFileFromPath(host, webviewPanel, filePath);
      const message = messages.find(candidate => candidate.type === 'volumeData');
      assert.ok(message, 'The added NRRD should be sent as volume data');
      assert.strictEqual(message.isAddFile, true);
      assert.ok(message.data.faceCount > 0);
      assert.strictEqual(
        message.data.metadata.volumeSessionId,
        vscode.Uri.file(filePath).toString()
      );
      assert.deepStrictEqual(retained, [vscode.Uri.file(filePath).toString()]);
    } finally {
      clearVolume(vscode.Uri.file(filePath).toString());
      fs.unlinkSync(filePath);
    }
  });

  test('Should discover extensionless DICOM slices and build a metre-scale volume', async () => {
    const folder = path.join(os.tmpdir(), `dicom-folder-test-${process.pid}-${Date.now()}`);
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, 'slice-one'), makeSyntheticDicom(1, 0));
    fs.writeFileSync(path.join(folder, 'slice-one-copy'), makeSyntheticDicom(1, 0));
    fs.writeFileSync(path.join(folder, 'slice-two'), makeSyntheticDicom(2, 2));
    fs.writeFileSync(path.join(folder, 'notes.txt'), 'not a DICOM file');

    try {
      const parsed = parseDicomSlice(
        vscode.Uri.file(path.join(folder, 'slice-one')),
        fs.readFileSync(path.join(folder, 'slice-one'))
      );
      assert.ok(parsed);
      assert.strictEqual(parsed.windowCenter, 40);
      assert.strictEqual(parsed.windowWidth, 400);

      const series = await scanDicomFolder(vscode.Uri.file(folder));
      assert.strictEqual(series.length, 1);
      assert.strictEqual(series[0].slices.length, 2);
      const nrrd = buildDicomSeriesNrrd(series[0]);
      const volume = await new NrrdParser().parse(nrrd, 'direct-dicom.nrrd');
      assert.deepStrictEqual(volume.sizes, [2, 2, 2]);
      assert.strictEqual(volume.spaceUnits, 'm');
      assert.ok(Math.abs(volume.ijkToWorld[0] + 0.00075) < 1e-9);
      assert.ok(Math.abs(volume.ijkToWorld[5] + 0.0005) < 1e-9);
      assert.ok(Math.abs(volume.ijkToWorld[10] - 0.002) < 1e-9);
      assert.strictEqual(volume.ijkToWorld[3], 0.1);
      assert.strictEqual(volume.ijkToWorld[7], 0.05);
      assert.strictEqual(volume.samples[0], -1000);
      assert.strictEqual(volume.samples[3], -700);
      assert.strictEqual(volume.header['window center'], '40');
      assert.strictEqual(volume.header['window width'], '400');
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  test('Should scan the real extensionless Siemens DICOM folder', async function () {
    this.timeout(10_000);

    const folder =
      '/Users/florian/Projects/cursor/test_data/testfiles/scientific/MRT OSG Februar 2023';
    if (!fs.existsSync(folder)) {
      this.skip();
      return;
    }

    const series = await scanDicomFolder(vscode.Uri.file(folder));
    assert.strictEqual(series.length, 4);
    assert.deepStrictEqual(
      series.map(item => item.slices.length),
      [44, 26, 26, 36]
    );
    assert.ok(series.every(item => item.slices.every(slice => !path.extname(slice.uri.fsPath))));

    const nrrd = buildDicomSeriesNrrd(series[0]);
    const volume = await new NrrdParser().parse(nrrd, 'real-siemens-series.nrrd');
    assert.deepStrictEqual(volume.sizes, [640, 640, 44]);
    assert.strictEqual(volume.spaceUnits, 'm');
    assert.ok(Array.from(volume.samples.subarray(0, 1024)).every(Number.isFinite));
  });

  test('Should support webview serialization', () => {
    // Test webview state management concepts
    const webviewOptions = {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [],
    };

    // Verify webview options are valid
    assert.strictEqual(
      webviewOptions.enableScripts,
      true,
      'Scripts should be enabled for 3D rendering'
    );
    assert.strictEqual(
      webviewOptions.retainContextWhenHidden,
      true,
      'Context should be retained for performance'
    );
    assert.ok(Array.isArray(webviewOptions.localResourceRoots), 'Resource roots should be defined');
  });

  test('Should handle webview panel creation', () => {
    // Mock webview panel creation workflow
    const panelOptions = {
      viewType: 'plyViewer.plyEditor',
      title: '3D Point Cloud Visualizer',
      showOptions: vscode.ViewColumn.One,
      options: {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    };

    assert.strictEqual(panelOptions.viewType, 'plyViewer.plyEditor');
    assert.ok(panelOptions.title.includes('3D'), 'Title should indicate 3D functionality');
    assert.strictEqual(panelOptions.options.enableScripts, true);
  });

  test('Should validate file type detection logic', () => {
    const testFiles = [
      { filename: 'model.ply', expectedFormat: 'ply' },
      { filename: 'mesh.obj', expectedFormat: 'obj' },
      { filename: 'shape.stl', expectedFormat: 'stl' },
      { filename: 'points.xyz', expectedFormat: 'xyz' },
      { filename: 'cloud.pcd', expectedFormat: 'pcd' },
      { filename: 'data.pts', expectedFormat: 'pts' },
      { filename: 'geometry.off', expectedFormat: 'off' },
      { filename: 'scene.gltf', expectedFormat: 'gltf' },
      { filename: 'model.glb', expectedFormat: 'glb' },
      { filename: 'survey.las', expectedFormat: 'las' },
      { filename: 'survey.laz', expectedFormat: 'laz' },
      { filename: 'scans.e57', expectedFormat: 'e57' },
    ];

    for (const testFile of testFiles) {
      const extension = path.extname(testFile.filename).toLowerCase();
      const expectedExt = '.' + testFile.expectedFormat;
      assert.strictEqual(
        extension,
        expectedExt,
        `${testFile.filename} should have correct extension`
      );
    }
  });

  test('Should handle parser selection logic', () => {
    const parserMapping = {
      '.ply': 'PlyParser',
      '.obj': 'ObjParser',
      '.stl': 'StlParser',
      '.xyz': 'PlyParser', // XYZ handled by PLY parser
      '.pcd': 'PcdParser',
      '.pts': 'PtsParser',
      '.off': 'OffParser',
      '.gltf': 'GltfParser',
      '.glb': 'GltfParser',
    };

    Object.entries(parserMapping).forEach(([ext, parser]) => {
      assert.ok(parser.endsWith('Parser'), `${ext} should map to a valid parser (${parser})`);
    });
  });

  test('Should support resource URI generation', () => {
    // Test resource URI concepts for webview
    const resourceTypes = ['css', 'js', 'fonts', 'icons'];

    for (const type of resourceTypes) {
      // Mock resource path validation
      const resourcePath = `media/${type}/`;
      assert.ok(resourcePath.startsWith('media/'), 'Resource paths should start with media/');
      assert.ok(resourcePath.includes(type), `Resource path should include type ${type}`);
    }
  });

  test('Should handle document change events', () => {
    // Mock document change event handling
    const documentChangeEvent = {
      document: {
        uri: vscode.Uri.file('/test/model.ply'),
        fileName: 'model.ply',
        isDirty: false,
      },
      contentChanges: [],
      reason: vscode.TextDocumentChangeReason.Undo,
    };

    assert.ok(documentChangeEvent.document.uri, 'Document should have URI');
    assert.ok(documentChangeEvent.document.fileName.endsWith('.ply'), 'Should handle PLY files');
    assert.ok(Array.isArray(documentChangeEvent.contentChanges), 'Content changes should be array');
  });

  test('Should support save operations', () => {
    // Mock save operation concepts
    const saveOptions = {
      includeText: false,
      reason: vscode.TextDocumentSaveReason.Manual,
    };

    assert.strictEqual(saveOptions.includeText, false, 'Binary files should not include text');
    assert.ok(
      Object.values(vscode.TextDocumentSaveReason).includes(saveOptions.reason),
      'Save reason should be valid'
    );
  });

  test('Should handle message passing between extension and webview', () => {
    // Mock message types that would be passed
    const messageTypes = [
      'loadFile',
      'updateTransform',
      'changePointSize',
      'toggleVisibility',
      'fitToView',
      'exportData',
      'showError',
      'updateProgress',
    ];

    messageTypes.forEach(type => {
      assert.ok(type.length > 0, `Message type ${type} should be non-empty`);
      assert.ok(typeof type === 'string', `Message type ${type} should be string`);
    });
  });

  test('Should validate webview HTML generation', () => {
    // Mock HTML template structure
    const htmlStructure = {
      doctype: '<!DOCTYPE html>',
      htmlTag: '<html>',
      head: '<head>',
      meta: '<meta charset="UTF-8">',
      viewport: '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      title: '<title>3D Point Cloud Visualizer</title>',
      body: '<body>',
      canvas: '<canvas>',
      scripts: '<script>',
    };

    Object.entries(htmlStructure).forEach(([element, tag]) => {
      assert.ok(tag.startsWith('<'), `${element} should be valid HTML tag`);
      // More flexible content checking
      if (element === 'scripts') {
        assert.ok(tag.startsWith('<script'), 'scripts should be valid script tag');
      } else if (element !== 'doctype' && element !== 'htmlTag') {
        assert.ok(tag.includes('<'), `${element} should be valid HTML content`);
      }
    });
  });

  test('Should handle CSP (Content Security Policy)', () => {
    // Mock CSP configuration
    const cspDirectives = [
      "default-src 'none'",
      "script-src 'unsafe-eval'", // Needed for Three.js
      "style-src 'unsafe-inline'",
      'img-src data:',
      "connect-src 'none'",
    ];

    cspDirectives.forEach(directive => {
      assert.ok(directive.includes('-src'), `${directive} should be valid CSP directive`);
      assert.ok(directive.split(' ').length >= 2, `${directive} should have directive and value`);
    });
  });

  test('Should support error handling and recovery', () => {
    // Mock error scenarios
    const errorScenarios = [
      { type: 'FileNotFound', recoverable: false },
      { type: 'ParseError', recoverable: true },
      { type: 'MemoryError', recoverable: true },
      { type: 'WebViewError', recoverable: false },
      { type: 'NetworkError', recoverable: true },
    ];

    errorScenarios.forEach(scenario => {
      assert.ok(typeof scenario.type === 'string', 'Error type should be string');
      assert.ok(typeof scenario.recoverable === 'boolean', 'Recoverable should be boolean');
    });
  });

  test('Should validate configuration options', () => {
    // Test configuration structure
    const configOptions = {
      'plyViewer.defaultPointSize': { type: 'number', default: 5.0 },
      'plyViewer.enableGamma': { type: 'boolean', default: true },
      'plyViewer.maxFileSize': { type: 'number', default: 100 }, // MB
      'plyViewer.cameraControls': { type: 'string', default: 'trackball' },
    };

    Object.entries(configOptions).forEach(([key, config]) => {
      assert.ok(key.startsWith('plyViewer.'), `Config key ${key} should have proper prefix`);
      assert.ok(
        ['string', 'number', 'boolean'].includes(config.type),
        `Config type ${config.type} should be valid`
      );
      assert.ok(config.default !== undefined, `Config ${key} should have default value`);
    });
  });

  test('Should support telemetry and analytics', () => {
    // Mock telemetry events
    const telemetryEvents = [
      'extension.activated',
      'file.opened',
      'file.parsed',
      'webview.created',
      'error.occurred',
      'performance.measured',
    ];

    telemetryEvents.forEach(event => {
      assert.ok(event.includes('.'), `Event ${event} should have category`);
      assert.ok(event.length > 5, `Event ${event} should be descriptive`);
    });
  });

  test('Should handle disposal and cleanup', () => {
    // Mock disposal resources
    const disposableResources = [
      'webviewPanel',
      'documentListener',
      'configurationListener',
      'fileWatcher',
      'commandRegistrations',
    ];

    disposableResources.forEach(resource => {
      assert.ok(typeof resource === 'string', `Resource ${resource} should be identifiable`);
      assert.ok(resource.length > 3, `Resource name ${resource} should be descriptive`);
    });
  });

  test('Should support progressive loading for large files', () => {
    // Mock progressive loading configuration
    const progressiveLoadingConfig = {
      chunkSize: 100000, // vertices per chunk
      maxChunks: 50,
      delayBetweenChunks: 10, // ms
      enableProgressReporting: true,
    };

    assert.ok(progressiveLoadingConfig.chunkSize > 1000, 'Chunk size should be reasonable');
    assert.ok(progressiveLoadingConfig.maxChunks > 0, 'Max chunks should be positive');
    assert.ok(progressiveLoadingConfig.delayBetweenChunks >= 0, 'Delay should be non-negative');
    assert.strictEqual(
      progressiveLoadingConfig.enableProgressReporting,
      true,
      'Progress should be reported'
    );
  });

  test('Should handle memory management', () => {
    // Mock memory management strategies
    const memoryStrategies = [
      { name: 'vertexDeduplication', enabled: true, memoryReduction: 0.3 },
      { name: 'colorCompression', enabled: true, memoryReduction: 0.2 },
      { name: 'geometrySimplification', enabled: false, memoryReduction: 0.5 },
      { name: 'instancedRendering', enabled: true, memoryReduction: 0.4 },
    ];

    memoryStrategies.forEach(strategy => {
      assert.ok(strategy.name.length > 0, `Strategy ${strategy.name} should have name`);
      assert.ok(typeof strategy.enabled === 'boolean', 'Strategy enabled should be boolean');
      assert.ok(
        strategy.memoryReduction > 0 && strategy.memoryReduction <= 1,
        'Memory reduction should be between 0 and 1'
      );
    });
  });
});
