import { mount } from 'svelte';
import MeasurementQuickActions from './components/MeasurementQuickActions.svelte';

export function mountMeasurementQuickActions(host: unknown): void {
  const panel = document.getElementById('main-ui-panel');
  if (!panel || document.getElementById('measurement-quick-actions-mount')) {
    return;
  }
  const target = document.createElement('div');
  target.id = 'measurement-quick-actions-mount';
  panel.appendChild(target);
  mount(MeasurementQuickActions, { target, props: { host } });
}
