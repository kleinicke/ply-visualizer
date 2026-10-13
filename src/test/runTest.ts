import * as path from 'path';
import { downloadAndUnzipVSCode, runTests } from '@vscode/test-electron';
import { execFileSync } from 'child_process';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';

async function main() {
  const workspace = await mkdtemp(path.join(tmpdir(), 'ply-test-workspace-'));
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

    const manifest = JSON.parse(
      await readFile(path.join(extensionDevelopmentPath, 'package.json'), 'utf8')
    );
    const minimum = manifest.engines.vscode.match(/\d+\.\d+\.\d+/)?.[0];
    const requested = process.env.VSCODE_TEST_VERSION ?? 'stable';
    if (requested === 'minimum' && !minimum) {
      throw new Error('No minimum VS Code version declared');
    }
    const version = requested === 'minimum' ? minimum : requested;
    const vscodeExecutablePath = await downloadAndUnzipVSCode({
      version,
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
      launchArgs: [
        workspace,
        '--disable-workspace-trust',
        // Hosted Linux CI has no physical GPU. Explicit software WebGL keeps
        // real-webview tests independent of Electron's changing GPU defaults.
        ...(process.env.VSCODE_TEST_SOFTWARE_GL === '1'
          ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
          : []),
      ],
    });
  } catch (err) {
    console.error('Failed to run tests');
    process.exitCode = 1;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

main();
