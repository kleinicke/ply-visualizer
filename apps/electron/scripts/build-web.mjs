// Builds the shared engine's standalone page and adapts it for the desktop
// host: no analytics, no website-only links/metadata, plus the desktop glue.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const engineDir = path.resolve(appDir, '..', '..', 'engine');
const dist = path.join(engineDir, 'dist');
const out = path.join(appDir, 'web');

if (!process.argv.includes('--skip-engine')) {
  // Run webpack's CLI through this Node binary: no shell, no `npx` (which is a
  // .cmd script on Windows and cannot be spawned directly there).
  const webpackCli = createRequire(path.join(engineDir, 'package.json')).resolve('webpack-cli/bin/cli.js');
  execFileSync(process.execPath, [webpackCli, '--mode=production'], { cwd: engineDir, stdio: 'inherit' });
}

fs.rmSync(out, { recursive: true, force: true });
const skip = new Set(['robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'examples']);
fs.cpSync(dist, out, {
  recursive: true,
  filter: src => !src.endsWith('.map') && !skip.has(path.basename(src)),
});

let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const strip = (pattern, label) => {
  const next = html.replace(pattern, '');
  if (next === html) {
    throw new Error(`build-web: expected to strip ${label} from index.html`);
  }
  html = next;
};
strip(/\s*<script async src="https:\/\/analytics[^"]*"><\/script>/, 'analytics loader');
strip(/\s*<script>\s*\(\(window\.plausible[\s\S]*?<\/script>/, 'analytics init');
strip(/\s*<link rel="canonical"[^>]*>/, 'canonical link');
strip(/\s*<link rel="manifest"[^>]*>/, 'manifest link');
html = html.replace(/\s*<meta (property="og:|name="twitter:|name="apple-)[^>]*>/g, '');
html = html.replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '');
strip(/\s*<div class="bottom-right-nav">[\s\S]*?<\/div>/, 'website footer links');
html = html.replace(/<title>[^<]*<\/title>/, '<title>PLY Visualizer</title>');
html = html.replace(
  '<script src="bundle.js"></script>',
  '<script src="bundle.js"></script>\n    <script src="loadBudget.js"></script>\n    <script src="desktop.js"></script>'
);
if (!html.includes('desktop.js')) {
  throw new Error('build-web: could not inject desktop.js');
}
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(path.join(appDir, 'src', 'desktop.js'), path.join(out, 'desktop.js'));
fs.copyFileSync(path.join(appDir, 'src', 'loadBudget.js'), path.join(out, 'loadBudget.js'));
console.log(`build-web: wrote ${out}`);
