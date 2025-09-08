export interface ColmapCamera {
    id: number;
    model: string;
    width: number;
    height: number;
    fx: number;
    fy?: number;
    cx: number;
    cy: number;
    k1?: number;
    k2?: number;
    k3?: number;
    k4?: number;
    p1?: number;
    p2?: number;
    name: string;
}

export interface ColmapCalibrationResult {
    cameras: Record<string, ColmapCamera>;
}

/**
 * Parses COLMAP cameras.txt format
 * 
 * Format: CAMERA_ID MODEL WIDTH HEIGHT PARAMS[]
 * Models:
 * - PINHOLE: fx fy cx cy
 * - RADIAL: f cx cy k1
 * - OPENCV: fx fy cx cy k1 k2 p1 p2
 * - OPENCV_FISHEYE: fx fy cx cy k1 k2 k3 k4
 */
export class ColmapParser {
    
    /**
     * Parse COLMAP cameras.txt content
     */
    static parse(content: string): ColmapCalibrationResult {
        const lines = content.trim().split('\n');
        const cameras: Record<string, ColmapCamera> = {};
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed.length === 0) {
                continue;
            }
            
            const parts = trimmed.split(/\s+/);
            if (parts.length < 5) {
                console.warn(`Invalid COLMAP camera line: ${line}`);
                continue;
            }
            
            const id = parseInt(parts[0]);
            const model = parts[1];
            const width = parseInt(parts[2]);
            const height = parseInt(parts[3]);
            const params = parts.slice(4).map(p => parseFloat(p));
            
            if (isNaN(id) || isNaN(width) || isNaN(height)) {
                console.warn(`Invalid numeric values in COLMAP line: ${line}`);
                continue;
            }
            
            const camera = this.parseModelParams(id, model, width, height, params);
            if (camera) {
                cameras[`camera_${id}`] = camera;
            }
        }
        
        if (Object.keys(cameras).length === 0) {
            throw new Error('No valid cameras found in COLMAP file');
        }
        
        return { cameras };
    }
    
    /**
     * Parse camera parameters based on model type
     */
    private static parseModelParams(id: number, model: string, width: number, height: number, params: number[]): ColmapCamera | null {
        const camera: Partial<ColmapCamera> = {
            id,
            model: model.toLowerCase(),
            width,
            height,
            name: `camera_${id}`
        };
        
        switch (model.toUpperCase()) {
            case 'PINHOLE':
                if (params.length !== 4) {
                    console.warn(`PINHOLE model requires 4 parameters, got ${params.length}`);
                    return null;
                }
                camera.fx = params[0];
                camera.fy = params[1];
                camera.cx = params[2];
                camera.cy = params[3];
                break;
                
            case 'RADIAL':
                if (params.length !== 4) {
                    console.warn(`RADIAL model requires 4 parameters, got ${params.length}`);
                    return null;
                }
                camera.fx = params[0];
                camera.fy = params[0]; // Same as fx for radial
                camera.cx = params[1];
                camera.cy = params[2];
                camera.k1 = params[3];
                break;
                
            case 'OPENCV':
                if (params.length !== 8) {
                    console.warn(`OPENCV model requires 8 parameters, got ${params.length}`);
                    return null;
                }
                camera.fx = params[0];
                camera.fy = params[1];
                camera.cx = params[2];
                camera.cy = params[3];
                camera.k1 = params[4];
                camera.k2 = params[5];
                camera.p1 = params[6];
                camera.p2 = params[7];
                break;
                
            case 'OPENCV_FISHEYE':
                if (params.length !== 8) {
                    console.warn(`OPENCV_FISHEYE model requires 8 parameters, got ${params.length}`);
                    return null;
                }
                camera.fx = params[0];
                camera.fy = params[1];
                camera.cx = params[2];
                camera.cy = params[3];
                camera.k1 = params[4];
                camera.k2 = params[5];
                camera.k3 = params[6];
                camera.k4 = params[7];
                break;
                
            default:
                console.warn(`Unknown COLMAP camera model: ${model}`);
                return null;
        }
        
        return camera as ColmapCamera;
    }
    
    /**
     * Convert to PLY Visualizer camera format
     */
    static toCameraFormat(result: ColmapCalibrationResult): { cameras: Record<string, any> } {
        const cameras: Record<string, any> = {};
        
        for (const [name, cam] of Object.entries(result.cameras)) {
            // Map COLMAP models to PLY Visualizer camera models
            let cameraModel = 'pinhole-ideal';
            if (cam.model === 'opencv' && (cam.k1 || cam.k2 || cam.p1 || cam.p2)) {
                cameraModel = 'pinhole-opencv';
            } else if (cam.model === 'opencv_fisheye') {
                cameraModel = 'fisheye-opencv';
            }
            
            cameras[name] = {
                name: cam.name,
                fx: cam.fx,
                fy: cam.fy || cam.fx,
                cx: cam.cx,
                cy: cam.cy,
                camera_model: cameraModel,
                k1: cam.k1,
                k2: cam.k2,
                k3: cam.k3,
                k4: cam.k4,
                p1: cam.p1,
                p2: cam.p2,
                width: cam.width,
                height: cam.height
            };
        }
        
        return { cameras };
    }
    
    /**
     * Validate COLMAP file format
     */
    static validate(content: string): boolean {
        const lines = content.trim().split('\n');
        let hasValidCamera = false;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || trimmed.length === 0) {
                continue;
            }
            
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 5 && !isNaN(parseInt(parts[0]))) {
                hasValidCamera = true;
                break;
            }
        }
        
        return hasValidCamera;
    }
}