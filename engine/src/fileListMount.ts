import { mount } from 'svelte';
import FileList from './components/FileList.svelte';
import type { FileListHost } from './components/fileListTypes';

export function mountFileList(host: FileListHost): void {
  const target = document.getElementById('file-list');
  if (!target) {
    return;
  }
  mount(FileList, { target, props: { host } });
}
