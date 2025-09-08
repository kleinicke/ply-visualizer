declare const GeoTIFF: any;

export interface ImageUtilsCallbacks {
    // Dimensions access
    getDepthDimensions: () => { width: number; height: number } | null;
    
    // Status handling
    showColorMappingStatus: (message: string, type: 'success' | 'error' | 'warning') => void;
}

/**
 * Image processing utilities - extracted from main.ts
 * Handles image loading, validation, and format conversion
 */
export class ImageUtils {
    constructor(private callbacks: ImageUtilsCallbacks) {}

    /**
     * Load and validate color image - extracted from main.ts
     */
    async loadAndValidateColorImage(file: File, depthDimensions?: { width: number; height: number }): Promise<ImageData | null> {
        return new Promise((resolve) => {
            if (!depthDimensions && !this.callbacks.getDepthDimensions()) {
                this.callbacks.showColorMappingStatus('No depth image dimensions available for validation', 'error');
                resolve(null);
                return;
            }
            
            const dimensions = depthDimensions || this.callbacks.getDepthDimensions()!;

            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                // Validate dimensions
                if (img.width !== dimensions.width || img.height !== dimensions.height) {
                    this.callbacks.showColorMappingStatus(
                        `Image dimensions (${img.width}×${img.height}) don't match depth image (${dimensions.width}×${dimensions.height})`,
                        'error'
                    );
                    resolve(null);
                    return;
                }

                // Extract image data
                canvas.width = img.width;
                canvas.height = img.height;
                ctx!.drawImage(img, 0, 0);
                const imageData = ctx!.getImageData(0, 0, img.width, img.height);
                
                resolve(imageData);
            };

            img.onerror = () => {
                this.callbacks.showColorMappingStatus('Failed to load color image', 'error');
                resolve(null);
            };

            // Handle different file types
            console.log(`Loading color image: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
            
            if (file.name.toLowerCase().endsWith('.ppm')) {
                // Handle PPM files
                console.log('Loading as PPM file');
                this.loadPpmImage(file, dimensions, resolve);
            } else if (file.type.startsWith('image/') && !file.type.includes('tiff') && !file.type.includes('tif')) {
                // Regular image files (PNG, JPEG, etc.) - not TIF
                console.log('Loading as regular image file');
                img.src = URL.createObjectURL(file);
            } else {
                // Handle TIF files using GeoTIFF
                console.log('Loading as TIF file using GeoTIFF');
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const buffer = e.target!.result as ArrayBuffer;
                        const tiff = await GeoTIFF.fromArrayBuffer(buffer);
                        const image = await tiff.getImage();
                        const rasters = await image.readRasters();
                        
                        // Validate dimensions
                        const width = image.getWidth();
                        const height = image.getHeight();
                        
                        if (width !== dimensions.width || height !== dimensions.height) {
                            this.callbacks.showColorMappingStatus(
                                `TIF dimensions (${width}×${height}) don't match depth image (${dimensions.width}×${dimensions.height})`,
                                'error'
                            );
                            resolve(null);
                            return;
                        }

                        // Convert TIF data to ImageData
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = width;
                        canvas.height = height;
                        
                        const imageData = ctx!.createImageData(width, height);
                        const data = imageData.data;
                        
                        if (rasters.length >= 3) {
                            // RGB TIF - handle different data types
                            const r = rasters[0];
                            const g = rasters[1];
                            const b = rasters[2];
                            
                            for (let i = 0; i < width * height; i++) {
                                // Normalize to 0-255 range regardless of input data type
                                data[i * 4] = Math.min(255, Math.max(0, Math.round(r[i])));
                                data[i * 4 + 1] = Math.min(255, Math.max(0, Math.round(g[i])));
                                data[i * 4 + 2] = Math.min(255, Math.max(0, Math.round(b[i])));
                                data[i * 4 + 3] = 255; // Alpha
                            }
                        } else {
                            // Grayscale TIF - handle different data types
                            const gray = rasters[0];
                            for (let i = 0; i < width * height; i++) {
                                const grayValue = Math.min(255, Math.max(0, Math.round(gray[i])));
                                data[i * 4] = grayValue;
                                data[i * 4 + 1] = grayValue;
                                data[i * 4 + 2] = grayValue;
                                data[i * 4 + 3] = 255; // Alpha
                            }
                        }
                        
                        resolve(imageData);
                        
                    } catch (error) {
                        console.error('Error processing TIF color image:', error);
                        this.callbacks.showColorMappingStatus(`Failed to process TIF color image: ${error instanceof Error ? error.message : String(error)}`, 'error');
                        resolve(null);
                    }
                };
                reader.readAsArrayBuffer(file);
            }
        });
    }

    /**
     * Load PPM image file and convert to ImageData - extracted from main.ts
     */
    private loadPpmImage(file: File, dimensions: { width: number; height: number }, resolve: (value: ImageData | null) => void): void {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target!.result as string;
                const imageData = this.parsePpmImage(text, dimensions);
                resolve(imageData);
            } catch (error) {
                console.error('Error parsing PPM file:', error);
                this.callbacks.showColorMappingStatus(`Failed to parse PPM file: ${error instanceof Error ? error.message : String(error)}`, 'error');
                resolve(null);
            }
        };
        
        reader.onerror = () => {
            console.error('Error reading PPM file');
            this.callbacks.showColorMappingStatus('Failed to read PPM file', 'error');
            resolve(null);
        };
        
        reader.readAsText(file);
    }

    /**
     * Parse PPM image format - extracted from main.ts
     */
    private parsePpmImage(text: string, expectedDimensions: { width: number; height: number }): ImageData {
        const lines = text.split('\n').filter(line => !line.startsWith('#') && line.trim().length > 0);
        
        if (lines.length < 3) {
            throw new Error('Invalid PPM file format');
        }
        
        const format = lines[0].trim();
        if (format !== 'P3' && format !== 'P6') {
            throw new Error(`Unsupported PPM format: ${format}`);
        }
        
        const [width, height] = lines[1].split(/\s+/).map(Number);
        const maxValue = parseInt(lines[2]);
        
        if (width !== expectedDimensions.width || height !== expectedDimensions.height) {
            throw new Error(`PPM dimensions (${width}×${height}) don't match expected (${expectedDimensions.width}×${expectedDimensions.height})`);
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        const imageData = ctx!.createImageData(width, height);
        const data = imageData.data;
        
        if (format === 'P3') {
            // ASCII format
            const values = lines.slice(3).join(' ').split(/\s+/).map(Number);
            
            if (values.length < width * height * 3) {
                throw new Error('Insufficient pixel data in PPM file');
            }
            
            for (let i = 0; i < width * height; i++) {
                const r = Math.round((values[i * 3] / maxValue) * 255);
                const g = Math.round((values[i * 3 + 1] / maxValue) * 255);
                const b = Math.round((values[i * 3 + 2] / maxValue) * 255);
                
                data[i * 4] = r;
                data[i * 4 + 1] = g;
                data[i * 4 + 2] = b;
                data[i * 4 + 3] = 255; // Alpha
            }
        } else {
            // P6 binary format - would need ArrayBuffer handling, not implemented here
            throw new Error('Binary PPM format (P6) not supported in text reader');
        }
        
        return imageData;
    }

    /**
     * Show color mapping status message - extracted from main.ts
     */
    showColorMappingStatus(message: string, type: 'success' | 'error' | 'warning'): void {
        const statusElement = document.getElementById('color-mapping-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-text ${type}`;
            
            // Clear after 5 seconds
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'status-text';
            }, 5000);
        }
    }
}