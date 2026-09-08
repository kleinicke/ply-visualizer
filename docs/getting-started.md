# Getting started

## Choose a host

| Where you work          | Open the viewer                                                                  |
| ----------------------- | -------------------------------------------------------------------------------- |
| VS Code                 | Install the extension and open a supported file with **Open with 3D Visualizer** |
| Browser                 | Open [the website](https://3d.f-kleinicke.de) and select or drop local files     |
| Python or local Jupyter | Use [`show(...)`](../packages/python/README.md#python)                           |
| AI agent                | Configure the [local MCP server](../packages/python/MCP.md)                      |
| JetBrains or desktop    | Follow the corresponding [platform guide](README.md#platform-guides)             |

## First file in VS Code

1. Open a supported point cloud or mesh in your workspace. If another editor
   opens it, use **Open With…** and select the 3D Visualizer, or use the file's
   **Open with 3D Visualizer** context-menu command.
2. Use the **Files** panel to see loaded objects and their available display
   modes. Use **+ Add Point Cloud** to add another file to the view.
3. Rotate and zoom with the mouse or trackpad. The **Controls** tab describes
   the selected control scheme. Double-click a visible point to move the
   rotation center there.
4. Toggle a file's checkbox to hide or show it. Shift-click isolates it;
   Shift-click it again to restore the group.
5. Expand a file's controls to change its color, point size, or transform.
   Available controls depend on the file's geometry and attributes.

For files on a server, use the command palette's **3D Visualizer: Load Remote
URL**. See [remote files](remote-files.md) for URL history and compression.

## First file on the website

Select a local file or drop it into the viewer. For a model with external
textures or binary buffers, select the model and supporting files together. The
browser cannot discover arbitrary neighboring files on your disk. Remote links
use a [source URL parameter](remote-files.md), and the file server must permit
browser cross-origin requests.

## Choose the correct interpretation

A file extension does not always identify its contents:

- KITTI `.bin` files contain point records; arbitrary binary files do not.
- NPY point arrays use a final dimension of three; depth arrays have a different
  interpretation. The [depth workflow](viewer-guide.md#depth-and-disparity)
  needs camera parameters.
- A JSON pose file must follow a supported pose layout. Use **Load JSON as 3D
  Pose** rather than treating arbitrary JSON as geometry.
- A 3DGS PLY can offer a splat display mode; an ordinary PLY has no splat data.

## If the result is unexpected

Check the file list and any error message first. A model can load geometry while
reporting missing optional textures. A cloud with incorrect depth calibration
can look distorted even though its file decoded successfully. Use the camera
controls to reframe the scene, and check object visibility and display modes. In
VS Code, **Show Timing Output** exposes loading diagnostics.

For MCP, opening a scene only submits it. Inspect the rendered revision and
capture the view before concluding that it loaded; see
[MCP workflows](mcp-workflows.md).
