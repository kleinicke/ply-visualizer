import * as THREE from 'three';

/**
 * Photographs for COLMAP camera frames.
 *
 * A reconstruction's `images.*` file names its source photographs but does not
 * contain them; they sit in a sibling `images/` folder. Loading them is what
 * turns the frames from wireframes into something you can recognise, and it is
 * the reason a reconstruction is opened as a folder rather than as three files.
 *
 * Decoding is deliberately bounded. A COLMAP dataset routinely has hundreds of
 * multi-megapixel JPEGs, and decoding them all at full size would cost far more
 * memory than the point cloud. Each is downscaled on decode, and only the first
 * `MAX_TEXTURES` are loaded at all.
 */

/** Longest edge kept, in pixels. Enough to recognise a scene on a frustum. */
const MAX_TEXTURE_EDGE = 512;

/**
 * Cap on decoded images. Beyond this the frames stay wireframes rather than
 * spending hundreds of megabytes on previews nobody asked to see.
 */
export const MAX_TEXTURES = 200;

export interface ColmapImageSource {
  /** Path as written in the model, e.g. `P1180141.JPG` or `left/0001.png`. */
  name: string;
  data: Uint8Array;
}

/** True for files that belong in a COLMAP `images/` folder. */
export function isImageFile(fileName: string): boolean {
  return /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(fileName);
}

/**
 * Matches a decoded file back to the name the model uses.
 *
 * `images.txt` may say `left/0001.png` while the file was read as
 * `images/left/0001.png`, so comparison is on the trailing path.
 */
export function matchesImageName(modelName: string, fileName: string): boolean {
  const normalise = (value: string) => value.replace(/\\/g, '/').toLowerCase();
  const model = normalise(modelName);
  const file = normalise(fileName);
  return file === model || file.endsWith(`/${model}`);
}

async function decodeScaled(data: Uint8Array): Promise<THREE.CanvasTexture | null> {
  try {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    const bitmap = await createImageBitmap(new Blob([copy.buffer]));
    const scale = Math.min(1, MAX_TEXTURE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  } catch (error) {
    console.warn('COLMAP: could not decode image preview', error);
    return null;
  }
}

/**
 * How many images are decoded at once.
 *
 * `createImageBitmap` hands the work to browser-managed threads, so decoding
 * serially leaves most of the machine idle: measured on a 129-image dataset,
 * eight at a time is about three times faster than one at a time. Much beyond
 * this the decoders contend and several full-size bitmaps are alive at once,
 * which costs more memory than it saves in time.
 */
const DECODE_CONCURRENCY = 8;

/**
 * Decodes the photographs referenced by the model, keyed by the model's own
 * image name so buildCameraProfile can look them up directly.
 *
 * Images the model does not reference are skipped: an `images/` folder often
 * holds more than the reconstruction registered.
 *
 * `onTexture` is called as each image finishes, so a caller can attach frames
 * progressively rather than waiting for the whole set.
 */
export async function loadColmapTextures(
  sources: ReadonlyArray<ColmapImageSource>,
  modelImageNames: ReadonlyArray<string>,
  onTexture?: (name: string, texture: THREE.Texture) => void
): Promise<Map<string, THREE.Texture>> {
  const textures = new Map<string, THREE.Texture>();
  if (sources.length === 0 || modelImageNames.length === 0) {
    return textures;
  }

  // Resolve names once. Matching inside the decode loop made this quadratic in
  // the number of images, which is the one part of the job that is pure CPU.
  const byName = new Map<string, ColmapImageSource>();
  for (const modelName of modelImageNames) {
    const source = sources.find(candidate => matchesImageName(modelName, candidate.name));
    if (source) {
      byName.set(modelName, source);
    }
  }

  const wanted = [...byName.keys()].slice(0, MAX_TEXTURES);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < wanted.length) {
      const modelName = wanted[next++];
      const texture = await decodeScaled(byName.get(modelName)!.data);
      if (texture) {
        textures.set(modelName, texture);
        onTexture?.(modelName, texture);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(DECODE_CONCURRENCY, wanted.length) }, () => worker())
  );
  return textures;
}
