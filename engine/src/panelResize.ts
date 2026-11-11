import type { ViewerLifetime } from './utils/viewerLifetime';
import { maskPointerInput } from './utils/pointerMask';

/**
 * Lets the right-anchored main panel be resized from its left edge (width),
 * bottom edge (height) and bottom-left corner (both). Double-click a handle to
 * return to the automatic size. The size is remembered per installation.
 */
const KEY = 'ply-visualizer.mainPanelSize.v1';
const MIN_W = 240;
const MIN_H = 160;

export function installPanelResize(lifetime: ViewerLifetime, panel: HTMLElement): void {
  let size: { w: number | null; h: number | null } = { w: null, h: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      size = {
        w: Number.isFinite(parsed.w) ? parsed.w : null,
        h: Number.isFinite(parsed.h) ? parsed.h : null,
      };
    }
  } catch {
    // storage unavailable: start at the automatic size
  }

  const apply = () => {
    const maxW = window.innerWidth - 20;
    const maxH = window.innerHeight - 20;
    panel.style.width = size.w === null ? '' : `${Math.max(MIN_W, Math.min(size.w, maxW))}px`;
    panel.style.height = size.h === null ? '' : `${Math.max(MIN_H, Math.min(size.h, maxH))}px`;
    panel.classList.toggle('panel-fixed-height', size.h !== null);
  };
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(size));
    } catch {
      // ignore
    }
  };

  const handles: HTMLElement[] = [];
  for (const edge of ['left', 'bottom', 'corner'] as const) {
    const handle = document.createElement('div');
    handle.className = `panel-resize-handle panel-resize-${edge}`;
    handle.title = 'Drag to resize · double-click to reset';
    handle.draggable = false;
    panel.appendChild(handle);
    handles.push(handle);
    // Never start a native drag-and-drop or text selection from a handle: on
    // macOS a stray one can leave the window ignoring clicks.
    handle.addEventListener('dragstart', event => event.preventDefault());
    handle.addEventListener('selectstart', event => event.preventDefault());

    handle.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      const rect = panel.getBoundingClientRect();
      const unmask = maskPointerInput(getComputedStyle(handle).cursor);
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      const startX = event.clientX;
      const startY = event.clientY;
      const move = (e: PointerEvent) => {
        if (edge !== 'bottom') {
          size.w = rect.width - (e.clientX - startX);
        }
        if (edge !== 'left') {
          size.h = rect.height + (e.clientY - startY);
        }
        // No synthetic window resize: that would re-anchor the scene's view
        // offset and slide the point cloud while the panel is dragged.
        apply();
      };
      let ended = false;
      const up = () => {
        if (ended) {
          return;
        }
        ended = true;
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        handle.removeEventListener('lostpointercapture', up);
        document.body.style.userSelect = previousUserSelect;
        unmask();
        save();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
      // Capture can be lost without a pointerup (gestures, focus changes).
      handle.addEventListener('lostpointercapture', up);
    });
    handle.addEventListener('dblclick', () => {
      if (edge !== 'bottom') {
        size.w = null;
      }
      if (edge !== 'left') {
        size.h = null;
      }
      apply();
      save();
    });
  }

  apply();
  lifetime.listen(window, 'resize', apply);
  lifetime.add(() => handles.forEach(handle => handle.remove()));
}
