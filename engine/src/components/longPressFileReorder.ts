import { fileRows, type FileItemHost } from './fileListTypes';

/** Hold the file header or its surrounding border/padding; short clicks retain their native behavior. */
export function longPressFileReorder(
  node: HTMLElement,
  options: { host: FileItemHost; entryId: number }
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pointer: number | null = null;
  let startX = 0;
  let startY = 0;
  let y = 0;
  let active = false;
  let suppressClick = false;
  let frame = 0;
  let beforeId: number | null = null;
  let marker: HTMLDivElement | null = null;
  const row = node.closest<HTMLElement>('.file-item')!;
  const list = node.closest<HTMLElement>('#file-list')!;

  function paint() {
    if (!active) {
      return;
    }
    const rows = [...list.querySelectorAll<HTMLElement>('[data-entry-id]')].filter(
      item => Number(item.dataset.entryId) !== options.entryId
    );
    const target = rows.find(item => {
      const rect = item.getBoundingClientRect();
      return y < rect.top + rect.height / 2;
    });
    beforeId = target ? Number(target.dataset.entryId) : null;
    const rect = (target ?? rows.at(-1) ?? row).getBoundingClientRect();
    if (marker) {
      Object.assign(marker.style, {
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        top: `${target ? rect.top : rect.bottom}px`,
      });
    }
    // The scroll container can be the list or a surrounding sidebar.
    for (let parent: HTMLElement | null = list; parent; parent = parent.parentElement) {
      if (
        parent.scrollHeight <= parent.clientHeight ||
        !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)
      ) {
        continue;
      }
      const bounds = parent.getBoundingClientRect();
      parent.scrollTop += y < bounds.top + 32 ? -8 : y > bounds.bottom - 32 ? 8 : 0;
      break;
    }
    frame = requestAnimationFrame(paint);
  }

  function finish(commit = false) {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    if (active && commit) {
      const entries = fileRows(options.host, options.host.fileEntries.all).map(item => item.entry);
      const moving = entries.find(entry => entry.id === options.entryId);
      const remaining = entries.filter(entry => entry.id !== options.entryId);
      if (moving) {
        const index =
          beforeId === null
            ? remaining.length
            : remaining.findIndex(entry => entry.id === beforeId);
        remaining.splice(index < 0 ? remaining.length : index, 0, moving);
        remaining.forEach((entry, order) => {
          entry.state.listOrder = order;
        });
      }
    }
    active = false;
    row.style.removeProperty('opacity');
    node.style.removeProperty('cursor');
    marker?.remove();
    marker = null;
    const releasedPointer = pointer;
    pointer = null;
    if (releasedPointer !== null && node.hasPointerCapture(releasedPointer)) {
      node.releasePointerCapture(releasedPointer);
    }
  }
  function down(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }
    // Expanded settings keep their own pointer gestures (sliders, inputs, etc.).
    if (event.target instanceof Element && event.target.closest('.file-item-content')) {
      return;
    }
    finish();
    suppressClick = false;
    pointer = event.pointerId;
    startX = event.clientX;
    startY = y = event.clientY;
    timer = setTimeout(() => {
      if (pointer === null) {
        return;
      }
      active = true;
      suppressClick = true;
      node.setPointerCapture(pointer);
      row.style.opacity = '0.55';
      node.style.cursor = 'grabbing';
      marker = document.createElement('div');
      Object.assign(marker.style, {
        position: 'fixed',
        height: '2px',
        background: 'var(--vscode-focusBorder, #3794ff)',
        pointerEvents: 'none',
        zIndex: '10000',
      });
      document.body.append(marker);
      paint();
    }, 400);
  }
  function move(event: PointerEvent) {
    if (event.pointerId !== pointer) {
      return;
    }
    y = event.clientY;
    if (!active && Math.hypot(event.clientX - startX, y - startY) > 6) {
      finish();
    }
    if (active) {
      event.preventDefault();
    }
  }
  function up(event: PointerEvent) {
    if (event.pointerId === pointer) {
      finish(active);
    }
  }
  function cancel() {
    finish();
  }
  function key(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      finish();
    }
  }
  function click(event: MouseEvent) {
    if (!suppressClick) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }
  function resetClick() {
    suppressClick = false;
  }
  node.addEventListener('pointerdown', down);
  window.addEventListener('pointerdown', resetClick, true);
  window.addEventListener('click', click, true);
  node.addEventListener('lostpointercapture', cancel);
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', cancel);
  window.addEventListener('keydown', key);
  return {
    update(value: typeof options) {
      options = value;
    },
    destroy() {
      finish();
      node.removeEventListener('pointerdown', down);
      window.removeEventListener('click', click, true);
      window.removeEventListener('pointerdown', resetClick, true);
      node.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', key);
    },
  };
}
