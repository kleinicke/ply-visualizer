/**
 * Parser for plain XYZ, XYZN (x y z nx ny nz) and XYZRGB (x y z r g b) ASCII
 * point clouds.
 *
 * Runs in the extension host (like the PCD/PTS/PLY parsers) and produces packed
 * typed arrays, so the webview receives compact binary instead of the raw
 * multi-hundred-MB text.
 *
 * Performance: parses floats directly from the byte buffer (a hand-rolled ASCII
 * atof) instead of decoding to a string + split + substring + parseFloat. That
 * chain allocates ~50M throwaway strings for a 600MB file; the byte scan
 * allocates nothing per number and roughly halves parse time.
 *
 * For plain `.xyz`, columns are auto-detected from the first valid row to match
 * the legacy parser: 3 = xyz, 4 = xyz + intensity, 6 = xyz + rgb.
 */
export interface XyzVariantData {
  vertexCount: number;
  positionsArray: Float32Array;
  colorsArray: Uint8Array | null;
  normalsArray: Float32Array | null;
  intensityArray: Float32Array | null;
  hasColors: boolean;
  hasNormals: boolean;
  hasIntensity: boolean;
}

// 10^(i-30) for i in 0..60 — covers the scale factors point-cloud floats need
// without a Math.pow() call per number.
const POW10: Float64Array = (() => {
  const t = new Float64Array(61);
  for (let i = 0; i < 61; i++) {
    t[i] = Math.pow(10, i - 30);
  }
  return t;
})();

export class XyzVariantParser {
  parse(data: Uint8Array, variant: string): XyzVariantData {
    const len = data.length;
    const fixedNormals = variant === 'xyzn';
    const fixedColors = variant === 'xyzrgb';

    // Grow dynamically — XYZ files have no point-count header.
    let capacity = 1_000_000;
    let positions = new Float32Array(capacity * 3);
    let normals: Float32Array | null = fixedNormals ? new Float32Array(capacity * 3) : null;
    let colors: Uint8Array | null = fixedColors ? new Uint8Array(capacity * 3) : null;
    let intensity: Float32Array | null = null;
    let parsed = 0;

    // For plain `.xyz`: 'unknown' until the first valid row decides the layout.
    let xyzMode: 'unknown' | 'plain' | 'intensity' | 'rgb' =
      variant === 'xyz' ? 'unknown' : 'plain';

    const grow = () => {
      capacity *= 2;
      const p2 = new Float32Array(capacity * 3);
      p2.set(positions);
      positions = p2;
      if (normals) {
        const n2 = new Float32Array(capacity * 3);
        n2.set(normals);
        normals = n2;
      }
      if (colors) {
        const c2 = new Uint8Array(capacity * 3);
        c2.set(colors);
        colors = c2;
      }
      if (intensity) {
        const i2 = new Float32Array(capacity);
        i2.set(intensity);
        intensity = i2;
      }
    };

    // Up to 6 numeric columns per line.
    const vals = new Float64Array(6);
    let pos = 0;

    // Parse a float starting at `pos` (which must point at a digit/sign/dot),
    // advancing `pos` past it. Returns NaN if no digits were present.
    const parseNum = (): number => {
      let sign = 1;
      let c = data[pos];
      if (c === 45) {
        sign = -1;
        pos++;
      } else if (c === 43) {
        pos++;
      }
      let mantissa = 0;
      let fracDigits = 0;
      let seenDot = false;
      let anyDigit = false;
      while (pos < len) {
        c = data[pos];
        if (c >= 48 && c <= 57) {
          mantissa = mantissa * 10 + (c - 48);
          if (seenDot) {
            fracDigits++;
          }
          anyDigit = true;
          pos++;
        } else if (c === 46 && !seenDot) {
          seenDot = true;
          pos++;
        } else {
          break;
        }
      }
      let exp = 0;
      if (pos < len && (data[pos] === 101 || data[pos] === 69)) {
        // 'e' / 'E'
        pos++;
        let esign = 1;
        if (data[pos] === 45) {
          esign = -1;
          pos++;
        } else if (data[pos] === 43) {
          pos++;
        }
        let e = 0;
        while (pos < len && data[pos] >= 48 && data[pos] <= 57) {
          e = e * 10 + (data[pos] - 48);
          pos++;
        }
        exp = esign * e;
      }
      if (!anyDigit) {
        return NaN;
      }
      let value = sign * mantissa;
      const scaleExp = exp - fracDigits;
      if (scaleExp !== 0) {
        value *= scaleExp >= -30 && scaleExp <= 30 ? POW10[scaleExp + 30] : Math.pow(10, scaleExp);
      }
      return value;
    };

    const writeColor = (i3: number, r: number, g: number, b: number) => {
      // Open3D writes 0-1 floats; raw integer otherwise.
      if (r <= 1.0 && g <= 1.0 && b <= 1.0) {
        colors![i3] = Math.round(r * 255);
        colors![i3 + 1] = Math.round(g * 255);
        colors![i3 + 2] = Math.round(b * 255);
      } else {
        colors![i3] = Math.min(255, Math.max(0, Math.round(r)));
        colors![i3 + 1] = Math.min(255, Math.max(0, Math.round(g)));
        colors![i3 + 2] = Math.min(255, Math.max(0, Math.round(b)));
      }
    };

    while (pos < len) {
      // Collect the numeric columns on this line.
      let nval = 0;
      while (pos < len) {
        const c = data[pos];
        if (c === 10) {
          pos++;
          break;
        } // newline ends the row
        if (c === 32 || c === 9 || c === 13) {
          pos++;
          continue;
        } // inter-token whitespace
        if ((c >= 48 && c <= 57) || c === 45 || c === 43 || c === 46) {
          const v = parseNum();
          if (nval < 6) {
            vals[nval] = v;
          }
          nval++;
        } else {
          // Non-numeric token (e.g. a comment) — skip to next whitespace/newline.
          while (
            pos < len &&
            data[pos] !== 32 &&
            data[pos] !== 9 &&
            data[pos] !== 13 &&
            data[pos] !== 10
          ) {
            pos++;
          }
        }
      }

      if (nval < 3 || isNaN(vals[0]) || isNaN(vals[1]) || isNaN(vals[2])) {
        continue; // skip blank / malformed rows
      }

      // Decide the plain-.xyz layout from the first valid row, then allocate.
      if (xyzMode === 'unknown') {
        if (nval >= 6) {
          xyzMode = 'rgb';
          colors = new Uint8Array(capacity * 3);
        } else if (nval === 4) {
          xyzMode = 'intensity';
          intensity = new Float32Array(capacity);
        } else {
          xyzMode = 'plain';
        }
      }

      if (parsed >= capacity) {
        grow();
      }
      const i3 = parsed * 3;
      positions[i3] = vals[0];
      positions[i3 + 1] = vals[1];
      positions[i3 + 2] = vals[2];

      if (normals && nval >= 6) {
        normals[i3] = vals[3];
        normals[i3 + 1] = vals[4];
        normals[i3 + 2] = vals[5];
      } else if (colors && nval >= 6) {
        writeColor(i3, vals[3], vals[4], vals[5]);
      } else if (intensity && nval >= 4) {
        intensity[parsed] = vals[3];
      }

      parsed++;
    }

    return {
      vertexCount: parsed,
      positionsArray: positions.slice(0, parsed * 3),
      colorsArray: colors ? colors.slice(0, parsed * 3) : null,
      normalsArray: normals ? normals.slice(0, parsed * 3) : null,
      intensityArray: intensity ? intensity.slice(0, parsed) : null,
      hasColors: !!colors,
      hasNormals: !!normals,
      hasIntensity: !!intensity,
    };
  }
}
