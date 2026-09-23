// Preserve small native wheel deltas instead of waiting in JCEF's OSR accumulator.
// Custom image/panel wheel handlers still run; only unhandled default scrolling
// is performed here because synthetic DOM wheel events have no default action.
const panRemainders = new WeakMap();
window.jetbrainsScroll = (xRatio, yRatio, dx, dy) => {
  if (![xRatio, yRatio, dx, dy].every(Number.isFinite)) return;
  const x = xRatio * innerWidth,
    y = yRatio * innerHeight;
  const target = document.elementFromPoint(x, y) || document.body;
  const event = new WheelEvent('wheel', {
    clientX: x,
    clientY: y,
    deltaX: dx,
    deltaY: dy,
    bubbles: true,
    cancelable: true,
  });
  if (!target.dispatchEvent(event)) return;
  let scroller = target;
  while (scroller && scroller !== document.body) {
    const style = getComputedStyle(scroller);
    if (
      (dy &&
        /auto|scroll/.test(style.overflowY) &&
        scroller.scrollHeight > scroller.clientHeight) ||
      (dx && /auto|scroll/.test(style.overflowX) && scroller.scrollWidth > scroller.clientWidth)
    )
      break;
    scroller = scroller.parentElement;
  }
  if (!scroller || scroller === document.body) scroller = document.scrollingElement;
  if (!scroller) return;
  const remainder = panRemainders.get(scroller) || [0, 0];
  remainder[0] += dx;
  remainder[1] += dy;
  const sx = Math.trunc(remainder[0]),
    sy = Math.trunc(remainder[1]);
  remainder[0] -= sx;
  remainder[1] -= sy;
  panRemainders.set(scroller, remainder);
  scroller.scrollBy({ left: sx, top: sy, behavior: 'instant' });
};

/* Thin IDE adapter: deliver the IDE's selected file through each viewer's
 * existing file input. No decoder, renderer or privileged browser API is added. */
window.addEventListener(
  'load',
  async () => {
    let stage = 'viewer initialization';
    try {
      const input = document.querySelector('#hiddenFileInput');
      if (!input) throw new Error('Viewer file input is unavailable');
      if (input.id === 'hiddenFileInput') {
        const deadline = Date.now() + 30000;
        while (document.documentElement.dataset.visualizerReady !== 'true') {
          if (Date.now() > deadline) throw new Error('3D viewer initialization timed out');
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      stage = 'requesting file';
      const [source, filename] = await Promise.all([fetch('../source'), fetch('../filename')]);
      if (!source.ok || !filename.ok)
        throw new Error(`Source HTTP ${source.status}; filename HTTP ${filename.status}`);
      const transfer = new DataTransfer();
      stage = 'reading file bytes';
      // JCEF can reject large response.blob() reads despite a successful HTTP response.
      const bytes = await source.arrayBuffer();
      transfer.items.add(new File([bytes], await filename.text()));
      stage = 'delivering file to viewer';
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      document.documentElement.dataset.jetbrainsFileDelivered = 'true';
    } catch (error) {
      console.error(`[3D Visualizer] IDE file transfer failed (${stage}): ${error.stack || error}`);
      const message = document.createElement('div');
      message.setAttribute('role', 'alert');
      message.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:100000;padding:12px;background:#722;color:white';
      message.textContent = `Could not open the IDE file (${stage}): ${error.message}`;
      document.body.append(message);
    }
  },
  { once: true }
);
