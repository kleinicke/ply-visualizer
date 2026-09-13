/** Focused, real extension-host integration run. */
const path = require('node:path');
const fs = require('node:fs');
const { downloadAndUnzipVSCode, runTests } = require('@vscode/test-electron');
const root = path.resolve(__dirname, '..');
exports.run = async () => {
  const Mocha = require('mocha');
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 180000 });
  mocha.addFile(path.join(root, 'out/src/test/suite/nativeAgent.test.js'));
  await new Promise((resolve, reject) =>
    mocha.run(failures =>
      failures ? reject(new Error(`${failures} native agent tests failed`)) : resolve()
    )
  );
};
if (require.main === module) {
  (async () => {
    delete process.env.ELECTRON_RUN_AS_NODE;
    let executable =
      process.env.VSCODE_EXECUTABLE_PATH ||
      (await downloadAndUnzipVSCode({ cachePath: path.join(root, '.vscode-test') }));
    if (!fs.existsSync(executable)) {
      executable = path.join(path.dirname(executable), 'Code');
    }
    await runTests({
      vscodeExecutablePath: executable,
      extensionDevelopmentPath: root,
      extensionTestsPath: __filename,
      launchArgs: [
        root,
        '--disable-workspace-trust',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-extensions',
      ],
    });
  })().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
