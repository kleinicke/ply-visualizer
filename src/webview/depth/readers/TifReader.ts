import { DepthReader, DepthReaderResult, DepthImage, DepthMetadata } from '../types';

// Use the global GeoTIFF that's already loaded
declare const GeoTIFF: any;

export class TifReader implements DepthReader {
    canRead(filename: string): boolean {
        return filename.toLowerCase().endsWith('.tif') || filename.toLowerCase().endsWith('.tiff');
    }

    async read(arrayBuffer: ArrayBuffer): Promise<DepthReaderResult> {
        try {
            const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
            const image = await tiff.getImage();
            
            const width = image.getWidth();
            const height = image.getHeight();
            const samplesPerPixel = image.getSamplesPerPixel();
            const sampleFormat = image.getSampleFormat ? image.getSampleFormat() : null;
            const bitsPerSample = image.getBitsPerSample();
            
            // Validate this is a depth image
            if (!this.isDepthTifImage(samplesPerPixel, sampleFormat, bitsPerSample)) {
                throw new Error(`Not a depth TIF image (${samplesPerPixel} channels, format=${sampleFormat})`);
            }
            
            // Read the raster data
            const rasterData = await image.readRasters();
            let depthData: Float32Array;
            
            if (rasterData instanceof Float32Array) {
                depthData = rasterData;
            } else if (rasterData instanceof Float64Array) {
                depthData = new Float32Array(rasterData);
            } else if (Array.isArray(rasterData) && rasterData.length > 0) {
                // Multi-band image, take the first band
                const firstBand = rasterData[0];
                if (firstBand instanceof Float32Array) {
                    depthData = firstBand;
                } else if (firstBand instanceof Float64Array) {
                    depthData = new Float32Array(firstBand);
                } else {
                    // Convert other types to Float32Array
                    depthData = new Float32Array(firstBand.length);
                    for (let i = 0; i < firstBand.length; i++) {
                        depthData[i] = Number(firstBand[i]);
                    }
                }
            } else {
                throw new Error('Unsupported TIF raster data format');
            }
            
            const depthImage: DepthImage = {
                width,
                height,
                data: depthData
            };
            
            const metadata: DepthMetadata = {
                kind: 'depth', // Default to depth
                unit: 'meter'   // Assume meters unless specified
            };
            
            return { image: depthImage, meta: metadata };
            
        } catch (error) {
            throw new Error(`Failed to read TIF file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    private isDepthTifImage(samplesPerPixel: number, sampleFormat: number | null, bitsPerSample: number[]): boolean {
        // Single channel
        if (samplesPerPixel !== 1) {
            return false;
        }
        
        // Floating point format preferred for depth
        if (sampleFormat === 3) { // IEEE floating point
            return true;
        }
        
        // Integer formats can also be depth/disparity
        if (sampleFormat === 1 || sampleFormat === 2) { // Unsigned/signed integer
            // Check bit depth - higher bit depths more likely to be depth
            const bitDepth = bitsPerSample && bitsPerSample.length > 0 ? bitsPerSample[0] : 0;
            return bitDepth >= 16; // 16-bit or higher integer
        }
        
        return false;
    }
}