/**
 * Migration Safety Test Suite
 *
 * This test suite ensures that the core functionality works before, during,
 * and after the Svelte migration process. All tests must pass 100% before
 * starting migration work.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Migration Safety - Build System', function () {
  this.timeout(60000); // 60 second timeout for builds

  it('Extension webpack build succeeds', function () {
    // Run build and check for output files
    try {
      execSync('npm run compile', { stdio: 'pipe' });

      // Check that required files exist
      assert(fs.existsSync('out/extension.js'), 'Extension bundle should exist');
      assert(fs.existsSync('out/webview/main.js'), 'Webview bundle should exist');

      // Check file sizes are reasonable (not empty)
      const extensionSize = fs.statSync('out/extension.js').size;
      const webviewSize = fs.statSync('out/webview/main.js').size;

      assert(extensionSize > 1000, 'Extension bundle should be substantial');
      assert(webviewSize > 10000, 'Webview bundle should be substantial');
    } catch (error) {
      assert.fail(`Build failed: ${error.message}`);
    }
  });

  it('No compilation errors in output', function () {
    try {
      const output = execSync('npm run compile', { encoding: 'utf8', stdio: 'pipe' });

      // Check for error indicators
      assert(!output.includes('ERROR'), 'Build output should not contain ERROR');
      assert(!output.includes('Module not found'), 'Build should not have missing modules');
      assert(!output.includes('Cannot resolve'), 'Build should resolve all dependencies');
    } catch (error) {
      assert.fail(`Build check failed: ${error.message}`);
    }
  });

  it('Bundle size regression check', function () {
    // Baseline sizes (current state before migration)
    const BASELINE_EXTENSION_SIZE = 500 * 1024; // 500KB baseline
    const BASELINE_WEBVIEW_SIZE = 1000 * 1024; // 1MB baseline

    const extensionSize = fs.statSync('out/extension.js').size;
    const webviewSize = fs.statSync('out/webview/main.js').size;

    // Allow 20% increase maximum
    assert(
      extensionSize < BASELINE_EXTENSION_SIZE * 1.2,
      `Extension bundle too large: ${extensionSize} > ${BASELINE_EXTENSION_SIZE * 1.2}`
    );
    assert(
      webviewSize < BASELINE_WEBVIEW_SIZE * 1.2,
      `Webview bundle too large: ${webviewSize} > ${BASELINE_WEBVIEW_SIZE * 1.2}`
    );
  });
});

describe('Migration Safety - Core File Structure', function () {
  it('Critical files exist', function () {
    const criticalFiles = [
      'website/src/main.ts',
      'src/extension.ts',
      'src/pointCloudEditorProvider.ts',
      'package.json',
      'webpack.config.js',
    ];

    criticalFiles.forEach(file => {
      assert(fs.existsSync(file), `Critical file missing: ${file}`);
    });
  });

  it('Main.ts has substantial content', function () {
    const mainTsPath = 'website/src/main.ts';
    const content = fs.readFileSync(mainTsPath, 'utf8');
    const lineCount = content.split('\n').length;

    // Should have the large main.ts file (14k+ lines currently)
    assert(lineCount > 10000, `main.ts should be substantial, got ${lineCount} lines`);
    assert(content.includes('PointCloudVisualizer'), 'main.ts should contain PointCloudVisualizer');
    assert(content.includes('THREE'), 'main.ts should use Three.js');
  });

  it('Test files directory structure', function () {
    const testDirs = [
      'testfiles/ply',
      'testfiles/stl',
      'testfiles/obj',
      'testfiles/tif',
      'testfiles/png',
    ];

    testDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        assert(files.length > 0, `Test directory ${dir} should contain test files`);
      }
    });
  });
});

describe('Migration Safety - Package Dependencies', function () {
  it('Required dependencies are installed', function () {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = ['three', 'pako', 'geotiff'];

    requiredDeps.forEach(dep => {
      assert(packageJson.dependencies[dep], `Required dependency missing: ${dep}`);
    });
  });

  it('Development dependencies are installed', function () {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDevDeps = ['webpack', 'typescript', 'ts-loader'];

    requiredDevDeps.forEach(dep => {
      assert(packageJson.devDependencies[dep], `Required dev dependency missing: ${dep}`);
    });
  });
});

// This test can be run manually to ensure VS Code extension works
describe('Migration Safety - Manual Verification Checklist', function () {
  it('Manual test checklist exists', function () {
    const checklist = [
      '1. Press F5 in VS Code to launch Extension Development Host',
      '2. Navigate to testfiles/ply/ directory',
      '3. Right-click a .ply file → "Open with 3D Visualizer"',
      '4. Verify 3D visualization loads without console errors',
      '5. Test camera controls (mouse drag, zoom)',
      '6. Load different file types (.stl, .obj, .tif)',
      '7. Verify all functionality works as expected',
    ];

    console.log('\n🧪 MANUAL VERIFICATION CHECKLIST:');
    checklist.forEach(item => console.log(`   ${item}`));
    console.log('\n   ✅ Complete this checklist before migration');
    console.log('   ⚠️  Any failures indicate current system has issues\n');

    // This always passes - it's just documentation
    assert(true, 'Manual checklist displayed');
  });
});
