/**
 * Parser for OFF (Object File Format) format
 * Supports both ASCII and binary OFF files for meshes
 */

export interface OffData {
    vertices: Array<{ x: number; y: number; z: number; red?: number; green?: number; blue?: number; nx?: number; ny?: number; nz?: number }>;
    faces: Array<{ indices: number[] }>;
    vertexCount: number;
    faceCount: number;
    hasColors: boolean;
    hasNormals: boolean;
    format: 'ascii' | 'binary';
    fileName: string;
    fileIndex?: number;
    comments: string[];
    offVariant: 'OFF' | 'COFF' | 'NOFF' | 'CNOFF';
}

export class OffParser {
    async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<OffData> {
        const startTime = performance.now();
        timingCallback?.('🔍 OFF: Starting parsing...');

        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data);
        const lines = text.split('\n').filter(line => line.trim() !== '');

        if (lines.length === 0) {
            throw new Error('Empty OFF file');
        }

        const vertices: Array<{ x: number; y: number; z: number; red?: number; green?: number; blue?: number; nx?: number; ny?: number; nz?: number }> = [];
        const faces: Array<{ indices: number[] }> = [];
        const comments: string[] = [];

        let lineIndex = 0;
        let hasColors = false;
        let hasNormals = false;
        let offVariant: 'OFF' | 'COFF' | 'NOFF' | 'CNOFF' = 'OFF';

        // Parse header
        const firstLine = lines[lineIndex].trim().toUpperCase();
        
        // Check OFF variant
        if (firstLine === 'OFF') {
            offVariant = 'OFF';
        } else if (firstLine === 'COFF') {
            offVariant = 'COFF';
            hasColors = true;
        } else if (firstLine === 'NOFF') {
            offVariant = 'NOFF';
            hasNormals = true;
        } else if (firstLine === 'CNOFF') {
            offVariant = 'CNOFF';
            hasColors = true;
            hasNormals = true;
        } else {
            // Sometimes the counts are on the same line as OFF
            const parts = firstLine.split(/\s+/);
            if (parts[0] === 'OFF' && parts.length >= 4) {
                // Continue parsing with counts on same line
            } else {
                throw new Error(`Invalid OFF file: expected OFF header, got "${firstLine}"`);
            }
        }

        lineIndex++;

        // Skip comments
        while (lineIndex < lines.length && lines[lineIndex].trim().startsWith('#')) {
            comments.push(lines[lineIndex].trim().substring(1).trim());
            lineIndex++;
        }

        // Parse vertex, face, edge counts
        let vertexCount = 0;
        let faceCount = 0;
        let edgeCount = 0;

        if (firstLine.includes('OFF') && firstLine.split(/\s+/).length >= 4) {
            // Counts are on the same line as OFF
            const parts = firstLine.split(/\s+/);
            vertexCount = parseInt(parts[1]);
            faceCount = parseInt(parts[2]);
            edgeCount = parseInt(parts[3]);
        } else {
            // Counts are on separate line
            if (lineIndex >= lines.length) {
                throw new Error('OFF file: missing vertex/face/edge counts');
            }
            const countLine = lines[lineIndex].trim().split(/\s+/);
            if (countLine.length < 3) {
                throw new Error('OFF file: invalid vertex/face/edge counts');
            }
            vertexCount = parseInt(countLine[0]);
            faceCount = parseInt(countLine[1]);
            edgeCount = parseInt(countLine[2]);
            lineIndex++;
        }

        if (isNaN(vertexCount) || isNaN(faceCount)) {
            throw new Error(`OFF file: invalid counts - vertices: ${vertexCount}, faces: ${faceCount}`);
        }

        timingCallback?.(`📊 OFF: ${offVariant} format - ${vertexCount} vertices, ${faceCount} faces`);

        // Parse vertices
        for (let i = 0; i < vertexCount && lineIndex < lines.length; i++) {
            const line = lines[lineIndex].trim();
            if (line === '') {
                i--; // Don't count empty lines
                lineIndex++;
                continue;
            }

            const parts = line.split(/\s+/);
            if (parts.length < 3) {
                throw new Error(`OFF file: invalid vertex at line ${lineIndex + 1} - expected at least 3 coordinates, got ${parts.length}`);
            }

            const vertex: any = {
                x: parseFloat(parts[0]),
                y: parseFloat(parts[1]),
                z: parseFloat(parts[2])
            };

            // Parse normals and colors based on format
            if (hasNormals && !hasColors) {
                // NOFF: x y z nx ny nz
                if (parts.length >= 6) {
                    vertex.nx = parseFloat(parts[3]);
                    vertex.ny = parseFloat(parts[4]);
                    vertex.nz = parseFloat(parts[5]);
                }
            } else if (hasNormals && hasColors) {
                // CNOFF: x y z nx ny nz r g b [a]
                if (parts.length >= 9) {
                    vertex.nx = parseFloat(parts[3]);
                    vertex.ny = parseFloat(parts[4]);
                    vertex.nz = parseFloat(parts[5]);
                    vertex.red = Math.round(Math.min(255, Math.max(0, parseFloat(parts[6]))));
                    vertex.green = Math.round(Math.min(255, Math.max(0, parseFloat(parts[7]))));
                    vertex.blue = Math.round(Math.min(255, Math.max(0, parseFloat(parts[8]))));
                }
            } else if (hasColors && !hasNormals) {
                // COFF: x y z r g b
                if (parts.length >= 6) {
                    vertex.red = Math.round(Math.min(255, Math.max(0, parseFloat(parts[3]))));
                    vertex.green = Math.round(Math.min(255, Math.max(0, parseFloat(parts[4]))));
                    vertex.blue = Math.round(Math.min(255, Math.max(0, parseFloat(parts[5]))));
                }
            }

            vertices.push(vertex);
            lineIndex++;
        }

        timingCallback?.(`✅ OFF: Parsed ${vertices.length} vertices`);

        // Parse faces
        for (let i = 0; i < faceCount && lineIndex < lines.length; i++) {
            const line = lines[lineIndex].trim();
            if (line === '') {
                i--; // Don't count empty lines
                lineIndex++;
                continue;
            }

            const parts = line.split(/\s+/).map(p => parseInt(p));
            if (parts.length < 1) {
                throw new Error(`OFF file: invalid face at line ${lineIndex + 1}`);
            }

            const vertexCountForFace = parts[0];
            if (parts.length < vertexCountForFace + 1) {
                throw new Error(`OFF file: face at line ${lineIndex + 1} expects ${vertexCountForFace} vertices but only has ${parts.length - 1}`);
            }

            const faceIndices = parts.slice(1, vertexCountForFace + 1);

            // Validate indices
            for (const index of faceIndices) {
                if (index < 0 || index >= vertexCount) {
                    throw new Error(`OFF file: invalid vertex index ${index} in face at line ${lineIndex + 1}`);
                }
            }

            // Convert polygons to triangles if needed
            if (faceIndices.length === 3) {
                faces.push({ indices: faceIndices });
            } else if (faceIndices.length === 4) {
                // Split quad into two triangles
                faces.push({ indices: [faceIndices[0], faceIndices[1], faceIndices[2]] });
                faces.push({ indices: [faceIndices[0], faceIndices[2], faceIndices[3]] });
            } else if (faceIndices.length > 4) {
                // Fan triangulation for polygons
                for (let j = 1; j < faceIndices.length - 1; j++) {
                    faces.push({ indices: [faceIndices[0], faceIndices[j], faceIndices[j + 1]] });
                }
            }

            lineIndex++;
        }

        const totalTime = performance.now() - startTime;
        timingCallback?.(`✅ OFF: Parsing complete - ${vertices.length} vertices, ${faces.length} triangles in ${totalTime.toFixed(1)}ms`);

        return {
            vertices,
            faces,
            vertexCount: vertices.length,
            faceCount: faces.length,
            hasColors,
            hasNormals,
            format: 'ascii',
            fileName: '',
            comments,
            offVariant
        };
    }
}