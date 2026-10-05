import { mount, unmount } from 'svelte';
import type { ViewerLifetime } from './utils/viewerLifetime';
import SmallViewAffordance from './components/SmallViewAffordance.svelte';

export function mountSmallViewAffordance(lifetime: ViewerLifetime, host: unknown): void {
  const panel = document.getElementById('main-ui-panel');
  if (!panel || document.getElementById('small-view-affordance-mount')) {
    return;
  }
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
  const observer = new ResizeObserver(positionBelowPanel);
  observer.observe(panel);
  lifetime.add(() => {
    observer.disconnect();
    target.remove();
  });
  lifetime.listen(window, 'resize', positionBelowPanel);

  {
    const component = mount(SmallViewAffordance, { target, props: { host } });
    lifetime.add(() => {
      void unmount(component);
    });
  }
}
