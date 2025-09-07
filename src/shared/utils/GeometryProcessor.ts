import * as THREE from 'three';
import { PlyVertex, PlyFace, PlyData } from '../../webview/interfaces';
import { ColorUtils } from './ColorUtils';

/**
 * Geometry processing utilities
 * Independent of VS Code APIs - handles PLY data to Three.js geometry conversion
 */
export class GeometryProcessor {
    
    /**
     * Create Three.js geometry from PLY data
     * Extracted from main.ts - massive 160-line function
     */
    static createGeometryFromPlyData(
        data: PlyData, 
        convertSrgbToLinear: boolean = true,
        onTiming?: (geometryMs: number) => void
    ): THREE.BufferGeometry {
        const geometry = new THREE.BufferGeometry();
        
        const startTime = performance.now();
        
        // Check if we have direct TypedArrays (new ultra-fast path)
        if ((data as any).useTypedArrays) {
            
            const positions = (data as any).positionsArray as Float32Array;
            const colors = (data as any).colorsArray as Uint8Array | null;
            const normals = (data as any).normalsArray as Float32Array | null;
            
            // Direct assignment - zero copying, zero processing!
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            if (colors && data.hasColors) {
                const colorFloats = new Float32Array(colors.length);
                if (convertSrgbToLinear) {
                    ColorUtils.ensureSrgbLUT();
                    const lut = ColorUtils.getSrgbToLinearLUT();
                    for (let i = 0; i < colors.length; i++) {
                        colorFloats[i] = lut[colors[i]];
                    }
                } else {
                    for (let i = 0; i < colors.length; i++) {
                        colorFloats[i] = colors[i] / 255;
                    }
                }
                geometry.setAttribute('color', new THREE.BufferAttribute(colorFloats, 3));
            }
            
            if (normals && data.hasNormals) {
                geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            }
            
        } else {
            // Fallback to traditional vertex object processing
            const vertexCount = data.vertices.length;
            // fallback path
            
            // Pre-allocate typed arrays for better performance
            const vertices = new Float32Array(vertexCount * 3);
            const colors = data.hasColors ? new Float32Array(vertexCount * 3) : null;
            const normals = data.hasNormals ? new Float32Array(vertexCount * 3) : null;

            // Optimized vertex processing - batch operations
            const vertexArray = data.vertices;
            for (let i = 0, i3 = 0; i < vertexCount; i++, i3 += 3) {
                const vertex = vertexArray[i];
                
                // Position data (required)
                vertices[i3] = vertex.x;
                vertices[i3 + 1] = vertex.y;
                vertices[i3 + 2] = vertex.z;

                // Color data (optional)
                if (colors && vertex.red !== undefined) {
                    const r8 = (vertex.red || 0) & 255;
                    const g8 = (vertex.green || 0) & 255;
                    const b8 = (vertex.blue || 0) & 255;
                    if (convertSrgbToLinear) {
                        ColorUtils.ensureSrgbLUT();
                        const lut = ColorUtils.getSrgbToLinearLUT();
                        colors[i3] = lut[r8];
                        colors[i3 + 1] = lut[g8];
                        colors[i3 + 2] = lut[b8];
                    } else {
                        colors[i3] = r8 / 255;
                        colors[i3 + 1] = g8 / 255;
                        colors[i3 + 2] = b8 / 255;
                    }
                }

                // Normal data (optional)
                if (normals && vertex.nx !== undefined) {
                    normals[i3] = vertex.nx;
                    normals[i3 + 1] = vertex.ny || 0;
                    normals[i3 + 2] = vertex.nz || 0;
                }
            }

            // Set attributes
            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            
            if (colors) {
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            }

            if (normals) {
                geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            }
        }

        // Optimized face processing
        if (data.faces.length > 0) {
            // Estimate index count for pre-allocation
            let estimatedIndexCount = 0;
            for (const face of data.faces) {
                if (face.indices.length >= 3) {
                    estimatedIndexCount += (face.indices.length - 2) * 3;
                }
            }
            
            const indices = new Uint32Array(estimatedIndexCount);
            let indexOffset = 0;
            
            for (const face of data.faces) {
                if (face.indices.length >= 3) {
                    // Optimized fan triangulation
                    const faceIndices = face.indices;
                    const firstIndex = faceIndices[0];
                    
                    for (let i = 1; i < faceIndices.length - 1; i++) {
                        indices[indexOffset++] = firstIndex;
                        indices[indexOffset++] = faceIndices[i];
                        indices[indexOffset++] = faceIndices[i + 1];
                    }
                }
            }
            
            if (indexOffset > 0) {
                // Trim array if we over-estimated
                const finalIndices = indexOffset < indices.length ? indices.slice(0, indexOffset) : indices;
                geometry.setIndex(new THREE.BufferAttribute(finalIndices, 1));
            }
        }

        // Ensure normals are available for proper lighting after indices are set
        if (!geometry.getAttribute('normal') && data.faces.length > 0) {
            geometry.computeVertexNormals();
        }

        geometry.computeBoundingBox();
        
        // Debug bounding box for disparity Depth files (may help with disappearing issue)
        if (geometry.boundingBox) {
            const box = geometry.boundingBox;
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
        // debug: bbox
            
            // Check for extreme values that might cause culling issues
            const maxDimension = Math.max(size.x, size.y, size.z);
            if (maxDimension > 10000) {
                // debug
            }
            
            // Check distance from origin
            const distanceFromOrigin = center.length();
            if (distanceFromOrigin > 1000) {
                // debug
            }
        }
        
        const endTime = performance.now();
        const geometryMs = +(endTime - startTime).toFixed(1);
        console.log(`Render: geometry ${geometryMs}ms`);
        onTiming?.(geometryMs);
        
        return geometry;
    }

    /**
     * Optimize point cloud material for different point counts
     */
    static optimizeForPointCount(material: THREE.PointsMaterial, pointCount: number): void {
        // Keep original visual quality settings
        material.transparent = true;
        material.alphaTest = 0.1;
        material.depthTest = true;
        material.depthWrite = true;
        material.sizeAttenuation = true; // Keep world-space sizing
        
        // Force material update
        material.needsUpdate = true;
    }

    /**
     * Create optimized point cloud with adaptive decimation support
     */
    static createOptimizedPointCloud(geometry: THREE.BufferGeometry, material: THREE.PointsMaterial): THREE.Points {
        // Optimize geometry for GPU
        const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
        if (positions && positions.count > 50000) {
            // For very large point clouds, try to reduce vertex data transfer
            geometry.deleteAttribute('normal'); // Points don't need normals
            geometry.computeBoundingBox(); // Help with frustum culling
            geometry.computeBoundingSphere();
        }
        
        const points = new THREE.Points(geometry, material);
        
        // Add adaptive decimation for large point clouds
        if (positions && positions.count > 100000) {
            (points as any).originalGeometry = geometry.clone(); // Store full geometry
            (points as any).hasAdaptiveDecimation = true;
            points.frustumCulled = false;
        }
        
        return points;
    }

    /**
     * Decimate geometry based on camera distance for LOD
     */
    static decimateGeometryByDistance(originalGeometry: THREE.BufferGeometry, cameraDistance: number): THREE.BufferGeometry {
        const positions = originalGeometry.getAttribute('position') as THREE.BufferAttribute;
        const colors = originalGeometry.getAttribute('color') as THREE.BufferAttribute;
        
        let decimationFactor = 1;
        
        // Aggressive decimation when zoomed out (high camera distance)
        if (cameraDistance > 50) decimationFactor = 10;      // Keep every 10th point
        else if (cameraDistance > 20) decimationFactor = 5;  // Keep every 5th point  
        else if (cameraDistance > 10) decimationFactor = 3;  // Keep every 3rd point
        else if (cameraDistance > 5) decimationFactor = 2;   // Keep every 2nd point
        
        if (decimationFactor === 1) return originalGeometry;
        
        const totalPoints = positions.count;
        const decimatedCount = Math.floor(totalPoints / decimationFactor);
        
        const newPositions = new Float32Array(decimatedCount * 3);
        const newColors = colors ? new Float32Array(decimatedCount * 3) : null;
        
        let writeIndex = 0;
        for (let i = 0; i < totalPoints; i += decimationFactor) {
            // Copy position
            newPositions[writeIndex * 3] = positions.array[i * 3];
            newPositions[writeIndex * 3 + 1] = positions.array[i * 3 + 1];
            newPositions[writeIndex * 3 + 2] = positions.array[i * 3 + 2];
            
            // Copy color if available
            if (newColors && colors) {
                newColors[writeIndex * 3] = colors.array[i * 3];
                newColors[writeIndex * 3 + 1] = colors.array[i * 3 + 1];
                newColors[writeIndex * 3 + 2] = colors.array[i * 3 + 2];
            }
            
            writeIndex++;
        }
        
        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
        if (newColors) {
            newGeometry.setAttribute('color', new THREE.BufferAttribute(newColors, 3));
        }
        
        return newGeometry;
    }

    /**
     * Update adaptive decimation for multiple point clouds
     */
    static updateAdaptiveDecimation(
        meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[],
        camera: THREE.PerspectiveCamera,
        lastCameraDistance: number
    ): number {
        // Calculate average distance to all point clouds
        let totalDistance = 0;
        let pointCloudCount = 0;
        
        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            if (mesh && (mesh instanceof THREE.Points) && (mesh as any).hasAdaptiveDecimation) {
                if (mesh.geometry.boundingBox) {
                    const center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
                    center.applyMatrix4(mesh.matrixWorld);
                    totalDistance += camera.position.distanceTo(center);
                    pointCloudCount++;
                }
            }
        }
        
        if (pointCloudCount === 0) return lastCameraDistance;
        
        const avgDistance = totalDistance / pointCloudCount;
        
        // Update geometries if distance changed significantly
        const distanceThreshold = 2.0; // Only update if camera moved significantly
        if (Math.abs(avgDistance - lastCameraDistance) > distanceThreshold) {
            console.log(`🔄 Adaptive decimation: distance=${avgDistance.toFixed(1)}`);
            
            for (let i = 0; i < meshes.length; i++) {
                const mesh = meshes[i];
                if (mesh && (mesh instanceof THREE.Points) && (mesh as any).hasAdaptiveDecimation) {
                    const originalGeometry = (mesh as any).originalGeometry;
                    if (originalGeometry) {
                        const decimatedGeometry = GeometryProcessor.decimateGeometryByDistance(originalGeometry, avgDistance);
                        
                        // Update mesh geometry
                        mesh.geometry.dispose();
                        mesh.geometry = decimatedGeometry;
                        
                        console.log(`📊 File ${i}: ${originalGeometry.getAttribute('position').count} → ${decimatedGeometry.getAttribute('position').count} points`);
                    }
                }
            }
        }
        
        return avgDistance;
    }

    /**
     * Fit camera to view all objects
     */
    static fitCameraToObjects(
        objects: THREE.Object3D[],
        camera: THREE.PerspectiveCamera,
        controls: any
    ): void {
        if (objects.length === 0) return;

        const box = new THREE.Box3();
        for (const obj of objects) { 
            box.expandByObject(obj); 
        }

        if (box.isEmpty()) return;

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Calculate camera position based on field of view
        const fov = camera.fov * (Math.PI / 180);
        const distance = maxDim / (2 * Math.tan(fov / 2));
        
        // Position camera at a distance that shows the entire object
        const cameraDistance = distance * 1.5; // Add some padding
        camera.position.copy(center);
        camera.position.z += cameraDistance;
        
        // Update controls target if available
        if (controls && controls.target) {
            controls.target.copy(center);
            controls.update();
        }
    }

    /**
     * Fit camera to single object
     */
    static fitCameraToObject(
        obj: THREE.Object3D,
        camera: THREE.PerspectiveCamera,
        controls: any
    ): void {
        GeometryProcessor.fitCameraToObjects([obj], camera, controls);
    }

    /**
     * Check if mesh is visible within camera frustum
     */
    static checkMeshVisibility(
        meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[],
        fileVisibility: boolean[],
        camera: THREE.PerspectiveCamera
    ): void {
        // Check if any meshes are being culled by frustum culling
        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            const isVisible = fileVisibility[i];
            
            if (!isVisible) continue; // Skip if manually hidden
            
            // Check if mesh should be visible but might be culled
            if (mesh && mesh.geometry && mesh.geometry.boundingBox) {
                const box = mesh.geometry.boundingBox.clone();
                box.applyMatrix4(mesh.matrixWorld);
                
                // Simple frustum check - if bounding box is completely outside view
                const center = box.getCenter(new THREE.Vector3());
                const distanceToCamera = camera.position.distanceTo(center);
                
                // Check if it's within camera range
                const withinNearFar = distanceToCamera >= camera.near && distanceToCamera <= camera.far;
                
                if (!withinNearFar) {
                    console.log(`⚠️ Mesh ${i} may be culled: distance=${distanceToCamera.toFixed(1)}, near=${camera.near}, far=${camera.far}`);
                }
                
                // Check if bounding box is extremely large
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 50000) {
                    console.log(`📏 Large mesh ${i}: max dimension=${maxDim.toFixed(1)}`);
                }
            }
        }
    }
}