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
    fileName?: string;
    fileIndex?: number;
}

export class PlyParser {
    private dataView: DataView | null = null;
    private offset = 0;
    private littleEndian = true;

    async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<PlyData> {
        const parseStartTime = performance.now();
        const log = timingCallback || console.log;
        log(`📋 Parser: Starting PLY parsing (${data.length} bytes)...`);
        
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

        // Only decode enough bytes to find the header (major optimization!)
        const headerStartTime = performance.now();
        const decoder = new TextDecoder('utf-8');
        
        // First, decode just the first 4KB to find header end
        const headerSearchSize = Math.min(4096, data.length);
        let headerText = decoder.decode(data.slice(0, headerSearchSize));
        
        if (!headerText.startsWith('ply')) {
            throw new Error('Invalid PLY file: missing PLY header');
        }

        let headerEndIndex = headerText.indexOf('end_header');
        
        // If not found in first 4KB, expand search (rare case)
        if (headerEndIndex === -1) {
            const expandedSize = Math.min(16384, data.length); // Try 16KB
            headerText = decoder.decode(data.slice(0, expandedSize));
            headerEndIndex = headerText.indexOf('end_header');
            
            if (headerEndIndex === -1) {
                throw new Error('Invalid PLY file: missing end_header');
            }
        }
        
        const headerDecodeTime = performance.now();
        log(`🔤 Parser: Header decode took ${(headerDecodeTime - headerStartTime).toFixed(1)}ms (${headerSearchSize} bytes instead of ${data.length})`);
        const headerLines = headerText.split('\n');

        // Parse header
        const vertexProperties: Array<{name: string, type: string}> = [];
        const faceProperties: Array<{name: string, type: string}> = [];
        let currentElement = '';

        for (const line of headerLines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'ply') {continue;}

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

        const dataParseStartTime = performance.now();
        if (result.format === 'ascii') {
            log(`📝 Parser: Starting ASCII data parsing (${result.vertexCount} vertices)...`);
            this.parseAsciiDataOptimized(data, dataStartPos, result, vertexProperties, faceProperties, log);
        } else {
            log(`🔢 Parser: Starting binary data parsing (${result.vertexCount} vertices)...`);
            const binaryParseStartTime = performance.now();
            this.parseBinaryDataOptimized(data, dataStartPos, result, vertexProperties, faceProperties, log);
            const binaryParseEndTime = performance.now();
            log(`🚀 Parser: Binary parsing took ${(binaryParseEndTime - binaryParseStartTime).toFixed(1)}ms`);
        }
        const dataParseTime = performance.now();
        log(`⚡ Parser: Data parsing took ${(dataParseTime - dataParseStartTime).toFixed(1)}ms`);
        
        const totalParseTime = performance.now();
        log(`🎯 Parser: Total parse time ${(totalParseTime - parseStartTime).toFixed(1)}ms`);

        return result;
    }

    private parseAsciiDataOptimized(
        data: Uint8Array, 
        startPos: number, 
        result: PlyData, 
        vertexProperties: Array<{name: string, type: string}>,
        faceProperties: Array<{name: string, type: string}>,
        log: (message: string) => void = console.log
    ): void {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data.slice(startPos));
        const lines = text.split('\n').filter(line => line.trim());

        // Pre-allocate vertices array for better performance
        result.vertices = new Array(result.vertexCount);

        let lineIndex = 0;

        // Create property index map for faster lookup
        const propMap = new Map<string, number>();
        vertexProperties.forEach((prop, index) => propMap.set(prop.name, index));

        // Parse vertices with optimized approach
        for (let i = 0; i < result.vertexCount && lineIndex < lines.length; i++, lineIndex++) {
            const values = lines[lineIndex].trim().split(/\s+/);
            const vertex: PlyVertex = { x: 0, y: 0, z: 0 };

            // Use direct indexing instead of searching
            const xIdx = propMap.get('x');
            const yIdx = propMap.get('y');
            const zIdx = propMap.get('z');
            
            if (xIdx !== undefined) vertex.x = parseFloat(values[xIdx]);
            if (yIdx !== undefined) vertex.y = parseFloat(values[yIdx]);
            if (zIdx !== undefined) vertex.z = parseFloat(values[zIdx]);

            // Only parse colors if they exist
            if (result.hasColors) {
                const redIdx = propMap.get('red');
                const greenIdx = propMap.get('green');
                const blueIdx = propMap.get('blue');
                
                if (redIdx !== undefined) vertex.red = parseFloat(values[redIdx]);
                if (greenIdx !== undefined) vertex.green = parseFloat(values[greenIdx]);
                if (blueIdx !== undefined) vertex.blue = parseFloat(values[blueIdx]);
            }

            // Only parse normals if they exist
            if (result.hasNormals) {
                const nxIdx = propMap.get('nx');
                const nyIdx = propMap.get('ny');
                const nzIdx = propMap.get('nz');
                
                if (nxIdx !== undefined) vertex.nx = parseFloat(values[nxIdx]);
                if (nyIdx !== undefined) vertex.ny = parseFloat(values[nyIdx]);
                if (nzIdx !== undefined) vertex.nz = parseFloat(values[nzIdx]);
            }

            result.vertices[i] = vertex;
        }

        // Pre-allocate faces array
        if (result.faceCount > 0) {
            result.faces = new Array(result.faceCount);
            
            // Parse faces
            for (let i = 0; i < result.faceCount && lineIndex < lines.length; i++, lineIndex++) {
                const values = lines[lineIndex].trim().split(/\s+/).map(v => parseInt(v));
                if (values.length > 0) {
                    const vertexCount = values[0];
                    const indices = values.slice(1, vertexCount + 1);
                    result.faces[i] = { indices };
                }
            }
        }
    }

    private parseBinaryDataOptimized(
        data: Uint8Array, 
        startPos: number, 
        result: PlyData, 
        vertexProperties: Array<{name: string, type: string}>,
        faceProperties: Array<{name: string, type: string}>,
        log: (message: string) => void = console.log
    ): void {
        this.dataView = new DataView(data.buffer, data.byteOffset + startPos);
        this.offset = 0;

        // Create property index maps for fast lookup
        const propIndexMap = new Map<string, number>();
        const propTypeMap = new Map<string, string>();
        vertexProperties.forEach((prop, index) => {
            propIndexMap.set(prop.name, index);
            propTypeMap.set(prop.name, prop.type);
        });

        // Calculate stride (bytes per vertex)
        let vertexStride = 0;
        for (const prop of vertexProperties) {
            switch (prop.type) {
                case 'char': case 'int8': case 'uchar': case 'uint8':
                    vertexStride += 1; break;
                case 'short': case 'int16': case 'ushort': case 'uint16':
                    vertexStride += 2; break;
                case 'int': case 'int32': case 'uint': case 'uint32': case 'float': case 'float32':
                    vertexStride += 4; break;
                case 'double': case 'float64':
                    vertexStride += 8; break;
            }
        }

        // Pre-allocate vertices array for better performance
        result.vertices = new Array(result.vertexCount);

                // ULTRA-FAST: Direct TypedArray parsing with zero object allocation
        log(`🚀 Parser: Using zero-allocation direct parsing for ${result.vertexCount} vertices...`);
        const vertexStartTime = performance.now();
        
        // Create property maps for lightning-fast lookup
        const propIndices = new Map<string, number>();
        vertexProperties.forEach((prop, idx) => propIndices.set(prop.name, idx));
        
        // Pre-allocate result arrays - NO individual vertex objects!
        const positions = new Float32Array(result.vertexCount * 3);
        const colors = result.hasColors ? new Uint8Array(result.vertexCount * 3) : null;
        const normals = result.hasNormals ? new Float32Array(result.vertexCount * 3) : null;
        
        // Find property indices once
        const xIdx = propIndices.get('x') ?? -1;
        const yIdx = propIndices.get('y') ?? -1;
        const zIdx = propIndices.get('z') ?? -1;
        const redIdx = propIndices.get('red') ?? -1;
        const greenIdx = propIndices.get('green') ?? -1;
        const blueIdx = propIndices.get('blue') ?? -1;
        const nxIdx = propIndices.get('nx') ?? -1;
        const nyIdx = propIndices.get('ny') ?? -1;
        const nzIdx = propIndices.get('nz') ?? -1;
        
        // Lightning-fast direct binary parsing
        for (let i = 0; i < result.vertexCount; i++) {
            const i3 = i * 3;
            
            // Read all properties for this vertex
            for (let propIdx = 0; propIdx < vertexProperties.length; propIdx++) {
                const value = this.readBinaryValueFast(vertexProperties[propIdx].type);
                
                // Direct array assignment based on property index
                if (propIdx === xIdx) positions[i3] = value;
                else if (propIdx === yIdx) positions[i3 + 1] = value;
                else if (propIdx === zIdx) positions[i3 + 2] = value;
                else if (colors && propIdx === redIdx) colors[i3] = value;
                else if (colors && propIdx === greenIdx) colors[i3 + 1] = value;
                else if (colors && propIdx === blueIdx) colors[i3 + 2] = value;
                else if (normals && propIdx === nxIdx) normals[i3] = value;
                else if (normals && propIdx === nyIdx) normals[i3 + 1] = value;
                else if (normals && propIdx === nzIdx) normals[i3 + 2] = value;
            }
        }
        
        // REVOLUTIONARY: Skip object creation entirely - store TypedArrays directly!
        log(`🚀 Parser: Skipping object creation - storing raw TypedArrays for maximum performance!`);
        
        // Store TypedArrays directly in the result (new approach)
        (result as any).positionsArray = positions;
        (result as any).colorsArray = colors;
        (result as any).normalsArray = normals;
        (result as any).useTypedArrays = true;
        
        // Create minimal vertex array for compatibility (only if really needed)
        result.vertices = [];

        const vertexEndTime = performance.now();
        log(`🎯 Parser: Vertex processing took ${(vertexEndTime - vertexStartTime).toFixed(1)}ms`);

        // Pre-allocate faces array
        if (result.faceCount > 0) {
            result.faces = new Array(result.faceCount);
            
            // Parse faces efficiently
            for (let i = 0; i < result.faceCount; i++) {
                const vertexCount = this.readBinaryValueFast('uchar');
                const indices = new Array(vertexCount);
                
                for (let j = 0; j < vertexCount; j++) {
                    indices[j] = this.readBinaryValueFast('int');
                }
                
                result.faces[i] = { indices };
            }
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

    private readBinaryValueFast(type: string): number {
        if (!this.dataView) {
            throw new Error('DataView not initialized');
        }

        // Optimized inline version with reduced function call overhead
        if (type === 'float' || type === 'float32') {
            const value = this.dataView.getFloat32(this.offset, this.littleEndian);
            this.offset += 4;
            return value;
        } else if (type === 'uchar' || type === 'uint8') {
            const value = this.dataView.getUint8(this.offset);
            this.offset += 1;
            return value;
        } else if (type === 'int' || type === 'int32') {
            const value = this.dataView.getInt32(this.offset, this.littleEndian);
            this.offset += 4;
            return value;
        } else if (type === 'char' || type === 'int8') {
            const value = this.dataView.getInt8(this.offset);
            this.offset += 1;
            return value;
        } else if (type === 'short' || type === 'int16') {
            const value = this.dataView.getInt16(this.offset, this.littleEndian);
            this.offset += 2;
            return value;
        } else if (type === 'ushort' || type === 'uint16') {
            const value = this.dataView.getUint16(this.offset, this.littleEndian);
            this.offset += 2;
            return value;
        } else if (type === 'uint' || type === 'uint32') {
            const value = this.dataView.getUint32(this.offset, this.littleEndian);
            this.offset += 4;
            return value;
        } else if (type === 'double' || type === 'float64') {
            const value = this.dataView.getFloat64(this.offset, this.littleEndian);
            this.offset += 8;
            return value;
        } else {
            throw new Error(`Unsupported data type: ${type}`);
        }
    }

    // ULTIMATE OPTIMIZATION: Extract header + raw binary data without parsing
    async parseHeaderOnly(data: Uint8Array, timingCallback?: (message: string) => void): Promise<{
        headerInfo: PlyData,
        binaryDataStart: number,
        vertexStride: number,
        propertyOffsets: Map<string, { offset: number, type: string }>
    }> {
        const parseStartTime = performance.now();
        const log = timingCallback || console.log;
        log(`🚀 ULTIMATE: Header-only parsing for direct binary streaming...`);
        
        // Same header parsing as before
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

        const headerStartTime = performance.now();
        const decoder = new TextDecoder('utf-8');
        
        const headerSearchSize = Math.min(4096, data.length);
        let headerText = decoder.decode(data.slice(0, headerSearchSize));
        
        if (!headerText.startsWith('ply')) {
            throw new Error('Invalid PLY file: missing PLY header');
        }

        let headerEndIndex = headerText.indexOf('end_header');
        
        if (headerEndIndex === -1) {
            const expandedSize = Math.min(16384, data.length);
            headerText = decoder.decode(data.slice(0, expandedSize));
            headerEndIndex = headerText.indexOf('end_header');
            
            if (headerEndIndex === -1) {
                throw new Error('Invalid PLY file: missing end_header');
            }
        }
        
        const headerDecodeTime = performance.now();
        log(`⚡ ULTIMATE: Header decode took ${(headerDecodeTime - headerStartTime).toFixed(1)}ms`);
        
        const headerLines = headerText.split('\n');
        const vertexProperties: Array<{name: string, type: string}> = [];
        const faceProperties: Array<{name: string, type: string}> = [];
        let currentElement = '';

        for (const line of headerLines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'ply') {continue;}

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

        result.hasColors = vertexProperties.some(p => ['red', 'green', 'blue'].includes(p.name));
        result.hasNormals = vertexProperties.some(p => ['nx', 'ny', 'nz'].includes(p.name));

        // Calculate binary data start position
        const headerEndPos = headerEndIndex + 'end_header'.length;
        let dataStartPos = headerEndPos;
        while (dataStartPos < data.length && (data[dataStartPos] === 10 || data[dataStartPos] === 13)) {
            dataStartPos++;
        }

        // Calculate vertex stride and property offsets for direct binary reading
        let vertexStride = 0;
        const propertyOffsets = new Map<string, { offset: number, type: string }>();
        
        for (const prop of vertexProperties) {
            propertyOffsets.set(prop.name, { offset: vertexStride, type: prop.type });
            
            switch (prop.type) {
                case 'char': case 'int8': case 'uchar': case 'uint8':
                    vertexStride += 1; break;
                case 'short': case 'int16': case 'ushort': case 'uint16':
                    vertexStride += 2; break;
                case 'int': case 'int32': case 'uint': case 'uint32': case 'float': case 'float32':
                    vertexStride += 4; break;
                case 'double': case 'float64':
                    vertexStride += 8; break;
            }
        }
        
        const totalTime = performance.now();
        log(`🎯 ULTIMATE: Header-only parsing took ${(totalTime - parseStartTime).toFixed(1)}ms`);

        return {
            headerInfo: result,
            binaryDataStart: dataStartPos,
            vertexStride,
            propertyOffsets
        };
    }
} 