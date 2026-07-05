import * as THREE from 'three';
import { SpatialData } from './interfaces';
import { isDepthDerivedFile } from './depth/commentSettings';
import {
  getIntensityArray,
  hasIntensityData,
  buildIntensityColorArrayForMode,
} from './utils/intensity';

export interface SrgbHost {
  convertSrgbToLinear: boolean;
}

export function pointColorsNeedSrgbDecode(
  host: SrgbHost,
  data: SpatialData,
  colorMode: string
): boolean {
  if (colorMode !== 'original' || !data.hasColors || !host.convertSrgbToLinear) {
    return false;
  }
  const depthDerived = isDepthDerivedFile(data) || (data as any).isDepthDerived;
  return !depthDerived;
}

export function setupPointSrgbDecode(material: THREE.PointsMaterial): void {
  if (material.userData.srgbDecodeSetup) {
    return;
  }
  material.userData.srgbDecodeSetup = true;
  material.onBeforeCompile = shader => {
    if (!material.userData.srgbDecode) {
      return; // stock shader: vertex colors used as-is (linear)
    }
    // Inject the decode function after <common> (a stable, early chunk) and the
    // decode itself right AFTER <color_fragment> (which has already done
    // diffuseColor.rgb *= vColor, and material.color is white for vertex-colored
    // points, so diffuseColor.rgb == the raw sRGB vertex color here). All
    // preprocessor directives are at column 0 — some GLSL drivers reject a '#'
    // that isn't, which is what broke the previous indented version.
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvec3 plySrgbToLinear( vec3 c ) { return mix( c / 12.92, pow( ( c + 0.055 ) / 1.055, vec3( 2.4 ) ), step( vec3( 0.04045 ), c ) ); }'
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n#ifdef USE_COLOR\ndiffuseColor.rgb = plySrgbToLinear( diffuseColor.rgb );\n#endif'
      );
  };
  // The compiled program differs by decode state, so it must be part of the key.
  material.customProgramCacheKey = () => (material.userData.srgbDecode ? 'plySrgb1' : 'plySrgb0');
}

export interface ColorArrayHost extends SrgbHost {
  colorProcessor: { ensureSrgbLUT(): Float32Array };
}

export function buildOriginalColorArray(
  host: ColorArrayHost,
  data: SpatialData
): Float32Array | Uint8Array | null {
  const isMesh = (data.faceCount || 0) > 0;
  const typedColors = (data as any).colorsArray as Uint8Array | null | undefined;
  if (typedColors && data.hasColors) {
    if (!isMesh) {
      return typedColors; // raw 8-bit sRGB, decoded in-shader; zero-copy
    }
    const colorFloats = new Float32Array(typedColors.length);
    if (host.convertSrgbToLinear) {
      const lut = host.colorProcessor.ensureSrgbLUT();
      for (let i = 0; i < typedColors.length; i++) {
        colorFloats[i] = lut[typedColors[i]];
      }
    } else {
      for (let i = 0; i < typedColors.length; i++) {
        colorFloats[i] = typedColors[i] / 255;
      }
    }
    return colorFloats;
  }

  if (!data.hasColors || !data.vertices?.length) {
    return null;
  }

  if (!isMesh) {
    const colors = new Uint8Array(data.vertices.length * 3);
    for (let i = 0, i3 = 0; i < data.vertices.length; i++, i3 += 3) {
      const vertex = data.vertices[i];
      colors[i3] = (vertex.red || 0) & 255;
      colors[i3 + 1] = (vertex.green || 0) & 255;
      colors[i3 + 2] = (vertex.blue || 0) & 255;
    }
    return colors;
  }

  const colors = new Float32Array(data.vertices.length * 3);
  for (let i = 0, i3 = 0; i < data.vertices.length; i++, i3 += 3) {
    const vertex = data.vertices[i];
    const r8 = (vertex.red || 0) & 255;
    const g8 = (vertex.green || 0) & 255;
    const b8 = (vertex.blue || 0) & 255;
    if (host.convertSrgbToLinear) {
      const lut = host.colorProcessor.ensureSrgbLUT();
      colors[i3] = lut[r8];
      colors[i3 + 1] = lut[g8];
      colors[i3 + 2] = lut[b8];
    } else {
      colors[i3] = r8 / 255;
      colors[i3 + 1] = g8 / 255;
      colors[i3 + 2] = b8 / 255;
    }
  }
  return colors;
}

export function applyColorModeToGeometry(
  host: ColorArrayHost,
  data: SpatialData,
  geometry: THREE.BufferGeometry,
  colorMode: string
): void {
  const pointCount = data.vertexCount || geometry.getAttribute('position')?.count || 0;

  if (colorMode.startsWith('intensity')) {
    const intensity = getIntensityArray(data);
    if (intensity) {
      const colorAttribute = new THREE.BufferAttribute(
        buildIntensityColorArrayForMode(intensity, pointCount, colorMode),
        3
      );
      geometry.setAttribute('color', colorAttribute);
      colorAttribute.needsUpdate = true;
      return;
    }
  }

  if (colorMode === 'original' && data.hasColors) {
    const colors = buildOriginalColorArray(host, data);
    if (colors) {
      // Uint8 (point-cloud sRGB) attributes are normalized so the GPU reads
      // 0..1; Float32 (mesh, already linear) are not.
      const normalized = colors instanceof Uint8Array;
      const colorAttribute = new THREE.BufferAttribute(colors, 3, normalized);
      geometry.setAttribute('color', colorAttribute);
      colorAttribute.needsUpdate = true;
      return;
    }
  }

  if (geometry.getAttribute('color')) {
    geometry.deleteAttribute('color');
  }
}

export function shouldUseVertexColors(data: SpatialData, colorMode: string): boolean {
  return (
    (colorMode === 'original' && data.hasColors) ||
    (colorMode.startsWith('intensity') && hasIntensityData(data))
  );
}

export interface FileColorsHost {
  fileColors: { length: number };
  individualColorModes: string[];
}

export function getColorName(fileIndex: number): string {
  const colorNames = [
    'White',
    'Red',
    'Green',
    'Blue',
    'Yellow',
    'Magenta',
    'Cyan',
    'Orange',
    'Purple',
    'Dark Green',
    'Gray',
  ];
  return colorNames[fileIndex % colorNames.length];
}

export function getColorOptions(host: FileColorsHost, fileIndex: number): string {
  let options = '';
  for (let i = 0; i < host.fileColors.length; i++) {
    const isSelected = host.individualColorModes[fileIndex] === i.toString();
    options += `<option value="${i}" ${isSelected ? 'selected' : ''}>${getColorName(i)}</option>`;
  }
  return options;
}
