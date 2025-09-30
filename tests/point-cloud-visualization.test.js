/**
 * Point Cloud Visualization Test
 *
 * This test verifies that the complete point cloud visualization pipeline works:
 * 1. Message reception from extension
 * 2. Binary data processing
 * 3. Three.js point cloud creation
 * 4. Scene rendering
 */

const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('Point Cloud Visualization', function () {
  let dom, window, document, console_logs, console_errors;
  let mockThreeManager, mockApp;

  beforeEach(function () {
    // Create a clean DOM environment
    dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body></body>
      </html>
    `,
      {
        url: 'http://localhost',
        pretendToBeVisual: true,
        resources: 'usable',
      }
    );

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.navigator = window.navigator;

    // Capture console output
    console_logs = [];
    console_errors = [];

    // Mock console to capture output
    window.console = {
      log: (...args) => {
        console_logs.push(args.join(' '));
        console.log(...args); // Still log to actual console
      },
      error: (...args) => {
        console_errors.push(args.join(' '));
        console.error(...args); // Still log to actual console
      },
      warn: (...args) => {
        console_logs.push('WARN: ' + args.join(' '));
        console.warn(...args);
      },
    };

    // Mock VS Code API
    global.acquireVsCodeApi = function () {
      return {
        postMessage: function (message) {
          console_logs.push('VS Code API: ' + JSON.stringify(message));
        },
      };
    };

    // Mock Three.js objects
    const mockScene = {
      children: [],
      add: function (object) {
        this.children.push(object);
      },
      remove: function (object) {
        const index = this.children.indexOf(object);
        if (index > -1) {this.children.splice(index, 1);}
      },
    };

    const mockGeometry = {
      setAttribute: function (name, attribute) {
        this[name] = attribute;
      },
      dispose: function () {},
    };

    const mockMaterial = {
      dispose: function () {},
    };

    const mockPoints = {
      geometry: mockGeometry,
      material: mockMaterial,
      name: '',
    };

    // Mock ThreeManager
    mockThreeManager = {
      scene: mockScene,
      clearScene: function () {
        console_logs.push('ThreeManager: clearScene called');
        this.scene.children = [];
      },
      addToScene: function (object, name) {
        console_logs.push(`ThreeManager: addToScene called with ${name}`);
        if (name) {object.name = name;}
        this.scene.add(object);
      },
      fitToView: function () {
        console_logs.push('ThreeManager: fitToView called');
      },
      requestRender: function () {
        console_logs.push('ThreeManager: requestRender called');
      },
    };

    // Mock THREE.js classes
    window.THREE = {
      BufferGeometry: function () {
        return {
          setAttribute: function (name, attribute) {
            console_logs.push(
              `BufferGeometry: setAttribute ${name} with ${attribute.array?.length || 0} elements`
            );
            this[name] = attribute;
          },
          dispose: function () {},
        };
      },
      BufferAttribute: function (array, itemSize) {
        console_logs.push(
          `BufferAttribute: created with ${array.length} elements, itemSize ${itemSize}`
        );
        return {
          array: array,
          itemSize: itemSize,
        };
      },
      PointsMaterial: function (options) {
        console_logs.push(`PointsMaterial: created with options ${JSON.stringify(options)}`);
        return {
          size: options.size,
          vertexColors: options.vertexColors,
          color: options.color,
          dispose: function () {},
        };
      },
      Points: function (geometry, material) {
        console_logs.push('Points: created with geometry and material');
        return {
          geometry: geometry,
          material: material,
          name: '',
        };
      },
    };

    // Set up global threeManager
    window.threeManager = mockThreeManager;
  });

  afterEach(function () {
    if (dom) {
      dom.window.close();
    }
    // Clean up globals
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.acquireVsCodeApi;
  });

  it('should process binary spatial data message correctly', function (done) {
    this.timeout(10000);

    // Create test binary data (simple point cloud with 3 points)
    const vertexCount = 3;
    const positions = new Float32Array([
      0.0,
      0.0,
      0.0, // Point 1
      1.0,
      0.0,
      0.0, // Point 2
      0.0,
      1.0,
      0.0, // Point 3
    ]);

    const colors = new Uint8Array([
      255,
      0,
      0, // Red
      0,
      255,
      0, // Green
      0,
      0,
      255, // Blue
    ]);

    // Create binary data buffer (positions + colors)
    const binaryBuffer = new ArrayBuffer(positions.byteLength + colors.byteLength);
    const view = new DataView(binaryBuffer);

    // Write positions (3 points * 3 floats * 4 bytes = 36 bytes)
    let offset = 0;
    for (let i = 0; i < positions.length; i++) {
      view.setFloat32(offset, positions[i], true); // little endian
      offset += 4;
    }

    // Write colors (3 points * 3 bytes = 9 bytes)
    for (let i = 0; i < colors.length; i++) {
      view.setUint8(offset, colors[i]);
      offset += 1;
    }

    // Create test message
    const testMessage = {
      type: 'ultimateRawBinaryData',
      messageType: 'multiSpatialData',
      fileName: 'test_pointcloud.ply',
      vertexCount: vertexCount,
      faceCount: 0,
      colorData: true,
      binaryData: binaryBuffer,
    };

    try {
      // Load the compiled main.js bundle
      const fs = require('fs');
      const path = require('path');
      const bundlePath = path.join(__dirname, '..', 'out', 'webview', 'main.js');

      if (!fs.existsSync(bundlePath)) {
        throw new Error(`Bundle not found at ${bundlePath}. Run 'npm run compile' first.`);
      }

      console.log('📦 Loading bundle from:', bundlePath);
      const bundleCode = fs.readFileSync(bundlePath, 'utf8');

      // Ensure we have a body element for Svelte to mount to
      if (!document.body) {
        document.body = document.createElement('body');
      }

      // Execute the bundle code
      eval(bundleCode);
      console.log('📄 Bundle executed successfully');

      // Wait for app initialization
      setTimeout(() => {
        console.log('🧪 Simulating message from extension...');

        // Simulate message from extension
        const messageEvent = new window.MessageEvent('message', {
          data: testMessage,
        });

        window.dispatchEvent(messageEvent);

        // Wait for message processing
        setTimeout(() => {
          console.log('📋 Final console logs:', console_logs.length);
          console.log('❌ Final console errors:', console_errors.length);

          // Print all logs for debugging
          console.log('All logs:');
          console_logs.forEach((log, i) => console.log(`  ${i + 1}. ${log}`));

          if (console_errors.length > 0) {
            console.log('All errors:');
            console_errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
          }

          // Check for expected behavior
          const hasMessageProcessing = console_logs.some(log =>
            log.includes('Processing message type: ultimateRawBinaryData')
          );
          const hasThreeManagerAvailable = console_logs.some(log =>
            log.includes('Global threeManager available: true')
          );
          const hasBinaryDataProcessing = console_logs.some(log =>
            log.includes('Processing binary spatial data')
          );
          const hasGeometryCreation = console_logs.some(log =>
            log.includes('BufferGeometry: setAttribute position')
          );
          const hasPointsCreation = console_logs.some(log =>
            log.includes('Points: created with geometry')
          );
          const hasSceneAdd = console_logs.some(log =>
            log.includes('ThreeManager: addToScene called')
          );
          const hasFitToView = console_logs.some(log =>
            log.includes('ThreeManager: fitToView called')
          );

          console.log('✅ Test Results:');
          console.log(`  Message Processing: ${hasMessageProcessing}`);
          console.log(`  ThreeManager Available: ${hasThreeManagerAvailable}`);
          console.log(`  Binary Data Processing: ${hasBinaryDataProcessing}`);
          console.log(`  Geometry Creation: ${hasGeometryCreation}`);
          console.log(`  Points Creation: ${hasPointsCreation}`);
          console.log(`  Scene Addition: ${hasSceneAdd}`);
          console.log(`  Fit To View: ${hasFitToView}`);

          // Verify the complete pipeline worked
          if (
            hasMessageProcessing &&
            hasThreeManagerAvailable &&
            hasBinaryDataProcessing &&
            hasGeometryCreation &&
            hasPointsCreation &&
            hasSceneAdd &&
            hasFitToView
          ) {
            console.log('🎉 Point cloud visualization pipeline working correctly!');
            done(); // Success
          } else {
            const missing = [];
            if (!hasMessageProcessing) {missing.push('Message Processing');}
            if (!hasThreeManagerAvailable) {missing.push('ThreeManager Available');}
            if (!hasBinaryDataProcessing) {missing.push('Binary Data Processing');}
            if (!hasGeometryCreation) {missing.push('Geometry Creation');}
            if (!hasPointsCreation) {missing.push('Points Creation');}
            if (!hasSceneAdd) {missing.push('Scene Addition');}
            if (!hasFitToView) {missing.push('Fit To View');}

            done(new Error(`Point cloud pipeline incomplete. Missing: ${missing.join(', ')}`));
          }
        }, 2000); // Wait 2 seconds for processing
      }, 1000); // Wait 1 second for app initialization
    } catch (error) {
      console.error('Test setup error:', error);
      done(error);
    }
  });

  it('should handle missing binary data gracefully', function (done) {
    this.timeout(5000);

    // Create test message without binary data
    const testMessage = {
      type: 'ultimateRawBinaryData',
      messageType: 'multiSpatialData',
      fileName: 'test_pointcloud.ply',
      vertexCount: 100,
      faceCount: 0,
      colorData: true,
      // binaryData: undefined (missing)
    };

    try {
      // Load the compiled main.js bundle
      const fs = require('fs');
      const path = require('path');
      const bundlePath = path.join(__dirname, '..', 'out', 'webview', 'main.js');

      const bundleCode = fs.readFileSync(bundlePath, 'utf8');

      if (!document.body) {
        document.body = document.createElement('body');
      }

      eval(bundleCode);

      setTimeout(() => {
        const messageEvent = new window.MessageEvent('message', {
          data: testMessage,
        });

        window.dispatchEvent(messageEvent);

        setTimeout(() => {
          // Should have error about missing binary data
          const hasNoBinaryDataError = console_errors.some(log =>
            log.includes('No binary data received')
          );

          if (hasNoBinaryDataError) {
            console.log('✅ Correctly handled missing binary data');
            done();
          } else {
            done(new Error('Should have detected missing binary data'));
          }
        }, 1000);
      }, 1000);
    } catch (error) {
      done(error);
    }
  });
});
