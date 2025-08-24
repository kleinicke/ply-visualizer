// Common types shared across parsers
export interface BaseVertex {
    x: number;
    y: number;
    z: number;
    red?: number;
    green?: number;
    blue?: number;
    nx?: number;
    ny?: number;
    nz?: number;
}

export interface BaseFace {
    indices: number[];
}

export interface BaseParserData {
    vertices: BaseVertex[];
    vertexCount: number;
    hasColors: boolean;
    hasNormals: boolean;
    fileName: string;
    fileIndex?: number;
    comments: string[];
}