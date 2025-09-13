import { ExTester } from 'vscode-extension-tester';
import * as path from 'path';

async function main(): Promise<void> {
  try {
    const extester = new ExTester();

    // Download and install VS Code
    await extester.downloadCode();

    // Download and install ChromeDriver
    await extester.downloadChromeDriver();

    // Install the extension
    await extester.installVsix({
      vsixFile: path.resolve(__dirname, '../../ply-visualizer-1.1.2.vsix'),
      useYarn: false,
    });

    // Run the UI tests
    await extester.runTests(path.resolve(__dirname, 'ui'));
  } catch (error) {
    console.error('UI test execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
