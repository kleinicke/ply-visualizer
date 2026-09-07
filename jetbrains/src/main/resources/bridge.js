/* Thin prototype adapter: deliver the IDE's selected file through each viewer's
 * existing file input. No decoder, renderer or privileged browser API is added. */
window.addEventListener(
  'load',
  async () => {
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
      const [source, filename] = await Promise.all([fetch('../source'), fetch('../filename')]);
      if (!source.ok || !filename.ok) throw new Error('The selected file could not be read');
      const transfer = new DataTransfer();
      transfer.items.add(new File([await source.blob()], await filename.text()));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      document.documentElement.dataset.jetbrainsFileDelivered = 'true';
    } catch (error) {
      const message = document.createElement('div');
      message.setAttribute('role', 'alert');
      message.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:100000;padding:12px;background:#722;color:white';
      message.textContent = `Could not open the IDE file: ${error.message}`;
      document.body.append(message);
    }
  },
  { once: true }
);
