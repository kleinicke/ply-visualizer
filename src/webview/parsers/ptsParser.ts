/**
 * Parser for PTS format (Point cloud data with various line formats)
 * Supports multiple line formats:
 * - x y z
 * - x y z intensity
 * - x y z r g b
 * - x y z intensity r g b
 * - x y z nx ny nz
 * - x y z r g b nx ny nz
 */

export interface PtsData {
  vertices: Array<{
    x: number;
    y: number;
    z: number;
    red?: number;
    green?: number;
    blue?: number;
    nx?: number;
    ny?: number;
    nz?: number;
    intensity?: number;
  }>;
  vertexCount: number;
  hasColors: boolean;
  hasNormals: boolean;
  hasIntensity: boolean;
  format: 'pts';
  fileName: string;
  fileIndex?: number;
  comments: string[];
  detectedFormat: string;
}

export class PtsParser {
  async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<PtsData> {
    const startTime = performance.now();
    timingCallback?.('🔍 PTS: Starting parsing...');

    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(data);
    const lines = text.split('\n').filter(line => line.trim() !== '');

    const vertices: Array<{
      x: number;
      y: number;
      z: number;
      red?: number;
      green?: number;
      blue?: number;
      nx?: number;
      ny?: number;
      nz?: number;
      intensity?: number;
    }> = [];
    const comments: string[] = [];

    let hasColors = false;
    let hasNormals = false;
    let hasIntensity = false;
    let detectedFormat = 'unknown';
    let formatDetected = false;

    // Process header lines (comments, etc.)
    let dataStartLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#') || line.startsWith('//')) {
        comments.push(line.substring(1).trim());
        dataStartLine = i + 1;
      } else if (line.match(/^\d+$/)) {
        // Sometimes PTS files start with point count
        dataStartLine = i + 1;
      } else {
        // Found data line
        break;
      }
    }

    timingCallback?.(`📝 PTS: Processing ${lines.length - dataStartLine} data lines...`);

    // Analyze first few data lines to detect format
    const sampleLines = lines.slice(dataStartLine, Math.min(dataStartLine + 10, lines.length));
    const sampleCounts = new Map<number, number>();

    for (const line of sampleLines) {
      const parts = line.trim().split(/\s+/);
      const count = parts.length;
      if (count >= 3) {
        sampleCounts.set(count, (sampleCounts.get(count) || 0) + 1);
      }
    }

    // Determine most common format
    let mostCommonCount = 0;
    let maxOccurrences = 0;
    for (const [count, occurrences] of sampleCounts) {
      if (occurrences > maxOccurrences) {
        maxOccurrences = occurrences;
        mostCommonCount = count;
      }
    }

    // Determine format based on column count
    switch (mostCommonCount) {
      case 3:
        detectedFormat = 'x y z';
        break;
      case 4:
        detectedFormat = 'x y z intensity';
        hasIntensity = true;
        break;
      case 6:
        detectedFormat = 'x y z r g b';
        hasColors = true;
        break;
      case 7:
        detectedFormat = 'x y z intensity r g b';
        hasIntensity = true;
        hasColors = true;
        break;
      case 9:
        detectedFormat = 'x y z r g b nx ny nz';
        hasColors = true;
        hasNormals = true;
        break;
      default:
        // Try to auto-detect based on value ranges
        if (mostCommonCount >= 6) {
          // Assume colors if we have at least 6 columns
          detectedFormat = `x y z r g b (${mostCommonCount} columns)`;
          hasColors = true;
          if (mostCommonCount >= 9) {
            hasNormals = true;
          }
        } else {
          detectedFormat = `x y z (${mostCommonCount} columns)`;
        }
        break;
    }

    formatDetected = true;
    timingCallback?.(`🎯 PTS: Detected format - ${detectedFormat}`);

    // Parse data lines
    let processedLines = 0;
    for (let i = dataStartLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') {continue;}

      const parts = line.split(/\s+/);
      if (parts.length < 3) {continue;}

      const values = parts.map(val => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
      });

      const vertex: any = {
        x: values[0] || 0,
        y: values[1] || 0,
        z: values[2] || 0,
      };

      // Parse additional columns based on detected format
      if (mostCommonCount === 4) {
        // x y z intensity
        vertex.intensity = values[3];
      } else if (mostCommonCount === 6) {
        // x y z r g b
        vertex.red = Math.round(Math.min(255, Math.max(0, values[3])));
        vertex.green = Math.round(Math.min(255, Math.max(0, values[4])));
        vertex.blue = Math.round(Math.min(255, Math.max(0, values[5])));
      } else if (mostCommonCount === 7) {
        // x y z intensity r g b
        vertex.intensity = values[3];
        vertex.red = Math.round(Math.min(255, Math.max(0, values[4])));
        vertex.green = Math.round(Math.min(255, Math.max(0, values[5])));
        vertex.blue = Math.round(Math.min(255, Math.max(0, values[6])));
      } else if (mostCommonCount === 9) {
        // x y z r g b nx ny nz
        vertex.red = Math.round(Math.min(255, Math.max(0, values[3])));
        vertex.green = Math.round(Math.min(255, Math.max(0, values[4])));
        vertex.blue = Math.round(Math.min(255, Math.max(0, values[5])));
        vertex.nx = values[6];
        vertex.ny = values[7];
        vertex.nz = values[8];
      } else if (values.length >= 6) {
        // Generic: assume colors in positions 3,4,5
        vertex.red = Math.round(Math.min(255, Math.max(0, values[3])));
        vertex.green = Math.round(Math.min(255, Math.max(0, values[4])));
        vertex.blue = Math.round(Math.min(255, Math.max(0, values[5])));

        // If more columns, assume normals
        if (values.length >= 9) {
          vertex.nx = values[6];
          vertex.ny = values[7];
          vertex.nz = values[8];
        }
      }

      vertices.push(vertex);
      processedLines++;

      if (processedLines % 100000 === 0) {
        timingCallback?.(`📊 PTS: Processed ${processedLines} points...`);
      }
    }

    const totalTime = performance.now() - startTime;
    timingCallback?.(
      `✅ PTS: Parsing complete - ${vertices.length} points in ${totalTime.toFixed(1)}ms`
    );

    return {
      vertices,
      vertexCount: vertices.length,
      hasColors,
      hasNormals,
      hasIntensity,
      format: 'pts',
      fileName: '',
      comments,
      detectedFormat,
    };
  }
}
