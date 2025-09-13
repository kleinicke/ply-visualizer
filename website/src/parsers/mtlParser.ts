export interface MtlMaterial {
  name: string;
  diffuseColor: { r: number; g: number; b: number };
  ambientColor?: { r: number; g: number; b: number };
  specularColor?: { r: number; g: number; b: number };
  opacity?: number;
  illuminationModel?: number;
}

export interface MtlData {
  materials: Map<string, MtlMaterial>;
  fileName?: string;
}

export class MtlParser {
  async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<MtlData> {
    const parseStartTime = performance.now();
    const log = timingCallback || console.log;
    log(`📋 Parser: Starting MTL parsing (${data.length} bytes)...`);

    const result: MtlData = {
      materials: new Map(),
    };

    // Decode the entire file as text
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(data);
    const lines = text.split('\n');

    log(`📝 Parser: Processing ${lines.length} lines...`);

    let currentMaterial: MtlMaterial | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }

      const parts = line.split(/\s+/);
      const command = parts[0];

      switch (command) {
        case 'newmtl':
          // New material definition
          if (parts.length >= 2) {
            if (currentMaterial) {
              // Save previous material
              result.materials.set(currentMaterial.name, currentMaterial);
            }

            currentMaterial = {
              name: parts[1],
              diffuseColor: { r: 0.8, g: 0.8, b: 0.8 }, // Default gray
            };
          }
          break;

        case 'Kd':
          // Diffuse color: Kd r g b
          if (currentMaterial && parts.length >= 4) {
            currentMaterial.diffuseColor = {
              r: parseFloat(parts[1]),
              g: parseFloat(parts[2]),
              b: parseFloat(parts[3]),
            };
          }
          break;

        case 'Ka':
          // Ambient color: Ka r g b
          if (currentMaterial && parts.length >= 4) {
            currentMaterial.ambientColor = {
              r: parseFloat(parts[1]),
              g: parseFloat(parts[2]),
              b: parseFloat(parts[3]),
            };
          }
          break;

        case 'Ks':
          // Specular color: Ks r g b
          if (currentMaterial && parts.length >= 4) {
            currentMaterial.specularColor = {
              r: parseFloat(parts[1]),
              g: parseFloat(parts[2]),
              b: parseFloat(parts[3]),
            };
          }
          break;

        case 'd':
        case 'Tr':
          // Opacity: d value or Tr value (Tr = 1-d)
          if (currentMaterial && parts.length >= 2) {
            const value = parseFloat(parts[1]);
            currentMaterial.opacity = command === 'd' ? value : 1.0 - value;
          }
          break;

        case 'illum':
          // Illumination model: illum value
          if (currentMaterial && parts.length >= 2) {
            currentMaterial.illuminationModel = parseInt(parts[1]);
          }
          break;

        // Ignore texture maps and other properties for now
        case 'map_Kd':
        case 'map_Ka':
        case 'map_Ks':
        case 'map_Bump':
        case 'map_bump':
        case 'bump':
        case 'disp':
        case 'decal':
        case 'Ns':
        case 'Ni':
          // Texture maps and material properties - ignore for now
          break;

        default:
          // Unknown command - log and ignore
          if (i < 10) {
            // Only log first 10 unknown commands to avoid spam
            log(`⚠️ Parser: Unknown MTL command '${command}' on line ${i + 1}`);
          }
          break;
      }
    }

    // Don't forget to save the last material
    if (currentMaterial) {
      result.materials.set(currentMaterial.name, currentMaterial);
    }

    const totalParseTime = performance.now();
    log(`🎯 Parser: MTL parsing complete in ${(totalParseTime - parseStartTime).toFixed(1)}ms`);
    log(`📊 Parser: Found ${result.materials.size} materials`);

    // Log materials for debugging
    result.materials.forEach((material, name) => {
      const rgb = material.diffuseColor;
      log(
        `🎨 Material '${name}': RGB(${rgb.r.toFixed(2)}, ${rgb.g.toFixed(2)}, ${rgb.b.toFixed(2)})`
      );
    });

    return result;
  }
}
