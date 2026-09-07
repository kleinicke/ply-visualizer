import type { EmbeddedViewer, ImagePreview } from '../../../engine/src/hosts/embeddedViewer';

export interface ImageProvider {
  supports(file: File): boolean;
  preview(
    file: File,
    services: { scalarPreview(file: File): Promise<ImagePreview> }
  ): Promise<{ blob: Blob; description: string }>;
}

/** Replace/prepend providers when the full image engine is integrated. */
export const imageProviders: ImageProvider[] = [
  {
    supports: file => /\.(tiff?|exr|pfm|npy|npz)$/i.test(file.name),
    async preview(file, services) {
      const result = await services.scalarPreview(file);
      return {
        blob: result.blob,
        description: `${result.width} × ${result.height} · ${result.description}`,
      };
    },
  },
  {
    supports: file => /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name),
    async preview(file) {
      return { blob: file, description: 'Image preview' };
    },
  },
];

export async function previewImage(file: File, getViewer: () => Promise<EmbeddedViewer>) {
  const provider = imageProviders.find(provider => provider.supports(file));
  if (!provider) {throw new Error(`No image viewer for ${file.name}`);}
  return provider.preview(file, { scalarPreview: async file => (await getViewer()).preview(file) });
}
