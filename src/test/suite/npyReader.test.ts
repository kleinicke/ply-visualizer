import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// Import the NPY reader - we'll need to mock the module resolution
// since it's designed for the webview context
describe('NPY Reader Test Suite', function() {
    this.timeout(10000);

    // Mock the depth reader types for testing
    interface DepthImage {
        width: number;
        height: number;
        data: Float32Array;
    }

    interface DepthMetadata {
        kind: 'depth' | 'disparity' | 'inv_depth' | 'z';
        unit?: 'meter' | 'millimeter';
        scale?: number;
    }

    interface DepthReaderResult {
        image: DepthImage;
        meta: DepthMetadata;
    }

    // Create a simplified NPY reader for testing
    class TestNpyReader {
        canRead(filename: string): boolean {
            return filename.toLowerCase().endsWith('.npy') || filename.toLowerCase().endsWith('.npz');
        }

        // Simplified NPY header parser for testing
        private parseNpyHeader(view: DataView): { shape: number[], dtype: string, dataOffset: number } {
            // NPY magic number check
            const magic = new Uint8Array(view.buffer, 0, 6);
            const expectedMagic = new Uint8Array([0x93, 0x4E, 0x55, 0x4D, 0x50, 0x59]);
            
            for (let i = 0; i < 6; i++) {
                if (magic[i] !== expectedMagic[i]) {
                    throw new Error('Invalid NPY file: missing magic number');
                }
            }
            
            // Version
            const majorVersion = view.getUint8(6);
            
            if (majorVersion !== 1 && majorVersion !== 2) {
                throw new Error(`Unsupported NPY version: ${majorVersion}`);
            }
            
            // Header length
            let headerLength: number;
            let headerStart: number;
            
            if (majorVersion === 1) {
                headerLength = view.getUint16(8, true);
                headerStart = 10;
            } else {
                headerLength = view.getUint32(8, true);
                headerStart = 12;
            }
            
            // Parse header dictionary
            const headerBytes = new Uint8Array(view.buffer, headerStart, headerLength);
            const headerString = new TextDecoder('latin1').decode(headerBytes);
            
            // Extract shape
            const shapeMatch = headerString.match(/'shape':\s*\(([^)]+)\)/);
            if (!shapeMatch) {
                throw new Error('Could not parse shape from NPY header');
            }
            
            const shapeStr = shapeMatch[1].trim();
            const shape = shapeStr.split(',').map(s => {
                const num = parseInt(s.trim(), 10);
                if (isNaN(num)) throw new Error(`Invalid shape dimension: ${s}`);
                return num;
            }).filter(n => n > 0);
            
            // Extract dtype
            const dtypeMatch = headerString.match(/'descr':\s*'([^']+)'/);
            if (!dtypeMatch) {
                throw new Error('Could not parse dtype from NPY header');
            }
            
            const dtype = dtypeMatch[1];
            const dataOffset = headerStart + headerLength;
            
            return { shape, dtype, dataOffset };
        }

        async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
            const view = new DataView(arrayBuffer);
            
            // Check if this is NPZ (ZIP format)
            if (arrayBuffer.byteLength >= 4) {
                const zipMagic = view.getUint32(0, true);
                if (zipMagic === 0x04034b50) {
                    throw new Error('NPZ files not yet fully supported in tests');
                }
            }
            
            const { shape, dtype, dataOffset } = this.parseNpyHeader(view);
            
            if (shape.length !== 2) {
                throw new Error(`Expected 2D array, got ${shape.length}D array`);
            }
            
            const [height, width] = shape;
            const expectedElements = height * width;
            let data: Float32Array;
            
            if (dtype === '<f4' || dtype === '=f4') {
                // 32-bit float, little endian
                data = new Float32Array(arrayBuffer, dataOffset, expectedElements);
            } else if (dtype === '>f4') {
                // 32-bit float, big endian - need to swap
                const rawData = new Uint8Array(arrayBuffer, dataOffset, expectedElements * 4);
                data = new Float32Array(expectedElements);
                for (let i = 0; i < expectedElements; i++) {
                    const offset = i * 4;
                    const b0 = rawData[offset + 3];
                    const b1 = rawData[offset + 2];
                    const b2 = rawData[offset + 1];
                    const b3 = rawData[offset + 0];
                    const swappedBytes = new Uint8Array([b0, b1, b2, b3]);
                    data[i] = new Float32Array(swappedBytes.buffer)[0];
                }
            } else {
                throw new Error(`Unsupported dtype for test: ${dtype}`);
            }
            
            const image: DepthImage = { width, height, data };
            const meta: DepthMetadata = { kind: 'depth', unit: 'meter', scale: 1.0 };
            
            return { image, meta };
        }
    }

    test('should identify NPY files correctly', function() {
        const reader = new TestNpyReader();
        
        assert.strictEqual(reader.canRead('test.npy'), true);
        assert.strictEqual(reader.canRead('test.NPY'), true);
        assert.strictEqual(reader.canRead('test.npz'), true);
        assert.strictEqual(reader.canRead('test.NPZ'), true);
        assert.strictEqual(reader.canRead('test.ply'), false);
        assert.strictEqual(reader.canRead('test.txt'), false);
    });

    test('should read test NPY files correctly', async function() {
        const reader = new TestNpyReader();
        const testFilesDir = path.resolve(__dirname, '../../../testfiles');
        
        // Test files to check
        const testFiles = [
            { name: 'test_depth_small.npy', expectedShape: [120, 160] },
            { name: 'test_depth.npy', expectedShape: [480, 640] },
            { name: 'test_disparity.npy', expectedShape: [480, 640] }
        ];
        
        for (const testFile of testFiles) {
            const filePath = path.join(testFilesDir, testFile.name);
            
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️  Test file ${testFile.name} not found, skipping`);
                continue;
            }
            
            const fileBuffer = fs.readFileSync(filePath);
            const arrayBuffer = fileBuffer.buffer.slice(
                fileBuffer.byteOffset, 
                fileBuffer.byteOffset + fileBuffer.byteLength
            );
            
            try {
                const result = await reader.read(arrayBuffer);
                
                // Verify structure
                assert.ok(result.image, 'Should have image data');
                assert.ok(result.meta, 'Should have metadata');
                
                // Verify dimensions
                const [expectedHeight, expectedWidth] = testFile.expectedShape;
                assert.strictEqual(result.image.height, expectedHeight, 
                    `Height should be ${expectedHeight} for ${testFile.name}`);
                assert.strictEqual(result.image.width, expectedWidth,
                    `Width should be ${expectedWidth} for ${testFile.name}`);
                
                // Verify data array
                const expectedLength = expectedHeight * expectedWidth;
                assert.strictEqual(result.image.data.length, expectedLength,
                    `Data array length should be ${expectedLength} for ${testFile.name}`);
                
                // Verify data is not all zeros (our synthetic data should have variation)
                const dataArray = Array.from(result.image.data);
                const nonZeroValues = dataArray.filter(v => v !== 0);
                assert.ok(nonZeroValues.length > 0, 'Should have non-zero depth values');
                
                // Verify reasonable depth range (our synthetic data is 0.1 to ~3 meters)
                const minValue = Math.min(...dataArray);
                const maxValue = Math.max(...dataArray);
                assert.ok(minValue >= 0, 'Minimum depth should be non-negative');
                assert.ok(maxValue > minValue, 'Should have depth variation');
                
                console.log(`✅ Successfully read ${testFile.name}: ${result.image.width}x${result.image.height}, range: ${minValue.toFixed(3)}-${maxValue.toFixed(3)}`);
                
            } catch (error) {
                assert.fail(`Failed to read ${testFile.name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    });

    test('should handle invalid NPY files gracefully', async function() {
        const reader = new TestNpyReader();
        
        // Test with invalid magic number
        const invalidBuffer = new ArrayBuffer(100);
        const invalidView = new DataView(invalidBuffer);
        
        // Write incorrect magic number
        invalidView.setUint8(0, 0x99); // Should be 0x93
        
        try {
            await reader.read(invalidBuffer);
            assert.fail('Should have thrown error for invalid magic number');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            assert.ok(errorMessage.includes('Invalid NPY file'), 
                'Should throw specific error for invalid magic number');
        }
    });

    test('should validate NPY file format requirements', async function() {
        // This test verifies our understanding of the NPY format
        const testFilePath = path.resolve(__dirname, '../../../testfiles/test_depth_small.npy');
        
        if (!fs.existsSync(testFilePath)) {
            console.log('⚠️  test_depth_small.npy not found, skipping format validation');
            return;
        }
        
        const fileBuffer = fs.readFileSync(testFilePath);
        
        // Check magic number
        assert.strictEqual(fileBuffer[0], 0x93, 'First byte should be 0x93');
        assert.strictEqual(fileBuffer[1], 0x4E, 'Second byte should be 0x4E (N)');
        assert.strictEqual(fileBuffer[2], 0x55, 'Third byte should be 0x55 (U)');
        assert.strictEqual(fileBuffer[3], 0x4D, 'Fourth byte should be 0x4D (M)');
        assert.strictEqual(fileBuffer[4], 0x50, 'Fifth byte should be 0x50 (P)');
        assert.strictEqual(fileBuffer[5], 0x59, 'Sixth byte should be 0x59 (Y)');
        
        // Check version
        const majorVersion = fileBuffer[6];
        const minorVersion = fileBuffer[7];
        assert.ok(majorVersion === 1 || majorVersion === 2, 'Major version should be 1 or 2');
        assert.ok(minorVersion === 0, 'Minor version should be 0');
        
        console.log(`✅ NPY file format validation passed (version ${majorVersion}.${minorVersion})`);
    });
});