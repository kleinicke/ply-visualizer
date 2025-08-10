import * as THREE from 'three';

interface CameraParams {
    cameraModel: 'pinhole' | 'fisheye';
    focalLength: number;
}

interface TifConversionResult {
    vertices: Float32Array;
    colors?: Float32Array;
    pointCount: number;
}

declare const GeoTIFF: any;

export class TifProcessor {
    
    /**
     * Process TIF file data and convert to point cloud
     */
    async processTifToPointCloud(tifData: ArrayBuffer, cameraParams: CameraParams): Promise<TifConversionResult> {
        try {
            // Load TIF using GeoTIFF
            const tiff = await GeoTIFF.fromArrayBuffer(tifData);
            const image = await tiff.getImage();
            
            // Get image dimensions and data
            const width = image.getWidth();
            const height = image.getHeight();
            const rasters = await image.readRasters();
            
            console.log(`Processing TIF: ${width}x${height}, camera: ${cameraParams.cameraModel}, focal: ${cameraParams.focalLength}`);
            
            // Extract depth data (assuming single band depth image)
            const depthData = new Float32Array(rasters[0]);
            
            // Calculate camera intrinsics (principal point at image center)
            const fx = cameraParams.focalLength;
            const fy = cameraParams.focalLength;
            const cx = width / 2;
            const cy = height / 2;
            
            // Convert depth image to point cloud
            const result = this.depthToPointCloud(
                depthData,
                width,
                height,
                fx,
                fy,
                cx,
                cy,
                cameraParams.cameraModel
            );
            
            return result;
            
        } catch (error) {
            console.error('Error processing TIF:', error);
            throw new Error(`Failed to process TIF file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Convert depth image to 3D point cloud
     * Based on the Python reference implementation
     */
    private depthToPointCloud(
        depthData: Float32Array,
        width: number,
        height: number,
        fx: number,
        fy: number,
        cx: number,
        cy: number,
        cameraModel: 'pinhole' | 'fisheye'
    ): TifConversionResult {
        
        const points: number[] = [];
        const colors: number[] = [];
        
        if (cameraModel === 'fisheye') {
            // Fisheye (equidistant) projection model
            for (let i = 0; i < width; i++) {
                for (let j = 0; j < height; j++) {
                    const depthIndex = j * width + i; // Note: j*width + i for proper indexing
                    const depth = depthData[depthIndex];
                    
                    // Skip invalid depth values
                    if (isNaN(depth) || depth <= 0) {
                        continue;
                    }
                    
                    // Compute offset from principal point
                    const u = i - cx;
                    const v = j - cy;
                    const r = Math.sqrt(u * u + v * v);
                    
                    if (r === 0) {
                        // Handle center point
                        points.push(0, 0, depth);
                    } else {
                        // Normalize offset
                        const u_norm = u / r;
                        const v_norm = v / r;
                        
                        // Compute angle for equidistant fisheye
                        const theta = r / fx;
                        
                        // Create 3D unit vector
                        const x_norm = u_norm * Math.sin(theta);
                        const y_norm = v_norm * Math.sin(theta);
                        const z_norm = Math.cos(theta);
                        
                        // Scale by depth
                        points.push(
                            x_norm * depth,
                            y_norm * depth,
                            z_norm * depth
                        );
                    }
                    
                    // Add color based on depth (grayscale visualization)
                    const normalizedDepth = Math.min(depth / 10, 1); // Scale depth for visualization
                    colors.push(normalizedDepth, normalizedDepth, normalizedDepth);
                }
            }
        } else {
            // Pinhole camera model
            for (let v = 0; v < height; v++) {
                for (let u = 0; u < width; u++) {
                    const depthIndex = v * width + u;
                    const depth = depthData[depthIndex];
                    
                    // Skip invalid depth values
                    if (isNaN(depth) || depth <= 0) {
                        continue;
                    }
                    
                    // Compute normalized pixel coordinates
                    const X = (u - cx) / fx;
                    const Y = (v - cy) / fy;
                    const Z = 1.0;
                    
                    // Create direction vector
                    const norm = Math.sqrt(X * X + Y * Y + Z * Z);
                    const dirX = X / norm;
                    const dirY = Y / norm;
                    const dirZ = Z / norm;
                    
                    // Scale by depth (euclidean depth)
                    points.push(
                        dirX * depth,
                        dirY * depth,
                        dirZ * depth
                    );
                    
                    // Add color based on depth (grayscale visualization)
                    const normalizedDepth = Math.min(depth / 10, 1); // Scale depth for visualization
                    colors.push(normalizedDepth, normalizedDepth, normalizedDepth);
                }
            }
        }
        
        console.log(`Generated ${points.length / 3} points from ${width}x${height} depth image`);
        
        return {
            vertices: new Float32Array(points),
            colors: new Float32Array(colors),
            pointCount: points.length / 3
        };
    }
    
    /**
     * Apply coordinate convention transformation
     */
    private applyCoordinateConvention(
        vertices: Float32Array,
        convention: 'opencv' | 'opengl'
    ): Float32Array {
        if (convention === 'opengl') {
            // Convert from OpenCV (Y-down, Z-forward) to OpenGL (Y-up, Z-backward)
            for (let i = 0; i < vertices.length; i += 3) {
                const x = vertices[i];
                const y = vertices[i + 1];
                const z = vertices[i + 2];
                
                vertices[i] = x;      // X unchanged
                vertices[i + 1] = -y; // Y flipped
                vertices[i + 2] = -z; // Z flipped
            }
        }
        return vertices;
    }
} 