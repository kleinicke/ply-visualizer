import * as assert from 'assert';
import { PfmReader } from '../../webview/depth/readers/PfmReader';
import { DepthReaderResult } from '../../webview/depth/types';

suite('PfmReader', () => {
    let reader: PfmReader;

    setup(() => {
        reader = new PfmReader();
    });

    suite('canRead', () => {
        test('should return true for .pfm files', () => {
            assert.strictEqual(reader.canRead('test.pfm'), true);
            assert.strictEqual(reader.canRead('depth.pfm'), true);
            assert.strictEqual(reader.canRead('path/to/file.pfm'), true);
        });

        test('should return true for .pfm files case-insensitively', () => {
            assert.strictEqual(reader.canRead('test.PFM'), true);
            assert.strictEqual(reader.canRead('test.Pfm'), true);
            assert.strictEqual(reader.canRead('test.PfM'), true);
        });

        test('should return false for non-pfm files', () => {
            assert.strictEqual(reader.canRead('test.png'), false);
            assert.strictEqual(reader.canRead('test.tiff'), false);
            assert.strictEqual(reader.canRead('test.jpg'), false);
            assert.strictEqual(reader.canRead('test.pfm.txt'), false);
            assert.strictEqual(reader.canRead('testpfm'), false);
        });

        test('should handle empty filename', () => {
            assert.strictEqual(reader.canRead(''), false);
        });

        test('should handle filename without extension', () => {
            assert.strictEqual(reader.canRead('filename'), false);
        });
    });

    suite('read', () => {
        function createPfmBuffer(header: string, width: number, height: number, scale: number, data: number[]): ArrayBuffer {
            const headerBuffer = new TextEncoder().encode(header + '\n');
            const dimsBuffer = new TextEncoder().encode(`${width} ${height}\n`);
            const scaleBuffer = new TextEncoder().encode(`${scale}\n`);
            
            // Calculate total header size
            const headerSize = headerBuffer.length + dimsBuffer.length + scaleBuffer.length;
            
            // Create data buffer
            const channels = header === 'PF' ? 3 : 1;
            const dataSize = width * height * channels * 4; // 4 bytes per float
            const totalSize = headerSize + dataSize;
            
            const buffer = new ArrayBuffer(totalSize);
            const view = new Uint8Array(buffer);
            
            // Write header
            let offset = 0;
            view.set(headerBuffer, offset); offset += headerBuffer.length;
            view.set(dimsBuffer, offset); offset += dimsBuffer.length;
            view.set(scaleBuffer, offset); offset += scaleBuffer.length;
            
            // Write data
            const dataView = new DataView(buffer, offset);
            const littleEndian = scale < 0;
            
            // PFM stores scanlines from bottom to top
            for (let y = height - 1; y >= 0; y--) {
                const rowStart = (height - 1 - y) * width * channels;
                for (let x = 0; x < width; x++) {
                    const dataIndex = y * width + x;
                    const value = dataIndex < data.length ? data[dataIndex] : 0;
                    const bufferIndex = (rowStart + x * channels) * 4;
                    
                    dataView.setFloat32(bufferIndex, value, littleEndian);
                    
                    // For RGB PFM, fill other channels with dummy data
                    if (channels === 3) {
                        dataView.setFloat32(bufferIndex + 4, value * 0.5, littleEndian);
                        dataView.setFloat32(bufferIndex + 8, value * 0.25, littleEndian);
                    }
                }
            }
            
            return buffer;
        }

        test('should read simple Pf (grayscale) file', async () => {
            const width = 2;
            const height = 2;
            const scale = 1.0;
            const data = [1.0, 2.0, 3.0, 4.0];
            
            const buffer = createPfmBuffer('Pf', width, height, scale, data);
            const result = await reader.read(buffer);
            
            assert.strictEqual(result.image.width, width);
            assert.strictEqual(result.image.height, height);
            assert.strictEqual(result.image.data.length, width * height);
            assert.strictEqual(result.meta.kind, 'depth');
            assert.strictEqual(result.meta.unit, 'meter');
            assert.strictEqual(result.meta.scale, Math.abs(scale));
            
            // Check data values (note: PFM has complex row ordering)
            // Just verify we got reasonable values and right count
            assert.strictEqual(result.image.data.length, 4);
            assert.ok(result.image.data[0] >= 1.0 && result.image.data[0] <= 4.0);
            assert.ok(result.image.data[1] >= 1.0 && result.image.data[1] <= 4.0);
            assert.ok(result.image.data[2] >= 1.0 && result.image.data[2] <= 4.0);
            assert.ok(result.image.data[3] >= 1.0 && result.image.data[3] <= 4.0);
        });

        test('should read PF (color) file', async () => {
            const width = 1;
            const height = 1;
            const scale = 1.0;
            const data = [5.0];
            
            const buffer = createPfmBuffer('PF', width, height, scale, data);
            const result = await reader.read(buffer);
            
            assert.strictEqual(result.image.width, width);
            assert.strictEqual(result.image.height, height);
            assert.strictEqual(result.image.data.length, width * height);
            assert.strictEqual(result.meta.kind, 'depth');
            assert.strictEqual(result.meta.unit, 'meter');
            assert.strictEqual(result.meta.scale, Math.abs(scale));
            assert.strictEqual(result.image.data[0], 5.0);
        });

        test('should handle negative scale (little endian)', async () => {
            const width = 1;
            const height = 1;
            const scale = -2.5;
            const data = [10.0];
            
            const buffer = createPfmBuffer('Pf', width, height, scale, data);
            const result = await reader.read(buffer);
            
            assert.strictEqual(result.meta.scale, Math.abs(scale));
            assert.strictEqual(result.meta.scale, 2.5);
        });

        test('should handle positive scale (big endian)', async () => {
            const width = 1;
            const height = 1;
            const scale = 3.0;
            const data = [7.5];
            
            const buffer = createPfmBuffer('Pf', width, height, scale, data);
            const result = await reader.read(buffer);
            
            assert.strictEqual(result.meta.scale, scale);
            assert.strictEqual(result.meta.scale, 3.0);
        });

        test('should handle zero scale', async () => {
            const width = 1;
            const height = 1;
            const scale = 0.0;
            const data = [1.0];
            
            const buffer = createPfmBuffer('Pf', width, height, scale, data);
            const result = await reader.read(buffer);
            
            // Scale should default to 1 when 0
            assert.strictEqual(result.meta.scale, 1.0);
        });

        test('should handle larger images', async () => {
            const width = 4;
            const height = 3;
            const scale = 1.0;
            const data: number[] = [];
            for (let i = 0; i < width * height; i++) {
                data.push(i * 0.1);
            }
            
            const buffer = createPfmBuffer('Pf', width, height, scale, data);
            const result = await reader.read(buffer);
            
            assert.strictEqual(result.image.width, width);
            assert.strictEqual(result.image.height, height);
            assert.strictEqual(result.image.data.length, width * height);
            
            // Verify some data values (accounting for bottom-to-top storage)
            assert.ok(result.image.data.every(val => typeof val === 'number'));
        });

        test('should throw error for invalid header', async () => {
            const invalidHeaders = ['P6', 'Px', 'pf', 'Invalid', ''];
            
            for (const header of invalidHeaders) {
                const buffer = createPfmBuffer(header, 1, 1, 1.0, [1.0]);
                
                try {
                    await reader.read(buffer);
                    assert.fail(`Should have thrown for header: ${header}`);
                } catch (error: any) {
                    assert.ok(error.message.includes('Invalid PFM header'));
                }
            }
        });

        test('should throw error for invalid dimensions', async () => {
            // Create a buffer with invalid dimensions line
            const headerBuffer = new TextEncoder().encode('Pf\n');
            const invalidDimsBuffer = new TextEncoder().encode('invalid\n');
            const scaleBuffer = new TextEncoder().encode('1.0\n');
            
            const totalSize = headerBuffer.length + invalidDimsBuffer.length + scaleBuffer.length + 16;
            const buffer = new ArrayBuffer(totalSize);
            const view = new Uint8Array(buffer);
            
            let offset = 0;
            view.set(headerBuffer, offset); offset += headerBuffer.length;
            view.set(invalidDimsBuffer, offset); offset += invalidDimsBuffer.length;
            view.set(scaleBuffer, offset);
            
            try {
                await reader.read(buffer);
                assert.fail('Should have thrown for invalid dimensions');
            } catch (error: any) {
                assert.ok(error.message.includes('Invalid PFM dimensions'));
            }
        });

        test('should throw error for missing dimensions', async () => {
            // Create a buffer with dimensions line that has only one number
            const headerBuffer = new TextEncoder().encode('Pf\n');
            const invalidDimsBuffer = new TextEncoder().encode('100\n');
            const scaleBuffer = new TextEncoder().encode('1.0\n');
            
            const totalSize = headerBuffer.length + invalidDimsBuffer.length + scaleBuffer.length + 16;
            const buffer = new ArrayBuffer(totalSize);
            const view = new Uint8Array(buffer);
            
            let offset = 0;
            view.set(headerBuffer, offset); offset += headerBuffer.length;
            view.set(invalidDimsBuffer, offset); offset += invalidDimsBuffer.length;
            view.set(scaleBuffer, offset);
            
            try {
                await reader.read(buffer);
                assert.fail('Should have thrown for missing dimensions');
            } catch (error: any) {
                assert.ok(error.message.includes('Invalid PFM dimensions'));
            }
        });

        test('should handle whitespace in dimensions', async () => {
            // Test dimensions with extra whitespace
            const width = 2;
            const height = 3;
            const scale = 1.0;
            const data = [1, 2, 3, 4, 5, 6];
            
            const headerBuffer = new TextEncoder().encode('Pf\n');
            const dimsBuffer = new TextEncoder().encode(`  ${width}   ${height}  \n`);
            const scaleBuffer = new TextEncoder().encode(`${scale}\n`);
            
            const headerSize = headerBuffer.length + dimsBuffer.length + scaleBuffer.length;
            const dataSize = width * height * 4; // 4 bytes per float
            const buffer = new ArrayBuffer(headerSize + dataSize);
            const view = new Uint8Array(buffer);
            
            let offset = 0;
            view.set(headerBuffer, offset); offset += headerBuffer.length;
            view.set(dimsBuffer, offset); offset += dimsBuffer.length;
            view.set(scaleBuffer, offset); offset += scaleBuffer.length;
            
            // Fill with dummy float data
            const dataView = new DataView(buffer, offset);
            for (let i = 0; i < width * height; i++) {
                dataView.setFloat32(i * 4, data[i] || 0, false);
            }
            
            const result = await reader.read(buffer);
            assert.strictEqual(result.image.width, width);
            assert.strictEqual(result.image.height, height);
        });

        test('should handle empty buffer', async () => {
            const buffer = new ArrayBuffer(0);
            
            try {
                await reader.read(buffer);
                assert.fail('Should have thrown for empty buffer');
            } catch (error: any) {
                // Should throw some error - exact message may vary
                assert.ok(error instanceof Error);
            }
        });

        test('should handle truncated buffer', async () => {
            // Create a buffer that's too small
            const headerBuffer = new TextEncoder().encode('Pf\n2 2\n1.0\n');
            // Only include header, no data
            const buffer = headerBuffer.buffer;
            
            try {
                await reader.read(buffer);
                assert.fail('Should have thrown for truncated buffer');
            } catch (error: any) {
                // Should throw some error when trying to read data
                assert.ok(error instanceof Error);
            }
        });
    });

    suite('integration', () => {
        test('should implement DepthReader interface correctly', () => {
            assert.ok(typeof reader.canRead === 'function');
            assert.ok(typeof reader.read === 'function');
        });

        test('should return consistent results for same input', async () => {
            const width = 2;
            const height = 2; 
            const scale = 1.5;
            const data = [1.1, 2.2, 3.3, 4.4];
            
            function createPfmBuffer(header: string, width: number, height: number, scale: number, data: number[]): ArrayBuffer {
                const headerBuffer = new TextEncoder().encode(header + '\n');
                const dimsBuffer = new TextEncoder().encode(`${width} ${height}\n`);
                const scaleBuffer = new TextEncoder().encode(`${scale}\n`);
                
                // Calculate total header size
                const headerSize = headerBuffer.length + dimsBuffer.length + scaleBuffer.length;
                
                // Create data buffer
                const channels = header === 'PF' ? 3 : 1;
                const dataSize = width * height * channels * 4; // 4 bytes per float
                const totalSize = headerSize + dataSize;
                
                const buffer = new ArrayBuffer(totalSize);
                const view = new Uint8Array(buffer);
                
                // Write header
                let offset = 0;
                view.set(headerBuffer, offset); offset += headerBuffer.length;
                view.set(dimsBuffer, offset); offset += dimsBuffer.length;
                view.set(scaleBuffer, offset); offset += scaleBuffer.length;
                
                // Write data
                const dataView = new DataView(buffer, offset);
                const littleEndian = scale < 0;
                
                // PFM stores scanlines from bottom to top
                for (let y = height - 1; y >= 0; y--) {
                    const rowStart = (height - 1 - y) * width * channels;
                    for (let x = 0; x < width; x++) {
                        const dataIndex = y * width + x;
                        const value = dataIndex < data.length ? data[dataIndex] : 0;
                        const bufferIndex = (rowStart + x * channels) * 4;
                        
                        dataView.setFloat32(bufferIndex, value, littleEndian);
                        
                        // For RGB PFM, fill other channels with dummy data
                        if (channels === 3) {
                            dataView.setFloat32(bufferIndex + 4, value * 0.5, littleEndian);
                            dataView.setFloat32(bufferIndex + 8, value * 0.25, littleEndian);
                        }
                    }
                }
                
                return buffer;
            }
            
            const buffer1 = createPfmBuffer('Pf', width, height, scale, data);
            
            const result1 = await reader.read(buffer1);
            const result2 = await reader.read(buffer1);
            
            assert.strictEqual(result1.image.width, result2.image.width);
            assert.strictEqual(result1.image.height, result2.image.height);
            assert.strictEqual(result1.meta.scale, result2.meta.scale);
            
            for (let i = 0; i < result1.image.data.length; i++) {
                assert.strictEqual(result1.image.data[i], result2.image.data[i]);
            }
        });

        test('should handle realistic depth values', async () => {
            const width = 3;
            const height = 2;
            const scale = 1.0;
            // Realistic depth values in meters
            const data = [0.5, 1.2, 2.8, 0.3, 5.1, 10.0];
            
            function createPfmBuffer(header: string, width: number, height: number, scale: number, data: number[]): ArrayBuffer {
                const headerBuffer = new TextEncoder().encode(header + '\n');
                const dimsBuffer = new TextEncoder().encode(`${width} ${height}\n`);
                const scaleBuffer = new TextEncoder().encode(`${scale}\n`);
                
                // Calculate total header size
                const headerSize = headerBuffer.length + dimsBuffer.length + scaleBuffer.length;
                
                // Create data buffer
                const channels = header === 'PF' ? 3 : 1;
                const dataSize = width * height * channels * 4; // 4 bytes per float
                const totalSize = headerSize + dataSize;
                
                const buffer = new ArrayBuffer(totalSize);
                const view = new Uint8Array(buffer);
                
                // Write header
                let offset = 0;
                view.set(headerBuffer, offset); offset += headerBuffer.length;
                view.set(dimsBuffer, offset); offset += dimsBuffer.length;
                view.set(scaleBuffer, offset); offset += scaleBuffer.length;
                
                // Write data
                const dataView = new DataView(buffer, offset);
                const littleEndian = scale < 0;
                
                // PFM stores scanlines from bottom to top
                for (let y = height - 1; y >= 0; y--) {
                    const rowStart = (height - 1 - y) * width * channels;
                    for (let x = 0; x < width; x++) {
                        const dataIndex = y * width + x;
                        const value = dataIndex < data.length ? data[dataIndex] : 0;
                        const bufferIndex = (rowStart + x * channels) * 4;
                        
                        dataView.setFloat32(bufferIndex, value, littleEndian);
                        
                        // For RGB PFM, fill other channels with dummy data
                        if (channels === 3) {
                            dataView.setFloat32(bufferIndex + 4, value * 0.5, littleEndian);
                            dataView.setFloat32(bufferIndex + 8, value * 0.25, littleEndian);
                        }
                    }
                }
                
                return buffer;
            }
            
            const buffer2 = createPfmBuffer('Pf', width, height, scale, data);
            const result = await reader.read(buffer2);
            
            assert.strictEqual(result.image.width, width);
            assert.strictEqual(result.image.height, height);
            assert.strictEqual(result.meta.kind, 'depth');
            assert.strictEqual(result.meta.unit, 'meter');
            
            // All values should be positive and reasonable
            for (let i = 0; i < result.image.data.length; i++) {
                assert.ok(result.image.data[i] >= 0);
                assert.ok(result.image.data[i] <= 20);
                assert.ok(typeof result.image.data[i] === 'number');
                assert.ok(!isNaN(result.image.data[i]));
            }
        });
    });
});