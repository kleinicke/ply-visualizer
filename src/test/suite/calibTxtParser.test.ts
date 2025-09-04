import * as assert from 'assert';

suite('CalibTXT Parser Test Suite', () => {
    // Mock CalibTxtParser for testing (webview component)
    class TestCalibTxtParser {
        parseCameraTxt(content: string): any {
            const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            const params: any = {};
            
            for (const line of lines) {
                if (line.startsWith('#') || line.startsWith('//')) continue; // Skip comments
                
                const parts = line.split(/[:\s=]+/).filter(p => p.length > 0);
                if (parts.length >= 2) {
                    const key = parts[0].toLowerCase();
                    const value = parseFloat(parts[1]);
                    
                    if (!isNaN(value)) {
                        params[key] = value;
                    }
                }
            }
            
            return this.standardizeCameraParams(params);
        }
        
        private standardizeCameraParams(params: any): any {
            const result: any = {
                fx: params.fx || params.focal_x || params.f,
                fy: params.fy || params.focal_y || params.f,
                cx: params.cx || params.center_x || params.principal_x,
                cy: params.cy || params.center_y || params.principal_y,
                k1: params.k1 || params.dist1 || 0,
                k2: params.k2 || params.dist2 || 0,
                k3: params.k3 || params.dist3 || 0,
                p1: params.p1 || params.tangential1 || 0,
                p2: params.p2 || params.tangential2 || 0
            };
            
            // Validate required parameters
            if (!result.fx || !result.fy || result.cx === undefined || result.cy === undefined) {
                throw new Error('Missing required camera parameters (fx, fy, cx, cy)');
            }
            
            return result;
        }
        
        parseCalibrationMatrix(content: string): number[][] | null {
            const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            const matrix: number[][] = [];
            
            for (const line of lines) {
                if (line.startsWith('#') || line.startsWith('//')) continue;
                
                // Try to parse as matrix row
                const values = line.split(/[\s,]+/).map(v => parseFloat(v)).filter(v => !isNaN(v));
                if (values.length >= 3) {
                    matrix.push(values);
                }
            }
            
            // Should be 3x3 or 3x4 matrix
            if (matrix.length === 3 && matrix.every(row => row.length >= 3)) {
                return matrix;
            }
            
            return null;
        }
    }

    let parser: TestCalibTxtParser;

    setup(() => {
        parser = new TestCalibTxtParser();
    });

    test('Should parse standard camera calibration parameters', () => {
        const calibContent = `# Camera calibration parameters
fx: 525.0
fy: 525.0
cx: 319.5
cy: 239.5
k1: 0.1
k2: -0.05
k3: 0.01
p1: 0.001
p2: -0.002`;

        const result = parser.parseCameraTxt(calibContent);
        
        assert.strictEqual(result.fx, 525.0);
        assert.strictEqual(result.fy, 525.0);
        assert.strictEqual(result.cx, 319.5);
        assert.strictEqual(result.cy, 239.5);
        assert.strictEqual(result.k1, 0.1);
        assert.strictEqual(result.k2, -0.05);
        assert.strictEqual(result.k3, 0.01);
        assert.strictEqual(result.p1, 0.001);
        assert.strictEqual(result.p2, -0.002);
    });

    test('Should handle alternative parameter names', () => {
        const calibContent = `focal_x = 600.0
focal_y = 600.0
center_x = 320.0
center_y = 240.0
dist1 = 0.05
dist2 = -0.02`;

        const result = parser.parseCameraTxt(calibContent);
        
        assert.strictEqual(result.fx, 600.0);
        assert.strictEqual(result.fy, 600.0);
        assert.strictEqual(result.cx, 320.0);
        assert.strictEqual(result.cy, 240.0);
        assert.strictEqual(result.k1, 0.05);
        assert.strictEqual(result.k2, -0.02);
    });

    test('Should handle single focal length parameter', () => {
        const calibContent = `f: 525.0
cx: 320.0
cy: 240.0`;

        const result = parser.parseCameraTxt(calibContent);
        
        assert.strictEqual(result.fx, 525.0);
        assert.strictEqual(result.fy, 525.0); // Should use same value for both
        assert.strictEqual(result.cx, 320.0);
        assert.strictEqual(result.cy, 240.0);
    });

    test('Should ignore comments and empty lines', () => {
        const calibContent = `# This is a comment
// Another comment style
fx: 525.0

fy: 525.0  # Inline comment
cx: 320.0
cy: 240.0

# End of file`;

        const result = parser.parseCameraTxt(calibContent);
        
        assert.strictEqual(result.fx, 525.0);
        assert.strictEqual(result.fy, 525.0);
        assert.strictEqual(result.cx, 320.0);
        assert.strictEqual(result.cy, 240.0);
    });

    test('Should throw error for missing required parameters', () => {
        const invalidContent = `fx: 525.0
# Missing fy, cx, cy`;

        assert.throws(() => {
            parser.parseCameraTxt(invalidContent);
        }, /Missing required camera parameters/);
    });

    test('Should parse camera matrix format', () => {
        const matrixContent = `# Camera calibration matrix (K)
525.0  0.0    319.5
0.0    525.0  239.5
0.0    0.0    1.0`;

        const matrix = parser.parseCalibrationMatrix(matrixContent);
        
        assert.ok(matrix !== null);
        assert.strictEqual(matrix.length, 3);
        assert.strictEqual(matrix[0][0], 525.0);
        assert.strictEqual(matrix[0][2], 319.5);
        assert.strictEqual(matrix[1][1], 525.0);
        assert.strictEqual(matrix[1][2], 239.5);
        assert.strictEqual(matrix[2][2], 1.0);
    });

    test('Should parse projection matrix format', () => {
        const matrixContent = `# Projection matrix (P)
525.0  0.0    319.5  0.0
0.0    525.0  239.5  0.0
0.0    0.0    1.0    0.0`;

        const matrix = parser.parseCalibrationMatrix(matrixContent);
        
        assert.ok(matrix !== null);
        assert.strictEqual(matrix.length, 3);
        assert.strictEqual(matrix[0].length, 4);
        assert.strictEqual(matrix[0][0], 525.0);
        assert.strictEqual(matrix[1][1], 525.0);
    });

    test('Should handle comma-separated matrix values', () => {
        const matrixContent = `525.0, 0.0, 319.5
0.0, 525.0, 239.5
0.0, 0.0, 1.0`;

        const matrix = parser.parseCalibrationMatrix(matrixContent);
        
        assert.ok(matrix !== null);
        assert.strictEqual(matrix.length, 3);
        assert.strictEqual(matrix[0][0], 525.0);
        assert.strictEqual(matrix[1][1], 525.0);
    });

    test('Should return null for invalid matrix format', () => {
        const invalidContent = `# Not a valid matrix
just some text
not numbers here`;

        const matrix = parser.parseCalibrationMatrix(invalidContent);
        assert.strictEqual(matrix, null);
    });

    test('Should handle mixed whitespace and delimiters', () => {
        const calibContent = `fx    =    525.0
fy:525.0
cx 320.0
cy=240.0`;

        const result = parser.parseCameraTxt(calibContent);
        
        assert.strictEqual(result.fx, 525.0);
        assert.strictEqual(result.fy, 525.0);
        assert.strictEqual(result.cx, 320.0);
        assert.strictEqual(result.cy, 240.0);
    });

    test('Should handle default values for optional distortion parameters', () => {
        const calibContent = `fx: 525.0
fy: 525.0
cx: 320.0
cy: 240.0`;

        const result = parser.parseCameraTxt(calibContent);
        
        assert.strictEqual(result.k1, 0);
        assert.strictEqual(result.k2, 0);
        assert.strictEqual(result.k3, 0);
        assert.strictEqual(result.p1, 0);
        assert.strictEqual(result.p2, 0);
    });
});