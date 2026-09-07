# Local MCP integration

The current checkout includes an **unpublished MCP Apps preview**
(`0.3.0.dev0`). The public `0.2.0` release provides browser-tab tools and
screenshots.

The optional MCP server lets an agent use the shared 3D viewer and inspect its
actual rendered output. Python 3.10+, uv, and a local WebGL browser are
required. The package bundles its renderer; users need no Node.js installation.

## Connect an agent

Add this server to your MCP client's configuration (clients using `mcpServers`
accept the following shape; others have a server settings form):

```json
{
  "mcpServers": {
    "ply-visualizer": {
      "command": "uvx",
      "args": [
        "--from",
        "ply-visualizer[mcp]==0.2.0",
        "ply-viewer-mcp",
        "--root",
        "/absolute/path/to/your/workspace"
      ]
    }
  }
}
```

Replace the workspace path. Repeat `--root` to allow multiple directories.
Relative file paths resolve against the first root. Symlinks resolving outside
these roots are rejected. Without `--root`, the current directory is allowed. Do
not configure the filesystem root unless you intend to allow all files.

For a persistent installation, use `uv tool install "ply-visualizer[mcp]"`, then
configure `ply-viewer-mcp` directly. For development, replace the `--from` value
with `/absolute/path/to/checkout/packages/python` and use uv's
`--with "mcp>=2.2,<3"` option after building the viewer assets.

The client owns the stdio process. Running the command manually waits for MCP
messages, and stdout is reserved for that protocol. Closing the client releases
its scenes and local servers.

## Available tools

| Tool               | Purpose                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `open_3d_files`    | Open local point clouds, meshes or splats together                  |
| `visualize_points` | Show XYZ arrays, RGB, prediction/target overlays and vectors        |
| `update_3d_scene`  | Replace geometry in the same view, preserving its camera            |
| `list_3d_scenes`   | Find this process's scene IDs and URLs                              |
| `inspect_3d_scene` | Read rendered counts, bounds, camera and revision                   |
| `set_3d_camera`    | Fit the scene or apply position, target and optional up vector      |
| `capture_3d_view`  | Return the actual canvas as a PNG image, up to 1024 pixels per side |
| `close_3d_scene`   | Release the scene's server and temporary data                       |

`viewer://capabilities` lists supported formats, allowed roots and the workflow.
Up to eight scenes are retained. Inline arrays are limited to 20,000 XYZ rows
per argument; use local files for larger scenes. RGB values are integers 0–255.
PyTorch/NumPy data in an agent's Python environment can use the Python API
directly; MCP JSON does not carry live tensor objects.

## Suggested agent instructions

Copy into your agent's project instructions:

> Use ply-visualizer when interactive 3D inspection would help explain or verify
> point clouds, meshes, splats, predictions or vector fields. Prefer file paths
> for large geometry. Reuse scene IDs for iterative updates. After opening a
> scene, inspect it and compare rendered_revision with the submitted revision;
> capture the view to assess the actual output. Adjust the camera as needed. A
> submitted scene is not proof that it rendered successfully. Close scenes when
> they are no longer needed.

For example: “Open scan.ply with ply-visualizer, fit the camera, and show me a
screenshot. Describe any visible holes.” Tool availability and these
instructions help an agent choose the viewer; installation alone does not make
every AI use it.

## Display and lifetime

The viewer opens a browser on the MCP server's machine. `open_browser=false`
returns a URL for the client/user to open. Inspection, camera and capture calls
wait up to 15 seconds for that browser tab. Keep it active if your browser
throttles background tabs. Multiple tabs can show a scene; the first responding
tab supplies each tool result. Paused views may report an older rendered
revision.

Files stay local. The server binds to loopback, checks request origin/host, and
uses a random session URL. Treat that URL as access to the scene.

The development version also supplies `ui://ply-visualizer/viewer.html` with MCP
Apps tool metadata and a bundled HTML resource. Its Svelte shell uses the
official MCP Apps SDK and embeds the existing local renderer with settings
collapsed. Updates retain the view and camera. An **Open in browser** button
asks the host to open the scene externally.

When a client advertises MCP Apps support, scene tools default to inline display
without opening a second tab. Set `open_browser=true` to explicitly open a tab,
or `false` to suppress it. Clients without Apps support keep the browser
default.

This local preview requests `frameDomains: ["http://127.0.0.1:*"]` because each
scene has a different loopback port. The shell validates loopback URLs and
session paths before embedding them. Hosts may reject nested frames, loopback
access, or HTTP content; the browser fallback is needed in those cases. Closing
the chat panel does not close the scene; use `close_3d_scene` when finished.

The browser and server must run on the same computer. A remote agent needs a
separate transport/display solution. Compatibility is verified with an MCP Apps
protocol test host; individual chat clients have not yet been verified. Local
Jupyter already has an inline iframe with settings collapsed by default; see
[notebook usage](README.md#inline-jupyter-notebooks).

## Try the unpublished checkout

```sh
npm run build:python-viewer
uv tool install --force "./packages/python[mcp]"
```

Configure the client command as `ply-viewer-mcp` with arguments
`["--root", "/absolute/workspace"]`. This uses the local development build; the
pinned PyPI command above continues to install the published browser version.
Nothing is uploaded by these commands.
