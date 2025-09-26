import * as assert from 'assert';
import {
  SpatialVertex,
  SpatialFace,
  SpatialData,
  CameraParams,
  DepthConversionResult,
} from '../../src/interfaces';

suite('Webview Interfaces', () => {
  suite('SpatialVertex', () => {
    test('should create SpatialVertex with required coordinates', () => {
      const vertex: SpatialVertex = {
        x: 1.5,
        y: 2.5,
        z: 3.5,
      };

      assert.strictEqual(vertex.x, 1.5);
      assert.strictEqual(vertex.y, 2.5);
      assert.strictEqual(vertex.z, 3.5);
    });

    test('should create SpatialVertex with optional color properties', () => {
      const vertex: SpatialVertex = {
        x: 1.0,
        y: 2.0,
        z: 3.0,
        red: 255,
        green: 128,
        blue: 64,
        alpha: 200,
      };

      assert.strictEqual(vertex.red, 255);
      assert.strictEqual(vertex.green, 128);
      assert.strictEqual(vertex.blue, 64);
      assert.strictEqual(vertex.alpha, 200);
    });

    test('should create SpatialVertex with optional normal properties', () => {
      const vertex: SpatialVertex = {
        x: 1.0,
        y: 2.0,
        z: 3.0,
        nx: 0.0,
        ny: 1.0,
        nz: 0.0,
      };

      assert.strictEqual(vertex.nx, 0.0);
      assert.strictEqual(vertex.ny, 1.0);
      assert.strictEqual(vertex.nz, 0.0);
    });

    test('should create SpatialVertex with all optional properties', () => {
      const vertex: SpatialVertex = {
        x: 1.0,
        y: 2.0,
        z: 3.0,
        red: 255,
        green: 128,
        blue: 64,
        alpha: 200,
        nx: 0.0,
        ny: 1.0,
        nz: 0.0,
      };

      assert.strictEqual(typeof vertex.x, 'number');
      assert.strictEqual(typeof vertex.y, 'number');
      assert.strictEqual(typeof vertex.z, 'number');
      assert.strictEqual(typeof vertex.red, 'number');
      assert.strictEqual(typeof vertex.green, 'number');
      assert.strictEqual(typeof vertex.blue, 'number');
      assert.strictEqual(typeof vertex.alpha, 'number');
      assert.strictEqual(typeof vertex.nx, 'number');
      assert.strictEqual(typeof vertex.ny, 'number');
      assert.strictEqual(typeof vertex.nz, 'number');
    });
  });

  suite('SpatialFace', () => {
    test('should create SpatialFace with triangle indices', () => {
      const face: SpatialFace = {
        indices: [0, 1, 2],
      };

      assert.deepStrictEqual(face.indices, [0, 1, 2]);
      assert.strictEqual(face.indices.length, 3);
    });

    test('should create SpatialFace with quad indices', () => {
      const face: SpatialFace = {
        indices: [0, 1, 2, 3],
      };

      assert.deepStrictEqual(face.indices, [0, 1, 2, 3]);
      assert.strictEqual(face.indices.length, 4);
    });

    test('should create SpatialFace with polygon indices', () => {
      const face: SpatialFace = {
        indices: [0, 1, 2, 3, 4, 5],
      };

      assert.deepStrictEqual(face.indices, [0, 1, 2, 3, 4, 5]);
      assert.strictEqual(face.indices.length, 6);
    });

    test('should handle empty face indices', () => {
      const face: SpatialFace = {
        indices: [],
      };

      assert.deepStrictEqual(face.indices, []);
      assert.strictEqual(face.indices.length, 0);
    });
  });

  suite('SpatialData', () => {
    test('should create minimal SpatialData structure', () => {
      const spatialData: SpatialData = {
        vertices: [],
        faces: [],
        format: 'ascii',
        version: '1.0',
        comments: [],
        vertexCount: 0,
        faceCount: 0,
        hasColors: false,
        hasNormals: false,
      };

      assert.deepStrictEqual(spatialData.vertices, []);
      assert.deepStrictEqual(spatialData.faces, []);
      assert.strictEqual(spatialData.format, 'ascii');
      assert.strictEqual(spatialData.version, '1.0');
      assert.deepStrictEqual(spatialData.comments, []);
      assert.strictEqual(spatialData.vertexCount, 0);
      assert.strictEqual(spatialData.faceCount, 0);
      assert.strictEqual(spatialData.hasColors, false);
      assert.strictEqual(spatialData.hasNormals, false);
    });

    test('should create SpatialData with binary little endian format', () => {
      const spatialData: SpatialData = {
        vertices: [{ x: 1, y: 2, z: 3 }],
        faces: [{ indices: [0, 1, 2] }],
        format: 'binary_little_endian',
        version: '1.0',
        comments: ['Test comment'],
        vertexCount: 1,
        faceCount: 1,
        hasColors: true,
        hasNormals: true,
      };

      assert.strictEqual(spatialData.format, 'binary_little_endian');
      assert.strictEqual(spatialData.hasColors, true);
      assert.strictEqual(spatialData.hasNormals, true);
      assert.deepStrictEqual(spatialData.comments, ['Test comment']);
    });

    test('should create SpatialData with binary big endian format', () => {
      const spatialData: SpatialData = {
        vertices: [],
        faces: [],
        format: 'binary_big_endian',
        version: '1.0',
        comments: [],
        vertexCount: 0,
        faceCount: 0,
        hasColors: false,
        hasNormals: false,
      };

      assert.strictEqual(spatialData.format, 'binary_big_endian');
    });

    test('should create SpatialData with optional fileName and fileIndex', () => {
      const spatialData: SpatialData = {
        vertices: [],
        faces: [],
        format: 'ascii',
        version: '1.0',
        comments: [],
        vertexCount: 0,
        faceCount: 0,
        hasColors: false,
        hasNormals: false,
        fileName: 'test.ply',
        fileIndex: 1,
      };

      assert.strictEqual(spatialData.fileName, 'test.ply');
      assert.strictEqual(spatialData.fileIndex, 1);
    });

    test('should validate vertex and face data consistency', () => {
      const vertices: SpatialVertex[] = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
      ];
      const faces: SpatialFace[] = [{ indices: [0, 1, 2] }];

      const spatialData: SpatialData = {
        vertices,
        faces,
        format: 'ascii',
        version: '1.0',
        comments: [],
        vertexCount: vertices.length,
        faceCount: faces.length,
        hasColors: false,
        hasNormals: false,
      };

      assert.strictEqual(spatialData.vertices.length, spatialData.vertexCount);
      assert.strictEqual(spatialData.faces.length, spatialData.faceCount);
    });
  });

  suite('CameraParams', () => {
    test('should create minimal pinhole-ideal camera params', () => {
      const params: CameraParams = {
        cameraModel: 'pinhole-ideal',
        fx: 500,
        depthType: 'euclidean',
      };

      assert.strictEqual(params.cameraModel, 'pinhole-ideal');
      assert.strictEqual(params.fx, 500);
      assert.strictEqual(params.depthType, 'euclidean');
    });

    test('should create pinhole-opencv camera params with distortion', () => {
      const params: CameraParams = {
        cameraModel: 'pinhole-opencv',
        fx: 500,
        fy: 500,
        cx: 320,
        cy: 240,
        depthType: 'euclidean',
        k1: -0.1,
        k2: 0.05,
        p1: 0.01,
        p2: 0.02,
        k3: -0.01,
      };

      assert.strictEqual(params.cameraModel, 'pinhole-opencv');
      assert.strictEqual(params.fy, 500);
      assert.strictEqual(params.cx, 320);
      assert.strictEqual(params.cy, 240);
      assert.strictEqual(params.k1, -0.1);
      assert.strictEqual(params.k2, 0.05);
      assert.strictEqual(params.p1, 0.01);
      assert.strictEqual(params.p2, 0.02);
      assert.strictEqual(params.k3, -0.01);
    });

    test('should create fisheye camera params', () => {
      const params: CameraParams = {
        cameraModel: 'fisheye-equidistant',
        fx: 300,
        fy: 300,
        cx: 320,
        cy: 240,
        depthType: 'euclidean',
        k1: 0.1,
        k2: 0.05,
        k3: 0.02,
        k4: 0.01,
      };

      assert.strictEqual(params.cameraModel, 'fisheye-equidistant');
      assert.strictEqual(params.k4, 0.01);
    });

    test('should create kannala-brandt fisheye params', () => {
      const params: CameraParams = {
        cameraModel: 'fisheye-kannala-brandt',
        fx: 300,
        depthType: 'euclidean',
        k1: 0.1,
        k2: 0.05,
        k3: 0.02,
        k4: 0.01,
        k5: 0.005,
      };

      assert.strictEqual(params.cameraModel, 'fisheye-kannala-brandt');
      assert.strictEqual(params.k5, 0.005);
    });

    test('should handle disparity depth type with baseline', () => {
      const params: CameraParams = {
        cameraModel: 'pinhole-ideal',
        fx: 500,
        depthType: 'disparity',
        baseline: 0.12,
        disparityOffset: 0.5,
      };

      assert.strictEqual(params.depthType, 'disparity');
      assert.strictEqual(params.baseline, 0.12);
      assert.strictEqual(params.disparityOffset, 0.5);
    });

    test('should handle inverse depth type', () => {
      const params: CameraParams = {
        cameraModel: 'pinhole-ideal',
        fx: 500,
        depthType: 'inverse_depth',
      };

      assert.strictEqual(params.depthType, 'inverse_depth');
    });

    test('should handle orthogonal depth type', () => {
      const params: CameraParams = {
        cameraModel: 'pinhole-ideal',
        fx: 500,
        depthType: 'orthogonal',
      };

      assert.strictEqual(params.depthType, 'orthogonal');
    });

    test('should handle depth scale and bias', () => {
      const params: CameraParams = {
        cameraModel: 'pinhole-ideal',
        fx: 500,
        depthType: 'euclidean',
        depthScale: 1000.0,
        depthBias: 0.1,
      };

      assert.strictEqual(params.depthScale, 1000.0);
      assert.strictEqual(params.depthBias, 0.1);
    });

    test('should handle coordinate conventions', () => {
      const openglParams: CameraParams = {
        cameraModel: 'pinhole-ideal',
        fx: 500,
        depthType: 'euclidean',
        convention: 'opengl',
      };

      const opencvParams: CameraParams = {
        cameraModel: 'pinhole-ideal',
        fx: 500,
        depthType: 'euclidean',
        convention: 'opencv',
      };

      assert.strictEqual(openglParams.convention, 'opengl');
      assert.strictEqual(opencvParams.convention, 'opencv');
    });

    test('should handle PNG scale factor', () => {
      const params: CameraParams = {
        cameraModel: 'pinhole-ideal',
        fx: 500,
        depthType: 'euclidean',
        pngScaleFactor: 1000,
      };

      assert.strictEqual(params.pngScaleFactor, 1000);
    });

    test('should validate camera model types', () => {
      const models: CameraParams['cameraModel'][] = [
        'pinhole-ideal',
        'pinhole-opencv',
        'fisheye-equidistant',
        'fisheye-opencv',
        'fisheye-kannala-brandt',
      ];

      models.forEach(model => {
        const params: CameraParams = {
          cameraModel: model,
          fx: 500,
          depthType: 'euclidean',
        };
        assert.strictEqual(params.cameraModel, model);
      });
    });

    test('should validate depth types', () => {
      const depthTypes: CameraParams['depthType'][] = [
        'euclidean',
        'orthogonal',
        'disparity',
        'inverse_depth',
      ];

      depthTypes.forEach(depthType => {
        const params: CameraParams = {
          cameraModel: 'pinhole-ideal',
          fx: 500,
          depthType,
        };
        assert.strictEqual(params.depthType, depthType);
      });
    });
  });

  suite('DepthConversionResult', () => {
    test('should create minimal DepthConversionResult', () => {
      const vertices = new Float32Array([1, 2, 3, 4, 5, 6]);
      const result: DepthConversionResult = {
        vertices,
        pointCount: 2,
      };

      assert.strictEqual(result.vertices, vertices);
      assert.strictEqual(result.pointCount, 2);
      assert.strictEqual(result.colors, undefined);
      assert.strictEqual(result.pixelCoords, undefined);
    });

    test('should create DepthConversionResult with colors', () => {
      const vertices = new Float32Array([1, 2, 3, 4, 5, 6]);
      const colors = new Float32Array([1, 0, 0, 0, 1, 0]);
      const result: DepthConversionResult = {
        vertices,
        colors,
        pointCount: 2,
      };

      assert.strictEqual(result.vertices, vertices);
      assert.strictEqual(result.colors, colors);
      assert.strictEqual(result.pointCount, 2);
    });

    test('should create DepthConversionResult with pixel coordinates', () => {
      const vertices = new Float32Array([1, 2, 3]);
      const pixelCoords = new Float32Array([100, 200]);
      const result: DepthConversionResult = {
        vertices,
        pixelCoords,
        pointCount: 1,
      };

      assert.strictEqual(result.vertices, vertices);
      assert.strictEqual(result.pixelCoords, pixelCoords);
      assert.strictEqual(result.pointCount, 1);
    });

    test('should create complete DepthConversionResult', () => {
      const vertices = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const colors = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      const pixelCoords = new Float32Array([10, 20, 30, 40, 50, 60]);
      const result: DepthConversionResult = {
        vertices,
        colors,
        pixelCoords,
        pointCount: 3,
      };

      assert.strictEqual(result.vertices, vertices);
      assert.strictEqual(result.colors, colors);
      assert.strictEqual(result.pixelCoords, pixelCoords);
      assert.strictEqual(result.pointCount, 3);
    });

    test('should validate array lengths consistency', () => {
      const pointCount = 3;
      const vertices = new Float32Array(pointCount * 3); // 3 floats per vertex (x, y, z)
      const colors = new Float32Array(pointCount * 3); // 3 floats per color (r, g, b)
      const pixelCoords = new Float32Array(pointCount * 2); // 2 floats per pixel coord (u, v)

      const result: DepthConversionResult = {
        vertices,
        colors,
        pixelCoords,
        pointCount,
      };

      assert.strictEqual(result.vertices.length, pointCount * 3);
      assert.strictEqual(result.colors!.length, pointCount * 3);
      assert.strictEqual(result.pixelCoords!.length, pointCount * 2);
      assert.strictEqual(result.pointCount, pointCount);
    });

    test('should handle empty arrays', () => {
      const result: DepthConversionResult = {
        vertices: new Float32Array(0),
        colors: new Float32Array(0),
        pixelCoords: new Float32Array(0),
        pointCount: 0,
      };

      assert.strictEqual(result.vertices.length, 0);
      assert.strictEqual(result.colors!.length, 0);
      assert.strictEqual(result.pixelCoords!.length, 0);
      assert.strictEqual(result.pointCount, 0);
    });
  });
});
