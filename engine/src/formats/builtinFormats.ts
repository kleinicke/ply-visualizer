import { PlyParser } from '../parsers/plyParser';
import { ObjParser } from '../parsers/objParser';
import { StlParser } from '../parsers/stlParser';
import { PcdParser } from '../parsers/pcdParser';
import { PtsParser } from '../parsers/ptsParser';
import { KittiBinParser } from '../parsers/kittiBinParser';
import { StonexX3aParser } from '../parsers/stonexX3aParser';
import { OffParser } from '../parsers/offParser';
import { GltfParser } from '../parsers/gltfParser';
import { NpyParser, isNpyPointCloudData } from '../parsers/npyParser';
import { NrrdParser } from '../parsers/nrrdParser';
import { buildVolumeMesh } from '../visualization/isosurface';
import { initTiffWasm, projectCameraPointsWasmSync } from '../depth/readers/tiffWasm';
import { FormatRegistry, UnifiedConverter } from './formatRegistry';

/**
 * Registration of every format the viewer accepts.
 *
 * Each entry is the whole story for one format: which extensions it claims,
 * which pipeline it belongs to, and how to decode it. Adding a format means
 * adding one `register` call here and nothing else.
 *
 * `convertToUnifiedFormat` arrives as an argument rather than an import
 * because it lives in fileHandler.ts, which imports this module - taking it as
 * a dependency keeps that one-directional instead of a cycle.
 */

/**
 * Also used directly by fileHandler's multi-file path: an X3A archive can hold
 * several scans, and `parseAll` turns each into its own entry.
 */
export async function createStonexParser(): Promise<StonexX3aParser> {
  const ready = await initTiffWasm();
  return new StonexX3aParser(
    ready
      ? request =>
          projectCameraPointsWasmSync({
            ...request,
            cameraModel: 'pinhole-opencv',
            coefficients: [...request.coefficients],
          })
      : undefined
  );
}

const registered = new WeakSet<FormatRegistry>();

export function registerBuiltinFormats(
  registry: FormatRegistry,
  convertToUnifiedFormat: UnifiedConverter
): void {
  // `register` throws on a duplicate extension, which is the right behaviour
  // for a genuine mistake but would be a module-load crash if this ever ran
  // twice against the same registry (two entry bundles sharing the module, a
  // dev-server reload). Registering once per registry keeps that a no-op.
  if (registered.has(registry)) {
    return;
  }
  registered.add(registry);

  registry.register({
    extensions: ['ply'],
    category: 'pointCloud',
    async parse({ data, fileName, timingCallback }) {
      const spatialData = await new PlyParser().parse(data, timingCallback);
      return {
        data: {
          ...spatialData,
          fileName,
          // Splat mode needs the full original PLY (SH/scale/rot props are
          // dropped during point parsing). Only 3DGS files pay this retention.
          ...(spatialData.isGaussianSplat ? { splatSource: { bytes: data } } : {}),
        },
        type: 'spatialData',
      };
    },
  });

  registry.register({
    // XYZ variants are ASCII point lists the PLY parser already handles.
    extensions: ['xyz', 'xyzn', 'xyzrgb'],
    category: 'pointCloud',
    async parse({ data, fileName, timingCallback }) {
      const xyzData = await new PlyParser().parse(data, timingCallback);
      return { data: { ...xyzData, fileName }, type: 'xyzData' };
    },
  });

  registry.register({
    extensions: ['pcd'],
    category: 'pointCloud',
    async parse({ data, fileName, timingCallback }) {
      const pcdData = await new PcdParser().parse(data, timingCallback);
      return { data: convertToUnifiedFormat(pcdData, fileName), type: 'pcdData' };
    },
  });

  registry.register({
    extensions: ['pts'],
    category: 'pointCloud',
    async parse({ data, fileName, timingCallback }) {
      const ptsData = await new PtsParser().parse(data, timingCallback);
      return { data: convertToUnifiedFormat(ptsData, fileName), type: 'ptsData' };
    },
  });

  registry.register({
    // KITTI velodyne scans.
    extensions: ['bin'],
    category: 'pointCloud',
    async parse({ data, fileName, timingCallback }) {
      const kittiBinData = await new KittiBinParser().parse(data, timingCallback);
      return { data: convertToUnifiedFormat(kittiBinData, fileName), type: 'kittiBinData' };
    },
  });

  registry.register({
    extensions: ['x3a', 'x3r'],
    category: 'pointCloud',
    async parse({ data, fileName, timingCallback }) {
      const parser = await createStonexParser();
      return { data: await parser.parse(data, fileName, timingCallback), type: 'spatialData' };
    },
  });

  registry.register({
    // Decoded by the lidar worker (parsers/lidarWorker.ts), which is chosen
    // before parseFileData is reached; registered so the files are accepted.
    extensions: ['las', 'laz', 'e57'],
    category: 'pointCloud',
  });

  registry.register({
    // Gaussian splat containers, decoded by Spark (visualization/splatMode.ts).
    extensions: ['spz', 'splat', 'ksplat', 'sog'],
    category: 'pointCloud',
  });

  registry.register({
    extensions: ['stl'],
    category: 'mesh',
    async parse({ data, fileName, timingCallback }) {
      const stlData = await new StlParser().parse(data, timingCallback);
      return { data: convertToUnifiedFormat(stlData, fileName), type: 'stlData' };
    },
  });

  registry.register({
    extensions: ['obj'],
    category: 'mesh',
    async parse({ data, fileName, timingCallback }) {
      const objData = await new ObjParser().parse(data, timingCallback);
      return { data: convertToUnifiedFormat(objData, fileName), type: 'objData' };
    },
  });

  registry.register({
    extensions: ['off'],
    category: 'mesh',
    async parse({ data, fileName, timingCallback }) {
      const offData = await new OffParser().parse(data, timingCallback);
      return { data: convertToUnifiedFormat(offData, fileName), type: 'offData' };
    },
  });

  registry.register({
    extensions: ['gltf', 'glb'],
    category: 'mesh',
    async parse({ data, fileName, timingCallback }) {
      const gltfData = await new GltfParser().parse(data, timingCallback);
      return { data: convertToUnifiedFormat(gltfData, fileName), type: 'gltfData' };
    },
  });

  registry.register({
    // Volumes. NRRD is the payload the tiff-visualizer bridge hands over for
    // DICOM/OME-TIFF stacks, and the format 3D Slicer and ITK write, so the
    // same path serves both. What reaches the scene is an isosurface — an
    // ordinary mesh — until a volume raycaster exists.
    extensions: ['nrrd', 'nhdr'],
    category: 'mesh',
    async parse({ data, fileName, timingCallback }) {
      const volume = await new NrrdParser().parse(data, fileName, timingCallback);
      const { data: meshData } = buildVolumeMesh(volume, {
        onProgress: fraction => timingCallback?.(`🧊 Isosurface: ${(fraction * 100).toFixed(0)}%`),
      });
      return { data: { ...meshData, fileName }, type: 'spatialData' };
    },
  });

  registry.register({
    // Depth formats are projected by DepthRegistry, not parsed here.
    extensions: ['tif', 'tiff', 'pfm', 'npz', 'png', 'exr'],
    category: 'depthImage',
  });

  registry.register({
    // NPY holds either a depth image or an XYZ point cloud; only the array
    // shape tells them apart, hence refineCategory.
    extensions: ['npy'],
    category: 'depthImage',
    refineCategory(data) {
      try {
        const buffer = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength
        ) as ArrayBuffer;
        return isNpyPointCloudData(buffer) ? 'pointCloud' : null;
      } catch (error) {
        // Unreadable header: keep the depth-image assumption, as before.
        console.warn('Failed to analyze NPY content, treating as depth image:', error);
        return null;
      }
    },
    async parse({ data, fileName, category, timingCallback }) {
      if (category !== 'pointCloud') {
        throw new Error(
          `NPY file ${fileName} was not detected as point cloud data. Shape may not end with dimension 3.`
        );
      }
      const npyData = await new NpyParser().parse(data, timingCallback);
      return { data: { ...npyData, fileName }, type: 'npyData' };
    },
  });

  registry.register({
    extensions: ['json'],
    category: 'poseData',
    async parse({ data, fileName }) {
      // Pose data and camera profiles. The real parsing happens in main.ts
      // based on content structure; the JSON text rides along in `comments`.
      const textContent = new TextDecoder().decode(data);
      return {
        data: {
          vertices: [],
          faces: [],
          format: 'json',
          vertexCount: 0,
          faceCount: 0,
          hasColors: false,
          hasNormals: false,
          fileName,
          comments: [textContent],
        },
        type: 'jsonData',
      };
    },
  });
}
