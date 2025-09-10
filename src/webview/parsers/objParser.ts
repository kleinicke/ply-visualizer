export interface ObjVertex {
    x: number;
    y: number;
    z: number;
}

export interface ObjTextureCoord {
    u: number;
    v: number;
    w?: number;
}

export interface ObjNormal {
    nx: number;
    ny: number;
    nz: number;
}

export interface ObjLine {
    start: number; // vertex index
    end: number;   // vertex index
    material?: string; // material used for this line
}

export interface ObjPoint {
    index: number; // vertex index
    material?: string; // material used for this point
}

export interface ObjFace {
    indices: number[];           // vertex indices
    textureIndices?: number[];   // texture coordinate indices
    normalIndices?: number[];    // normal vector indices
    material?: string;           // material used for this face
}

export interface MaterialGroup {
    material: string;
    points: ObjPoint[];
    lines: ObjLine[];
    faces: ObjFace[];
}

export interface ObjData {
    vertices: ObjVertex[];
    textureCoords: ObjTextureCoord[];
    normals: ObjNormal[];
    points: ObjPoint[];
    lines: ObjLine[];
    faces: ObjFace[];
    materialGroups: MaterialGroup[]; // Geometry grouped by material
    materialFile?: string;
    currentMaterial?: string;
    vertexCount: number;
    textureCoordCount: number;
    normalCount: number;
    pointCount: number;
    lineCount: number;
    faceCount: number;
    hasTextures: boolean;
    hasNormals: boolean;
    fileName?: string;
    fileIndex?: number;
}

export class ObjParser {
    async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<ObjData> {
        const parseStartTime = performance.now();
        const log = timingCallback || console.log;
        log(`📋 Parser: Starting OBJ parsing (${data.length} bytes)...`);
        
        const result: ObjData = {
            vertices: [],
            textureCoords: [],
            normals: [],
            points: [],
            lines: [],
            faces: [],
            materialGroups: [],
            vertexCount: 0,
            textureCoordCount: 0,
            normalCount: 0,
            pointCount: 0,
            lineCount: 0,
            faceCount: 0,
            hasTextures: false,
            hasNormals: false
        };

        let currentMaterialName: string | undefined;

        // Decode the entire file as text
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data);
        const lines = text.split('\n');

        log(`📝 Parser: Processing ${lines.length} lines...`);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines and comments
            if (!line || line.startsWith('#')) {
                continue;
            }

            const parts = line.split(/\s+/);
            const command = parts[0];

            switch (command) {
                case 'mtllib':
                    // Material library file reference
                    result.materialFile = parts[1];
                    break;

                case 'usemtl':
                    // Use material
                    currentMaterialName = parts[1];
                    result.currentMaterial = parts[1];
                    break;

                case 'v':
                    // Vertex: v x y z [w]
                    if (parts.length >= 4) {
                        const vertex: ObjVertex = {
                            x: parseFloat(parts[1]),
                            y: parseFloat(parts[2]),
                            z: parseFloat(parts[3])
                        };
                        result.vertices.push(vertex);
                        result.vertexCount++;
                    }
                    break;

                case 'vt':
                    // Texture coordinate: vt u [v] [w]
                    if (parts.length >= 2) {
                        const texCoord: ObjTextureCoord = {
                            u: parseFloat(parts[1]),
                            v: parts.length >= 3 ? parseFloat(parts[2]) : 0.0
                        };
                        if (parts.length >= 4) {
                            texCoord.w = parseFloat(parts[3]);
                        }
                        result.textureCoords.push(texCoord);
                        result.textureCoordCount++;
                        result.hasTextures = true;
                    }
                    break;

                case 'vn':
                    // Vertex normal: vn nx ny nz
                    if (parts.length >= 4) {
                        const normal: ObjNormal = {
                            nx: parseFloat(parts[1]),
                            ny: parseFloat(parts[2]),
                            nz: parseFloat(parts[3])
                        };
                        result.normals.push(normal);
                        result.normalCount++;
                        result.hasNormals = true;
                    }
                    break;

                case 'p':
                    // Point: p v1 [v2 v3 ...]
                    // OBJ uses 1-based indexing, so subtract 1 for 0-based indexing
                    if (parts.length >= 2) {
                        // Points can reference multiple vertices
                        for (let j = 1; j < parts.length; j++) {
                            const objPoint: ObjPoint = {
                                index: parseInt(parts[j]) - 1, // Convert to 0-based
                                material: currentMaterialName
                            };
                            result.points.push(objPoint);
                            result.pointCount++;
                        }
                    }
                    break;

                case 'l':
                    // Line: l v1 v2 [v3 ...]
                    // OBJ uses 1-based indexing, so subtract 1 for 0-based indexing
                    if (parts.length >= 3) {
                        // For multi-vertex lines, create line segments between consecutive vertices
                        for (let j = 1; j < parts.length - 1; j++) {
                            const objLine: ObjLine = {
                                start: parseInt(parts[j]) - 1,  // Convert to 0-based
                                end: parseInt(parts[j + 1]) - 1, // Convert to 0-based
                                material: currentMaterialName
                            };
                            result.lines.push(objLine);
                            result.lineCount++;
                        }
                    }
                    break;

                case 'f':
                    // Face: f v1[/vt1/vn1] v2[/vt2/vn2] v3[/vt3/vn3] ...
                    if (parts.length >= 4) {
                        const faceIndices: number[] = [];
                        const textureIndices: number[] = [];
                        const normalIndices: number[] = [];
                        let hasTexInFace = false;
                        let hasNormInFace = false;
                        
                        for (let j = 1; j < parts.length; j++) {
                            // Handle vertex/texture/normal format: v/vt/vn or v//vn or v/vt or v
                            const indices = parts[j].split('/');
                            
                            // Vertex index (required)
                            faceIndices.push(parseInt(indices[0]) - 1); // Convert to 0-based
                            
                            // Texture coordinate index (optional)
                            if (indices.length >= 2 && indices[1] !== '') {
                                textureIndices.push(parseInt(indices[1]) - 1); // Convert to 0-based
                                hasTexInFace = true;
                            }
                            
                            // Normal index (optional)
                            if (indices.length >= 3 && indices[2] !== '') {
                                normalIndices.push(parseInt(indices[2]) - 1); // Convert to 0-based
                                hasNormInFace = true;
                            }
                        }
                        
                        const face: ObjFace = { 
                            indices: faceIndices,
                            material: currentMaterialName
                        };
                        if (hasTexInFace) {
                            face.textureIndices = textureIndices;
                        }
                        if (hasNormInFace) {
                            face.normalIndices = normalIndices;
                        }
                        
                        result.faces.push(face);
                        result.faceCount++;
                    }
                    break;

                // Ignore other commands (vt, vn, s, g, o, etc.) for now
                default:
                    break;
            }

            // Progress update every 10000 lines
            if (i % 10000 === 0 && i > 0) {
                log(`📊 Parser: Processed ${i} lines...`);
            }
        }

        // Group geometry by materials for multi-material rendering
        const materialGroups = new Map<string, MaterialGroup>();
        
        // Group points by material
        for (const point of result.points) {
            const materialName = point.material || 'default';
            if (!materialGroups.has(materialName)) {
                materialGroups.set(materialName, {
                    material: materialName,
                    points: [],
                    lines: [],
                    faces: []
                });
            }
            materialGroups.get(materialName)!.points.push(point);
        }
        
        // Group lines by material
        for (const line of result.lines) {
            const materialName = line.material || 'default';
            if (!materialGroups.has(materialName)) {
                materialGroups.set(materialName, {
                    material: materialName,
                    points: [],
                    lines: [],
                    faces: []
                });
            }
            materialGroups.get(materialName)!.lines.push(line);
        }
        
        // Group faces by material
        for (const face of result.faces) {
            const materialName = face.material || 'default';
            if (!materialGroups.has(materialName)) {
                materialGroups.set(materialName, {
                    material: materialName,
                    points: [],
                    lines: [],
                    faces: []
                });
            }
            materialGroups.get(materialName)!.faces.push(face);
        }
        
        result.materialGroups = Array.from(materialGroups.values());

        const totalParseTime = performance.now();
        log(`🎯 Parser: OBJ parsing complete in ${(totalParseTime - parseStartTime).toFixed(1)}ms`);
        log(`📊 Parser: Found ${result.vertexCount} vertices, ${result.pointCount} points, ${result.lineCount} lines, ${result.faceCount} faces`);
        log(`🎨 Parser: Grouped into ${result.materialGroups.length} material group(s)`);
        if (result.hasTextures) {
            log(`🗺️ Parser: Found ${result.textureCoordCount} texture coordinates`);
        }
        if (result.hasNormals) {
            log(`📐 Parser: Found ${result.normalCount} normals`);
        }
        if (result.materialFile) {
            log(`🎨 Parser: Material file: ${result.materialFile}`);
        }

        return result;
    }
}