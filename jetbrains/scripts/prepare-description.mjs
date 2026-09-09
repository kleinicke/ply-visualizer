import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

const readmeUrl = new URL('../../README.md', import.meta.url);
const outputUrl = new URL('../build/marketplace-description.html', import.meta.url);
const repository = 'https://github.com/kleinicke/ply-visualizer/';
const markdown = new MarkdownIt();
// The general README media demonstrates VS Code and must not appear on Marketplace.
markdown.renderer.rules.image = () => "";
const normalizeLink = markdown.normalizeLink.bind(markdown);
markdown.normalizeLink = (url) => {
  if (url.startsWith('#')) {
    return normalizeLink(`${repository}blob/main/README.md${url}`);
  }
  if (!/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) {
    return normalizeLink(new URL(url, `${repository}blob/main/`).href);
  }
  return normalizeLink(url);
};

const html = markdown.render(await readFile(readmeUrl, 'utf8'));
await mkdir(new URL('.', outputUrl), { recursive: true });
await writeFile(outputUrl, html);
console.log(`Generated marketplace description: ${fileURLToPath(outputUrl)}`);
