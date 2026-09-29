# Control the website's open viewer with MCP

The `3d-visualizer-browser-mcp` process exposes the existing viewer tools to a
local MCP client. It pairs with one tab at <https://3d.f-kleinicke.de/>. The
website never runs an MCP server or reads local files for the agent. The agent
initiates the connection, so the ordinary viewer has no pairing controls.

## Start the bridge from this checkout

From the repository root, install the local Python package with MCP support:

```sh
uv sync --project packages/python --extra mcp
```

Configure your MCP client to start the following command through stdio:

```sh
uv run --project /absolute/path/to/ply-visualizer/packages/python \
  3d-visualizer-browser-mcp
```

The bridge listens only on `127.0.0.1:8767`. It generates a private link for
each agent-initiated website session.

For an MCP client that uses JSON command configuration, the equivalent is:

```json
{
  "command": "uv",
  "args": [
    "run",
    "--project",
    "/absolute/path/to/ply-visualizer/packages/python",
    "3d-visualizer-browser-mcp"
  ]
}
```

Ask the agent to call `pair_3d_website`. It returns a URL and `scene_id`. The
agent can open that URL in a new tab with `open_browser=true`. To continue in an
existing tab, the agent passes that tab's `current_url` to the tool and
navigates the **same tab** to the returned URL. Only the fragment changes, so
the tab keeps its loaded files and camera even when the URL has a `source` query
parameter. For a new tab, the agent may provide `source_url` and `filename` to
load one CORS-accessible HTTPS file. The browser may ask to allow access to apps
on your device; permit it for this connection. The fragment containing the
session token is removed from the address bar immediately after the page reads
it.

The agent then uses the returned `scene_id` with `inspect_3d_scene`,
`navigate_3d_view`, and the other viewer tools. `list_3d_scenes` reports whether
the tab is still connected. Closing the tab stops commands; starting another
website session revokes the previous token.

The browser profile exposes inspection, PNG capture, camera and navigation,
appearance, object controls and transforms, measurements, alignment, picking,
views, selection, comparison and video controls. File loading and file exports
remain in the browser or the separate local MCP viewer, because this paired tab
has no file-system access through the bridge.

The bridge accepts requests only from the 3D website and local development
origins. Each agent-created link contains a random session token held in memory.
Tool calls can return scene metadata or captured PNGs to the connected MCP
client. Keep the link private.
