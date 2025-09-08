import { CameraParams, DepthConversionResult, PlyData, PlyVertex } from '../../webview/interfaces';

export interface DepthUtilsCallbacks {
    // Status and error handling
    showStatus: (message: string) => void;
    showError: (message: string) => void;
    
    // Depth file management
    getPendingDepthFiles: () => Map<string, any>;
    removePendingDepthFile: (requestId: string) => void;
    getFileDepthData: () => Map<number, any>;
    setFileDepthData: (fileIndex: number, data: any) => void;
    
    // File management
    addNewFiles: (files: PlyData[]) => void;
    displayFiles: (files: PlyData[]) => Promise<void>;
    getPlyFilesLength: () => number;
    
    // UI updates
    updatePrinciplePointFields: (fileIndex: number, dimensions: { width: number; height: number }) => void;
}

/**
 * Depth processing utilities - extracted from main.ts
 * Handles depth image to point cloud conversion and related operations
 */
export class DepthUtils {
    constructor(private callbacks: DepthUtilsCallbacks) {}

    /**
     * Process depth file with camera parameters - extracted from main.ts
     */
    async processDepthWithParams(requestId: string, cameraParams: CameraParams): Promise<void> {
        const pendingDepthFiles = this.callbacks.getPendingDepthFiles();
        const depthFileData = pendingDepthFiles.get(requestId);
        if (!depthFileData) {
            console.error('Depth file data not found for requestId:', requestId);
            return;
        }

        console.log('Processing depth with camera params:', cameraParams);
        this.callbacks.showStatus('Converting depth image to point cloud...');

        // Process the depth data using the new depth processing system
        const result = await this.processDepthToPointCloud(depthFileData.data, depthFileData.fileName, cameraParams);

        const isPfm = /\.pfm$/i.test(depthFileData.fileName);
        const isTif = /\.(tif|tiff)$/i.test(depthFileData.fileName);
        const isNpy = /\.(npy|npz)$/i.test(depthFileData.fileName);
        const isPng = /\.png$/i.test(depthFileData.fileName);
        const fileType = isPfm ? 'PFM' : isNpy ? 'NPY' : isPng ? 'PNG' : 'TIF';

        // Create PLY data structure with vertices converted from typed arrays
        const vertices: PlyVertex[] = [];
        for (let i = 0; i < result.pointCount; i++) {
            const vertex: PlyVertex = {
                x: result.vertices[i * 3],
                y: result.vertices[i * 3 + 1],
                z: result.vertices[i * 3 + 2]
            };
            if (result.colors) {
                vertex.red = Math.round(result.colors[i * 3] * 255);
                vertex.green = Math.round(result.colors[i * 3 + 1] * 255);
                vertex.blue = Math.round(result.colors[i * 3 + 2] * 255);
            }
            vertices.push(vertex);
        }

        const plyData: PlyData = {
            vertices: vertices,
            faces: [],
            vertexCount: result.pointCount,
            hasColors: !!result.colors,
            hasNormals: false,
            faceCount: 0,
            fileName: depthFileData.fileName,
            fileIndex: depthFileData.isAddFile ? this.callbacks.getPlyFilesLength() : 0,
            format: 'binary_little_endian',
            version: '1.0',
            comments: [
                `Converted from ${fileType} depth image: ${depthFileData.fileName}`, 
                `Camera: ${cameraParams.cameraModel}`, 
                `Depth type: ${cameraParams.depthType}`,
                `fx: ${cameraParams.fx}px${cameraParams.fy ? `, fy: ${cameraParams.fy}px` : ''}`,
                ...(cameraParams.baseline ? [`Baseline: ${cameraParams.baseline}mm`] : []),
                ...(cameraParams.pngScaleFactor ? [`Scale factor: scale=${cameraParams.pngScaleFactor}`] : [])
            ]
        };

        console.log(`${fileType} to PLY conversion complete: ${result.pointCount} points`);

        // Add to scene
        if (depthFileData.isAddFile) {
            this.callbacks.addNewFiles([plyData]);
        } else {
            await this.callbacks.displayFiles([plyData]);
        }

        // Cache the depth file data for later reprocessing (using the file index)
        const fileIndex = plyData.fileIndex || 0;
        const dimensions = {
            width: (result as any).width || 0,
            height: (result as any).height || 0
        };
        
        // Log depth image dimensions when storing
        console.log(`📐 Storing depth data for file ${fileIndex} (${fileType}):`);
        console.log(`   Dimensions: ${dimensions.width} × ${dimensions.height}`);
        console.log(`   Computed principle point would be: cx = ${(dimensions.width-1)/2}, cy = ${(dimensions.height-1)/2}`);
        
        this.callbacks.setFileDepthData(fileIndex, {
            originalData: depthFileData.data,
            fileName: depthFileData.fileName,
            cameraParams: cameraParams,
            depthDimensions: dimensions
        });

        // Update the cx/cy form fields with the actual computed values
        this.callbacks.updatePrinciplePointFields(fileIndex, dimensions);

        // Clean up
        this.callbacks.removePendingDepthFile(requestId);
        this.callbacks.showStatus(`${fileType} to point cloud conversion complete: ${result.pointCount} points`);
    }

    /**
     * Process depth to point cloud - extracted from main.ts (public for reprocessing)
     */
    async processDepthToPointCloud(depthData: ArrayBuffer, fileName: string, cameraParams: CameraParams): Promise<DepthConversionResult> {
        const { registerDefaultReaders, readDepth } = await import('../../webview/depth/DepthRegistry');
        const { normalizeDepth, projectToPointCloud } = await import('../../webview/depth/DepthProjector');
        try {
            // DEBUG: Log what parameters we received
            console.log(`🔬 PROCESS DEPTH DEBUG for ${fileName}:`);
            console.log('  Received cameraParams:', cameraParams);
            console.log('  depthType specifically:', cameraParams.depthType);
            console.log('  baseline specifically:', cameraParams.baseline);
            
            registerDefaultReaders();
            
            // Configure PNG reader with scale factor if processing PNG file
            if (/\.png$/i.test(fileName) && cameraParams.pngScaleFactor) {
                const { PngReader } = await import('../../webview/depth/readers/PngReader');
                const pngReader = new PngReader();
                pngReader.setConfig({
                    pngScaleFactor: cameraParams.pngScaleFactor,
                    invalidValue: 0
                });
                
                // Re-register the configured PNG reader
                const { registerReader } = await import('../../webview/depth/DepthRegistry');
                registerReader(pngReader);
                console.log(`🎯 Configured PNG reader with scale factor: ${cameraParams.pngScaleFactor}`);
            }
            
            const { image, meta: baseMeta } = await readDepth(fileName, depthData);
            
            // Update cx/cy with computed values if they are still placeholder values
            const computedCx = (image.width - 1) / 2;
            const computedCy = (image.height - 1) / 2;
            
            // If cx/cy are not provided, replace with computed values
            const shouldUpdateCx = cameraParams.cx === undefined;
            const shouldUpdateCy = cameraParams.cy === undefined;
            
            if (shouldUpdateCx) {
                cameraParams.cx = computedCx;
                console.log(`📐 Updated cx from placeholder to computed value: ${computedCx}`);
            }
            
            if (shouldUpdateCy) {
                cameraParams.cy = computedCy;  
                console.log(`📐 Updated cy from placeholder to computed value: ${computedCy}`);
            }
            
            // Log image dimensions and principle point information
            console.log(`📐 Depth image loaded: ${fileName}`);
            console.log(`   Image dimensions: ${image.width} × ${image.height} pixels`);
            console.log(`   Auto-computed principle point: cx = ${computedCx}, cy = ${computedCy}`);
            console.log(`   Using cx/cy values from camera parameters: cx = ${cameraParams.cx}, cy = ${cameraParams.cy}`);
            console.log(`   🎯 Camera parameters are the source of truth for principle point`);
            
            // Set up camera parameters (use values from camera parameters, which may have been updated)
            const fx = cameraParams.fx;
            const fy = cameraParams.fy || cameraParams.fx; // Use fx if fy is not provided
            const cx = cameraParams.cx !== undefined ? cameraParams.cx : (image.width - 1) / 2; // Use provided value or auto-calculate
            const cy = cameraParams.cy !== undefined ? cameraParams.cy : (image.height - 1) / 2; // Use provided value or auto-calculate

            // Override depth kind based on UI selection
            const meta: any = { ...baseMeta };
            console.log(`  📋 Original baseMeta.kind: ${baseMeta.kind}`);
            console.log(`  ⚙️ Checking depthType: ${cameraParams.depthType}`);
            
            if (cameraParams.depthType === 'disparity') {
                const fxOk = !!cameraParams.fx && cameraParams.fx > 0;
                const blOk = !!cameraParams.baseline && cameraParams.baseline > 0;
                console.log(`  🔍 Disparity checks: fxOk=${fxOk} (${cameraParams.fx}), blOk=${blOk} (${cameraParams.baseline})`);
                if (fxOk && blOk) {
                    meta.kind = 'disparity';
                    meta.baseline = cameraParams.baseline! / 1000; // Convert mm to meters
                    meta.disparityOffset = cameraParams.disparityOffset || 0; // Default to 0
                    console.log(`  ✅ Set meta.kind to 'disparity', baseline=${meta.baseline}m, offset=${meta.disparityOffset}`);
                } else {
                    console.warn('Disparity selected but baseline/focal missing; keeping original kind:', baseMeta.kind);
                }
            } else if (cameraParams.depthType === 'orthogonal') {
                meta.kind = 'z';
                console.log(`  ✅ Set meta.kind to 'z' (orthogonal)`);
            } else if (cameraParams.depthType === 'euclidean') {
                meta.kind = 'depth';
                console.log(`  ✅ Set meta.kind to 'depth' (euclidean)`);
            } else if (cameraParams.depthType === 'inverse_depth') {
                meta.kind = 'inverse_depth';
                console.log(`  ✅ Set meta.kind to 'inverse_depth'`);
            }
            
            console.log(`  📋 Final meta.kind: ${meta.kind}`);

            const norm = normalizeDepth(image, {
                ...meta,
                fx, fy, cx, cy,
                baseline: meta.baseline,
                depthScale: cameraParams.depthScale,
                depthBias: cameraParams.depthBias
            });

            const result = projectToPointCloud(norm, {
                kind: meta.kind,
                fx, fy, cx, cy,
                cameraModel: cameraParams.cameraModel,
                convention: cameraParams.convention || 'opengl', // Use selected convention, default to OpenGL
                k1: cameraParams.k1 ? parseFloat(cameraParams.k1.toString()) : undefined,
                k2: cameraParams.k2 ? parseFloat(cameraParams.k2.toString()) : undefined,
                k3: cameraParams.k3 ? parseFloat(cameraParams.k3.toString()) : undefined,
                k4: cameraParams.k4 ? parseFloat(cameraParams.k4.toString()) : undefined,
                k5: cameraParams.k5 ? parseFloat(cameraParams.k5.toString()) : undefined,
                p1: cameraParams.p1 ? parseFloat(cameraParams.p1.toString()) : undefined,
                p2: cameraParams.p2 ? parseFloat(cameraParams.p2.toString()) : undefined
            });
            return result as unknown as DepthConversionResult;

        } catch (error) {
            console.error('Error processing depth to point cloud:', error);
            throw error;
        }
    }
}