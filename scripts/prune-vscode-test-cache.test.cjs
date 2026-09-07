const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prune } = require('./prune-vscode-test-cache.cjs');

test('prunes old complete runtimes while protecting selected, running and unrelated data', () => {
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-prune-'));
  try {
    for (const name of [
      'vscode-current',
      'vscode-old',
      'vscode-running',
      'vscode-downloading',
      'user-data',
    ]) {
      fs.mkdirSync(path.join(cache, name));
      if (name !== 'vscode-downloading')
        fs.writeFileSync(path.join(cache, name, 'is-complete'), '');
    }
    const executable = path.join(cache, 'vscode-current', 'Code');
    fs.writeFileSync(executable, '');
    fs.symlinkSync(path.join(cache, 'vscode-old'), path.join(cache, 'vscode-link'), 'junction');
    assert.throws(() => prune(cache, path.join(cache, '..', 'Code'), ''));
    assert.deepEqual(prune(cache, executable, path.join(cache, 'vscode-running', 'Code')), [
      'vscode-old',
    ]);
    assert.deepEqual(fs.readdirSync(cache).sort(), [
      'user-data',
      'vscode-current',
      'vscode-downloading',
      'vscode-link',
      'vscode-running',
    ]);
  } finally {
    fs.rmSync(cache, { recursive: true, force: true });
  }
});
