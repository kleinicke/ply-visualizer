export interface ZedCamera {
    name: string;
    fx: number;
    fy: number;
    cx: number;
    cy: number;
    k1?: number;
    k2?: number;
    k3?: number;
    p1?: number;
    p2?: number;
    baseline?: number;
}

export interface ZedCalibrationResult {
    cameras: Record<string, ZedCamera>;
    stereoBaseline?: number;
}

/**
 * Parses ZED camera calibration .conf files
 * 
 * Format:
 * [LEFT_CAM_HD]
 * fx=672.123
 * fy=672.456
 * ...
 * 
 * [STEREO]  
 * Baseline=120.0
 */
export class ZedParser {
    
    /**
     * Parse ZED .conf file content
     */
    static parse(content: string): ZedCalibrationResult {
        const sections = this.parseSections(content);
        const cameras: Record<string, ZedCamera> = {};
        let baseline: number | undefined;
        
        // Parse camera sections
        for (const [sectionName, params] of Object.entries(sections)) {
            if (sectionName.includes('CAM')) {
                const camera = this.parseCamera(sectionName, params);
                if (camera) {
                    cameras[camera.name] = camera;
                }
            } else if (sectionName === 'STEREO') {
                baseline = this.parseBaseline(params);
            }
        }
        
        // Add baseline to all cameras
        if (baseline !== undefined) {
            for (const camera of Object.values(cameras)) {
                camera.baseline = baseline;
            }
        }
        
        if (Object.keys(cameras).length === 0) {
            throw new Error('No valid cameras found in ZED calibration file');
        }
        
        return {
            cameras,
            stereoBaseline: baseline
        };
    }
    
    /**
     * Parse INI-style sections
     */
    private static parseSections(content: string): Record<string, Record<string, string>> {
        const sections: Record<string, Record<string, string>> = {};
        const lines = content.trim().split('\n');
        
        let currentSection: string | null = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
                continue;
            }
            
            // Section header
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                currentSection = trimmed.slice(1, -1);
                sections[currentSection] = {};
                continue;
            }
            
            // Key-value pair
            if (currentSection && trimmed.includes('=')) {
                const [key, ...valueParts] = trimmed.split('=');
                const value = valueParts.join('='); // Handle values with '=' in them
                sections[currentSection][key.trim()] = value.trim();
            }
        }
        
        return sections;
    }
    
    /**
     * Parse camera parameters from section
     */
    private static parseCamera(sectionName: string, params: Record<string, string>): ZedCamera | null {
        // Extract camera name from section (LEFT_CAM_HD -> left)
        const name = sectionName.toLowerCase().includes('left') ? 'left' : 
                    sectionName.toLowerCase().includes('right') ? 'right' : 
                    sectionName.toLowerCase();
        
        const fx = parseFloat(params.fx);
        const fy = parseFloat(params.fy);
        const cx = parseFloat(params.cx);
        const cy = parseFloat(params.cy);
        
        if (isNaN(fx) || isNaN(fy) || isNaN(cx) || isNaN(cy)) {
            console.warn(`Invalid camera parameters in section ${sectionName}`);
            return null;
        }
        
        const camera: ZedCamera = {
            name,
            fx, fy, cx, cy
        };
        
        // Optional distortion parameters
        if (params.k1) camera.k1 = parseFloat(params.k1);
        if (params.k2) camera.k2 = parseFloat(params.k2);
        if (params.k3) camera.k3 = parseFloat(params.k3);
        if (params.p1) camera.p1 = parseFloat(params.p1);
        if (params.p2) camera.p2 = parseFloat(params.p2);
        
        return camera;
    }
    
    /**
     * Parse baseline from stereo section
     */
    private static parseBaseline(params: Record<string, string>): number | undefined {
        if (params.Baseline) {
            const baseline = parseFloat(params.Baseline);
            return isNaN(baseline) ? undefined : baseline;
        }
        return undefined;
    }
    
    /**
     * Convert to PLY Visualizer camera format
     */
    static toCameraFormat(result: ZedCalibrationResult): { cameras: Record<string, any> } {
        const cameras: Record<string, any> = {};
        
        for (const [name, cam] of Object.entries(result.cameras)) {
            // ZED cameras typically use OpenCV distortion model
            const cameraModel = (cam.k1 || cam.k2 || cam.p1 || cam.p2) ? 'pinhole-opencv' : 'pinhole-ideal';
            
            cameras[name] = {
                name: cam.name,
                fx: cam.fx,
                fy: cam.fy,
                cx: cam.cx,
                cy: cam.cy,
                camera_model: cameraModel,
                baseline: cam.baseline,
                k1: cam.k1,
                k2: cam.k2,
                k3: cam.k3,
                p1: cam.p1,
                p2: cam.p2
            };
        }
        
        return { cameras };
    }
    
    /**
     * Validate ZED conf file format
     */
    static validate(content: string): boolean {
        // Check for ZED-specific section patterns
        const hasZedSection = content.includes('[LEFT_CAM') || 
                             content.includes('[RIGHT_CAM') || 
                             content.includes('[STEREO');
        
        const hasZedParams = content.includes('fx=') && 
                            content.includes('fy=') && 
                            content.includes('cx=') && 
                            content.includes('cy=');
        
        return hasZedSection && hasZedParams;
    }
}