const path = require('path');
const { runTests } = require('@vscode/test-web');
const fs = require('fs');
const { format } = require('util');
const extensionPath = path.resolve(
  process.env.PLY_WEB_EXTENSION_PATH || path.resolve(__dirname, '..')
);
const original = { log: console.log, info: console.info, debug: console.debug };
for (const method of Object.keys(original)) {
  console[method] = (...args) => {
    const match = format(...args).match(/(?:^|\n)WEB_CAPTURE_PNG ([A-Za-z0-9+/=]+)(?:$|\n)/);
    if (match) {
      const target = path.resolve(__dirname, '../.vscode-test/web/viewer.png');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(match[1], 'base64'));
      original.log(`Web viewer capture: ${target}`);
    } else {
      original[method](...args);
    }
  };
}
runTests({
  browserType: 'chromium',
  quality: 'stable',
  headless: true,
  extensionDevelopmentPath: extensionPath,
  extensionTestsPath: path.join(extensionPath, 'out/web-test/index.js'),
  folderPath: path.resolve(__dirname, '../engine/examples'),
  testRunnerDataDir: path.resolve(__dirname, '../.vscode-test/web'),
})
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    Object.assign(console, original);
  });
