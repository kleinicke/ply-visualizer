import * as vscode from 'vscode';

export function renderWebviewHtml(
  html: string,
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  plyPrefetchUri?: { uri: string; size: number },
  depthPrefetchUri?: string,
  depthPrefetchSize?: number,
  webHost = false
): string {
  // Get URIs for VSCode webview resources
  const scriptPathOnDisk = vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'main.js');
  const scriptUri = webview.asWebviewUri(scriptPathOnDisk).toString();

  const stylePathOnDisk = vscode.Uri.joinPath(extensionUri, 'engine', 'media', 'style.css');
  const styleUri = webview.asWebviewUri(stylePathOnDisk).toString();
  const componentStyleUri = webview
    .asWebviewUri(vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'bundle.css'))
    .toString();

  // Rust/WASM TIFF/EXR/PNG16 decoder (ported from the tiff-visualizer sister
  // extension; the only image decoder in the webview). The glue defines a
  // global wasm_bindgen; the webview fetches the .wasm binary from this URI
  // at init time.
  const tiffWasmGlueOnDisk = vscode.Uri.joinPath(
    extensionUri,
    'engine',
    'media',
    'wasm',
    'tiff_wasm.js'
  );
  const tiffWasmGlueUri = webview.asWebviewUri(tiffWasmGlueOnDisk).toString();
  const tiffWasmBinaryOnDisk = vscode.Uri.joinPath(
    extensionUri,
    'engine',
    'media',
    'wasm',
    'tiff_wasm_bg.wasm'
  );
  const tiffWasmBinaryUri = webview.asWebviewUri(tiffWasmBinaryOnDisk).toString();

  // Use a nonce to only allow specific scripts to be run
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');

  // VSCode-specific modifications to the HTML:
  // 1. Add Content Security Policy. 'wasm-unsafe-eval' is required to compile
  //    the TIFF decoder WebAssembly module; connect-src already allows
  //    fetching the .wasm binary from the webview resource origin.
  //    connect-src blob: allows explicitly supplied GLTF buffers and textures.
  //    connect-src data: is for Spark (gaussian splats), which fetches its
  //    inlined WASM sorter from a data:application/wasm URL.
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; connect-src ${webview.cspSource} https: data: blob:; worker-src ${webview.cspSource} blob:; script-src 'nonce-${nonce}' ${webview.cspSource} 'wasm-unsafe-eval'; img-src ${webview.cspSource} https: blob: data:; font-src ${webview.cspSource};">`;
  html = html.replace('<meta name="viewport"', `${cspMeta}\n    <meta name="viewport"`);

  // 2. Replace resource URLs with webview URIs
  html = html.replace(/href="media\/style\.css"/, `href="${styleUri}"`);
  html = html.replace(/href="bundle\.css"/, `href="${componentStyleUri}"`);
  html = html.replace(
    /src="media\/wasm\/tiff_wasm\.js"/,
    `nonce="${nonce}" src="${tiffWasmGlueUri}"`
  );
  // Point the webview at the webview-resource URI for the .wasm binary.
  html = html.replace(
    /window\.__TIFF_WASM_GLUE_URL__ = window\.__TIFF_WASM_GLUE_URL__ \|\| 'media\/wasm\/tiff_wasm\.js';/,
    `window.__TIFF_WASM_GLUE_URL__ = '${tiffWasmGlueUri}';`
  );
  html = html.replace(
    /window\.__TIFF_WASM_URL__ = window\.__TIFF_WASM_URL__ \|\| 'media\/wasm\/tiff_wasm_bg\.wasm';/,
    `window.__TIFF_WASM_URL__ = '${tiffWasmBinaryUri}';`
  );
  // Add the nonce to the inline bootstrap script that sets __TIFF_WASM_URL__.
  html = html.replace(
    /<script>\s*\n\s*\/\/ Default WASM binary location/,
    `<script nonce="${nonce}">\n      // Default WASM binary location`
  );
  // The webview has no URL query string, so the engine's `?webgpu=1` switch
  // is unreachable here; the setting is forwarded as the global instead.
  // Injected before bundle.js because the viewer reads it while booting.
  const useWebGPU = vscode.workspace
    .getConfiguration('plyViewer')
    .get<boolean>('experimentalWebGPU', false);
  // A local binary PLY is fetched by the page itself; naming it here lets
  // that fetch start while the viewer boots (see startPlyPrefetch).
  const prefetch =
    (plyPrefetchUri
      ? `window.__PLY_PREFETCH__ = ${JSON.stringify(plyPrefetchUri.uri)};\n      ` +
        `window.__PLY_PREFETCH_SIZE__ = ${plyPrefetchUri.size};\n      `
      : '') +
    (depthPrefetchUri
      ? `window.__DEPTH_PREFETCH__ = ${JSON.stringify(depthPrefetchUri)};\n      ` +
        (depthPrefetchSize !== undefined
          ? `window.__DEPTH_PREFETCH_SIZE__ = ${depthPrefetchSize};\n      `
          : '')
      : '');
  html = html.replace(
    /window\.__TIFF_WASM_URL__ = '/,
    `window.__PLY_WEB_HOST__ = ${webHost};\n      window.__PLY_WEBGPU__ = ${useWebGPU};\n      ${prefetch}window.__TIFF_WASM_URL__ = '`
  );
  html = html.replace(/src="bundle\.js"/, `nonce="${nonce}" src="${scriptUri}"`);

  // 3. Remove browser-specific elements (file input, navigation links)
  // Note: Theme selector is now handled by JS (checking isVSCode) rather than removing HTML
  html = html.replace(
    /<input[^>]*id="hiddenFileInput"[^>]*>/,
    '<!-- File input removed in VSCode -->'
  );
  html = html.replace(/<div class="bottom-right-nav">[\s\S]*?<\/div>/, '');
  html = html.replace(/<div id="welcome-message-mount"><\/div>/, '');

  return html;
}
