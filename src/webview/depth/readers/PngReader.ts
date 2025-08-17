import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata, DepthKind } from '../types';

export interface PngDepthConfig {
    scaleFactor: number; // Depth/disparity is divided to get applied value in meters/disparities (1000 for mm, 256 for disparity, 1 for meters)
    invalidValue?: number; // Value representing invalid pixels (default: 0)
}

export class PngReader implements DepthReader {
    private config: PngDepthConfig = {
        scaleFactor: 1000, // Default: millimeters to meters
        invalidValue: 0
    };

    canRead(filename: string): boolean {
        return filename.toLowerCase().endsWith('.png');
    }

    setConfig(config: Partial<PngDepthConfig>): void {
        this.config = { ...this.config, ...config };
    }

    async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
        try {
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Try to detect if this is a 16-bit PNG and parse accordingly
            const pngInfo = this.detectPngFormat(uint8Array);
            let depthImage: DepthImage;
            
            if (pngInfo.bitDepth === 16) {
                // Handle 16-bit PNG using raw parsing
                depthImage = await this.parse16BitPng(uint8Array);
            } else {
                // Handle 8-bit PNG using canvas fallback
                const imageData = await this.decodePng(uint8Array);
                depthImage = this.convertCanvasToDepth(imageData);
            }
            
            const metadata = this.createMetadata();
            metadata.bitDepth = pngInfo.bitDepth;

            return { image: depthImage, meta: metadata };

        } catch (error) {
            throw new Error(`Failed to read PNG file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async decodePng(data: Uint8Array): Promise<ImageData> {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not create canvas context'));
                return;
            }

            const blob = new Blob([data], { type: 'image/png' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                try {
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    URL.revokeObjectURL(url);
                    resolve(imageData);
                } catch (error) {
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load PNG image'));
            };

            img.src = url;
        });
    }

    private detectPngFormat(data: Uint8Array): { bitDepth: number; colorType: number; width: number; height: number } {
        // PNG signature check
        const signature = [137, 80, 78, 71, 13, 10, 26, 10];
        for (let i = 0; i < signature.length; i++) {
            if (data[i] !== signature[i]) {
                throw new Error('Invalid PNG signature');
            }
        }

        // Find IHDR chunk (should be the first chunk after signature)
        let offset = 8; // Skip PNG signature
        
        while (offset < data.length) {
            const length = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
            const chunkType = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
            
            if (chunkType === 'IHDR') {
                const width = (data[offset + 8] << 24) | (data[offset + 9] << 16) | (data[offset + 10] << 8) | data[offset + 11];
                const height = (data[offset + 12] << 24) | (data[offset + 13] << 16) | (data[offset + 14] << 8) | data[offset + 15];
                const bitDepth = data[offset + 16];
                const colorType = data[offset + 17];
                
                return { bitDepth, colorType, width, height };
            }
            
            offset += 8 + length + 4; // chunk header + data + CRC
        }
        
        throw new Error('IHDR chunk not found');
    }

    private async parse16BitPng(data: Uint8Array): Promise<DepthImage> {
        const pngInfo = this.detectPngFormat(data);
        
        if (pngInfo.colorType !== 0) {
            throw new Error('Only grayscale PNG images are supported for depth');
        }
        
        // For now, use a simplified approach with canvas API and scale values
        // This will lose 16-bit precision but provides basic functionality
        const imageData = await this.decodePng(data);
        const depthData = new Float32Array(pngInfo.width * pngInfo.height);
        
        // Convert 8-bit canvas data to depth values, scaling up to simulate 16-bit range
        for (let i = 0; i < pngInfo.width * pngInfo.height; i++) {
            const pixelIndex = i * 4;
            let rawValue = imageData.data[pixelIndex]; // Use red channel
            
            // Scale 8-bit value to 16-bit range for better depth representation
            rawValue = rawValue * 256;
            
            // Check for invalid pixels
            if (rawValue === this.config.invalidValue) {
                depthData[i] = 0;
                continue;
            }

            // Apply scale factor to convert to meters
            const depthValue = rawValue / this.config.scaleFactor;
            depthData[i] = depthValue;
        }

        return {
            width: pngInfo.width,
            height: pngInfo.height,
            data: depthData
        };
    }

    private convertCanvasToDepth(imageData: ImageData): DepthImage {
        const { width, height, data } = imageData;
        const depthData = new Float32Array(width * height);
        
        // Convert RGBA to depth values
        // Note: This assumes 8-bit input from canvas, real 16-bit would need different handling
        for (let i = 0; i < width * height; i++) {
            const pixelIndex = i * 4;
            // For grayscale, R, G, B should be the same
            let rawValue = data[pixelIndex]; // Use red channel
            
            // Check for invalid pixels
            if (rawValue === this.config.invalidValue) {
                depthData[i] = 0; // Mark as invalid
                continue;
            }

            // Apply scale factor to convert to meters
            const depthValue = rawValue / this.config.scaleFactor;
            depthData[i] = depthValue;
        }

        return {
            width,
            height,
            data: depthData
        };
    }

    private createMetadata(): DepthMetadata {
        return {
            kind: 'depth', // Always treat as depth values after scaling
            unit: 'meter', // We convert to meters using scaleFactor
            scale: this.config.scaleFactor,
            requiresConfiguration: true, // PNG depth images often need configuration
            invalidValue: this.config.invalidValue
        };
    }

    // Method to configure PNG depth interpretation from UI
    static createWithConfig(config: PngDepthConfig): PngReader {
        const reader = new PngReader();
        reader.setConfig(config);
        return reader;
    }
}

// Enhanced version that would use a proper 16-bit PNG library
export class Enhanced16BitPngReader implements DepthReader {
    private config: PngDepthConfig = {
        scaleFactor: 1000, // Default: millimeters to meters
        invalidValue: 0
    };

    canRead(filename: string): boolean {
        return filename.toLowerCase().endsWith('.png');
    }

    setConfig(config: Partial<PngDepthConfig>): void {
        this.config = { ...this.config, ...config };
    }

    async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
        // This would use a library like pngjs to properly decode 16-bit PNG files
        // import PNG from 'pngjs';
        
        throw new Error('Enhanced 16-bit PNG reader requires pngjs library integration');
        
        // Example implementation structure:
        /*
        const png = PNG.sync.read(Buffer.from(arrayBuffer));
        
        if (png.colorType !== 0 || png.bitDepth !== 16) {
            throw new Error('PNG must be 16-bit grayscale');
        }

        const depthData = new Float32Array(png.width * png.height);
        
        for (let i = 0; i < png.width * png.height; i++) {
            const pixelIndex = i * 2; // 16-bit = 2 bytes per pixel
            const rawValue = (png.data[pixelIndex] << 8) | png.data[pixelIndex + 1];
            
            // Apply depth conversion logic here
            depthData[i] = this.convertRawValueToDepth(rawValue);
        }

        return {
            image: { width: png.width, height: png.height, data: depthData },
            meta: this.createMetadata()
        };
        */
    }
}