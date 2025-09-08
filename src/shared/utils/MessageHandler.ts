import { PlyData, PlyVertex, PlyFace } from '../../webview/interfaces';

export interface MessageHandlerCallbacks {
    // File management
    addNewFiles: (files: PlyData[]) => void;
    displayFiles: (files: PlyData[]) => Promise<void>;
    
    // Status and error handling
    showStatus: (message: string) => void;
    showError: (message: string) => void;
    
    // Data storage
    getPendingDepthFiles: () => Map<string, any>;
    setPendingDepthFile: (requestId: string, data: any) => void;
    removePendingDepthFile: (requestId: string) => void;
    
    // Camera parameters
    saveCameraParams: (params: any) => void;
    processDepthWithParams: (requestId: string, params: any) => Promise<void>;
    
    // File properties access
    getPlyFilesLength: () => number;
    
    // Normals visualization
    createNormalsVisualizer: (plyData: PlyData) => any;
    getNormalsVisible: () => boolean[];
    setNormalsVisible: (fileIndex: number, visible: boolean) => void;
    getNormalsVisualizers: () => any[];
    addNormalsVisualizer: (fileIndex: number, visualizer: any) => void;
    
    // Scene access
    getScene: () => any;
}

/**
 * Message handling utilities - extracted from main.ts
 * Handles processing of various file format messages and data conversion
 */
export class MessageHandler {
    constructor(private callbacks: MessageHandlerCallbacks) {}

    /**
     * Handle XYZ data processing - extracted from main.ts
     */
    async handleXyzData(message: any): Promise<void> {
        try {
            console.log('Received XYZ data for processing:', message.fileName);
            this.callbacks.showStatus('Parsing XYZ file...');
            
            // Parse XYZ file (simple format: x y z [r g b] per line)
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(message.data);
            const lines = text.split('\n').filter(line => line.trim().length > 0);
            
            const vertices: PlyVertex[] = [];
            let hasColors = false;
            
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    const x = parseFloat(parts[0]);
                    const y = parseFloat(parts[1]);
                    const z = parseFloat(parts[2]);
                    
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                        const vertex: PlyVertex = { x, y, z };
                        
                        // Check for color data (RGB values)
                        if (parts.length >= 6) {
                            const r = parseInt(parts[3]);
                            const g = parseInt(parts[4]);
                            const b = parseInt(parts[5]);
                            
                            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                                vertex.red = Math.max(0, Math.min(255, r));
                                vertex.green = Math.max(0, Math.min(255, g));
                                vertex.blue = Math.max(0, Math.min(255, b));
                                hasColors = true;
                            }
                        }
                        
                        vertices.push(vertex);
                    }
                }
            }
            
            if (vertices.length === 0) {
                throw new Error('No valid vertices found in XYZ file');
            }
            
            // Create PLY data structure
            const plyData: PlyData = {
                vertices,
                faces: [],
                format: 'ascii',
                version: '1.0',
                comments: [`Converted from XYZ file: ${message.fileName}`],
                vertexCount: vertices.length,
                faceCount: 0,
                hasColors,
                hasNormals: false,
                fileName: message.fileName.replace(/\.xyz$/i, '_pointcloud.ply'),
                fileIndex: this.callbacks.getPlyFilesLength()
            };
            
            // Add to visualization
            if (message.isAddFile) {
                this.callbacks.addNewFiles([plyData]);
            } else {
                await this.callbacks.displayFiles([plyData]);
            }
            
            this.callbacks.showStatus(`XYZ file loaded successfully! ${vertices.length.toLocaleString()} points${hasColors ? ' with colors' : ''}`);
            
        } catch (error) {
            console.error('Error handling XYZ data:', error);
            this.callbacks.showError(`Failed to process XYZ file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle STL data processing - extracted from main.ts
     */
    async handleStlData(message: any): Promise<void> {
        try {
            console.log(`STL: recv ${message.fileName}`);
            this.callbacks.showStatus(`STL: processing ${message.fileName}`);
            
            const stlData = message.data;
            console.log(`STL: ${stlData.triangleCount} triangles, format=${stlData.format}, hasColors=${stlData.hasColors}`);
            
            // Convert STL triangles to PLY vertices and faces
            const vertices: PlyVertex[] = [];
            const faces: PlyFace[] = [];
            const vertexMap = new Map<string, number>(); // For vertex deduplication
            let hasColors = false;
            
            for (let i = 0; i < stlData.triangles.length; i++) {
                const triangle = stlData.triangles[i];
                const faceIndices: number[] = [];
                
                // Process each vertex of the triangle
                for (let j = 0; j < 3; j++) {
                    const v = triangle.vertices[j];
                    const key = `${v.x.toFixed(6)},${v.y.toFixed(6)},${v.z.toFixed(6)}`;
                    
                    let vertexIndex = vertexMap.get(key);
                    if (vertexIndex === undefined) {
                        // New vertex
                        vertexIndex = vertices.length;
                        vertexMap.set(key, vertexIndex);
                        
                        const vertex: PlyVertex = {
                            x: v.x,
                            y: v.y,
                            z: v.z
                        };
                        
                        // Add normal data
                        if (triangle.normal) {
                            vertex.nx = triangle.normal.x;
                            vertex.ny = triangle.normal.y;
                            vertex.nz = triangle.normal.z;
                        }
                        
                        // Add color if available
                        if (v.color !== undefined) {
                            vertex.red = (v.color >> 16) & 0xFF;
                            vertex.green = (v.color >> 8) & 0xFF;
                            vertex.blue = v.color & 0xFF;
                            hasColors = true;
                        } else if (triangle.color !== undefined) {
                            // Use triangle color if vertex color not available
                            vertex.red = (triangle.color >> 16) & 0xFF;
                            vertex.green = (triangle.color >> 8) & 0xFF;
                            vertex.blue = triangle.color & 0xFF;
                            hasColors = true;
                        }
                        
                        vertices.push(vertex);
                    }
                    
                    faceIndices.push(vertexIndex);
                }
                
                faces.push({ indices: faceIndices });
            }
            
            // Convert STL data to PLY format for rendering
            const plyData: PlyData = {
                vertices,
                faces,
                format: stlData.format === 'binary' ? 'binary_little_endian' : 'ascii',
                version: '1.0',
                comments: [
                    `Converted from STL file: ${message.fileName}`,
                    `Original format: ${stlData.format}`,
                    `Triangle count: ${stlData.triangleCount}`,
                    ...(stlData.header ? [`Header: ${stlData.header}`] : [])
                ],
                vertexCount: vertices.length,
                faceCount: faces.length,
                hasColors: hasColors,
                hasNormals: true,
                fileName: message.fileName.replace(/\.stl$/i, '_mesh.ply'),
                fileIndex: this.callbacks.getPlyFilesLength()
            };
            
            // Store STL-specific data for enhanced rendering
            (plyData as any).stlData = stlData;
            (plyData as any).isStlFile = true;
            (plyData as any).stlFormat = stlData.format;
            (plyData as any).stlTriangleCount = stlData.triangleCount;
            
            // Add to visualization
            if (message.isAddFile) {
                this.callbacks.addNewFiles([plyData]);
            } else {
                await this.callbacks.displayFiles([plyData]);
            }
            
            // Status message
            const statusParts = [
                `${vertices.length.toLocaleString()} vertices`,
                `${faces.length.toLocaleString()} triangles`,
                `${stlData.format} format`
            ];
            if (hasColors) {
                statusParts.push('with colors');
            }
            
            this.callbacks.showStatus(`STL mesh loaded: ${statusParts.join(', ')}`);
            
        } catch (error) {
            console.error('Error handling STL data:', error);
            this.callbacks.showError(`Failed to process STL file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle camera parameters - extracted from main.ts
     */
    async handleCameraParams(message: any): Promise<void> {
        try {
            const requestId = message.requestId;
            const pendingDepthFiles = this.callbacks.getPendingDepthFiles();
            
            if (!requestId || !pendingDepthFiles.has(requestId)) {
                throw new Error('No Depth data available for processing');
            }

            console.log('Processing Depth with camera params:', message);
            
            const cameraParams: any = {
                cameraModel: message.cameraModel,
                fx: message.fx,
                fy: message.fy,
                cx: message.cx, // Will be calculated from image dimensions if not provided
                cy: message.cy, // Will be calculated from image dimensions if not provided
                depthType: message.depthType || 'euclidean', // Default to euclidean for backward compatibility
                baseline: message.baseline,
                convention: message.convention || 'opengl' // Default to OpenGL convention
            };

            // Save camera parameters for future use
            this.callbacks.saveCameraParams(cameraParams);
            console.log('✅ Camera parameters saved for future Depth files');
            
            // Process the depth file (could be TIF or PFM)
            await this.callbacks.processDepthWithParams(requestId, cameraParams);
            
        } catch (error) {
            console.error('Error processing Depth with camera params:', error);
            this.callbacks.showError(`Depth conversion failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle PCD data processing - extracted from main.ts
     */
    async handlePcdData(message: any): Promise<void> {
        try {
            console.log(`Load: recv PCD ${message.fileName}`);
            this.callbacks.showStatus(`PCD: processing ${message.fileName}`);
            
            const pcdData = message.data;
            console.log(`PCD: ${pcdData.vertexCount} points, format=${pcdData.format}, colors=${pcdData.hasColors}, normals=${pcdData.hasNormals}`);
            
            // Convert PCD data to PLY format for rendering
            const plyData: PlyData = {
                vertices: pcdData.vertices,
                faces: [], // PCD files are point clouds, no faces
                format: pcdData.format === 'binary' ? 'binary_little_endian' : 'ascii',
                version: '1.0',
                comments: [
                    `Converted from PCD: ${message.fileName}`,
                    `Original format: ${pcdData.format}`,
                    `Width: ${pcdData.width}, Height: ${pcdData.height}`,
                    `Fields: ${pcdData.fields?.join(', ') || 'unknown'}`,
                    ...pcdData.comments
                ],
                vertexCount: pcdData.vertexCount,
                faceCount: 0,
                hasColors: pcdData.hasColors,
                hasNormals: pcdData.hasNormals,
                fileName: message.fileName.replace(/\.pcd$/i, '_pointcloud.ply'),
                fileIndex: this.callbacks.getPlyFilesLength()
            };

            if (message.isAddFile) {
                this.callbacks.addNewFiles([plyData]);
            } else {
                await this.callbacks.displayFiles([plyData]);
            }

            this.callbacks.showStatus(`PCD loaded: ${pcdData.vertexCount.toLocaleString()} points, format: ${pcdData.format}`);

        } catch (error) {
            console.error('Error handling PCD data:', error);
            this.callbacks.showError(`Failed to process PCD file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle PCD data processing with normals support - extracted from main.ts
     */
    async handlePcdDataWithNormals(message: any): Promise<void> {
        try {
            console.log(`Load: recv PCD ${message.fileName}`);
            this.callbacks.showStatus(`PCD: processing ${message.fileName}`);
            
            const pcdData = message.data;
            console.log(`PCD: ${pcdData.vertexCount} points, format=${pcdData.format}, colors=${pcdData.hasColors}, normals=${pcdData.hasNormals}`);
            
            // Convert PCD data to PLY format for rendering
            const plyData: PlyData = {
                vertices: pcdData.vertices,
                faces: [], // PCD files are point clouds, no faces
                format: pcdData.format === 'binary' ? 'binary_little_endian' : 'ascii',
                version: '1.0',
                comments: [
                    `Converted from PCD: ${message.fileName}`,
                    `Original format: ${pcdData.format}`,
                    `Width: ${pcdData.width}, Height: ${pcdData.height}`,
                    `Fields: ${pcdData.fields?.join(', ') || 'unknown'}`,
                    ...pcdData.comments
                ],
                vertexCount: pcdData.vertexCount,
                faceCount: 0,
                hasColors: pcdData.hasColors,
                hasNormals: pcdData.hasNormals,
                fileName: message.fileName,
                fileIndex: this.callbacks.getPlyFilesLength()
            };

            if (message.isAddFile) {
                this.callbacks.addNewFiles([plyData]);
            } else {
                await this.callbacks.displayFiles([plyData]);
            }

            // Create normals visualizer if PCD has normals
            if (plyData.hasNormals) {
                const normalsVisualizer = this.callbacks.createNormalsVisualizer(plyData);
                
                // Set initial visibility based on stored state (default true)
                const fileIndex = plyData.fileIndex || (this.callbacks.getPlyFilesLength() - 1);
                const normalsVisible = this.callbacks.getNormalsVisible();
                const initialVisible = normalsVisible[fileIndex] !== false;
                normalsVisualizer.visible = initialVisible;
                
                const scene = this.callbacks.getScene();
                scene.add(normalsVisualizer);
                
                // Add to normals visualizers array
                this.callbacks.addNormalsVisualizer(fileIndex, normalsVisualizer);
            }
            
            this.callbacks.showStatus(`PCD: loaded ${pcdData.vertexCount} points from ${message.fileName}`);
            
        } catch (error) {
            console.error('Error handling PCD data:', error);
            this.callbacks.showError(`PCD processing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle PTS data processing - extracted from main.ts
     */
    async handlePtsData(message: any): Promise<void> {
        try {
            console.log(`Load: recv PTS ${message.fileName}`);
            this.callbacks.showStatus(`PTS: processing ${message.fileName}`);
            
            const ptsData = message.data;
            console.log(`PTS: ${ptsData.vertexCount} points, format=${ptsData.detectedFormat}, colors=${ptsData.hasColors}, normals=${ptsData.hasNormals}, intensity=${ptsData.hasIntensity}`);
            
            // Convert PTS data to PLY format for rendering
            const plyData: PlyData = {
                vertices: ptsData.vertices,
                faces: [], // PTS files are point clouds, no faces
                format: 'ascii',
                version: '1.0',
                comments: [
                    `Converted from PTS: ${message.fileName}`,
                    `Detected format: ${ptsData.detectedFormat}`,
                    ...ptsData.comments
                ],
                vertexCount: ptsData.vertexCount,
                faceCount: 0,
                hasColors: ptsData.hasColors,
                hasNormals: ptsData.hasNormals,
                fileName: message.fileName,
                fileIndex: this.callbacks.getPlyFilesLength()
            };

            if (message.isAddFile) {
                this.callbacks.addNewFiles([plyData]);
            } else {
                await this.callbacks.displayFiles([plyData]);
            }

            // Create normals visualizer if PTS has normals
            if (plyData.hasNormals) {
                const normalsVisualizer = this.callbacks.createNormalsVisualizer(plyData);
                
                // Set initial visibility based on stored state (default true)
                const fileIndex = plyData.fileIndex || (this.callbacks.getPlyFilesLength() - 1);
                const normalsVisible = this.callbacks.getNormalsVisible();
                const initialVisible = normalsVisible[fileIndex] !== false;
                normalsVisualizer.visible = initialVisible;
                
                const scene = this.callbacks.getScene();
                scene.add(normalsVisualizer);
                
                // Add to normals visualizers array
                this.callbacks.addNormalsVisualizer(fileIndex, normalsVisualizer);
            }
            
            this.callbacks.showStatus(`PTS: loaded ${ptsData.vertexCount} points from ${message.fileName}`);
            
        } catch (error) {
            console.error('Error handling PTS data:', error);
            this.callbacks.showError(`PTS processing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle OFF data processing - extracted from main.ts
     */
    async handleOffData(message: any): Promise<void> {
        try {
            console.log(`Load: recv OFF ${message.fileName}`);
            this.callbacks.showStatus(`OFF: processing ${message.fileName}`);
            
            const offData = message.data;
            console.log(`OFF: ${offData.vertexCount} vertices, ${offData.faceCount} faces, variant=${offData.offVariant}, colors=${offData.hasColors}, normals=${offData.hasNormals}`);
            
            // Convert OFF data to PLY format for rendering
            const plyData: PlyData = {
                vertices: offData.vertices,
                faces: offData.faces,
                format: 'ascii',
                version: '1.0',
                comments: [
                    `Converted from OFF: ${message.fileName}`,
                    `OFF variant: ${offData.offVariant}`,
                    ...offData.comments
                ],
                vertexCount: offData.vertexCount,
                faceCount: offData.faceCount,
                hasColors: offData.hasColors,
                hasNormals: offData.hasNormals,
                fileName: message.fileName,
                fileIndex: this.callbacks.getPlyFilesLength()
            };

            if (message.isAddFile) {
                this.callbacks.addNewFiles([plyData]);
            } else {
                await this.callbacks.displayFiles([plyData]);
            }

            // Create normals visualizer if OFF has normals (for both meshes and point clouds)
            if (plyData.hasNormals) {
                const normalsVisualizer = this.callbacks.createNormalsVisualizer(plyData);
                
                // Set initial visibility based on stored state (default true)
                const fileIndex = plyData.fileIndex || (this.callbacks.getPlyFilesLength() - 1);
                const normalsVisible = this.callbacks.getNormalsVisible();
                const initialVisible = normalsVisible[fileIndex] !== false;
                normalsVisualizer.visible = initialVisible;
                
                const scene = this.callbacks.getScene();
                scene.add(normalsVisualizer);
                
                // Add to normals visualizers array
                this.callbacks.addNormalsVisualizer(fileIndex, normalsVisualizer);
            }
            
            const meshType = offData.faceCount > 0 ? 'mesh' : 'point cloud';
            this.callbacks.showStatus(`OFF: loaded ${offData.vertexCount} vertices, ${offData.faceCount} faces as ${meshType} from ${message.fileName}`);
            
        } catch (error) {
            console.error('Error handling OFF data:', error);
            this.callbacks.showError(`OFF processing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle GLTF/GLB data processing - extracted from main.ts
     */
    async handleGltfData(message: any): Promise<void> {
        try {
            console.log(`Load: recv GLTF/GLB ${message.fileName}`);
            this.callbacks.showStatus(`GLTF: processing ${message.fileName}`);
            
            const gltfData = message.data;
            console.log(`GLTF: ${gltfData.vertexCount} vertices, ${gltfData.faceCount} faces, ${gltfData.meshCount} meshes, ${gltfData.materialCount} materials, colors=${gltfData.hasColors}, normals=${gltfData.hasNormals}`);
            
            // Convert GLTF data to PLY format for rendering
            const plyData: PlyData = {
                vertices: gltfData.vertices,
                faces: gltfData.faces,
                format: 'ascii',
                version: '1.0',
                comments: [
                    `Converted from GLTF/GLB: ${message.fileName}`,
                    `Format: ${gltfData.format}`,
                    `Meshes: ${gltfData.meshCount}, Materials: ${gltfData.materialCount}`,
                    ...gltfData.comments
                ],
                vertexCount: gltfData.vertexCount,
                faceCount: gltfData.faceCount,
                hasColors: gltfData.hasColors,
                hasNormals: gltfData.hasNormals,
                fileName: message.fileName,
                fileIndex: this.callbacks.getPlyFilesLength()
            };

            if (message.isAddFile) {
                this.callbacks.addNewFiles([plyData]);
            } else {
                await this.callbacks.displayFiles([plyData]);
            }
            
            const meshType = gltfData.faceCount > 0 ? 'mesh' : 'point cloud';
            this.callbacks.showStatus(`GLTF: loaded ${gltfData.vertexCount} vertices, ${gltfData.faceCount} faces as ${meshType} from ${message.fileName}`);
            
        } catch (error) {
            console.error('Error handling GLTF data:', error);
            this.callbacks.showError(`GLTF processing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle XYZ variant data processing - extracted from main.ts
     */
    async handleXyzVariantData(message: any): Promise<void> {
        try {
            console.log(`Load: recv XYZ variant (${message.variant}) ${message.fileName}`);
            this.callbacks.showStatus(`XYZ: processing ${message.fileName} (${message.variant})`);
            
            // Parse XYZ variant data
            const plyData = this.parseXyzVariantData(message.data, message.variant, message.fileName);

            if (message.isAddFile) {
                this.callbacks.addNewFiles([plyData]);
            } else {
                await this.callbacks.displayFiles([plyData]);
            }

            if (plyData.hasNormals) {
                const normalsVisualizer = this.callbacks.createNormalsVisualizer(plyData);
                
                // Set initial visibility based on stored state (default true)
                const fileIndex = plyData.fileIndex || (this.callbacks.getPlyFilesLength() - 1);
                const normalsVisible = this.callbacks.getNormalsVisible();
                const initialVisible = normalsVisible[fileIndex] !== false;
                normalsVisualizer.visible = initialVisible;
                
                const scene = this.callbacks.getScene();
                scene.add(normalsVisualizer);
                
                // Add to normals visualizers array
                this.callbacks.addNormalsVisualizer(fileIndex, normalsVisualizer);
            }
            
            this.callbacks.showStatus(`${message.variant.toUpperCase()}: loaded ${plyData.vertexCount} points from ${message.fileName}`);
            
        } catch (error) {
            console.error('Error handling XYZ variant data:', error);
            this.callbacks.showError(`${message.variant.toUpperCase()} processing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Parse XYZ variant data - extracted from main.ts
     */
    private parseXyzVariantData(data: ArrayBuffer, variant: string, fileName: string): PlyData {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data);
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        const vertices: PlyVertex[] = [];
        let hasColors = false;
        let hasNormals = false;
        
        if (variant === 'xyzn') {
            hasNormals = true;
        } else if (variant === 'xyzrgb') {
            hasColors = true;
        }
        
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 3) continue;
            
            const vertex: PlyVertex = {
                x: parseFloat(parts[0]),
                y: parseFloat(parts[1]),
                z: parseFloat(parts[2])
            };
            
            if (variant === 'xyzn' && parts.length >= 6) {
                vertex.nx = parseFloat(parts[3]);
                vertex.ny = parseFloat(parts[4]);
                vertex.nz = parseFloat(parts[5]);
            } else if (variant === 'xyzrgb' && parts.length >= 6) {
                const r = parseFloat(parts[3]);
                const g = parseFloat(parts[4]);
                const b = parseFloat(parts[5]);
                
                if (r <= 1.0 && g <= 1.0 && b <= 1.0) {
                    vertex.red = Math.round(r * 255);
                    vertex.green = Math.round(g * 255);
                    vertex.blue = Math.round(b * 255);
                } else {
                    vertex.red = Math.round(Math.min(255, Math.max(0, r)));
                    vertex.green = Math.round(Math.min(255, Math.max(0, g)));
                    vertex.blue = Math.round(Math.min(255, Math.max(0, b)));
                }
            }
            
            vertices.push(vertex);
        }
        
        return {
            vertices,
            faces: [],
            format: 'ascii',
            version: '1.0',
            comments: [
                `Converted from ${variant.toUpperCase()}: ${fileName}`,
                `Format variant: ${variant}`
            ],
            vertexCount: vertices.length,
            faceCount: 0,
            hasColors,
            hasNormals,
            fileName: fileName,
            fileIndex: this.callbacks.getPlyFilesLength()
        };
    }

    /**
     * Handle camera parameters cancellation
     */
    handleCameraParamsCancelled(requestId?: string): void {
        console.log('Camera parameter selection cancelled');
        const pendingDepthFiles = this.callbacks.getPendingDepthFiles();
        
        if (requestId && pendingDepthFiles.has(requestId)) {
            // Remove only the specific cancelled Depth file
            const depthData = pendingDepthFiles.get(requestId);
            this.callbacks.removePendingDepthFile(requestId);
            this.callbacks.showError(`Depth conversion cancelled for ${depthData?.fileName || 'file'}`);
        } else {
            // Fallback: clear all pending Depth files
            pendingDepthFiles.clear();
            this.callbacks.showError('Depth conversion cancelled by user');
        }
    }

    /**
     * Handle camera parameters error
     */
    handleCameraParamsError(error: string, requestId?: string): void {
        console.error('Camera parameter error:', error);
        const pendingDepthFiles = this.callbacks.getPendingDepthFiles();
        
        if (requestId && pendingDepthFiles.has(requestId)) {
            // Remove only the specific Depth file with error
            const depthData = pendingDepthFiles.get(requestId);
            this.callbacks.removePendingDepthFile(requestId);
            this.callbacks.showError(`Camera parameter error for ${depthData?.fileName || 'file'}: ${error}`);
        } else {
            // Fallback: clear all pending Depth files
            pendingDepthFiles.clear();
            this.callbacks.showError(`Camera parameter error: ${error}`);
        }
    }

    /**
     * Handle save PLY file result
     */
    handleSavePlyFileResult(message: any): void {
        if (message.success) {
            this.callbacks.showStatus(`PLY file saved successfully: ${message.filePath}`);
            console.log(`✅ PLY file saved: ${message.filePath}`);
        } else {
            if (message.cancelled) {
                this.callbacks.showStatus('Save operation cancelled by user');
            } else {
                this.callbacks.showError(`Failed to save PLY file: ${message.error || 'Unknown error'}`);
                console.error('PLY save error:', message.error);
            }
        }
    }
}