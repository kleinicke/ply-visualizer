import * as path from 'path';
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';
import { execFileSync } from 'child_process';

async function main() {
  try {
    delete process.env.ELECTRON_RUN_AS_NODE;

    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    // __dirname at runtime is .../out/src/test
    // We need the repository root as the extension development path
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    const vscodeExecutablePath = await downloadAndUnzipVSCode({
      cachePath: path.join(extensionDevelopmentPath, '.vscode-test'),
      extensionDevelopmentPath,
    });
    execFileSync(
      process.execPath,
      [
        path.join(extensionDevelopmentPath, 'scripts/prune-vscode-test-cache.cjs'),
        vscodeExecutablePath,
      ],
      { stdio: 'inherit' }
    );

    // Run against the downloaded runtime retained by cache cleanup.
    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      // Do not disable extensions; we want our extension under development to load
      // Removing '--disable-extensions' ensures contributions are available during tests
      launchArgs: [],
    });
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();
