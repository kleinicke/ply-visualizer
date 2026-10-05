import { mount, unmount } from 'svelte';
import type { ViewerLifetime } from './utils/viewerLifetime';
import FileList from './components/FileList.svelte';
import type { FileListHost } from './components/fileListTypes';

export function mountFileList(lifetime: ViewerLifetime, host: FileListHost): void {
  const target = document.getElementById('file-list');
  if (!target) {
    return;
  }
  {
    const component = mount(FileList, { target, props: { host } });
    lifetime.add(() => {
      void unmount(component);
    });
  }
}
