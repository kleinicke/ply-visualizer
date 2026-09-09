# 3D Visualizer — MCP integration

Open a scene, inspect its rendered revision, and capture a PNG before describing
what is visible. A returned scene ID confirms submission, not successful
rendering.

This checkout targets the next release; the new `viz3d` import, profiles, doctor
and headless rendering are not part of the published 0.4.2 package. To try them:

```sh
npm run build:python-viewer
uv tool install --force './packages/python[mcp,headless]'
uvx --from './packages/python[headless]' playwright install chromium
3d-visualizer doctor --check-headless
```

<!-- prettier-ignore-start -->

<!-- agent-quickstart:start -->

### Agent installation

These examples target **0.5.0.dev0**. Development versions must be installed
from this checkout until published; do not assume an unreleased version exists on PyPI.

For agents, use `uv tool install` or `uvx`; `uv add` is for using the library
inside a Python project. Headless mode also needs Chromium installed once.

```sh
uv tool install "3d-visualizer[mcp,headless]==0.5.0.dev0"
uvx --from "3d-visualizer[headless]==0.5.0.dev0" playwright install chromium
3d-visualizer doctor --check-headless
```

Client configuration (replace the data directory):

```json
{
  "mcpServers": {
    "3d-visualizer": {
      "command": "uvx",
      "args": [
        "--from",
        "3d-visualizer[mcp,headless]==0.5.0.dev0",
        "3d-visualizer-mcp",
        "--root",
        "/absolute/path/to/data"
      ]
    }
  }
}
```

[Install in VS Code](vscode:mcp/install?%7B%22name%22%3A%223d-visualizer%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22uvx%22%2C%22args%22%3A%5B%22--from%22%2C%223d-visualizer%5Bmcp%2Cheadless%5D%3D%3D0.5.0.dev0%22%2C%223d-visualizer-mcp%22%2C%22--root%22%2C%22%24%7BworkspaceFolder%7D%22%5D%7D)

The VS Code link uses the current workspace as the allowed data root.

```sh
claude mcp add --transport stdio 3d-visualizer -- uvx --from "3d-visualizer[mcp,headless]==0.5.0.dev0" 3d-visualizer-mcp --root /absolute/path/to/data
```

The default `--tools core` exposes eight everyday tools. Use `--tools full`
for depth conversion, selections, animation, alignment and export.
`--renderer auto` uses an advertised MCP Apps host, otherwise offscreen
Chromium. Use `--renderer inline` to require a widget or explicit browser;
use `--renderer headless` for unattended work.
<!-- agent-quickstart:end -->

<!-- prettier-ignore-end -->

## Choose a rendering mode

- `auto` (default): use inline MCP Apps when the client advertises support;
  otherwise run offscreen Chromium on the MCP server.
- `inline`: wait for an MCP Apps widget. `open_browser=true` explicitly opens a
  local browser fallback. No automatic browser window opens.
- `headless`: render offscreen regardless of host capabilities, returning PNGs
  through MCP. No desktop, browser tab or host WebGL is needed.

Headless mode uses the same shared WebGL/WebAssembly renderer with software
rendering. Install the `headless` extra and Playwright Chromium first. Linux CI
also needs Chromium system dependencies
(`playwright install --with-deps chromium`). Each headless scene owns a Chromium
process; close scenes when finished. Large scans remain memory intensive. The
offscreen browser can fetch only its own loopback scene server; remote downloads
must go through the explicit URL tool. There is no separate native OpenGL
renderer.

If an MCP Apps host advertises support but blocks WebGL or WebAssembly, use
`--renderer headless`. Automatic mode does not silently replace an already
attached widget or redirect commands to a second renderer.

## Compact and full tool profiles

`--tools core` includes `open_3d_files`, `visualize_points`, `inspect_3d_scene`,
`capture_3d_view`, `set_3d_camera`, `navigate_3d_view`, `list_3d_scenes` and
`close_3d_scene`. Two additional app-only transport tools are hidden from the
agent by compatible MCP Apps clients.

`--tools full` also exposes calibrated depth conversion, URL loading, training
updates, selections, measurements, appearance, object transforms, animation,
alignment, comparisons, scene-state persistence and export. Omitted tools are
not callable under the core profile. Restart/reload the server after changing
profiles so the client refreshes its tool catalog.

Read `viewer://capabilities` for the active profile, roots and build IDs. Read
`viewer://workflows` for task recipes. The complete
[tool reference](https://github.com/kleinicke/ply-visualizer/blob/main/docs/mcp-tools.md)
is generated from the source; advanced recipes require the full profile.

## Verify the installation and the result

`3d-visualizer doctor --root /path/to/data` prints the source and installed
versions, executable/module paths, resolved roots, bundled asset checks and
renderer build ID. `--check-headless` actually launches Chromium and inspects a
small scene. Missing browsers and failed parsing are errors, not successful
renders. The CLI cannot observe a chat host's WebGL support and reports it as
unknown; a connected scene's inspection reports actual renderer capabilities.

For every inspection:

1. Open files or points and retain `scene_id`.
2. Inspect; verify `rendered_revision`, object counts, renderer ID and build ID.
3. Position/frame the camera, then capture the view and examine the PNG.
4. Close the scene after use. A failed selection must never lead to exporting an
   older selection accidentally.

Coordinates use source units; never assume meters. Scene/model transforms are
column-major affine matrices, quaternions are XYZW. Camera position and rotation
center are distinct. Inspect full coordinate/presentation state when reproducing
an inspection. Depth calibration comes from explicit accompanying files/context,
not guesses from image pixels. See
[depth workflows](https://github.com/kleinicke/ply-visualizer/blob/main/docs/depth-agent-workflows.md)
and
[agent recipes](https://github.com/kleinicke/ply-visualizer/blob/main/docs/mcp-workflows.md).

## Files, transport and lifetime

`--root` may be repeated. Relative paths resolve against the first root;
symlinks outside allowed roots are rejected. Without a root, the current
directory is allowed. App transport can read only the scene's explicit files and
bundled assets. External GLTF/FBX/DAE assets must be provided explicitly.

Local and headless viewers use server-sent change events and direct binary file
responses. Inline widgets use a held app-only request that wakes on scene or
command changes, plus a heartbeat/reconnect fallback. This avoids waiting for an
idle polling interval before commands are delivered. Portable MCP Apps binary
transfer still uses bounded base64 chunks with four concurrent workers; it does
not claim a zero-copy or native binary MCP transport.

Closing a widget does not close its scene. `close_3d_scene` releases the server,
files and any headless browser. The client owns the stdio process; restart loses
in-memory scene IDs. Saved scene-state exports can be imported after reopening
matching source geometry.

## HTTP and REST

`3d-visualizer-api --root /path/to/data --state-dir /private/server-state`
serves authenticated Streamable HTTP at `/mcp` and REST/OpenAPI at `/api/v1`
using the `http` extra. It is a single-owner service; remote deployment needs
TLS. See the
[HTTP guide](https://github.com/kleinicke/ply-visualizer/blob/main/docs/http-agent-api.md).

## Discoverability

Registry identifier: `io.github.kleinicke/3d-visualizer`. The source repository
remains `kleinicke/ply-visualizer`; it is not an import or installation command.
The general inspection skill is shipped in `skills/3d-visualizer-inspection`,
with the depth-focused skill alongside it. Registry listing and package
installation do not automatically register a server in every agent client.
