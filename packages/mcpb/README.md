# 3D Visualizer MCP bundle

This MCPB 0.4 bundle uses the host’s UV runtime to install the pinned PyPI
package. Choose a data directory during installation. Inline viewing requires an
MCP Apps host with WebGL support; ordinary MCP support alone does not guarantee
inline rendering. The bundle does not host a public HTTP endpoint.

Build from the repository root with
`python3 scripts/build-mcp-bundle.py --out /tmp/3d-visualizer.mcpb`. Only the
manifest, launcher, dependency declaration, README, license and icon are
packaged. Local environments, credentials and datasets are excluded.
