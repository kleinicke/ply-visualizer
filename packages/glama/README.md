# Glama listing for 3D Visualizer

The Awesome MCP Servers review requires a Glama listing that passes its checks
and a score badge after the server description. Glama requires the Dockerfile to
be supplied directly in its server configuration; storing it here alone does not
configure Glama.

1. Sign in at https://glama.ai/mcp/servers and submit
   `https://github.com/kleinicke/ply-visualizer` as **3D Visualizer**.
2. Paste the adjacent `Dockerfile` into Glama's build configuration and run its
   checks. It installs the published package and starts stdio MCP with an empty
   allowed `/data` directory; no API keys or sample files are needed for
   initialization and tool/resource discovery.
3. Once the listing passes, copy its actual score-badge Markdown and append it
   after the description in
   https://github.com/punkpeye/awesome-mcp-servers/pull/14040. Use the path
   assigned by Glama, which need not match the product display name.

To build locally without sending repository files as build context:

```sh
docker build -t 3d-visualizer-glama - < packages/glama/Dockerfile
docker run --rm -i 3d-visualizer-glama
```

The process waits for an MCP client on stdin. Introspection does not need a
browser, GPU, dataset or public HTTP service. Rendering and capture still need
an attached MCP Apps renderer; passing Glama's introspection check does not
prove inline rendering works in every client.
