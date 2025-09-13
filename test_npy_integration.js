// Quick test to verify NPY reader integration
const fs = require('fs');
const path = require('path');

// Read the NpyReader source to make sure it's properly integrated
const npyReaderPath = './src/webview/depth/readers/NpyReader.ts';
const registryPath = './src/webview/depth/DepthRegistry.ts';

console.log('Testing NPY integration...');

// Check if NpyReader exists
if (!fs.existsSync(npyReaderPath)) {
  console.error('❌ NpyReader.ts not found');
  process.exit(1);
}

// Check if NPY reader is registered
const registryContent = fs.readFileSync(registryPath, 'utf8');
if (!registryContent.includes('NpyReader')) {
  console.error('❌ NpyReader not registered in DepthRegistry');
  process.exit(1);
}

// Check if package.json includes NPY extensions
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const hasNpyPattern = packageJson.contributes.customEditors[0].selector.some(
  selector => selector.filenamePattern === '*.npy' || selector.filenamePattern === '*.npz'
);

if (!hasNpyPattern) {
  console.error('❌ NPY file patterns not found in package.json');
  process.exit(1);
}

// Check test files exist
const testFiles = [
  './testfiles/test_depth.npy',
  './testfiles/test_disparity.npy',
  './testfiles/test_depth_small.npy',
  './testfiles/test_depth_with_params.npz',
];

for (const file of testFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Test file not found: ${file}`);
    process.exit(1);
  }
}

console.log('✅ NPY integration tests passed!');
console.log('✅ NpyReader.ts exists');
console.log('✅ NPY reader registered in DepthRegistry');
console.log('✅ NPY file patterns added to package.json');
console.log('✅ All test files exist in testfiles/');
console.log('\nTo test the visualization:');
console.log('1. Press F5 in VS Code to launch Extension Development Host');
console.log('2. Open any of the NPY files in testfiles/');
console.log('3. Follow the camera parameter prompts to convert to point cloud');
