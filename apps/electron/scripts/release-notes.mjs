// Prints the GitHub release notes for a desktop tag: that version's section of
// CHANGELOG.md, then the fixed text in release-notes.md (downloads, signing).
//
//   node scripts/release-notes.mjs desktop-v0.1.5 [owner/repo]
//
// Fails when the changelog has no section for the version, so a release is
// never published without its changes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [tag, repo = process.env.GITHUB_REPOSITORY || 'deivse/ply-visualizer'] = process.argv.slice(2);
const version = /^desktop-v(.+)$/.exec(tag ?? '')?.[1];
if (!version) {
  console.error('usage: release-notes.mjs desktop-v<version> [owner/repo]');
  process.exit(2);
}

const changelog = fs.readFileSync(path.join(appDir, 'CHANGELOG.md'), 'utf8');
const sections = changelog.split(/^## /m).slice(1);
const section = sections.find(s => s.split('\n', 1)[0].trim() === version);
if (!section) {
  console.error(`CHANGELOG.md has no "## ${version}" section`);
  process.exit(1);
}
const changes = section.slice(section.indexOf('\n') + 1).trim();

const template = fs
  .readFileSync(path.join(appDir, 'release-notes.md'), 'utf8')
  .replaceAll('{{REPO_URL}}', `https://github.com/${repo}`)
  .replaceAll('{{TAG}}', tag)
  .trim();

process.stdout.write(`## What's new in ${version}\n\n${changes}\n\n---\n\n${template}\n`);
