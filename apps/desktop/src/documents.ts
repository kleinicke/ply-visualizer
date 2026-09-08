export type ViewKind = 'image' | 'scene' | 'text' | 'video';
export interface FileRef {
  id: string;
  name: string;
  size: number;
  file?: File;
  path?: string;
}
export interface SourceDocument {
  id: string;
  name: string;
  sources: FileRef[];
  kind: ViewKind;
  mode: 'single' | 'composition' | 'collection' | 'sequence' | 'compare';
  pinned: boolean;
  index: number;
  settings?: any;
  presentation?: any;
}
export interface ViewerProvider {
  id: string;
  views(name: string): ViewKind[] | null;
}
export const providers: ViewerProvider[] = [
  {
    id: 'scientific-image',
    views: name =>
      /\.(png|tiff?|exr|pfm|npy|npz)$/i.test(name)
        ? ['image', 'scene']
        : /\.(jpe?g|webp|gif|bmp|avif|ico|hdr|jxl|tga|ppm|pgm|pbm|pnm|fits?|fts|dcm|dicom|nc|netcdf|czi|nd2|lif|sdt|ora|kra|psd|psb|xcf|afphoto|jp2|j2k|jxr|wdp|hdp)$/i.test(
              name
            )
          ? ['image']
          : null,
  },
  {
    id: 'scene',
    views: name =>
      /\.(ply|xyz|xyzn|xyzrgb|pcd|pts|obj|stl|off|gltf|glb|las|laz|e57|x3a|x3r|spz|splat|ksplat|sog|nrrd)$/i.test(
        name
      )
        ? ['scene']
        : null,
  },
  { id: 'video', views: name => (/\.(mp4|webm|m4v|mov|ogv)$/i.test(name) ? ['video'] : null) },
];
export function routeDocument(name: string): ViewKind[] {
  return providers.map(p => p.views(name)).find(Boolean) || ['text'];
}
export function matchesFilter(name: string, query: string): boolean {
  if (!query) {
    return true;
  }
  if (!/[?*]/.test(query)) {
    return name.toLowerCase().includes(query.toLowerCase());
  }
  const expression = query
    .split('')
    .map(c => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${expression}$`, 'i').test(name);
}
export function orderedSources(files: FileRef[]) {
  return [...files].sort((a, b) =>
    (a.path || a.name).localeCompare(b.path || b.name, undefined, { numeric: true })
  );
}
export function textPreview(bytes: Uint8Array): string {
  if (bytes.subarray(0, 8192).includes(0)) {
    throw new Error('Binary file — no text preview available');
  }
  return (
    new TextDecoder().decode(bytes.subarray(0, 2 * 1024 * 1024)) +
    (bytes.length > 2 * 1024 * 1024 ? '\n\n[Preview limited to 2 MiB]' : '')
  );
}
