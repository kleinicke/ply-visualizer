/**
 * Color utilities for gamma correction and color space conversion
 * Independent of VS Code APIs
 */
export class ColorUtils {
    private static srgbToLinearLUT: Float32Array | null = null;

    /**
     * Predefined colors for different files
     */
    static readonly FILE_COLORS: [number, number, number][] = [
        [1.0, 1.0, 1.0], // White
        [1.0, 0.0, 0.0], // Red
        [0.0, 1.0, 0.0], // Green
        [0.0, 0.0, 1.0], // Blue
        [1.0, 1.0, 0.0], // Yellow
        [1.0, 0.0, 1.0], // Magenta
        [0.0, 1.0, 1.0], // Cyan
        [1.0, 0.5, 0.0], // Orange
        [0.5, 0.0, 1.0], // Purple
        [0.0, 0.5, 0.0], // Dark Green
        [0.5, 0.5, 0.5]  // Gray
    ];

    /**
     * Ensure sRGB to linear LUT is created
     */
    static ensureSrgbLUT(): void {
        if (ColorUtils.srgbToLinearLUT) return;
        const lut = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const s = i / 255;
            lut[i] = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        }
        ColorUtils.srgbToLinearLUT = lut;
    }

    /**
     * Get sRGB to linear conversion LUT
     */
    static getSrgbToLinearLUT(): Float32Array {
        ColorUtils.ensureSrgbLUT();
        return ColorUtils.srgbToLinearLUT!;
    }

    /**
     * Convert sRGB color to linear
     */
    static srgbToLinear(r: number, g: number, b: number): [number, number, number] {
        ColorUtils.ensureSrgbLUT();
        const lut = ColorUtils.srgbToLinearLUT!;
        
        const r8 = Math.round(Math.max(0, Math.min(255, r * 255)));
        const g8 = Math.round(Math.max(0, Math.min(255, g * 255)));
        const b8 = Math.round(Math.max(0, Math.min(255, b * 255)));
        
        return [lut[r8], lut[g8], lut[b8]];
    }

    /**
     * Convert byte color to linear using LUT
     */
    static byteToLinear(r: number, g: number, b: number): [number, number, number] {
        ColorUtils.ensureSrgbLUT();
        const lut = ColorUtils.srgbToLinearLUT!;
        
        return [lut[r & 255], lut[g & 255], lut[b & 255]];
    }

    /**
     * Convert byte color to normalized sRGB
     */
    static byteToSrgb(r: number, g: number, b: number): [number, number, number] {
        return [(r & 255) / 255, (g & 255) / 255, (b & 255) / 255];
    }
}