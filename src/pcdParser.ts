/**
 * Parser for Point Cloud Data (PCD) format
 * Supports both ASCII and binary PCD files
 */

export interface PcdData {
    vertices: Array<{ x: number; y: number; z: number; red?: number; green?: number; blue?: number; nx?: number; ny?: number; nz?: number }>;
    vertexCount: number;
    hasColors: boolean;
    hasNormals: boolean;
    format: 'ascii' | 'binary';
    fileName: string;
    fileIndex?: number;
    comments: string[];
    width: number;
    height: number;
    fields: string[];
    size: number[];
    type: string[];
    count: number[];
    viewpoint: number[];
}

export class PcdParser {
    async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<PcdData> {
        const startTime = performance.now();
        timingCallback?.('🔍 PCD: Starting header parsing...');

        // Convert to text for header parsing
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data);
        const lines = text.split('\n');

        let dataStartIndex = -1;
        let width = 0;
        let height = 1;
        let points = 0;
        let fields: string[] = [];
        let size: number[] = [];
        let type: string[] = [];
        let count: number[] = [];
        let viewpoint: number[] = [0, 0, 0, 1, 0, 0, 0];
        let format: 'ascii' | 'binary' = 'ascii';
        const comments: string[] = [];

        // Parse header
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line === '' || line.startsWith('#')) {
                if (line.startsWith('#')) {
                    comments.push(line.substring(1).trim());
                }
                continue;
            }

            const parts = line.split(/\s+/);
            const keyword = parts[0].toUpperCase();

            switch (keyword) {
                case 'VERSION':
                    // Version info, can ignore for now
                    break;
                case 'FIELDS':
                    fields = parts.slice(1);
                    break;
                case 'SIZE':
                    size = parts.slice(1).map(Number);
                    break;
                case 'TYPE':
                    type = parts.slice(1);
                    break;
                case 'COUNT':
                    count = parts.slice(1).map(Number);
                    break;
                case 'WIDTH':
                    width = parseInt(parts[1]);
                    break;
                case 'HEIGHT':
                    height = parseInt(parts[1]);
                    break;
                case 'VIEWPOINT':
                    viewpoint = parts.slice(1).map(Number);
                    break;
                case 'POINTS':
                    points = parseInt(parts[1]);
                    break;
                case 'DATA':
                    format = parts[1].toLowerCase() as 'ascii' | 'binary';
                    dataStartIndex = i + 1;
                    break;
            }

            if (dataStartIndex !== -1) {
                break;
            }
        }

        if (dataStartIndex === -1) {
            throw new Error('Invalid PCD file: DATA section not found');
        }

        const vertexCount = points || (width * height);
        
        // Determine what data we have
        const hasColors = fields.some(f => ['rgb', 'rgba', 'r', 'g', 'b'].includes(f.toLowerCase()));
        const hasNormals = fields.some(f => ['normal_x', 'normal_y', 'normal_z', 'nx', 'ny', 'nz'].includes(f.toLowerCase()));

        timingCallback?.(`📊 PCD: Header parsed - ${vertexCount} points, ${format} format, fields: ${fields.join(', ')}`);

        const vertices: Array<{ x: number; y: number; z: number; red?: number; green?: number; blue?: number; nx?: number; ny?: number; nz?: number }> = [];

        if (format === 'ascii') {
            // Parse ASCII data
            const dataLines = lines.slice(dataStartIndex);
            let processedPoints = 0;

            for (const line of dataLines) {
                if (line.trim() === '') continue;
                
                const values = line.trim().split(/\s+/).map(val => {
                    const num = parseFloat(val);
                    return isNaN(num) ? 0 : num;
                });

                if (values.length < fields.length) continue;

                const vertex: any = { x: 0, y: 0, z: 0 };

                // Map field values to vertex properties
                for (let i = 0; i < fields.length; i++) {
                    const field = fields[i].toLowerCase();
                    const value = values[i];

                    switch (field) {
                        case 'x':
                            vertex.x = value;
                            break;
                        case 'y':
                            vertex.y = value;
                            break;
                        case 'z':
                            vertex.z = value;
                            break;
                        case 'r':
                        case 'red':
                            vertex.red = Math.round(Math.min(255, Math.max(0, value)));
                            break;
                        case 'g':
                        case 'green':
                            vertex.green = Math.round(Math.min(255, Math.max(0, value)));
                            break;
                        case 'b':
                        case 'blue':
                            vertex.blue = Math.round(Math.min(255, Math.max(0, value)));
                            break;
                        case 'rgb':
                        case 'rgba':
                            // Handle packed RGB
                            const rgb = Math.round(value);
                            vertex.red = (rgb >> 16) & 0xFF;
                            vertex.green = (rgb >> 8) & 0xFF;
                            vertex.blue = rgb & 0xFF;
                            break;
                        case 'normal_x':
                        case 'nx':
                            vertex.nx = value;
                            break;
                        case 'normal_y':
                        case 'ny':
                            vertex.ny = value;
                            break;
                        case 'normal_z':
                        case 'nz':
                            vertex.nz = value;
                            break;
                    }
                }

                vertices.push(vertex);
                processedPoints++;

                if (processedPoints >= vertexCount) {
                    break;
                }
            }

            timingCallback?.(`✅ PCD: ASCII parsing complete - ${processedPoints} points processed`);

        } else if (format === 'binary') {
            // Parse binary data
            timingCallback?.('🔧 PCD: Starting binary data parsing...');
            
            // Calculate data start position in bytes
            const headerText = lines.slice(0, dataStartIndex).join('\n') + '\n';
            const headerBytes = new TextEncoder().encode(headerText);
            const binaryDataStart = headerBytes.length;

            const binaryData = data.slice(binaryDataStart);
            
            // Calculate point size
            let pointSize = 0;
            for (let i = 0; i < fields.length; i++) {
                pointSize += size[i] * (count[i] || 1);
            }

            if (binaryData.length < pointSize * vertexCount) {
                throw new Error(`PCD binary data too short: expected ${pointSize * vertexCount} bytes, got ${binaryData.length}`);
            }

            const dataView = new DataView(binaryData.buffer, binaryData.byteOffset, binaryData.byteLength);

            for (let pointIdx = 0; pointIdx < vertexCount; pointIdx++) {
                const vertex: any = { x: 0, y: 0, z: 0 };
                let offset = pointIdx * pointSize;

                for (let fieldIdx = 0; fieldIdx < fields.length; fieldIdx++) {
                    const field = fields[fieldIdx].toLowerCase();
                    const fieldSize = size[fieldIdx];
                    const fieldType = type[fieldIdx];
                    const fieldCount = count[fieldIdx] || 1;

                    let value: number;
                    
                    // Read value based on type
                    switch (fieldType) {
                        case 'F':
                            value = fieldSize === 4 ? dataView.getFloat32(offset, true) : dataView.getFloat64(offset, true);
                            break;
                        case 'U':
                            if (fieldSize === 1) value = dataView.getUint8(offset);
                            else if (fieldSize === 2) value = dataView.getUint16(offset, true);
                            else if (fieldSize === 4) value = dataView.getUint32(offset, true);
                            else value = 0;
                            break;
                        case 'I':
                            if (fieldSize === 1) value = dataView.getInt8(offset);
                            else if (fieldSize === 2) value = dataView.getInt16(offset, true);
                            else if (fieldSize === 4) value = dataView.getInt32(offset, true);
                            else value = 0;
                            break;
                        default:
                            value = 0;
                    }

                    // Map to vertex properties
                    switch (field) {
                        case 'x':
                            vertex.x = value;
                            break;
                        case 'y':
                            vertex.y = value;
                            break;
                        case 'z':
                            vertex.z = value;
                            break;
                        case 'r':
                        case 'red':
                            vertex.red = Math.round(Math.min(255, Math.max(0, value)));
                            break;
                        case 'g':
                        case 'green':
                            vertex.green = Math.round(Math.min(255, Math.max(0, value)));
                            break;
                        case 'b':
                        case 'blue':
                            vertex.blue = Math.round(Math.min(255, Math.max(0, value)));
                            break;
                        case 'rgb':
                        case 'rgba':
                            // For binary PCD, RGB is stored as a float with packed integer bits
                            let rgbInt: number;
                            if (fieldType === 'F') {
                                // Float RGB - reinterpret float as uint32
                                const buffer = new ArrayBuffer(4);
                                const floatView = new Float32Array(buffer);
                                const intView = new Uint32Array(buffer);
                                floatView[0] = value;
                                rgbInt = intView[0];
                            } else {
                                rgbInt = Math.round(value);
                            }
                            vertex.red = (rgbInt >> 16) & 0xFF;
                            vertex.green = (rgbInt >> 8) & 0xFF;
                            vertex.blue = rgbInt & 0xFF;
                            break;
                        case 'normal_x':
                        case 'nx':
                            vertex.nx = value;
                            break;
                        case 'normal_y':
                        case 'ny':
                            vertex.ny = value;
                            break;
                        case 'normal_z':
                        case 'nz':
                            vertex.nz = value;
                            break;
                    }

                    offset += fieldSize * fieldCount;
                }

                vertices.push(vertex);
            }

            timingCallback?.(`✅ PCD: Binary parsing complete - ${vertexCount} points processed`);
        }

        const totalTime = performance.now() - startTime;
        timingCallback?.(`🎯 PCD: Total parsing time: ${totalTime.toFixed(1)}ms`);

        return {
            vertices,
            vertexCount: vertices.length,
            hasColors,
            hasNormals,
            format,
            fileName: '',
            comments,
            width,
            height,
            fields,
            size,
            type,
            count,
            viewpoint
        };
    }
}