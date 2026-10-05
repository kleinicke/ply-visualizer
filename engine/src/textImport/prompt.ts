import type { SpatialData } from '../interfaces';
import { setTextImporter } from './bridge';
import { mount, unmount } from 'svelte';
import TextImportDialog from '../components/TextImportDialog.svelte';
import { parseTextTableWasm } from '../parsers/pointcloudWasm';
import type { TextImportOptions } from './options';

// Extension messages can arrive together. Keep one import dialog active at a time.
let queue: Promise<unknown> = Promise.resolve();
export function importTextFile(data: Uint8Array, fileName: string): Promise<SpatialData> {
  const request = queue.then(
    () =>
      new Promise<SpatialData>((resolve, reject) => {
        const target = document.createElement('div');
        document.body.appendChild(target);
        const close = () => {
          void unmount(component);
          target.remove();
        };
        const component = mount(TextImportDialog, {
          target,
          props: {
            fileName,
            sample: new TextDecoder().decode(data.subarray(0, 8192)),
            onCancel: () => {
              close();
              const error = new Error('Import cancelled');
              error.name = 'AbortError';
              reject(error);
            },
            onImport: async (options: TextImportOptions) => {
              const parsed = await parseTextTableWasm(data, options);
              const payload: SpatialData = {
                ...parsed,
                vertices: [],
                faces: [],
                faceCount: 0,
                version: '1.0',
                format: 'ascii',
                useTypedArrays: true,
                comments: [`Text import: ${JSON.stringify(options)}`],
              };
              close();
              resolve(payload);
            },
          },
        });
      })
  );
  queue = request.catch((): void => {});
  return request;
}

setTextImporter(importTextFile);
