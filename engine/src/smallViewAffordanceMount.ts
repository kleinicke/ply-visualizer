import { mount } from 'svelte';
import SmallViewAffordance from './components/SmallViewAffordance.svelte';

export function mountSmallViewAffordance(host: unknown): void {
  const panel = document.getElementById('main-ui-panel');
  if (!panel || document.getElementById('small-view-affordance-mount')) {return;}
  const target = document.createElement('div');
  target.id = 'small-view-affordance-mount';
  target.style.position = 'fixed';
  target.style.zIndex = '100';
  panel.parentElement?.appendChild(target);

  const positionBelowPanel = () => {
    const bounds = panel.getBoundingClientRect();
    target.style.top = `${bounds.bottom + 8}px`;
    target.style.left = `${bounds.left}px`;
    target.style.width = `${bounds.width}px`;
  };
  positionBelowPanel();
  new ResizeObserver(positionBelowPanel).observe(panel);
  window.addEventListener('resize', positionBelowPanel);

  mount(SmallViewAffordance, { target, props: { host } });
}
