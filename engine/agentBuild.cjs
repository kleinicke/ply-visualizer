const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const webpack = require('webpack');
const root = path.resolve(__dirname, '..');
const hash = crypto.createHash('sha256');
function visit(folder) {
  for (const entry of fs
    .readdirSync(folder, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) visit(file);
    else {
      hash.update(path.relative(root, file));
      hash.update(fs.readFileSync(file));
    }
  }
}
visit(path.join(__dirname, 'src'));
hash.update(
  fs.readFileSync(path.join(root, 'wasm/pointcloud-parser/pkg-web/pointcloud_parser_bg.wasm'))
);
const version = fs
  .readFileSync(path.join(root, 'packages/python/pyproject.toml'), 'utf8')
  .match(/^version = "([^"]+)"/m)[1];
let commit = 'unknown';
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
} catch {}
const info = {
  package_version: version,
  commit,
  renderer_build_id: hash.update(version).digest('hex').slice(0, 20),
};
class BuildInfoPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('AgentBuildInfo', compilation => {
      compilation.hooks.processAssets.tap(
        { name: 'AgentBuildInfo', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => {
          compilation.emitAsset(
            'build-info.json',
            new webpack.sources.RawSource(JSON.stringify(info))
          );
        }
      );
    });
  }
}
module.exports = [
  new webpack.DefinePlugin({ __PLY_BUILD_INFO__: JSON.stringify(info) }),
  new BuildInfoPlugin(),
];
