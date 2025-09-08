export interface TumCamera {
    name: string;
    fx: number;
    fy: number;
    cx: number;
    cy: number;
}

export interface TumCalibrationResult {
    cameras: Record<string, TumCamera>;
}

/**
 * Parses TUM dataset camera.txt files
 * 
 * Format: fx fy cx cy
 * Simple space-separated values on a single line
 */
export class TumParser {
    
    /**
     * Parse TUM camera.txt content
     */
    static parse(content: string, fileName: string = 'camera.txt'): TumCalibrationResult {
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed.length === 0) {
                continue;
            }
            
            // Parse camera parameters
            const parts = trimmed.split(/\s+/);
            
            if (parts.length === 4) {
                const fx = parseFloat(parts[0]);
                const fy = parseFloat(parts[1]);
                const cx = parseFloat(parts[2]);
                const cy = parseFloat(parts[3]);
                
                if (isNaN(fx) || isNaN(fy) || isNaN(cx) || isNaN(cy)) {
                    console.warn(`Invalid numeric values in TUM camera line: ${line}`);
                    continue;
                }
                
                const camera: TumCamera = {
                    name: 'camera',
                    fx, fy, cx, cy
                };
                
                return {
                    cameras: { camera }
                };
            } else {
                console.warn(`Invalid TUM camera format, expected 4 values, got ${parts.length}: ${line}`);
            }
        }
        
        throw new Error('No valid camera parameters found in TUM file');
    }
    
    /**
     * Convert to PLY Visualizer camera format
     */
    static toCameraFormat(result: TumCalibrationResult): { cameras: Record<string, any> } {
        const cameras: Record<string, any> = {};
        
        for (const [name, cam] of Object.entries(result.cameras)) {
            cameras[name] = {
                name: cam.name,
                fx: cam.fx,
                fy: cam.fy,
                cx: cam.cx,
                cy: cam.cy,
                camera_model: 'pinhole-ideal'
            };
        }
        
        return { cameras };
    }
    
    /**
     * Validate TUM camera.txt format
     */
    static validate(content: string): boolean {
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed.length === 0) {
                continue;
            }
            
            // Check if line has exactly 4 numeric values
            const parts = trimmed.split(/\s+/);
            if (parts.length === 4) {
                const allNumeric = parts.every(part => !isNaN(parseFloat(part)));
                if (allNumeric) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check if content is likely TUM format
     */
    static isTumFormat(content: string, fileName: string): boolean {
        // TUM files are typically named camera.txt, calibration.txt, etc.
        const isTumName = fileName.toLowerCase().includes('camera') || 
                         fileName.toLowerCase().includes('calibration') ||
                         fileName.toLowerCase().includes('tum');
        
        // Content should be simple: just numeric values
        const hasSimpleFormat = this.validate(content);
        
        // Should not have complex structure (no sections, matrices, etc.)
        const isSimple = !content.includes('[') && 
                         !content.includes('{') && 
                         !content.includes('matrix') &&
                         !content.includes('=');
        
        return isTumName && hasSimpleFormat && isSimple;
    }
}