# HTTP MCP, REST and asynchronous tasks

Install the Python package's HTTP extras, then start one server process:

```sh
uv pip install '3d-visualizer[http]'
ply-viewer-api --root /path/to/data --state-dir /path/to/private/server-state
```

For an unpublished checkout use `uv pip install -e 'packages/python[http]'`
after `npm run build:python-viewer`. The default address is
`http://127.0.0.1:8765`. Both interfaces share the same scenes, validation, file
roots and renderer commands:

- MCP: `/mcp` using Streamable HTTP, including protocol `2026-07-28`.
- REST/JSON: `/api/v1/tools`, `/api/v1/tools/{operation}`.
- OpenAPI 3.1: `/api/v1/openapi.json`, generated from the actual tool schemas.

A random bearer token is created in `<state-dir>/token` with owner-only file
permissions. Read that file locally and configure `Authorization: Bearer ...` in
your HTTP/MCP client. Do not put the token in a URL. An existing credential can
be supplied using `--token-file`. All clients using that token act as one owner
and share scenes/tasks; this is not a multi-tenant service or OAuth server.
Browser-origin requests are rejected; no broad CORS policy is enabled.

For remote access, bind with `--host 0.0.0.0`, terminate TLS at your reverse
proxy, and allow the external MCP Host explicitly with
`--allowed-host viewer.example.org`. Use one process/worker per state directory.
Scene state and renderer connections live in that process and cannot be spread
across workers merely because the protocol transport is stateless.

## Calling operations

```python
import httpx
from pathlib import Path

api = httpx.Client(
    base_url="http://127.0.0.1:8765",
    headers={"Authorization": "Bearer " + Path("/path/to/private/server-state/token").read_text().strip()},
)
upload = api.post("/api/v1/uploads/cloud.ply", content=Path("cloud.ply").read_bytes()).json()
opened = api.post("/api/v1/tools/open_3d_files", json={"paths": [upload["path"]]}).json()
scene_id = opened["structuredContent"]["scene_id"]
```

The JSON body is the same arguments object used by MCP. Responses retain
`structuredContent`, optional image content and `isError`; synchronous tool
errors return HTTP 422. Examples include `control_3d_video` for model animation,
`open_depth_image` for calibrated depth, and `capture_3d_view` for PNG capture.
POST `/api/v1/tools/list_3d_scenes` with `{}` to list active scenes.

Uploads use raw request bytes and unique server paths. Limits are 256 MiB per
file, 1 GiB total uploads and 1,024 retained upload directories. Complete
uploads remain until explicitly deleted. GET `/api/v1/files?path=...` downloads
a supported data/export file under configured roots; DELETE at the same URL
removes only server-managed uploads. Do not delete uploads still needed by an
active scene. JSON requests are bounded to 2 MiB; upload larger geometry as
files.

An opened scene is **submitted**, not necessarily rendered. Camera controls,
projection, inspection and captures require an active inline MCP Apps viewer or
an explicitly opened browser. For local use the scene's returned loopback URL
opens its browser viewer. That URL is local to the server machine; it is not a
remote viewer URL. For remote automation, open the scene through the HTTP MCP
client's inline viewer and use its scene_id from REST. This API does not start a
headless browser or install a renderer on a remote server.

## Tasks

REST callers can add `?async=true` to an operation. HTTP 202 returns a taskId
and Location header. Poll GET `/api/v1/tasks/{taskId}` at the returned interval
until completed/failed. Completed tasks contain the original result, including
tool errors. DELETE requests cooperative cancellation; an already running
renderer mutation may still finish.

HTTP MCP advertises `io.modelcontextprotocol/tasks`. A client must opt in
through its **per-request capabilities**. Eligible long operations can then
return the standard `resultType: "task"` handle. `tasks/get`, `tasks/update` and
`tasks/cancel` implement the
[Tasks extension](https://modelcontextprotocol.io/extensions/tasks/overview).
Clients that do not opt in retain ordinary tool results. Alignment tasks poll
the renderer's job state before completing, with a 30-minute wait limit. Complex
align-all is never selected automatically. There are currently no mid-task input
requests or task notification subscriptions; unknown input responses are
ignored.

Task records/results persist in SQLite: at most 64 records, retained for one
hour from creation, with a 16 MiB result limit. Reconnecting clients can
retrieve results; after a server restart, unfinished tasks become explicit
failures and are not replayed. Scenes themselves do not survive a restart.
Inspect existing files before retrying an interrupted export or download.

For stdio, enable the same extension explicitly:

```sh
ply-viewer-mcp --root /path/to/data --task-state-dir /path/to/private/stdio-state
```

## Other implementation choices

An MCP server is defined by its tool/resource schemas and protocol behavior;
Python decorators are one way to produce them. The
[official TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/v2/) is
feasible for a Node host next to VS Code/the website. The
[official Rust SDK](https://rust.sdk.modelcontextprotocol.io/) is feasible for a
Tauri/native host. A low-level implementation could serve the JSON-RPC methods
directly, but would also need to maintain transport, validation, extension and
protocol compatibility.

Keeping Python preserves the package/CLI/tensor integration and the existing
validated tool handlers. The HTTP/REST layer calls those handlers rather than
maintaining a second copy. A future TypeScript or Rust host could reuse the
shared viewer command contract; it would still need host-side scene/filesystem
management. Neither changing language nor adding REST makes every AI client
automatically discover or render the viewer.

[FastMCP's OpenAPI integration](https://gofastmcp.com/integrations/openapi) can
also generate MCP tools from an HTTP API specification. That is feasible for
API-first services, but generating a second wrapper around these existing MCP
handlers would add a transport layer without improving their viewer semantics.
