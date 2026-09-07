// Keep the selected test runtime and any runtime still in use. Never touch
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
  const removed = [];
  for (const entry of fs.readdirSync(cache, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === keep || !/^vscode-[\w.-]+$/.test(entry.name))
      continue;
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
