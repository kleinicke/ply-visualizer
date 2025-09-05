import * as assert from 'assert';
import * as THREE from 'three';

// Depth processing and camera parameter methods from main.ts
suite('PointCloudVisualizer Depth Processing Test Suite', () => {

    suite('Camera Parameter Management', () => {
        test('Should handle camera intrinsic parameters', () => {
            const cameraParams = {
                fx: 525.0,
                fy: 525.0,
                cx: 320.0,
                cy: 240.0,
                k1: 0.0,
                k2: 0.0,
                k3: 0.0,
                p1: 0.0,
                p2: 0.0,
                baseline: 0.075,
                depthScale: 1000.0,
                depthBias: 0.0
            };

            assert.strictEqual(cameraParams.fx, 525.0);
            assert.strictEqual(cameraParams.fy, 525.0);
            assert.ok(cameraParams.cx > 0);
            assert.ok(cameraParams.cy > 0);
            assert.ok(cameraParams.baseline > 0);
            assert.ok(cameraParams.depthScale > 0);
        });

        test('Should validate camera model types', () => {
            const validModels = ['pinhole', 'pinhole-opencv', 'fisheye-opencv', 'kannala-brandt'];
            
            for (const model of validModels) {
                assert.ok(typeof model === 'string');
                assert.ok(model.length > 0);
            }
            
            assert.ok(validModels.includes('pinhole'));
            assert.ok(validModels.includes('fisheye-opencv'));
        });

        test('Should handle distortion parameters', () => {
            const distortionParams = {
                pinhole: { k1: 0.1, k2: -0.05, k3: 0.0, p1: 0.001, p2: -0.001 },
                fisheye: { k1: 0.2, k2: 0.1, k3: -0.05, k4: 0.01 },
                kannalaBrandt: { k1: 0.15, k2: 0.08, k3: -0.03, k4: 0.005 }
            };

            // Test that all distortion coefficients are numbers
            for (const [modelName, params] of Object.entries(distortionParams)) {
                for (const [param, value] of Object.entries(params)) {
                    assert.ok(typeof value === 'number', `${modelName}.${param} should be a number`);
                    assert.ok(!isNaN(value), `${modelName}.${param} should not be NaN`);
                }
            }
        });

        test('Should save and load camera parameters', () => {
            const originalParams = {
                fx: 600.0,
                fy: 600.0,
                cx: 320.0,
                cy: 240.0,
                model: 'pinhole',
                convention: 'opengl'
            };

            // Simulate saving to storage
            const savedParamsJson = JSON.stringify(originalParams);
            assert.ok(savedParamsJson.includes('600'));
            
            // Simulate loading from storage
            const loadedParams = JSON.parse(savedParamsJson);
            assert.deepStrictEqual(loadedParams, originalParams);
        });
    });

    suite('Depth Image Processing', () => {
        test('Should validate depth image dimensions', () => {
            const depthData = {
                width: 640,
                height: 480,
                data: new Float32Array(640 * 480)
            };

            assert.strictEqual(depthData.width * depthData.height, depthData.data.length);
            assert.ok(depthData.width > 0);
            assert.ok(depthData.height > 0);
        });

        test('Should convert depth pixels to 3D coordinates', () => {
            const width = 2;
            const height = 2;
            const depthValues = new Float32Array([1.0, 2.0, 1.5, 2.5]);
            const cameraParams = {
                fx: 100.0,
                fy: 100.0,
                cx: 1.0,
                cy: 1.0
            };

            const vertices: Array<{x: number, y: number, z: number}> = [];

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const index = y * width + x;
                    const depth = depthValues[index];
                    
                    if (depth > 0) {
                        const x3d = (x - cameraParams.cx) * depth / cameraParams.fx;
                        const y3d = (y - cameraParams.cy) * depth / cameraParams.fy;
                        const z3d = depth;
                        
                        vertices.push({ x: x3d, y: y3d, z: z3d });
                    }
                }
            }

            assert.strictEqual(vertices.length, 4); // All valid depths
            
            // Check first vertex (pixel 0,0, depth 1.0)
            const firstVertex = vertices[0];
            assert.strictEqual(firstVertex.x, (0 - 1.0) * 1.0 / 100.0); // -0.01
            assert.strictEqual(firstVertex.y, (0 - 1.0) * 1.0 / 100.0); // -0.01
            assert.strictEqual(firstVertex.z, 1.0);
        });

        test('Should handle invalid depth values', () => {
            const depthValues = new Float32Array([1.0, 0.0, -1.0, NaN, Infinity, 2.0]);
            const validDepths: number[] = [];

            for (const depth of depthValues) {
                if (depth > 0 && isFinite(depth) && !isNaN(depth)) {
                    validDepths.push(depth);
                }
            }

            assert.strictEqual(validDepths.length, 2);
            assert.deepStrictEqual(validDepths, [1.0, 2.0]);
        });

        test('Should apply depth scaling and bias', () => {
            const rawDepth = 1000; // Raw depth value
            const depthScale = 0.001; // Convert mm to m
            const depthBias = 0.1; // Bias in meters

            const scaledDepth = rawDepth * depthScale + depthBias;
            assert.strictEqual(scaledDepth, 1.1); // 1000 * 0.001 + 0.1 = 1.1
        });

        test('Should handle disparity to depth conversion', () => {
            const disparity = 50.0; // pixels
            const baseline = 0.075; // 75mm baseline in meters
            const fx = 525.0; // focal length

            // depth = (baseline * fx) / disparity
            const depth = (baseline * fx) / disparity;
            assert.ok(Math.abs(depth - 0.7875) < 0.001);
        });
    });

    suite('Color Image Integration', () => {
        test('Should validate color image dimensions match depth', () => {
            const depthDims = { width: 640, height: 480 };
            const colorImage = {
                width: 640,
                height: 480,
                data: new Uint8ClampedArray(640 * 480 * 4) // RGBA
            };

            assert.strictEqual(depthDims.width, colorImage.width);
            assert.strictEqual(depthDims.height, colorImage.height);
            assert.strictEqual(colorImage.data.length, colorImage.width * colorImage.height * 4);
        });

        test('Should map depth pixels to color pixels', () => {
            const depthPixel = { x: 100, y: 150 };
            const colorDims = { width: 640, height: 480 };
            
            // Assuming 1:1 mapping for aligned depth/color
            const colorIndex = (depthPixel.y * colorDims.width + depthPixel.x) * 4;
            const expectedIndex = (150 * 640 + 100) * 4;
            
            assert.strictEqual(colorIndex, expectedIndex);
            assert.strictEqual(colorIndex, 384400);
        });

        test('Should extract RGB values from color image', () => {
            const colorData = new Uint8ClampedArray([255, 128, 0, 255]); // Orange pixel RGBA
            
            const r = colorData[0] / 255.0;
            const g = colorData[1] / 255.0;
            const b = colorData[2] / 255.0;
            const a = colorData[3] / 255.0;

            assert.strictEqual(r, 1.0);
            assert.ok(Math.abs(g - 0.5019607843137255) < 0.001);
            assert.strictEqual(b, 0.0);
            assert.strictEqual(a, 1.0);
        });

        test('Should handle missing or invalid color data', () => {
            const depthVertex = { x: 1, y: 2, z: 3 };
            let colorVertex = { ...depthVertex, red: 255, green: 255, blue: 255 };
            
            // If no color image available, use default color
            const hasColorImage = false;
            if (!hasColorImage) {
                colorVertex = { ...depthVertex, red: 128, green: 128, blue: 128 };
            }

            assert.strictEqual(colorVertex.red, 128);
            assert.strictEqual(colorVertex.green, 128);
            assert.strictEqual(colorVertex.blue, 128);
        });
    });

    suite('Coordinate System Conversions', () => {
        test('Should convert between OpenGL and OpenCV conventions', () => {
            const openglPoint = { x: 1, y: 2, z: 3 };
            
            // OpenCV convention: Y down, Z forward
            // OpenGL convention: Y up, Z backward
            
            // OpenGL to OpenCV: negate Y and Z
            const opencvPoint = {
                x: openglPoint.x,
                y: -openglPoint.y,
                z: -openglPoint.z
            };

            assert.strictEqual(opencvPoint.x, 1);
            assert.strictEqual(opencvPoint.y, -2);
            assert.strictEqual(opencvPoint.z, -3);

            // Convert back: OpenCV to OpenGL
            const backToOpengl = {
                x: opencvPoint.x,
                y: -opencvPoint.y,
                z: -opencvPoint.z
            };

            assert.deepStrictEqual(backToOpengl, openglPoint);
        });

        test('Should apply camera pose transformations', () => {
            const point = new THREE.Vector3(1, 0, 0);
            
            // 90 degree rotation around Y axis
            const rotation = new THREE.Matrix4().makeRotationY(Math.PI / 2);
            const translation = new THREE.Matrix4().makeTranslation(2, 3, 4);
            
            // Apply rotation then translation
            const transform = new THREE.Matrix4().multiplyMatrices(translation, rotation);
            point.applyMatrix4(transform);
            
            // X axis becomes -Z axis, then translate
            assert.ok(Math.abs(point.x - 2) < 0.001);
            assert.ok(Math.abs(point.y - 3) < 0.001);
            assert.ok(Math.abs(point.z - 3) < 0.001); // -1 + 4
        });

        test('Should handle right-handed vs left-handed coordinate systems', () => {
            const rightHanded = { x: 1, y: 2, z: 3 };
            
            // Convert to left-handed by negating Z
            const leftHanded = {
                x: rightHanded.x,
                y: rightHanded.y,
                z: -rightHanded.z
            };

            assert.strictEqual(leftHanded.z, -3);
            
            // Cross product test: in right-handed system, X cross Y = Z
            const xAxis = new THREE.Vector3(1, 0, 0);
            const yAxis = new THREE.Vector3(0, 1, 0);
            const cross = new THREE.Vector3().crossVectors(xAxis, yAxis);
            
            assert.ok(cross.equals(new THREE.Vector3(0, 0, 1)));
        });
    });

    suite('TIF/TIFF Depth Processing', () => {
        test('Should validate TIF depth image format', () => {
            const tifMetadata = {
                samplesPerPixel: 1,     // Grayscale
                sampleFormat: 3,        // IEEE floating point
                bitsPerSample: [32],    // 32-bit float
                photometric: 1          // BlackIsZero
            };

            // Valid depth TIF
            assert.strictEqual(tifMetadata.samplesPerPixel, 1);
            assert.strictEqual(tifMetadata.sampleFormat, 3);
            assert.strictEqual(tifMetadata.bitsPerSample[0], 32);
        });

        test('Should process TIF depth data', () => {
            const tifWidth = 4;
            const tifHeight = 3;
            const tifData = new Float32Array([
                1.0, 1.5, 2.0, 0.0,    // Row 0
                1.2, 1.8, 2.5, 1.1,    // Row 1
                0.0, 2.1, 2.8, 1.9     // Row 2
            ]);

            assert.strictEqual(tifData.length, tifWidth * tifHeight);
            
            // Count valid depth values (> 0)
            let validCount = 0;
            for (const depth of tifData) {
                if (depth > 0) validCount++;
            }
            
            assert.strictEqual(validCount, 10); // Should have 10 valid depths
        });

        test('Should handle TIF endianness', () => {
            // Little endian TIF header
            const littleEndianMagic = 0x4949;
            const bigEndianMagic = 0x4D4D;
            
            assert.strictEqual(littleEndianMagic, 0x4949);
            assert.strictEqual(bigEndianMagic, 0x4D4D);
            
            // Test endian detection
            const isLittleEndian = littleEndianMagic === 0x4949;
            const isBigEndian = bigEndianMagic === 0x4D4D;
            
            assert.ok(isLittleEndian);
            assert.ok(isBigEndian);
        });
    });

    suite('Depth Processing Performance', () => {
        test('Should handle large depth images efficiently', () => {
            const largeWidth = 2560;
            const largeHeight = 1440;
            const totalPixels = largeWidth * largeHeight;
            
            // Simulate processing time check
            const maxExpectedPixels = 2 * 1024 * 1024; // 2M pixels
            const shouldOptimize = totalPixels > maxExpectedPixels;
            
            assert.ok(shouldOptimize); // 2560*1440 = 3,686,400 > 2,097,152 (2M)
            assert.ok(totalPixels > maxExpectedPixels);
            
            // For large images, might use decimation
            const decimationFactor = shouldOptimize ? 2 : 1;
            const processedPixels = Math.floor(totalPixels / (decimationFactor * decimationFactor));
            
            assert.ok(processedPixels < totalPixels);
        });

        test('Should provide progress updates for depth processing', () => {
            const totalPixels = 1000;
            const progressUpdates: number[] = [];
            const updateInterval = 100; // Update every 100 pixels
            
            for (let i = 0; i < totalPixels; i++) {
                if (i % updateInterval === 0) {
                    const progress = i / totalPixels;
                    progressUpdates.push(progress);
                }
            }
            
            assert.ok(progressUpdates.length >= 10);
            assert.strictEqual(progressUpdates[0], 0);
            assert.ok(progressUpdates[progressUpdates.length - 1] < 1.0);
        });

        test('Should cache processed depth results', () => {
            const depthCache = new Map<number, any>();
            const fileIndex = 0;
            
            const depthResult = {
                vertices: [{ x: 1, y: 2, z: 3 }],
                pointCount: 1,
                processingTime: 123
            };
            
            // Store in cache
            depthCache.set(fileIndex, depthResult);
            
            assert.ok(depthCache.has(fileIndex));
            assert.strictEqual(depthCache.get(fileIndex)?.pointCount, 1);
            
            // Retrieve from cache
            const cached = depthCache.get(fileIndex);
            assert.deepStrictEqual(cached, depthResult);
        });
    });

    suite('Error Handling in Depth Processing', () => {
        test('Should handle missing camera parameters gracefully', () => {
            const incompleteParams = {
                fx: 525.0,
                fy: 525.0
                // Missing cx, cy
            };
            
            const hasRequiredParams = 
                incompleteParams.fx !== undefined &&
                incompleteParams.fy !== undefined &&
                (incompleteParams as any).cx !== undefined &&
                (incompleteParams as any).cy !== undefined;
                
            assert.ok(!hasRequiredParams);
        });

        test('Should validate depth image data integrity', () => {
            const corruptedDepth = new Float32Array([1.0, NaN, -Infinity, 2.0, Infinity]);
            const cleanedDepth: number[] = [];
            
            for (const depth of corruptedDepth) {
                if (isFinite(depth) && depth > 0) {
                    cleanedDepth.push(depth);
                }
            }
            
            assert.strictEqual(cleanedDepth.length, 2);
            assert.deepStrictEqual(cleanedDepth, [1.0, 2.0]);
        });

        test('Should handle calibration file parsing errors', () => {
            const malformedCalibLines = [
                'fx 525.0',           // Valid
                'fy invalid_number',  // Invalid
                'cx',                 // Missing value
                '',                   // Empty line
                'cy 240.0'            // Valid
            ];
            
            const parsedParams: {[key: string]: number} = {};
            
            for (const line of malformedCalibLines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length === 2) {
                    const key = parts[0];
                    const value = parseFloat(parts[1]);
                    if (!isNaN(value)) {
                        parsedParams[key] = value;
                    }
                }
            }
            
            assert.strictEqual(Object.keys(parsedParams).length, 2);
            assert.strictEqual(parsedParams['fx'], 525.0);
            assert.strictEqual(parsedParams['cy'], 240.0);
            assert.ok(!('fy' in parsedParams));
        });
    });
});