// Keep minimum, newest cached release, selected, and running test runtimes. Never touch
// profiles, extensions, symlinks, or incomplete downloads.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function prune(cache, executable, processes) {
  const relative = path.relative(cache, executable);
  const keep = relative.split(path.sep)[0];
  if (relative.startsWith('..') || path.isAbsolute(relative) || !keep.startsWith('vscode-')) {
    throw new Error('Selected executable must be inside the VS Code test cache');
  }
  if (!fs.existsSync(executable)) throw new Error('Selected VS Code executable does not exist');
  const minimum = require('../package.json').engines.vscode.match(/\d+\.\d+\.\d+/)[0];
  const entries = fs.readdirSync(cache, { withFileTypes: true });
  const completed = entries.filter(
    entry => entry.isDirectory() && fs.existsSync(path.join(cache, entry.name, 'is-complete'))
  );
  const versionOf = name => name.match(/^vscode-.*-(\d+\.\d+\.\d+)$/)?.[1];
  const versions = completed.map(entry => versionOf(entry.name)).filter(Boolean);
  versions.sort((a, b) => {
    const left = a.split('.').map(Number),
      right = b.split('.').map(Number);
    return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  });
  const stable = versions.at(-1);
  const removed = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === keep || !/^vscode-[\w.-]+$/.test(entry.name))
      continue;
    const version = versionOf(entry.name);
    if (version && (version === minimum || version === stable)) continue;
    const directory = path.join(cache, entry.name);
    if (!fs.existsSync(path.join(directory, 'is-complete'))) continue;
    if (processes.includes(directory)) continue;
    fs.rmSync(directory, { recursive: true });
    removed.push(entry.name);
  }
  return removed;
}

if (require.main === module) {
  try {
    const cache = path.resolve(__dirname, '../.vscode-test');
    // Fail closed when process inspection is unavailable (e.g. a sandbox).
    const processes =
      process.platform === 'win32'
        ? execFileSync(
            'powershell.exe',
            [
              '-NoProfile',
              '-Command',
              'Get-CimInstance Win32_Process | Select-Object -ExpandProperty CommandLine',
            ],
            { encoding: 'utf8' }
          )
        : execFileSync('ps', ['-axo', 'command'], { encoding: 'utf8' });
    const removed = prune(cache, path.resolve(process.argv[2]), processes);
    console.log(`VS Code cache: removed ${removed.length} old runtime(s).`);
  } catch (error) {
    // Cache housekeeping must not prevent tests from running.
    console.warn(`VS Code cache cleanup skipped: ${error.message}`);
  }
}
module.exports = { prune };
