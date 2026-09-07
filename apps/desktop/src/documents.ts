export type ViewKind = 'image' | 'scene';
export interface SourceDocument {
  id: string;
  name: string;
  file: File;
  views: ViewKind[];
  defaultView: ViewKind;
}
export interface ViewerProvider {
  id: string;
  views(name: string): ViewKind[] | null;
}

// Order is intentional: image-capable formats open in 2D even when the 3D
// engine can interpret them as depth. Future TIFF integration replaces the
// image provider, not the desktop host or this document model.
export const providers: ViewerProvider[] = [
  {
    id: 'image',
    views: name =>
      /\.(png|tiff?|exr|pfm|npy|npz)$/i.test(name)
        ? ['image', 'scene']
        : /\.(jpe?g|webp|gif|bmp|avif)$/i.test(name)
          ? ['image']
          : null,
  },
  {
    id: '3d',
    views: name =>
      /\.(ply|xyz|xyzn|xyzrgb|pcd|pts|obj|stl|off|gltf|glb|las|laz|e57|x3a|x3r|spz|splat|ksplat|sog|nrrd|bin|json)$/i.test(
        name
      )
        ? ['scene']
        : null,
  },
];

export function routeDocument(name: string): ViewKind[] {
  for (const provider of providers) {
    const views = provider.views(name);
    if (views) {return views;}
  }
  throw new Error(`Unsupported file: ${name}`);
}
