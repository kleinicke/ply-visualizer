# 3D Visualizer MCP server

Give AI agents tools to inspect, compare and export 3D data. The server runs
locally and accesses files inside directories you explicitly allow.

## Install and connect

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then add
this configuration to your MCP client. Replace the root with your data folder:

```json
{
  "mcpServers": {
    "3d-visualizer": {
      "command": "uvx",
      "args": [
        "--from",
        "3d-visualizer[mcp]==0.4.2",
        "3d-visualizer-mcp",
        "--root",
        "/absolute/path/to/data"
      ]
    }
  }
}
```

No API key is required. The client starts the server and discovers its tools
over stdio. Version 0.4.2 is the published release described here.

## What agents can do

- Open point clouds and meshes from allowed local files or remote URLs.
- Project depth and disparity images using supplied calibration and optional
  aligned RGB images, including COLMAP depth workflows.
- Inspect coordinates, attributes and presentation state; move the camera, focus
  a selection, set viewpoints and capture PNG previews.
- Select labeled regions, isolate geometry, measure distances and export subsets
  with attributes and point provenance where supported.
- Transform objects, adjust visibility, point size, coloring and opacity;
  compare predictions and references with distance coloring.
- Save and restore scene states and named views; control supported model
  animations and camera keyframes.
- Visualize NumPy arrays and PyTorch tensors through the companion Python API.

## Rendering requirements

Interactive views and PNG captures in release 0.4.2 require a compatible MCP
Apps client with WebGL and widget-to-server calls. Plain stdio tool discovery
works without a browser, GPU or dataset; it does not prove that a client can
render the inline viewer. The server is local software, not a public hosted
endpoint. Remote URLs are inputs to the viewer.

## Example requests

- "Open this PCD, list its labels, isolate label 20 and frame it."
- "Show this depth image as a cloud using the calibration beside it."
- "Compare these prediction and reference clouds, then capture the result."
- "Export the selected object with its labels and original point indices."

For file conventions, client configuration and detailed workflows, see the
[MCP reference](https://github.com/kleinicke/ply-visualizer/blob/main/packages/python/MCP.md)
and
[Python documentation](https://github.com/kleinicke/ply-visualizer/blob/main/packages/python/README.md).
