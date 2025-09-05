import * as assert from 'assert';
import { CameraModel, DepthKind, DepthImage, DepthMetadata, DepthReaderResult, DepthReader } from '../../webview/depth/types';

suite('Webview Depth Types', () => {
    
    suite('CameraModel type', () => {
        test('should accept pinhole-ideal model', () => {
            const model: CameraModel = 'pinhole-ideal';
            assert.strictEqual(model, 'pinhole-ideal');
        });

        test('should accept pinhole-opencv model', () => {
            const model: CameraModel = 'pinhole-opencv';
            assert.strictEqual(model, 'pinhole-opencv');
        });

        test('should accept fisheye-equidistant model', () => {
            const model: CameraModel = 'fisheye-equidistant';
            assert.strictEqual(model, 'fisheye-equidistant');
        });

        test('should accept fisheye-opencv model', () => {
            const model: CameraModel = 'fisheye-opencv';
            assert.strictEqual(model, 'fisheye-opencv');
        });

        test('should accept fisheye-kannala-brandt model', () => {
            const model: CameraModel = 'fisheye-kannala-brandt';
            assert.strictEqual(model, 'fisheye-kannala-brandt');
        });

        test('should be used in type checking', () => {
            const models: CameraModel[] = [
                'pinhole-ideal',
                'pinhole-opencv', 
                'fisheye-equidistant',
                'fisheye-opencv',
                'fisheye-kannala-brandt'
            ];
            
            assert.strictEqual(models.length, 5);
            models.forEach(model => {
                assert.ok(typeof model === 'string');
            });
        });
    });

    suite('DepthKind type', () => {
        test('should accept depth kind', () => {
            const kind: DepthKind = 'depth';
            assert.strictEqual(kind, 'depth');
        });

        test('should accept disparity kind', () => {
            const kind: DepthKind = 'disparity';
            assert.strictEqual(kind, 'disparity');
        });

        test('should accept inverse_depth kind', () => {
            const kind: DepthKind = 'inverse_depth';
            assert.strictEqual(kind, 'inverse_depth');
        });

        test('should accept z kind', () => {
            const kind: DepthKind = 'z';
            assert.strictEqual(kind, 'z');
        });

        test('should be used in type checking', () => {
            const kinds: DepthKind[] = ['depth', 'disparity', 'inverse_depth', 'z'];
            
            assert.strictEqual(kinds.length, 4);
            kinds.forEach(kind => {
                assert.ok(typeof kind === 'string');
            });
        });
    });

    suite('DepthImage interface', () => {
        test('should create DepthImage with required properties', () => {
            const data = new Float32Array([1, 2, 3, 4]);
            const image: DepthImage = {
                width: 2,
                height: 2,
                data: data
            };
            
            assert.strictEqual(image.width, 2);
            assert.strictEqual(image.height, 2);
            assert.strictEqual(image.data, data);
            assert.strictEqual(image.data.length, 4);
        });

        test('should validate data size consistency', () => {
            const width = 10;
            const height = 15;
            const data = new Float32Array(width * height);
            
            const image: DepthImage = {
                width,
                height,
                data
            };
            
            assert.strictEqual(image.data.length, width * height);
            assert.strictEqual(image.data.length, 150);
        });

        test('should handle empty image', () => {
            const image: DepthImage = {
                width: 0,
                height: 0,
                data: new Float32Array(0)
            };
            
            assert.strictEqual(image.width, 0);
            assert.strictEqual(image.height, 0);
            assert.strictEqual(image.data.length, 0);
        });

        test('should handle large image dimensions', () => {
            const width = 1920;
            const height = 1080;
            const data = new Float32Array(width * height);
            
            const image: DepthImage = {
                width,
                height,
                data
            };
            
            assert.strictEqual(image.width, width);
            assert.strictEqual(image.height, height);
            assert.strictEqual(image.data.length, width * height);
        });

        test('should accept different Float32Array values', () => {
            const data = new Float32Array([0.1, 1.5, 10.0, 100.5]);
            const image: DepthImage = {
                width: 2,
                height: 2,
                data
            };
            
            // Use approximate equality for floating point values
            assert.ok(Math.abs(image.data[0] - 0.1) < 0.0001);
            assert.strictEqual(image.data[1], 1.5);
            assert.strictEqual(image.data[2], 10.0);
            assert.strictEqual(image.data[3], 100.5);
        });
    });

    suite('DepthMetadata interface', () => {
        test('should create minimal DepthMetadata', () => {
            const meta: DepthMetadata = {
                kind: 'depth'
            };
            
            assert.strictEqual(meta.kind, 'depth');
        });

        test('should create DepthMetadata with unit', () => {
            const meta: DepthMetadata = {
                kind: 'depth',
                unit: 'meter'
            };
            
            assert.strictEqual(meta.kind, 'depth');
            assert.strictEqual(meta.unit, 'meter');
        });

        test('should create DepthMetadata with millimeter unit', () => {
            const meta: DepthMetadata = {
                kind: 'depth',
                unit: 'millimeter'
            };
            
            assert.strictEqual(meta.unit, 'millimeter');
        });

        test('should create DepthMetadata with scale', () => {
            const meta: DepthMetadata = {
                kind: 'depth',
                scale: 1000.0
            };
            
            assert.strictEqual(meta.scale, 1000.0);
        });

        test('should create DepthMetadata with camera intrinsics', () => {
            const meta: DepthMetadata = {
                kind: 'depth',
                fx: 500.0,
                fy: 500.0,
                cx: 320.0,
                cy: 240.0
            };
            
            assert.strictEqual(meta.fx, 500.0);
            assert.strictEqual(meta.fy, 500.0);
            assert.strictEqual(meta.cx, 320.0);
            assert.strictEqual(meta.cy, 240.0);
        });

        test('should create DepthMetadata with disparity parameters', () => {
            const meta: DepthMetadata = {
                kind: 'disparity',
                baseline: 0.12,
                disparityOffset: 0.5
            };
            
            assert.strictEqual(meta.kind, 'disparity');
            assert.strictEqual(meta.baseline, 0.12);
            assert.strictEqual(meta.disparityOffset, 0.5);
        });

        test('should create DepthMetadata with depth scale and bias', () => {
            const meta: DepthMetadata = {
                kind: 'depth',
                depthScale: 1000.0,
                depthBias: 0.1
            };
            
            assert.strictEqual(meta.depthScale, 1000.0);
            assert.strictEqual(meta.depthBias, 0.1);
        });

        test('should create DepthMetadata with camera model', () => {
            const meta: DepthMetadata = {
                kind: 'depth',
                cameraModel: 'pinhole-opencv'
            };
            
            assert.strictEqual(meta.cameraModel, 'pinhole-opencv');
        });

        test('should create DepthMetadata with coordinate conventions', () => {
            const opencvMeta: DepthMetadata = {
                kind: 'depth',
                convention: 'opencv'
            };
            
            const openglMeta: DepthMetadata = {
                kind: 'depth',
                convention: 'opengl'
            };
            
            assert.strictEqual(opencvMeta.convention, 'opencv');
            assert.strictEqual(openglMeta.convention, 'opengl');
        });

        test('should create DepthMetadata with depth clamp', () => {
            const meta: DepthMetadata = {
                kind: 'depth',
                depthClamp: {
                    min: 0.1,
                    max: 100.0
                }
            };
            
            assert.strictEqual(meta.depthClamp?.min, 0.1);
            assert.strictEqual(meta.depthClamp?.max, 100.0);
        });

        test('should create DepthMetadata with partial depth clamp', () => {
            const minOnlyMeta: DepthMetadata = {
                kind: 'depth',
                depthClamp: { min: 0.1 }
            };
            
            const maxOnlyMeta: DepthMetadata = {
                kind: 'depth',
                depthClamp: { max: 100.0 }
            };
            
            assert.strictEqual(minOnlyMeta.depthClamp?.min, 0.1);
            assert.strictEqual(minOnlyMeta.depthClamp?.max, undefined);
            assert.strictEqual(maxOnlyMeta.depthClamp?.min, undefined);
            assert.strictEqual(maxOnlyMeta.depthClamp?.max, 100.0);
        });

        test('should create DepthMetadata with NPZ metadata', () => {
            const meta: DepthMetadata = {
                kind: 'depth',
                availableArrays: {
                    'depth': { shape: [480, 640], dtype: 'float32' },
                    'mask': { shape: [480, 640], dtype: 'uint8' }
                },
                requiresConfiguration: true,
                selectedArray: 'depth',
                selectedChannel: 0
            };
            
            assert.ok(meta.availableArrays);
            assert.ok(meta.availableArrays['depth']);
            assert.deepStrictEqual(meta.availableArrays['depth'].shape, [480, 640]);
            assert.strictEqual(meta.availableArrays['depth'].dtype, 'float32');
            assert.strictEqual(meta.requiresConfiguration, true);
            assert.strictEqual(meta.selectedArray, 'depth');
            assert.strictEqual(meta.selectedChannel, 0);
        });

        test('should create DepthMetadata with PNG metadata', () => {
            const meta: DepthMetadata = {
                kind: 'depth',
                invalidValue: 0,
                bitDepth: 16
            };
            
            assert.strictEqual(meta.invalidValue, 0);
            assert.strictEqual(meta.bitDepth, 16);
        });

        test('should create DepthMetadata with all properties', () => {
            const meta: DepthMetadata = {
                kind: 'depth',
                unit: 'meter',
                scale: 1000.0,
                fx: 500.0,
                fy: 500.0,
                cx: 320.0,
                cy: 240.0,
                baseline: 0.12,
                disparityOffset: 0.5,
                depthScale: 1000.0,
                depthBias: 0.1,
                cameraModel: 'pinhole-opencv',
                convention: 'opencv',
                depthClamp: { min: 0.1, max: 100.0 },
                availableArrays: {
                    'depth': { shape: [480, 640], dtype: 'float32' }
                },
                requiresConfiguration: true,
                selectedArray: 'depth',
                selectedChannel: 0,
                invalidValue: 0,
                bitDepth: 16
            };
            
            // Verify all properties are set correctly
            assert.strictEqual(meta.kind, 'depth');
            assert.strictEqual(meta.unit, 'meter');
            assert.strictEqual(meta.scale, 1000.0);
            assert.strictEqual(meta.fx, 500.0);
            assert.strictEqual(meta.fy, 500.0);
            assert.strictEqual(meta.cx, 320.0);
            assert.strictEqual(meta.cy, 240.0);
            assert.strictEqual(meta.baseline, 0.12);
            assert.strictEqual(meta.disparityOffset, 0.5);
            assert.strictEqual(meta.depthScale, 1000.0);
            assert.strictEqual(meta.depthBias, 0.1);
            assert.strictEqual(meta.cameraModel, 'pinhole-opencv');
            assert.strictEqual(meta.convention, 'opencv');
            assert.strictEqual(meta.depthClamp?.min, 0.1);
            assert.strictEqual(meta.depthClamp?.max, 100.0);
            assert.ok(meta.availableArrays);
            assert.strictEqual(meta.requiresConfiguration, true);
            assert.strictEqual(meta.selectedArray, 'depth');
            assert.strictEqual(meta.selectedChannel, 0);
            assert.strictEqual(meta.invalidValue, 0);
            assert.strictEqual(meta.bitDepth, 16);
        });
    });

    suite('DepthReaderResult interface', () => {
        test('should create DepthReaderResult with required properties', () => {
            const image: DepthImage = {
                width: 10,
                height: 10,
                data: new Float32Array(100)
            };
            
            const meta: DepthMetadata = {
                kind: 'depth'
            };
            
            const result: DepthReaderResult = {
                image,
                meta
            };
            
            assert.strictEqual(result.image, image);
            assert.strictEqual(result.meta, meta);
            assert.strictEqual(result.image.width, 10);
            assert.strictEqual(result.image.height, 10);
            assert.strictEqual(result.meta.kind, 'depth');
        });

        test('should create DepthReaderResult with complex metadata', () => {
            const image: DepthImage = {
                width: 640,
                height: 480,
                data: new Float32Array(640 * 480)
            };
            
            const meta: DepthMetadata = {
                kind: 'disparity',
                unit: 'millimeter',
                fx: 525.0,
                fy: 525.0,
                cx: 319.5,
                cy: 239.5,
                baseline: 0.075,
                cameraModel: 'pinhole-opencv',
                convention: 'opencv'
            };
            
            const result: DepthReaderResult = {
                image,
                meta
            };
            
            assert.strictEqual(result.image.width, 640);
            assert.strictEqual(result.image.height, 480);
            assert.strictEqual(result.image.data.length, 640 * 480);
            assert.strictEqual(result.meta.kind, 'disparity');
            assert.strictEqual(result.meta.unit, 'millimeter');
            assert.strictEqual(result.meta.fx, 525.0);
            assert.strictEqual(result.meta.baseline, 0.075);
            assert.strictEqual(result.meta.cameraModel, 'pinhole-opencv');
        });
    });

    suite('DepthReader interface', () => {
        test('should implement DepthReader interface', () => {
            class TestDepthReader implements DepthReader {
                canRead(filename: string, mimeType?: string): boolean {
                    return filename.toLowerCase().endsWith('.test');
                }
                
                async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
                    const image: DepthImage = {
                        width: 1,
                        height: 1,
                        data: new Float32Array(1)
                    };
                    
                    const meta: DepthMetadata = {
                        kind: 'depth'
                    };
                    
                    return { image, meta };
                }
            }
            
            const reader = new TestDepthReader();
            assert.strictEqual(typeof reader.canRead, 'function');
            assert.strictEqual(typeof reader.read, 'function');
        });

        test('should test canRead method behavior', () => {
            class ExtensionBasedReader implements DepthReader {
                private supportedExtensions: string[];
                
                constructor(extensions: string[]) {
                    this.supportedExtensions = extensions;
                }
                
                canRead(filename: string, mimeType?: string): boolean {
                    const ext = filename.toLowerCase().split('.').pop() || '';
                    return this.supportedExtensions.includes(ext);
                }
                
                async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
                    throw new Error('Not implemented for test');
                }
            }
            
            const reader = new ExtensionBasedReader(['png', 'tif']);
            
            assert.strictEqual(reader.canRead('test.png'), true);
            assert.strictEqual(reader.canRead('test.tif'), true);
            assert.strictEqual(reader.canRead('test.jpg'), false);
            assert.strictEqual(reader.canRead('test.PNG'), true); // case insensitive
        });

        test('should test read method behavior', async () => {
            class MockDataReader implements DepthReader {
                canRead(filename: string): boolean {
                    return true;
                }
                
                async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
                    const size = arrayBuffer.byteLength / 4; // assuming float32
                    const width = Math.floor(Math.sqrt(size));
                    const height = Math.ceil(size / width);
                    
                    const image: DepthImage = {
                        width,
                        height,
                        data: new Float32Array(arrayBuffer)
                    };
                    
                    const meta: DepthMetadata = {
                        kind: 'depth',
                        unit: 'meter'
                    };
                    
                    return { image, meta };
                }
            }
            
            const reader = new MockDataReader();
            const testData = new Float32Array([1, 2, 3, 4]);
            const buffer = testData.buffer;
            
            const result = await reader.read(buffer);
            
            assert.ok(result);
            assert.ok(result.image);
            assert.ok(result.meta);
            assert.strictEqual(result.image.data.length, 4);
            assert.strictEqual(result.meta.kind, 'depth');
            assert.strictEqual(result.meta.unit, 'meter');
        });

        test('should handle mimeType parameter in canRead', () => {
            class MimeTypeAwareReader implements DepthReader {
                canRead(filename: string, mimeType?: string): boolean {
                    if (mimeType) {
                        return mimeType.startsWith('image/');
                    }
                    return filename.toLowerCase().endsWith('.img');
                }
                
                async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
                    throw new Error('Not implemented for test');
                }
            }
            
            const reader = new MimeTypeAwareReader();
            
            assert.strictEqual(reader.canRead('test.img'), true);
            assert.strictEqual(reader.canRead('test.xyz'), false);
            assert.strictEqual(reader.canRead('test.xyz', 'image/png'), true);
            assert.strictEqual(reader.canRead('test.xyz', 'text/plain'), false);
        });

        test('should handle async read method', async () => {
            class AsyncReader implements DepthReader {
                canRead(filename: string): boolean {
                    return true;
                }
                
                async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
                    // Simulate async processing
                    await new Promise(resolve => setTimeout(resolve, 1));
                    
                    return {
                        image: {
                            width: 1,
                            height: 1,
                            data: new Float32Array(1)
                        },
                        meta: {
                            kind: 'depth'
                        }
                    };
                }
            }
            
            const reader = new AsyncReader();
            const result = await reader.read(new ArrayBuffer(4));
            
            assert.ok(result);
            assert.ok(result.image);
            assert.ok(result.meta);
        });
    });

    suite('Type compatibility and validation', () => {
        test('should ensure DepthKind values match expected types', () => {
            const validKinds: DepthKind[] = ['depth', 'disparity', 'inverse_depth', 'z'];
            
            validKinds.forEach(kind => {
                const meta: DepthMetadata = { kind };
                assert.ok(typeof meta.kind === 'string');
                assert.ok(['depth', 'disparity', 'inverse_depth', 'z'].includes(meta.kind));
            });
        });

        test('should ensure CameraModel values match expected types', () => {
            const validModels: CameraModel[] = [
                'pinhole-ideal',
                'pinhole-opencv',
                'fisheye-equidistant', 
                'fisheye-opencv',
                'fisheye-kannala-brandt'
            ];
            
            validModels.forEach(model => {
                const meta: DepthMetadata = { 
                    kind: 'depth',
                    cameraModel: model 
                };
                assert.ok(typeof meta.cameraModel === 'string');
                assert.ok(validModels.includes(meta.cameraModel));
            });
        });

        test('should validate Float32Array usage', () => {
            const data = new Float32Array([1.5, 2.7, 3.14]);
            const image: DepthImage = {
                width: 3,
                height: 1,
                data
            };
            
            assert.ok(image.data instanceof Float32Array);
            assert.strictEqual(image.data.constructor.name, 'Float32Array');
            assert.strictEqual(image.data.length, 3);
        });
    });
});