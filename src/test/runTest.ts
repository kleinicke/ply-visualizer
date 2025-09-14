import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    // __dirname at runtime is .../out/src/test
    // We need the repository root as the extension development path
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Download VS Code, unzip it and run the integration test
    await runTests({
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
