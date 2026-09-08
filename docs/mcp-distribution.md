# 3D Visualizer distribution

The public product name is **3D Visualizer** and the MCP identifier is
`io.github.kleinicke/3d-visualizer`. The existing GitHub repository,
`ply-visualizer` PyPI distribution, `ply_visualizer` import, resource URIs and
`ply-viewer*` commands remain compatible. New CLI aliases are `3d-visualizer`,
`3d-visualizer-mcp` and `3d-visualizer-api`.

## Installation

```sh
uvx --from 'ply-visualizer[mcp]==0.4.1' 3d-visualizer-mcp --root /absolute/data/directory
```

Local MCP needs Python 3.10+ (uv can manage Python). Inline interactive previews
need an MCP Apps host with WebGL; otherwise explicitly open the browser viewer.
The server has authenticated HTTP support for self-hosting, but the website is
not a publicly hosted MCP endpoint. No hosted endpoint should be entered in a
directory until it is actually deployed and tested.

## Registry metadata

- `server.json`: official registry entry, PyPI package, icon and required data
  directory. Registry runners use
  `uvx --with 'mcp>=2.2,<3' ply-visualizer==0.4.1 --root /absolute/data/directory`.
  The matching `ply-visualizer` executable starts MCP, while `ply-viewer` opens
  the CLI viewer.
- `packages/python/README.md`: ownership marker required in the published PyPI
  description. Changing this marker requires a new package release.
- `glama.json`: maintainer claim using Glama's published schema.
- `packages/mcpb`: MCPB 0.4 UV bundle for local desktop distribution. Build with
  `python3 scripts/build-mcp-bundle.py --out /tmp/3d-visualizer-0.4.1.mcpb`. The
  builder uses an explicit file allowlist and checks release versions.

Before each release, synchronize the Python version, diagnostics version,
`server.json`, MCPB manifest and pinned bundle dependency. Build and validate
wheel/sdist, smoke-test the launch commands, then publish the package before
publishing registry metadata. Credentials must remain outside version control.

## Listing copy

**Name:** 3D Visualizer

**Short description:** Inspect, compare and export point clouds, meshes and
calibrated depth data with inline 3D previews.

**Repository:** https://github.com/kleinicke/ply-visualizer

**Docs:**
https://github.com/kleinicke/ply-visualizer/blob/main/packages/python/MCP.md

**Package:** https://pypi.org/project/ply-visualizer/

**Suggested categories:** Data Visualization; Developer Tools; AI & Machine
Learning.

**Keywords:** 3D, point cloud, mesh, PLY, PCD, depth, disparity, COLMAP, NumPy,
PyTorch, MCP Apps.

**Example tasks:** inspect an unknown scan; isolate and export a labeled object;
compare prediction and target; convert depth using calibration from companion
files. Calibration is explicit, never inferred from image pixels alone.

## Submission destinations

- [Official registry](https://modelcontextprotocol.io/registry/quickstart):
  authenticate with `mcp-publisher login github`, then
  `mcp-publisher publish server.json`.
- [Glama](https://glama.ai/mcp/servers): sign in and choose Add Server, using
  the repository URL and listing copy above.
- [Smithery](https://smithery.ai/docs/build/publish): publish the local bundle
  with
  `smithery mcp publish /tmp/3d-visualizer-0.4.1.mcpb -n kleinicke/3d-visualizer`.
- [Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers): submit
  one alphabetical entry in Data Visualization via a pull request.
- [MCP.so](https://mcp.so/submit): submit via its form or a server-submission
  issue in `chatmcp/mcpso`.

Directory submissions pending moderation are not confirmed published listings.
Registry discovery does not automatically install the server into every client.
