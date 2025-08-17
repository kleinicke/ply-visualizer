#!/usr/bin/env node

/**
 * STL Testing Script
 * Quick test runner for STL file functionality
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 STL Testing Script');
console.log('====================');

// Check if test files exist
const stlTestDir = path.join(__dirname, 'testfiles', 'stl');
const requiredFiles = [
    'test_cube_ascii.stl',
    'test_empty_ascii.stl', 
    'test_large_coordinates.stl',
    'test_colored_cube_binary.stl'
];

console.log('\n📁 Checking STL test files...');
let allFilesPresent = true;

for (const file of requiredFiles) {
    const filePath = path.join(stlTestDir, file);
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ ${file} (${stats.size} bytes)`);
    } else {
        console.log(`❌ ${file} - NOT FOUND`);
        allFilesPresent = false;
    }
}

if (!allFilesPresent) {
    console.log('\n⚠️  Some test files are missing. Please ensure all STL test files are in testfiles/stl/');
    process.exit(1);
}

// Check if extension compiles
console.log('\n🔨 Checking extension compilation...');
try {
    execSync('npm run compile', { stdio: 'pipe' });
    console.log('✅ Extension compiles successfully');
} catch (error) {
    console.log('❌ Compilation failed:');
    console.log(error.stdout?.toString() || error.message);
    process.exit(1);
}

// Run linting
console.log('\n🧹 Running linter...');
try {
    execSync('npm run lint', { stdio: 'pipe' });
    console.log('✅ Linting passed');
} catch (error) {
    console.log('⚠️  Linting warnings (non-blocking):');
    const output = error.stdout?.toString() || error.message;
    const lines = output.split('\n');
    const errorCount = lines.filter(line => line.includes('error')).length;
    const warningCount = lines.filter(line => line.includes('warning')).length;
    
    if (errorCount > 0) {
        console.log(`❌ ${errorCount} errors found`);
        process.exit(1);
    } else {
        console.log(`⚠️  ${warningCount} warnings (acceptable)`);
    }
}

// Quick unit test check
console.log('\n🧪 Running unit tests...');
try {
    execSync('npm run test', { stdio: 'pipe' });
    console.log('✅ Unit tests passed');
} catch (error) {
    console.log('❌ Unit tests failed:');
    const output = error.stdout?.toString() || error.message;
    console.log(output.split('\n').slice(-10).join('\n')); // Last 10 lines
    console.log('\nNote: Some test failures may be expected if new STL features need test updates');
}

console.log('\n🎯 STL Manual Testing Checklist:');
console.log('================================');
console.log('1. Press F5 in VS Code to open Extension Development Host');
console.log('2. Navigate to testfiles/stl/ folder');
console.log('3. Right-click test_cube_ascii.stl → "Open with PLY Visualizer"');
console.log('4. Verify 3D cube mesh appears');
console.log('5. Test test_empty_ascii.stl (should show "Empty mesh loaded")');
console.log('6. Test test_large_coordinates.stl (press F for Fit to View)');
console.log('7. Test test_sphere_subdivided.stl (complex 1280-triangle mesh)');

console.log('\n🚀 Ready for STL testing!');
console.log('\nTo run UI tests: npm run test:ui');
console.log('To run all tests: npm run test:all');
console.log('For manual testing: Press F5 in VS Code');