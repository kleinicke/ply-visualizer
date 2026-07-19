import * as vscode from 'vscode';
import * as path from 'path';
import { PlyParser } from '../../engine/src/parsers/plyParser';
import { ObjParser } from '../../engine/src/parsers/objParser';
import { StlParser } from '../../engine/src/parsers/stlParser';
import { PcdParser } from '../../engine/src/parsers/pcdParser';
import { PtsParser } from '../../engine/src/parsers/ptsParser';
import { KittiBinParser } from '../../engine/src/parsers/kittiBinParser';
import { OffParser } from '../../engine/src/parsers/offParser';
import { GltfParser } from '../../engine/src/parsers/gltfParser';
import { NpyParser } from '../../engine/src/parsers/npyParser';
import {
  detectFileTypeWithContent,
  isPlyBinary,
  generateErrorMessage,
  SUPPORTED_EXTENSIONS,
  ALL_SUPPORTED_EXTENSIONS,
} from '../../engine/src/fileHandler';
import {
  toUint8Array,
  toArrayBuffer,
  sendUltimateRawBinary,
  sendSpatialDataToWebview,
} from './binaryTransfer';
import { parseLidarWasm } from '../wasmPointcloud';

export interface AddFileHost {
  getShortPath(filePath: string): string;
  logPerf(line: string): void;
  setLoadStartedAt(ts: number): void;
  tryAutoLoadMtl(
    webviewPanel: vscode.WebviewPanel,
    objUri: vscode.Uri,
    parsedObjData: any,
    fileIndex: number
  ): Promise<void>;
}

function decodeLidarData(
  bytes: Uint8Array,
  extension: 'las' | 'laz' | 'e57',
  fileName: string,
  shortPath: string
): any[] {
  return parseLidarWasm(bytes, extension, fileName).map(cloud => ({
    vertices: [],
    faces: [],
    format: 'binary_little_endian' as const,
    version: '1.0',
    comments: [`Imported from ${extension.toUpperCase()}`],
    vertexCount: cloud.vertexCount,
    sourcePointCount: cloud.sourcePointCount,
    faceCount: 0,
    hasColors: cloud.hasColors,
    hasNormals: false,
    hasIntensity: cloud.hasIntensity,
    fileName: extension === 'e57' ? cloud.name : fileName,
    shortPath,
    fileSizeInBytes: bytes.byteLength,
    positionsArray: cloud.positionsArray,
    colorsArray: cloud.colorsArray,
    normalsArray: null,
    intensityArray: cloud.intensityArray,
    scalarFields: cloud.scalarFields,
    useTypedArrays: true,
    sourceOrigin: Array.from(cloud.sourceOrigin) as [number, number, number],
    metadata: cloud.metadata,
  }));
}

async function addKittiBinData(
  host: AddFileHost,
  webviewPanel: vscode.WebviewPanel,
  bytes: Uint8Array,
  fileName: string,
  shortPath: string
): Promise<void> {
  const parsedData: any = await new KittiBinParser().parse(bytes, host.logPerf.bind(host));
  parsedData.fileName = fileName;
  parsedData.shortPath = shortPath;
  parsedData.fileSizeInBytes = bytes.byteLength;
  parsedData.faceCount = 0;
  parsedData.faces = [];
  await sendSpatialDataToWebview(webviewPanel, [parsedData], 'addFiles');
}

export async function handleAddFile(
  host: AddFileHost,
  webviewPanel: vscode.WebviewPanel,
  currentFilePath: string | undefined
): Promise<void> {
  const defaultUri = currentFilePath ? vscode.Uri.file(path.dirname(currentFilePath)) : undefined;

  const files = await vscode.window.showOpenDialog({
    canSelectMany: true,
    filters: {
      'Point Cloud & Pose Files': [...ALL_SUPPORTED_EXTENSIONS],

      'Point Clouds': [...SUPPORTED_EXTENSIONS.pointClouds],

      // eslint-disable-next-line @typescript-eslint/naming-convention -- dialog filter display name
      Meshes: [...SUPPORTED_EXTENSIONS.meshes],

      'Depth Images': [...SUPPORTED_EXTENSIONS.depthImages],

      'Pose Data': [...SUPPORTED_EXTENSIONS.poseData],
    },
    title: 'Select point cloud files to add',
    defaultUri: defaultUri,
  });

  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      try {
        const fileStartTime = performance.now();
        const fileName = path.basename(files[i].fsPath);
        const shortPath = host.getShortPath(files[i].fsPath);
        const fileExtension = path.extname(files[i].fsPath).toLowerCase();
        console.log(`🚀 ULTIMATE: Processing add file ${fileName} (${fileExtension})`);

        // Tell the webview a load started so it shows a non-blocking progress
        // row in the Files list (the scene already has clouds and stays
        // interactive — no overlay). Sent before the read/parse below.
        host.setLoadStartedAt(Date.now());
        webviewPanel.webview.postMessage({ type: 'startLoading', fileName });

        // Handle different file types
        if (fileExtension === '.las' || fileExtension === '.laz' || fileExtension === '.e57') {
          const bytes = await vscode.workspace.fs.readFile(files[i]);
          const extension = fileExtension.slice(1) as 'las' | 'laz' | 'e57';
          const data = decodeLidarData(bytes, extension, fileName, shortPath);
          await sendSpatialDataToWebview(webviewPanel, data, 'multiSpatialData');
          continue;
        }

        if (fileExtension === '.bin') {
          const bytes = await vscode.workspace.fs.readFile(files[i]);
          await addKittiBinData(host, webviewPanel, bytes, fileName, shortPath);
          continue;
        }

        if (
          fileExtension === '.tif' ||
          fileExtension === '.tiff' ||
          fileExtension === '.pfm' ||
          fileExtension === '.npy' ||
          fileExtension === '.npz' ||
          fileExtension === '.png' ||
          fileExtension === '.exr'
        ) {
          // Handle depth files for conversion
          const depthData = await vscode.workspace.fs.readFile(files[i]);

          // Send depth data to webview for conversion
          webviewPanel.webview.postMessage({
            type: 'depthData',
            fileName: fileName,
            shortPath: shortPath,
            data: depthData.buffer.slice(
              depthData.byteOffset,
              depthData.byteOffset + depthData.byteLength
            ),
            isAddFile: true, // Flag to indicate this is from "Add Point Cloud"
          });

          console.log(`🎯 Depth Add File: ${fileName} sent for processing`);
          continue;
        }

        // Handle PLY files (existing logic)
        if (fileExtension === '.ply') {
          // Read file data
          const spatialData = await vscode.workspace.fs.readFile(files[i]);

          // Parse file (detect format first)
          const parser = new PlyParser();

          // Quick format detection using shared functionality
          const isBinary = isPlyBinary(spatialData);

          if (isBinary) {
            // Use ultimate binary transfer for binary PLY files
            const headerResult = await parser.parseHeaderOnly(spatialData);

            // Add file info
            headerResult.headerInfo.fileName = fileName;
            headerResult.headerInfo.shortPath = shortPath;
            headerResult.headerInfo.fileIndex = i;

            // Send ultimate raw binary data
            await sendUltimateRawBinary(
              webviewPanel,
              headerResult.headerInfo,
              headerResult,
              spatialData,
              'addFiles',
              host.logPerf.bind(host)
            );
          } else {
            // Use traditional parsing for ASCII PLY files
            console.log(`📝 ASCII PLY detected: ${fileName} - using traditional parsing`);
            const parsedData = await parser.parse(spatialData);

            // Add file info
            parsedData.fileName = fileName;
            parsedData.shortPath = shortPath;
            parsedData.fileIndex = i;

            // Send via traditional method (will use binary transfer if possible)
            await sendSpatialDataToWebview(webviewPanel, [parsedData], 'addFiles');
          }

          const totalTime = performance.now();
          console.log(
            `🎯 ULTIMATE Add PLY File: ${fileName} processed in ${(totalTime - fileStartTime).toFixed(1)}ms`
          );
          continue;
        }

        // Handle XYZ files
        if (fileExtension === '.xyz') {
          const xyzData = await vscode.workspace.fs.readFile(files[i]);

          // Send XYZ data to webview for parsing
          webviewPanel.webview.postMessage({
            type: 'xyzData',
            fileName: fileName,
            shortPath: shortPath,
            data: xyzData.buffer.slice(xyzData.byteOffset, xyzData.byteOffset + xyzData.byteLength),
            isAddFile: true,
          });

          console.log(`🎯 XYZ Add File: ${fileName} sent for processing`);
          continue;
        }

        // Handle OBJ files
        if (fileExtension === '.obj') {
          const objData = await vscode.workspace.fs.readFile(files[i]);
          const objParser = new ObjParser();
          const parsedData = await objParser.parse(objData);

          webviewPanel.webview.postMessage({
            type: 'objData',
            fileName: fileName,
            shortPath: shortPath,
            data: parsedData,
            isAddFile: true,
          });

          // Try to auto-load MTL file for added OBJ files
          await host.tryAutoLoadMtl(webviewPanel, files[i], parsedData, i);

          console.log(`🎯 OBJ Add File: ${fileName} sent for processing`);
          continue;
        }

        // Handle STL files
        if (fileExtension === '.stl') {
          const stlData = await vscode.workspace.fs.readFile(files[i]);
          const stlParser = new StlParser();
          const parsedData = await stlParser.parse(stlData);

          webviewPanel.webview.postMessage({
            type: 'stlData',
            fileName: fileName,
            shortPath: shortPath,
            data: parsedData,
            isAddFile: true,
          });

          console.log(`🎯 STL Add File: ${fileName} sent for processing`);
          continue;
        }

        // Handle JSON pose files
        if (fileExtension === '.json') {
          try {
            const jsonBytes = await vscode.workspace.fs.readFile(files[i]);
            const jsonText = Buffer.from(jsonBytes).toString('utf-8');
            // Try standard parse first, then sanitize fallback
            let parsed: any;
            try {
              parsed = JSON.parse(jsonText);
            } catch (e) {
              const sanitizedText = jsonText
                .replace(/\bNaN\b/g, 'null')
                .replace(/\bInfinity\b/g, 'null')
                .replace(/\b-Infinity\b/g, 'null');
              parsed = JSON.parse(sanitizedText);
            }
            webviewPanel.webview.postMessage({
              type: 'poseData',
              fileName: fileName,
              shortPath: shortPath,
              data: parsed,
              isAddFile: true,
            });
            console.log(`🎯 JSON Pose Add File: ${fileName} sent for processing`);
          } catch (err) {
            vscode.window.showErrorMessage(
              `Failed to load JSON pose ${fileName}: ${err instanceof Error ? err.message : String(err)}`
            );
          }
          continue;
        }

        // Handle PCD files
        if (fileExtension === '.pcd') {
          const pcdData = await vscode.workspace.fs.readFile(files[i]);
          const pcdParser = new PcdParser();
          const parsedData = await pcdParser.parse(pcdData);

          webviewPanel.webview.postMessage({
            type: 'pcdData',
            fileName: fileName,
            shortPath: shortPath,
            data: parsedData,
            isAddFile: true,
          });

          console.log(`🎯 PCD Add File: ${fileName} sent for processing`);
          continue;
        }

        // Handle PTS files
        if (fileExtension === '.pts') {
          const ptsData = await vscode.workspace.fs.readFile(files[i]);
          const ptsParser = new PtsParser();
          const parsedData = await ptsParser.parse(ptsData);

          webviewPanel.webview.postMessage({
            type: 'ptsData',
            fileName: fileName,
            shortPath: shortPath,
            data: parsedData,
            isAddFile: true,
          });

          console.log(`🎯 PTS Add File: ${fileName} sent for processing`);
          continue;
        }

        // Handle OFF files
        if (fileExtension === '.off') {
          const offData = await vscode.workspace.fs.readFile(files[i]);
          const offParser = new OffParser();
          const parsedData = await offParser.parse(offData);

          webviewPanel.webview.postMessage({
            type: 'offData',
            fileName: fileName,
            shortPath: shortPath,
            data: parsedData,
            isAddFile: true,
          });

          console.log(`🎯 OFF Add File: ${fileName} sent for processing`);
          continue;
        }

        // Handle GLTF/GLB files
        if (fileExtension === '.gltf' || fileExtension === '.glb') {
          const gltfData = await vscode.workspace.fs.readFile(files[i]);
          const gltfParser = new GltfParser();
          const parsedData = await gltfParser.parse(gltfData);

          webviewPanel.webview.postMessage({
            type: 'gltfData',
            fileName: fileName,
            shortPath: shortPath,
            data: parsedData,
            isAddFile: true,
          });

          console.log(`🎯 GLTF/GLB Add File: ${fileName} sent for processing`);
          continue;
        }

        // Handle XYZN/XYZRGB variants
        if (fileExtension === '.xyzn' || fileExtension === '.xyzrgb') {
          const xyzData = await vscode.workspace.fs.readFile(files[i]);

          webviewPanel.webview.postMessage({
            type: 'xyzVariantData',
            fileName: fileName,
            shortPath: shortPath,
            data: xyzData.buffer.slice(xyzData.byteOffset, xyzData.byteOffset + xyzData.byteLength),
            variant: fileExtension.substring(1), // Remove the dot
            isAddFile: true,
          });

          console.log(`🎯 XYZ Variant Add File: ${fileName} sent for processing`);
          continue;
        }

        // Unsupported file type
        vscode.window.showWarningMessage(
          generateErrorMessage(
            fileName,
            fileExtension.substring(1),
            new Error('Unsupported file type')
          )
        );
      } catch (error) {
        console.error(`Failed to load file ${files[i].fsPath}:`, error);
        vscode.window.showErrorMessage(`Failed to load file ${files[i].fsPath}: ${error}`);
      }
    }
  }
}

export async function handleAddFileFromPath(
  host: AddFileHost,
  webviewPanel: vscode.WebviewPanel,
  filePathStr: string
): Promise<void> {
  try {
    const fileUri = vscode.Uri.file(filePathStr);
    const fileName = path.basename(fileUri.fsPath);
    const shortPath = host.getShortPath(fileUri.fsPath);
    const ext = path.extname(fileUri.fsPath).toLowerCase();

    // Non-blocking progress row in the Files list during read/parse (the scene
    // already has clouds and stays interactive).
    host.setLoadStartedAt(Date.now());
    webviewPanel.webview.postMessage({ type: 'startLoading', fileName });

    if (ext === '.las' || ext === '.laz' || ext === '.e57') {
      const bytes = await vscode.workspace.fs.readFile(fileUri);
      const data = decodeLidarData(
        bytes,
        ext.slice(1) as 'las' | 'laz' | 'e57',
        fileName,
        shortPath
      );
      await sendSpatialDataToWebview(webviewPanel, data, 'multiSpatialData');
      return;
    }

    if (ext === '.bin') {
      const bytes = await vscode.workspace.fs.readFile(fileUri);
      await addKittiBinData(host, webviewPanel, bytes, fileName, shortPath);
      return;
    }

    if (
      ext === '.tif' ||
      ext === '.tiff' ||
      ext === '.pfm' ||
      ext === '.npy' ||
      ext === '.npz' ||
      ext === '.png' ||
      ext === '.exr'
    ) {
      const depthData = await vscode.workspace.fs.readFile(fileUri);
      webviewPanel.webview.postMessage({
        type: 'depthData',
        fileName,
        shortPath,
        data: depthData.buffer.slice(
          depthData.byteOffset,
          depthData.byteOffset + depthData.byteLength
        ),
        isAddFile: true,
      });
      return;
    }
    if (ext === '.ply') {
      const spatialData = await vscode.workspace.fs.readFile(fileUri);
      const parser = new PlyParser();
      const isBinary = isPlyBinary(spatialData);
      if (isBinary) {
        const headerResult = await parser.parseHeaderOnly(spatialData);
        headerResult.headerInfo.fileName = fileName;
        headerResult.headerInfo.shortPath = shortPath;
        await sendUltimateRawBinary(
          webviewPanel,
          headerResult.headerInfo,
          headerResult,
          spatialData,
          'addFiles',
          host.logPerf.bind(host)
        );
      } else {
        const parsedData = await parser.parse(spatialData);
        parsedData.fileName = fileName;
        parsedData.shortPath = shortPath;
        await sendSpatialDataToWebview(webviewPanel, [parsedData], 'addFiles');
      }
      return;
    }
    if (ext === '.xyz') {
      const xyzData = await vscode.workspace.fs.readFile(fileUri);
      webviewPanel.webview.postMessage({
        type: 'xyzData',
        fileName,
        shortPath,
        data: xyzData.buffer.slice(xyzData.byteOffset, xyzData.byteOffset + xyzData.byteLength),
        isAddFile: true,
      });
      return;
    }
    if (ext === '.obj') {
      const objData = await vscode.workspace.fs.readFile(fileUri);
      const objParser = new ObjParser();
      const parsedData = await objParser.parse(objData);
      webviewPanel.webview.postMessage({
        type: 'objData',
        fileName,
        shortPath,
        data: parsedData,
        isAddFile: true,
      });
      await host.tryAutoLoadMtl(webviewPanel, fileUri, parsedData, 0);
      return;
    }
    if (ext === '.stl') {
      const stlData = await vscode.workspace.fs.readFile(fileUri);
      const stlParser = new StlParser();
      const parsedData = await stlParser.parse(stlData);
      webviewPanel.webview.postMessage({
        type: 'stlData',
        fileName,
        shortPath,
        data: parsedData,
        isAddFile: true,
      });
      return;
    }
    if (ext === '.pcd') {
      const pcdData = await vscode.workspace.fs.readFile(fileUri);
      const pcdParser = new PcdParser();
      const parsedData = await pcdParser.parse(pcdData);
      webviewPanel.webview.postMessage({
        type: 'pcdData',
        fileName,
        shortPath,
        data: parsedData,
        isAddFile: true,
      });
      return;
    }
    if (ext === '.pts') {
      const ptsData = await vscode.workspace.fs.readFile(fileUri);
      const ptsParser = new PtsParser();
      const parsedData = await ptsParser.parse(ptsData);
      webviewPanel.webview.postMessage({
        type: 'ptsData',
        fileName,
        shortPath,
        data: parsedData,
        isAddFile: true,
      });
      return;
    }
    if (ext === '.off') {
      const offData = await vscode.workspace.fs.readFile(fileUri);
      const offParser = new OffParser();
      const parsedData = await offParser.parse(offData);
      webviewPanel.webview.postMessage({
        type: 'offData',
        fileName,
        shortPath,
        data: parsedData,
        isAddFile: true,
      });
      return;
    }
    if (ext === '.gltf' || ext === '.glb') {
      const gltfData = await vscode.workspace.fs.readFile(fileUri);
      const gltfParser = new GltfParser();
      const parsedData = await gltfParser.parse(gltfData);
      webviewPanel.webview.postMessage({
        type: 'gltfData',
        fileName,
        shortPath,
        data: parsedData,
        isAddFile: true,
      });
      return;
    }
    if (ext === '.xyzn' || ext === '.xyzrgb') {
      const xyzData = await vscode.workspace.fs.readFile(fileUri);
      webviewPanel.webview.postMessage({
        type: 'xyzVariantData',
        fileName,
        shortPath,
        data: xyzData.buffer.slice(xyzData.byteOffset, xyzData.byteOffset + xyzData.byteLength),
        variant: ext.substring(1),
        isAddFile: true,
      });
      return;
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to add file from path: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleDroppedFilesFromWebview(
  host: AddFileHost,
  webviewPanel: vscode.WebviewPanel,
  files: Array<{ name?: string; data?: ArrayBuffer | Uint8Array }>
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    const droppedFile = files[i];
    const fileName = path.basename(droppedFile.name || `dropped-file-${i + 1}`);

    try {
      if (!droppedFile.data) {
        throw new Error('Dropped file did not include readable data');
      }

      const fileData = toUint8Array(droppedFile.data);
      const shortPath = fileName;
      const ext = path.extname(fileName).toLowerCase();
      const fileType = detectFileTypeWithContent(fileName, fileData);

      if (!fileType) {
        webviewPanel.webview.postMessage({
          type: 'loadingError',
          fileName,
          fileType: ext || 'file',
          error: `Unsupported dropped file type: ${ext || 'unknown'}`,
        });
        continue;
      }

      if (fileType.extension === 'npy' && fileType.category === 'pointCloud') {
        const npyParser = new NpyParser();
        const parsedData = await npyParser.parse(fileData);
        webviewPanel.webview.postMessage({
          type: 'npyData',
          fileName,
          shortPath,
          data: parsedData,
          isAddFile: true,
        });
        continue;
      }

      if (fileType.isDepthFile) {
        webviewPanel.webview.postMessage({
          type: 'depthData',
          fileName,
          shortPath,
          data: toArrayBuffer(fileData),
          isAddFile: true,
        });
        continue;
      }

      if (ext === '.las' || ext === '.laz' || ext === '.e57') {
        const data = decodeLidarData(
          fileData,
          ext.slice(1) as 'las' | 'laz' | 'e57',
          fileName,
          shortPath
        );
        await sendSpatialDataToWebview(webviewPanel, data, 'multiSpatialData');
        continue;
      }

      if (ext === '.bin') {
        await addKittiBinData(host, webviewPanel, fileData, fileName, shortPath);
        continue;
      }

      if (ext === '.ply') {
        const parser = new PlyParser();
        const isBinary = isPlyBinary(fileData);
        if (isBinary) {
          const headerResult = await parser.parseHeaderOnly(fileData);
          headerResult.headerInfo.fileName = fileName;
          headerResult.headerInfo.shortPath = shortPath;
          await sendUltimateRawBinary(
            webviewPanel,
            headerResult.headerInfo,
            headerResult,
            fileData,
            'addFiles',
            host.logPerf.bind(host)
          );
        } else {
          const parsedData = await parser.parse(fileData);
          parsedData.fileName = fileName;
          parsedData.shortPath = shortPath;
          await sendSpatialDataToWebview(webviewPanel, [parsedData], 'addFiles');
        }
        continue;
      }

      if (ext === '.xyz') {
        webviewPanel.webview.postMessage({
          type: 'xyzData',
          fileName,
          shortPath,
          data: toArrayBuffer(fileData),
          isAddFile: true,
        });
        continue;
      }

      if (ext === '.obj') {
        const objParser = new ObjParser();
        const parsedData = await objParser.parse(fileData);
        webviewPanel.webview.postMessage({
          type: 'objData',
          fileName,
          shortPath,
          data: parsedData,
          isAddFile: true,
        });
        continue;
      }

      if (ext === '.stl') {
        const stlParser = new StlParser();
        const parsedData = await stlParser.parse(fileData);
        webviewPanel.webview.postMessage({
          type: 'stlData',
          fileName,
          shortPath,
          data: parsedData,
          isAddFile: true,
        });
        continue;
      }

      if (ext === '.pcd') {
        const pcdParser = new PcdParser();
        const parsedData = await pcdParser.parse(fileData);
        webviewPanel.webview.postMessage({
          type: 'pcdData',
          fileName,
          shortPath,
          data: parsedData,
          isAddFile: true,
        });
        continue;
      }

      if (ext === '.pts') {
        const ptsParser = new PtsParser();
        const parsedData = await ptsParser.parse(fileData);
        webviewPanel.webview.postMessage({
          type: 'ptsData',
          fileName,
          shortPath,
          data: parsedData,
          isAddFile: true,
        });
        continue;
      }

      if (ext === '.off') {
        const offParser = new OffParser();
        const parsedData = await offParser.parse(fileData);
        webviewPanel.webview.postMessage({
          type: 'offData',
          fileName,
          shortPath,
          data: parsedData,
          isAddFile: true,
        });
        continue;
      }

      if (ext === '.gltf' || ext === '.glb') {
        const gltfParser = new GltfParser();
        const parsedData = await gltfParser.parse(fileData);
        webviewPanel.webview.postMessage({
          type: 'gltfData',
          fileName,
          shortPath,
          data: parsedData,
          isAddFile: true,
        });
        continue;
      }

      if (ext === '.xyzn' || ext === '.xyzrgb') {
        webviewPanel.webview.postMessage({
          type: 'xyzVariantData',
          fileName,
          shortPath,
          data: toArrayBuffer(fileData),
          variant: ext.substring(1),
          isAddFile: true,
        });
        continue;
      }
    } catch (error) {
      webviewPanel.webview.postMessage({
        type: 'loadingError',
        fileName,
        fileType: path.extname(fileName).slice(1).toUpperCase() || 'file',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
