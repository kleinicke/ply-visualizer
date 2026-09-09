# 3D Visualizer MCP bundle

This MCPB 0.4 bundle uses the host’s UV runtime to install the pinned PyPI
package. Choose a data directory during installation. Inline viewing requires an
MCP Apps host with WebGL support; ordinary MCP support alone does not guarantee
inline rendering. Other hosts use headless Chromium for PNG captures. Install
Chromium once using the command in the
[MCP quickstart](https://github.com/kleinicke/ply-visualizer/blob/main/packages/python/MCP.md).
The bundle does not host a public HTTP endpoint. Development bundles depend on
an unpublished version until the corresponding release is published.

Build from the repository root with
`python3 scripts/build-mcp-bundle.py --out /tmp/3d-visualizer.mcpb`. Only the
manifest, launcher, dependency declaration, README, license and icon are
packaged. Local environments, credentials and datasets are excluded.
