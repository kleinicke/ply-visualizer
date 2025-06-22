export interface PlyVertex {
    x: number;
    y: number;
    z: number;
    red?: number;
    green?: number;
    blue?: number;
    alpha?: number;
    nx?: number;
    ny?: number;
    nz?: number;
}

export interface PlyFace {
    indices: number[];
}

export interface PlyData {
    vertices: PlyVertex[];
    faces: PlyFace[];
    format: 'ascii' | 'binary_little_endian' | 'binary_big_endian';
    version: string;
    comments: string[];
    vertexCount: number;
    faceCount: number;
    hasColors: boolean;
    hasNormals: boolean;
}

export class PlyParser {
    private dataView: DataView | null = null;
    private offset = 0;
    private littleEndian = true;

    async parse(data: Uint8Array): Promise<PlyData> {
        const result: PlyData = {
            vertices: [],
            faces: [],
            format: 'ascii',
            version: '1.0',
            comments: [],
            vertexCount: 0,
            faceCount: 0,
            hasColors: false,
            hasNormals: false
        };

        // Convert to string to read header
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data);
        
        if (!text.startsWith('ply')) {
            throw new Error('Invalid PLY file: missing PLY header');
        }

        const headerEndIndex = text.indexOf('end_header');
        if (headerEndIndex === -1) {
            throw new Error('Invalid PLY file: missing end_header');
        }

        const headerText = text.substring(0, headerEndIndex);
        const headerLines = headerText.split('\n');

        // Parse header
        const vertexProperties: Array<{name: string, type: string}> = [];
        const faceProperties: Array<{name: string, type: string}> = [];
        let currentElement = '';

        for (const line of headerLines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'ply') continue;

            const parts = trimmed.split(/\s+/);
            
            if (parts[0] === 'format') {
                result.format = parts[1] as any;
                result.version = parts[2] || '1.0';
                this.littleEndian = parts[1] === 'binary_little_endian';
            } else if (parts[0] === 'comment') {
                result.comments.push(parts.slice(1).join(' '));
            } else if (parts[0] === 'element') {
                currentElement = parts[1];
                const count = parseInt(parts[2]);
                if (parts[1] === 'vertex') {
                    result.vertexCount = count;
                } else if (parts[1] === 'face') {
                    result.faceCount = count;
                }
            } else if (parts[0] === 'property') {
                if (currentElement === 'vertex') {
                    vertexProperties.push({
                        name: parts[parts.length - 1],
                        type: parts[1]
                    });
                } else if (currentElement === 'face') {
                    faceProperties.push({
                        name: parts[parts.length - 1],
                        type: parts[1]
                    });
                }
            }
        }

        // Check for colors and normals
        result.hasColors = vertexProperties.some(p => ['red', 'green', 'blue'].includes(p.name));
        result.hasNormals = vertexProperties.some(p => ['nx', 'ny', 'nz'].includes(p.name));

        // Find data start position
        const headerEndPos = headerEndIndex + 'end_header'.length;
        let dataStartPos = headerEndPos;
        while (dataStartPos < data.length && (data[dataStartPos] === 10 || data[dataStartPos] === 13)) {
            dataStartPos++;
        }

        if (result.format === 'ascii') {
            this.parseAsciiData(data, dataStartPos, result, vertexProperties, faceProperties);
        } else {
            this.parseBinaryData(data, dataStartPos, result, vertexProperties, faceProperties);
        }

        return result;
    }

    private parseAsciiData(
        data: Uint8Array, 
        startPos: number, 
        result: PlyData, 
        vertexProperties: Array<{name: string, type: string}>,
        faceProperties: Array<{name: string, type: string}>
    ): void {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data.slice(startPos));
        const lines = text.split('\n').filter(line => line.trim());

        let lineIndex = 0;

        // Parse vertices
        for (let i = 0; i < result.vertexCount && lineIndex < lines.length; i++, lineIndex++) {
            const values = lines[lineIndex].trim().split(/\s+/).map(v => parseFloat(v));
            const vertex: PlyVertex = { x: 0, y: 0, z: 0 };

            for (let j = 0; j < vertexProperties.length && j < values.length; j++) {
                const prop = vertexProperties[j];
                const value = values[j];
                
                switch (prop.name) {
                    case 'x': vertex.x = value; break;
                    case 'y': vertex.y = value; break;
                    case 'z': vertex.z = value; break;
                    case 'red': vertex.red = value; break;
                    case 'green': vertex.green = value; break;
                    case 'blue': vertex.blue = value; break;
                    case 'alpha': vertex.alpha = value; break;
                    case 'nx': vertex.nx = value; break;
                    case 'ny': vertex.ny = value; break;
                    case 'nz': vertex.nz = value; break;
                }
            }
            result.vertices.push(vertex);
        }

        // Parse faces
        for (let i = 0; i < result.faceCount && lineIndex < lines.length; i++, lineIndex++) {
            const values = lines[lineIndex].trim().split(/\s+/).map(v => parseInt(v));
            if (values.length > 0) {
                const vertexCount = values[0];
                const indices = values.slice(1, vertexCount + 1);
                result.faces.push({ indices });
            }
        }
    }

    private parseBinaryData(
        data: Uint8Array, 
        startPos: number, 
        result: PlyData, 
        vertexProperties: Array<{name: string, type: string}>,
        faceProperties: Array<{name: string, type: string}>
    ): void {
        this.dataView = new DataView(data.buffer, data.byteOffset + startPos);
        this.offset = 0;

        // Parse vertices
        for (let i = 0; i < result.vertexCount; i++) {
            const vertex: PlyVertex = { x: 0, y: 0, z: 0 };

            for (const prop of vertexProperties) {
                const value = this.readBinaryValue(prop.type);
                
                switch (prop.name) {
                    case 'x': vertex.x = value; break;
                    case 'y': vertex.y = value; break;
                    case 'z': vertex.z = value; break;
                    case 'red': vertex.red = value; break;
                    case 'green': vertex.green = value; break;
                    case 'blue': vertex.blue = value; break;
                    case 'alpha': vertex.alpha = value; break;
                    case 'nx': vertex.nx = value; break;
                    case 'ny': vertex.ny = value; break;
                    case 'nz': vertex.nz = value; break;
                }
            }
            result.vertices.push(vertex);
        }

        // Parse faces
        for (let i = 0; i < result.faceCount; i++) {
            const vertexCount = this.readBinaryValue('uchar');
            const indices: number[] = [];
            
            for (let j = 0; j < vertexCount; j++) {
                indices.push(this.readBinaryValue('int'));
            }
            
            result.faces.push({ indices });
        }
    }

    private readBinaryValue(type: string): number {
        if (!this.dataView) {
            throw new Error('DataView not initialized');
        }

        let value: number;
        
        switch (type) {
            case 'char':
            case 'int8':
                value = this.dataView.getInt8(this.offset);
                this.offset += 1;
                break;
            case 'uchar':
            case 'uint8':
                value = this.dataView.getUint8(this.offset);
                this.offset += 1;
                break;
            case 'short':
            case 'int16':
                value = this.dataView.getInt16(this.offset, this.littleEndian);
                this.offset += 2;
                break;
            case 'ushort':
            case 'uint16':
                value = this.dataView.getUint16(this.offset, this.littleEndian);
                this.offset += 2;
                break;
            case 'int':
            case 'int32':
                value = this.dataView.getInt32(this.offset, this.littleEndian);
                this.offset += 4;
                break;
            case 'uint':
            case 'uint32':
                value = this.dataView.getUint32(this.offset, this.littleEndian);
                this.offset += 4;
                break;
            case 'float':
            case 'float32':
                value = this.dataView.getFloat32(this.offset, this.littleEndian);
                this.offset += 4;
                break;
            case 'double':
            case 'float64':
                value = this.dataView.getFloat64(this.offset, this.littleEndian);
                this.offset += 8;
                break;
            default:
                throw new Error(`Unsupported data type: ${type}`);
        }
        
        return value;
    }
} 