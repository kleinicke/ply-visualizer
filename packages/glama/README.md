# Glama listing for 3D Visualizer

The Awesome MCP Servers review requires a Glama listing that passes its checks
and a score badge after the server description. Glama requires the Dockerfile to
be supplied directly in its server configuration; storing it here alone does not
configure Glama.

The approved listing is
[kleinicke/ply-visualizer](https://glama.ai/mcp/servers/kleinicke/ply-visualizer).
The score badge was added to
[PR #14040](https://github.com/punkpeye/awesome-mcp-servers/pull/14040). The
checks must still pass before that listing requirement is complete.

## Glama generated Dockerfile settings

Open the
[Dockerfile admin page](https://glama.ai/mcp/servers/kleinicke/ply-visualizer/admin/dockerfile).
The current UI generates a Dockerfile from these fields. Use Python **3.13**.
Keep its base image and Node version defaults for Glama's `mcp-proxy` wrapper.

Build steps:

```json
[
  "uv pip install --python /usr/local/bin/python '3d-visualizer[mcp]==0.4.2'",
  "mkdir -p /data"
]
```

CMD arguments:

```json
["mcp-proxy", "--", "3d-visualizer-mcp", "--root", "/data"]
```

Keep the environment schema empty (`properties: {}`, `required: []`) and
placeholder parameters `{}`. Build, inspect the introspection result, then
release the successful build. No API keys or sample files are needed. Do not use
the automatically detected `pnpm install` / `tsx ./out/extension.js`: that
starts the VS Code extension, not the Python MCP server.

The adjacent `Dockerfile` is the equivalent standalone stdio container for local
checks, without Glama's proxy wrapper.

To build locally without sending repository files as build context:

```sh
docker build -t 3d-visualizer-glama - < packages/glama/Dockerfile
docker run --rm -i 3d-visualizer-glama
```

The process waits for an MCP client on stdin. Introspection does not need a
browser, GPU, dataset or public HTTP service. Rendering and capture still need
an attached MCP Apps renderer; passing Glama's introspection check does not
prove inline rendering works in every client.
