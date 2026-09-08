// Desktop-only source adaptation. Fail on upstream changes rather than silently
// reintroducing a compatibility codec or changing the synchronous call graph.
export function withoutUpng(file, input) {
  let source = input;
  const replace = (before, after) => {
    if (!source.includes(before))
      throw new Error(`PNG adaptation boundary changed in ${file}: ${before.slice(0, 60)}`);
    source = source.replace(before, after);
  };
  if (file.endsWith('/layered-preview-decoders.ts')) {
    replace(
      "import UPNG from 'upng-js';",
      "import { decodeEmbeddedPng, mapSequential } from 'desktop-native-png';"
    );
    const start = source.indexOf('function decodePngRgba(');
    const end = source.indexOf('\nfunction xmlAttribute', start);
    if (start < 0 || end < 0) throw new Error('Embedded PNG boundary changed');
    source =
      source.slice(0, start) + 'const decodePngRgba = decodeEmbeddedPng;\n' + source.slice(end);
    for (const name of [
      'decodeOraResult',
      'archivePreviewResult',
      'decodeAffinityPreview',
      'decodeLayeredPreview',
    ]) {
      replace(`function ${name}(`, `async function ${name}(`);
      const start = source.indexOf(`async function ${name}(`);
      const type = source.indexOf('): DecodedLayeredPreview {', start);
      if (type < 0) throw new Error(`Missing return type for ${name}`);
      source =
        source.slice(0, type) +
        source
          .slice(type)
          .replace('): DecodedLayeredPreview {', '): Promise<DecodedLayeredPreview> {');
    }
    replace(
      'const buildNodes = (nodes: OraXmlNode[]',
      'const buildNodes = async (nodes: OraXmlNode[]'
    );
    replace(
      '): LayerNodeSummary[] => nodes.map(node => {',
      '): Promise<LayerNodeSummary[]> => mapSequential(nodes, async node => {'
    );
    replace('summary.children = buildNodes(', 'summary.children = await buildNodes(');
    replace('const root = buildNodes(xmlRoots);', 'const root = await buildNodes(xmlRoots);');
    replace('const png = decodePngRgba(bytes);', 'const png = await decodePngRgba(bytes);');
    replace('? decodePngRgba(previewBytes)', '? await decodePngRgba(previewBytes)');
    replace(
      'const decoded = decodePngRgba(best.bytes);',
      'const decoded = await decodePngRgba(best.bytes);'
    );
    replace('const result = decodeOraResult(', 'const result = await decodeOraResult(');
    source = source.replaceAll(
      'result = archivePreviewResult(',
      'result = await archivePreviewResult('
    );
    replace('result = decodeAffinityPreview(', 'result = await decodeAffinityPreview(');
  } else if (file.endsWith('/png-processor.ts')) {
    replace(
      'async (b) => (await loadUpng()).decode(b)',
      "async () => { throw new Error('Precise PNG decoding failed in the Rust decoder'); }"
    );
    replace(
      "console.error('UPNG.js processing failed, falling back to browser Image API:', error);\n            return this._processWithNativeAPI(src);",
      'throw error;'
    );
  } else if (file.endsWith('/decode-worker.ts')) {
    const start = source.indexOf('function decodePng16Upng(');
    const end = source.indexOf('\nasync function decodePng16(', start);
    if (start < 0 || end < 0) throw new Error('PNG worker boundary changed');
    source =
      source.slice(0, start) +
      "function decodePng16Upng(_buffer: ArrayBuffer, error = '') { throw new Error(error || 'Rust PNG decoder unavailable'); }\n" +
      source.slice(end);
  }
  return source;
}
