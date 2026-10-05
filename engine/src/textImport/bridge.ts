import type { SpatialData } from '../interfaces';
let importer: ((data: Uint8Array, fileName: string) => Promise<SpatialData>) | undefined;
export function setTextImporter(handler: NonNullable<typeof importer>): void {
  importer = handler;
}
export function requestTextImport(data: Uint8Array, fileName: string): Promise<SpatialData> {
  if (!importer) {throw new Error('Open this text file in the viewer to choose its layout.');}
  return importer(data, fileName);
}
