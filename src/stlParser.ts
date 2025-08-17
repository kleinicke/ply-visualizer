export interface StlVertex {
    x: number;
    y: number;
    z: number;
}

export interface StlTriangle {
    normal: {
        x: number;
        y: number;
        z: number;
    };
    vertices: [StlVertex, StlVertex, StlVertex];
    attributeByteCount?: number;
    color?: {
        red: number;
        green: number;
        blue: number;
        alpha?: number;
    };
}

export interface StlData {
    triangles: StlTriangle[];
    format: 'ascii' | 'binary';
    header: string;
    triangleCount: number;
    hasColors: boolean;
    fileName?: string;
    fileIndex?: number;
}

export class StlParser {
    private dataView: DataView | null = null;
    private offset = 0;

    async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<StlData> {
        const parseStartTime = performance.now();
        const log = timingCallback || console.log;
        log(`📋 Parser: Starting STL parsing (${data.length} bytes)...`);
        
        const result: StlData = {
            triangles: [],
            format: 'ascii',
            header: '',
            triangleCount: 0,
            hasColors: false
        };

        // Detect if this is ASCII or binary STL
        const decoder = new TextDecoder('utf-8');
        const headerText = decoder.decode(data.slice(0, Math.min(1024, data.length)));
        
        if (headerText.toLowerCase().includes('solid ') && 
            headerText.toLowerCase().includes('facet normal') &&
            !this.isBinaryStl(data)) {
            // ASCII STL
            result.format = 'ascii';
            log(`📝 ASCII STL detected`);
            await this.parseAsciiStl(data, result, log);
        } else {
            // Binary STL
            result.format = 'binary';
            log(`🔢 Binary STL detected`);
            await this.parseBinaryStl(data, result, log);
        }

        const parseTime = performance.now();
        log(`✅ Parser: STL parsing complete in ${(parseTime - parseStartTime).toFixed(1)}ms - ${result.triangleCount} triangles`);
        
        return result;
    }

    private isBinaryStl(data: Uint8Array): boolean {
        // Binary STL files are at least 84 bytes (80-byte header + 4-byte triangle count)
        if (data.length < 84) {
            return false;
        }

        try {
            // Read triangle count from binary header (bytes 80-83)
            const triangleCountView = new DataView(data.buffer, data.byteOffset + 80, 4);
            const triangleCount = triangleCountView.getUint32(0, true); // little endian

            // Sanity check: triangle count should be reasonable (not negative or extremely large)
            if (triangleCount < 0 || triangleCount > 100000000) {
                return false;
            }

            // Calculate expected file size for binary STL
            // 80-byte header + 4-byte count + (50 bytes per triangle * triangle count)
            const expectedSize = 80 + 4 + (triangleCount * 50);
            
            // Allow for some tolerance in file size comparison
            const sizeDiff = Math.abs(data.length - expectedSize);
            const tolerance = Math.max(100, Math.floor(triangleCount * 0.1)); // Allow up to 10% deviation or 100 bytes
            
            return sizeDiff <= tolerance;
        } catch (error) {
            // If we can't read the triangle count, assume it's not binary
            return false;
        }
    }

    private async parseAsciiStl(data: Uint8Array, result: StlData, log: (message: string) => void): Promise<void> {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data);
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        
        // Handle empty or minimal files
        if (lines.length === 0) {
            result.triangleCount = 0;
            result.header = 'empty';
            log(`📊 ASCII STL: Empty file`);
            return;
        }
        
        let lineIndex = 0;
        let triangleCount = 0;

        // Extract header (first line after "solid")
        if (lines[lineIndex] && lines[lineIndex].toLowerCase().startsWith('solid ')) {
            result.header = lines[lineIndex].substring(6).trim();
            lineIndex++;
        }
        
        // Check for immediate endsolid (empty mesh)
        if (lines[lineIndex] && lines[lineIndex].toLowerCase().startsWith('endsolid')) {
            result.triangleCount = 0;
            log(`📊 ASCII STL: Empty mesh - 0 triangles`);
            return;
        }

        while (lineIndex < lines.length) {
            const line = lines[lineIndex].toLowerCase();
            
            if (line.startsWith('facet normal')) {
                // Parse facet
                const triangle = this.parseAsciiTriangle(lines, lineIndex);
                if (triangle) {
                    result.triangles.push(triangle);
                    triangleCount++;
                    lineIndex += 7; // Move past the facet (facet normal + outer loop + 3 vertices + endloop + endfacet)
                } else {
                    lineIndex++;
                }
            } else if (line.startsWith('endsolid')) {
                break;
            } else {
                lineIndex++;
            }
        }

        result.triangleCount = triangleCount;
        log(`📊 ASCII STL: ${triangleCount} triangles parsed`);
    }

    private parseAsciiTriangle(lines: string[], startIndex: number): StlTriangle | null {
        try {
            // Parse normal vector from "facet normal x y z"
            const normalLine = lines[startIndex].trim();
            const normalParts = normalLine.split(/\s+/);
            if (normalParts.length < 5 || normalParts[0] !== 'facet' || normalParts[1] !== 'normal') {
                return null;
            }

            const normal = {
                x: parseFloat(normalParts[2]),
                y: parseFloat(normalParts[3]),
                z: parseFloat(normalParts[4])
            };

            // Expect "outer loop"
            if (!lines[startIndex + 1] || !lines[startIndex + 1].trim().toLowerCase().includes('outer loop')) {
                return null;
            }

            // Parse three vertices
            const vertex1 = this.parseAsciiVertex(lines[startIndex + 2]);
            const vertex2 = this.parseAsciiVertex(lines[startIndex + 3]);
            const vertex3 = this.parseAsciiVertex(lines[startIndex + 4]);

            // Validate vertices
            if (!vertex1 || !vertex2 || !vertex3) {
                return null;
            }

            const vertices: [StlVertex, StlVertex, StlVertex] = [vertex1, vertex2, vertex3];

            // Expect "endloop" and "endfacet"
            const endloop = lines[startIndex + 5] && lines[startIndex + 5].trim().toLowerCase();
            const endfacet = lines[startIndex + 6] && lines[startIndex + 6].trim().toLowerCase();
            
            if (!endloop?.includes('endloop') || !endfacet?.includes('endfacet')) {
                return null;
            }

            return {
                normal,
                vertices
            };
        } catch (error) {
            return null;
        }
    }

    private parseAsciiVertex(line: string): StlVertex | null {
        if (!line) {
            return null;
        }
        
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4 || parts[0] !== 'vertex') {
            return null;
        }

        try {
            return {
                x: parseFloat(parts[1]),
                y: parseFloat(parts[2]),
                z: parseFloat(parts[3])
            };
        } catch (error) {
            return null;
        }
    }

    private async parseBinaryStl(data: Uint8Array, result: StlData, log: (message: string) => void): Promise<void> {
        this.dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.offset = 0;

        // Read 80-byte header
        const headerBytes = new Uint8Array(data.buffer, data.byteOffset, 80);
        const decoder = new TextDecoder('utf-8');
        result.header = decoder.decode(headerBytes).replace(/\0/g, '').trim();

        this.offset = 80;

        // Read triangle count (4 bytes, little endian)
        const triangleCount = this.dataView.getUint32(this.offset, true);
        this.offset += 4;

        result.triangleCount = triangleCount;
        log(`📊 Binary STL: ${triangleCount} triangles to parse`);

        // Parse triangles
        for (let i = 0; i < triangleCount; i++) {
            const triangle = this.parseBinaryTriangle();
            if (triangle) {
                result.triangles.push(triangle);
                
                // Check if triangle has color information
                if (triangle.color) {
                    result.hasColors = true;
                }
            }

            // Log progress for large files
            if (i > 0 && i % 10000 === 0) {
                log(`📈 Parsed ${i}/${triangleCount} triangles...`);
            }
        }

        log(`📊 Binary STL: ${result.triangles.length} triangles parsed successfully`);
    }

    private parseBinaryTriangle(): StlTriangle | null {
        if (!this.dataView || this.offset + 50 > this.dataView.byteLength) {
            return null;
        }

        try {
            // Read normal vector (3 floats, 12 bytes)
            const normal = {
                x: this.dataView.getFloat32(this.offset, true),
                y: this.dataView.getFloat32(this.offset + 4, true),
                z: this.dataView.getFloat32(this.offset + 8, true)
            };
            this.offset += 12;

            // Read three vertices (9 floats, 36 bytes)
            const vertices: [StlVertex, StlVertex, StlVertex] = [
                {
                    x: this.dataView.getFloat32(this.offset, true),
                    y: this.dataView.getFloat32(this.offset + 4, true),
                    z: this.dataView.getFloat32(this.offset + 8, true)
                },
                {
                    x: this.dataView.getFloat32(this.offset + 12, true),
                    y: this.dataView.getFloat32(this.offset + 16, true),
                    z: this.dataView.getFloat32(this.offset + 20, true)
                },
                {
                    x: this.dataView.getFloat32(this.offset + 24, true),
                    y: this.dataView.getFloat32(this.offset + 28, true),
                    z: this.dataView.getFloat32(this.offset + 32, true)
                }
            ];
            this.offset += 36;

            // Read attribute byte count (2 bytes)
            const attributeByteCount = this.dataView.getUint16(this.offset, true);
            this.offset += 2;

            const triangle: StlTriangle = {
                normal,
                vertices,
                attributeByteCount
            };

            // Check for color information in attribute bytes
            // Some STL files encode RGB color in the attribute bytes
            if (attributeByteCount > 0) {
                // Common color encoding: RGB565 format in 2 bytes
                if (attributeByteCount >= 2) {
                    const colorData = this.dataView.getUint16(this.offset - 2, true);
                    if (colorData !== 0) {
                        // Extract RGB from RGB565 format
                        const red = ((colorData >> 11) & 0x1F) * 8;   // 5 bits -> 8 bits
                        const green = ((colorData >> 5) & 0x3F) * 4;  // 6 bits -> 8 bits  
                        const blue = (colorData & 0x1F) * 8;          // 5 bits -> 8 bits
                        
                        triangle.color = {
                            red: red,
                            green: green,
                            blue: blue
                        };
                    }
                }
            }

            return triangle;
        } catch (error) {
            return null;
        }
    }
}