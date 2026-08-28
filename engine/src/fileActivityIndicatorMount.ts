import { mount } from 'svelte';
import FileActivityIndicator from './components/FileActivityIndicator.svelte';

export function mountFileActivityIndicator(): void {
  const target = document.getElementById('file-activity-indicator-mount');
  if (!target) {return;}
  mount(FileActivityIndicator, { target });
}
