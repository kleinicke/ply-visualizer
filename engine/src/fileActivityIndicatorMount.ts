import { mount, unmount } from 'svelte';
import type { ViewerLifetime } from './utils/viewerLifetime';
import FileActivityIndicator from './components/FileActivityIndicator.svelte';

export function mountFileActivityIndicator(lifetime: ViewerLifetime): void {
  const target = document.getElementById('file-activity-indicator-mount');
  if (!target) {
    return;
  }
  {
    const component = mount(FileActivityIndicator, { target });
    lifetime.add(() => {
      void unmount(component);
    });
  }
}
