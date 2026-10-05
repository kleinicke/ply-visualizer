import { mount, unmount } from 'svelte';
import type { ViewerLifetime } from './utils/viewerLifetime';
import MeasurementQuickActions from './components/MeasurementQuickActions.svelte';

export function mountMeasurementQuickActions(lifetime: ViewerLifetime, host: unknown): void {
  const panel = document.getElementById('main-ui-panel');
  if (!panel || document.getElementById('measurement-quick-actions-mount')) {
    return;
  }
  const target = document.createElement('div');
  target.id = 'measurement-quick-actions-mount';
  panel.appendChild(target);
  lifetime.add(() => target.remove());
  {
    const component = mount(MeasurementQuickActions, { target, props: { host } });
    lifetime.add(() => {
      void unmount(component);
    });
  }
}
