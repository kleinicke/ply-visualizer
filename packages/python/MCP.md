# Local MCP integration

The current checkout is an **unpublished 0.4.0.dev3 preview**. It replaces
0.3.0's nested localhost iframe with the shared renderer running directly in the
MCP widget. PyPI still serves 0.3.0 until the next requested release.

The optional MCP server lets an agent use the shared 3D viewer and inspect its
actual rendered output. Python 3.10+ and a WebGL-capable MCP Apps host (or an
explicit browser fallback) are required. The recommended installer is uv. The
package bundles its renderer; users need no Node.js installation.

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
        "ply-visualizer[mcp]==0.3.0",
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
There are 18 agent-facing tools and two app-only transport tools. Up to eight
scenes are retained. Inline arrays are limited to 20,000 XYZ rows per argument;
use local files for larger scenes. RGB values are integers 0–255. PyTorch/NumPy
data in an agent's Python environment can use the Python API directly; MCP JSON
does not carry live tensor objects.

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

## Agent controls (development preview)

| Tool                | Operations                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigate_3d_view`  | Tight fit; front/back/top/bottom/left/right/isometric presets; orbit, pan, zoom; pivot XYZ, reset pivot to origin, pick visible geometry at normalized screen XY |
| `set_3d_appearance` | Exposure in stops and background `#RRGGBB`                                                                                                                       |
| `set_3d_object`     | Overlay opacity (0–1), visibility, world-unit point size, points/mesh mode, fixed RGB, original/intensity/available scalar coloring                              |
| `measure_3d_scene`  | Distances and paths in scene units, list, undo, close path, clear                                                                                                |
| `control_3d_video`  | Add/remove/update/visit keyframes, loop, start/stop preview, list reusable camera poses                                                                          |

| `select_3d_region` | Select by object, scalar values, world box and/or plane;
highlight, isolate, focus and return a PNG in one call; clear restores prior
visibility | | `pick_3d_point` | Hit/miss, world XYZ, object/decoded point
indices and scalar attributes without moving the camera | | `manage_3d_views` |
Save, restore, list or delete named camera views; undo up to 50 agent camera
changes |

`inspect_3d_scene` returns object indices, current presentation state, bounds,
valid vertex counts and available scalar names. Source/filtered counts are null
when the parser does not supply them. PCD numeric attributes (including
segmentation labels) are decoded for ASCII, binary and compressed binary,
aligned with the valid points. Multi-component fields appear as `field_0`,
`field_1`, etc. Attribute summaries include finite ranges and counts for up to
64 values, with an explicit truncation flag. Attributes use the viewer's float32
storage; large integer IDs above 2²⁴ may lose precision. Numeric labels do not
supply semantic names such as “box”. Video controls preview the existing camera
timeline; video export is not part of these tools. Camera snapshots/keyframes
can reproduce a viewpoint.

The first view uses the viewer's OpenGL convention (Y-up, looking along -Z) and
a tight bounding-box fit. Coordinates are not transformed. Settings are
collapsed by default and all listed operations work without opening the panel.

## Coordinate and presentation inspection

Call `inspect_3d_scene` before spatial edits. It returns:

- `coordinate_system`: handedness, default axes, matrix layout, normalized
  screen-coordinate convention and units. The default is right-handed,
  OpenGL-style **Y-up**, camera forward **-Z**. Blender's world convention is
  **Z-up**. The viewer does not convert source coordinates or infer metres.
- `camera`: world position, `rotation_center` (the controls' `target`), unit
  `view_direction`, actual `screen_right`/`screen_up`, reference `up`, distance
  to the center, perspective field of view, clipping distances, zoom and
  viewport dimensions. `target_direction` is separate from the actual optical
  direction. World-to-camera and projection matrices are column-major.
- Each object's `local_to_world`, `source_origin` if known, opacity, material
  colors and the existing scalar/color mode. Mixed-material opacity returns
  `opacity=null` plus `material_opacities`, rather than guessing one value.
- `presentation`: background color (CSS RGB or hex), background kind, exposure
  multiplier, brightness stops and settings-panel visibility.
- `selection`: the current subset's source object, point count and label/box/
  plane criteria, or null. `visible_bounds` excludes hidden objects; `bounds`
  still describes all loaded geometry.

Use the actual camera vectors after navigation; the default world axes do not
say which way the camera currently faces. Physical scale remains unspecified
unless the source supplies it; measurements use scene units.

### Reliable updates and actionable errors

`update_3d_scene` has no widget resource metadata: it updates the original view
instead of asking the client to create another widget. Camera position, target
and up are preserved while replacing geometry, including clearing a selection.
Every responding renderer reports a `renderer_id`. The first active renderer
owns command delivery while its heartbeat is current; duplicate widgets cannot
answer its commands. After ten seconds without its heartbeat, a replacement can
take over. Compare IDs after an update: a changed ID indicates a different
renderer, not proof that the original camera was preserved. Camera bookmarks and
presentation state are not persisted across renderer restarts.

Expected renderer and argument errors retain their explanation in MCP's error
response. A zero-match label selection reports that the previous selection is
unchanged and lists available source label values (up to 64). Unexpected Python
exceptions remain generic and are logged on the server.

## Select the labeled box and hide the table

1. Inspect the cloud's `attributes.label.value_counts`, or call `pick_3d_point`
   on a visible point of the box and read `attributes.label`. Verify visually:
   labels identify regions only if the source was segmented that way.
2. Call
   `select_3d_region(scene_id=..., object_index=0, field="label", values=[2])`
   using the actual discovered label. The defaults highlight and isolate that
   region, center the orbit target, tightly frame it and return a PNG preview.
3. Call `select_3d_region(scene_id=..., action="clear")` to remove the derived
   subset and restore the previous visibility. Source files are never modified.

Optional `bounds=[minX,minY,minZ,maxX,maxY,maxZ]` and `plane=[a,b,c,d]`
intersect the label selection in world coordinates; the plane keeps
`a*x+b*y+c*z+d >= 0`. Reissue the selection with a new plane to inspect
successive slices. With no predicate, the entire point-cloud object is selected.
A zero-match request leaves the prior selection intact. Only one derived
selection is retained; it is cleared automatically when switching batches or
replacing geometry. This is explicit selection, not automatic object detection.
Region subsets currently support point clouds; use object visibility for mesh
objects.

Set `highlight=false` to keep source RGB; color the subset by an available
scalar through `set_3d_object`. For comparisons, keep both clouds visible and
set their colors and `opacity` individually. This supports an overlay in one
camera; synchronized side-by-side viewports are not implemented.

Named views last for the renderer session and restore the camera only. Undo
covers agent camera commands, not manual mouse gestures. Picking indices refer
to the decoded cloud after invalid rows have been removed; they are not raw PCD
record numbers. A subset pick also reports its source object and decoded index.
Mesh/splat picks may report null indices when their existing picker only returns
an intersection position.

## Display, connection and lifetime

**No separate window opens by default**, including in clients without MCP Apps.
Use `open_browser=true` only when you explicitly want a browser fallback. An
agent should open a scene, inspect its rendered revision, then capture it.
Opening returns before rendering because the host needs that result to create
the widget. Do not claim a submitted scene has rendered. Inspection waits for an
actual renderer response; it reports a clear error if none arrives.

The widget uses app-to-server calls to transfer geometry and lazy engine assets
in bounded chunks. There is no nested iframe, localhost fetch or external CDN.
Settings and themes tolerate sandboxed widgets with no persistent storage. The
renderer still requires **WebGL and WebAssembly compilation**; the host must
permit these and MCP Apps tool calls. Hosts may also impose resource/message
size limits. Tested with a protocol host using `connect-src 'none'`,
`frame-src 'none'`, and `script-src 'unsafe-inline' 'wasm-unsafe-eval'`.
Individual chat clients still need verification; this does not override their
security policy or grant permissions automatically.

`read_viewer_data` and `submit_viewer_reply` are app-only transport tools, not
model-facing data APIs. They expose only the scene's files and bundled assets.
Local file reads remain restricted by `--root`. Data travels through your MCP
client when displayed inline, rather than staying solely in a localhost page.

`list_3d_scenes` reports `awaiting_renderer`, `connected`, or `disconnected`.
Keep the inline view active while inspecting or capturing it. Closing a card
does not destroy its scene; use `close_3d_scene`. Restarting the server loses
scene IDs; reopen files to create a new scene. Browser URLs are available only
while the local server runs.

## Installation and reloads

Install a server once in your MCP client's settings, with only the directories
you want to allow. Package installation alone does not register its tools. After
changing the command or package version, use the client's server reload control;
some clients require a new conversation or app restart to refresh their tool
catalog. Those permissions and reload requirements belong to the client and
cannot be removed by the viewer.

The public pinned configuration above installs 0.3.0. To test these fixes now,
use the local checkout below and point the client at the installed command.

## Develop from a local checkout

```sh
npm run build:python-viewer
uv tool install --force "./packages/python[mcp]"
```

Configure the client command as `ply-viewer-mcp` with arguments
`["--root", "/absolute/workspace"]`. This uses the local development build; the
pinned PyPI command above installs version 0.3.0 including the MCP Apps preview.
Nothing is uploaded by these commands.

### Transport behavior

Geometry and renderer assets use bounded 512 KiB base64 chunks. After the first
chunk establishes the size, up to four chunks are fetched concurrently into one
output buffer. This reduces serial round trips; base64 overhead and MCP-client
traffic still apply. It is not a streaming decoder. Scene/command polling backs
off from 500 ms to 4 seconds when idle and resets after an update or command; an
idle command can therefore take up to about 4 seconds to be noticed.

### Remaining inspection work

Camera bookmarks still do not restore selection or presentation, and source-row
provenance after invalid-point filtering is not available. Full scene-state
save/export/import, subset export with provenance, multiple named selections
with set operations, adaptive point sizing, multi-view previews, linked
comparisons with error coloring, and screenshot legends remain follow-up work.

## Alignment from an agent

`align_3d_clouds` starts a job and returns `job.state="queued"`. Poll the same
tool with `action="status"` until it reports `completed` or `failed`. A
completed align-all job can contain failed clouds: inspect `progress.entries`
and the resulting transforms, then capture to verify the fit visually.

| Action            | Behavior                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `auto`            | Move `source_index` onto fixed `target_index` using coarse yaw search, then ICP                                                         |
| `icp`             | Refine a pair already close to the correct rigid pose                                                                                   |
| `correspondences` | Fit at least three non-collinear paired world XYZ landmarks using `source_points` / `target_points`                                     |
| `align_all`       | Keep `target_index` fixed; choose `strategy="anchor"`, `"nested"` (grow the aligned union), or `"complex"` (grow with extra hypotheses) |
| `refine_all`      | Refine each cloud against the anchor                                                                                                    |
| `status`          | Job outcome, shared workflow messages, per-cloud progress, undo availability and column-major transforms                                |
| `undo`            | Restore transforms from before the last accepted agent alignment                                                                        |

`up_axis` describes the source scans, not the current camera. It defaults to
`"y"`; use `"z"` for Z-up scans. Automatic yaw search assumes level scans about
that axis. These are rigid fits, without scale estimation or nonrigid warping.
For pair `auto`/`icp`, `against_all_others=true` matches the moving cloud
against the union of every other loaded cloud. Clear an active temporary region
selection first. Load subsets as separate files to register them independently.
The camera is preserved. Geometry refresh waits until alignment finishes, and
other agent edits are rejected while busy.

These tools reuse the existing registration workflows and Rust solvers.
Sandboxed widgets may use the in-page WASM fallback when workers are blocked;
during that calculation the canvas and status calls can pause. Jobs have no
mid-solve cancellation. A renderer restart loses the running job and undo state.

## Remote 3D files

`open_3d_url(url="https://example.org/scan.pcd")` downloads a file on the local
MCP server and opens the regular inline widget. This is an explicit outbound
HTTP(S) request, including redirects. It does not require the remote server to
allow browser CORS. The viewer still receives geometry through MCP transport.

Use a direct file URL, not a repository page, login page or HTML preview.
Supported formats are the same as `open_3d_files`; gzip files are decompressed.
For extensionless or signed URLs, supply `filename="scan.pcd"`. Cookies, login
flows and credentials embedded in URLs are not supported; signed links work
while valid. Downloads default to a 256 MiB limit for both transferred and
uncompressed bytes (configurable up to 1 GiB), with socket/transfer time limits.
Temporary downloads are deleted when the scene closes. A successful download is
not proof of successful parsing: inspect the rendered revision afterward.

The native URL-input/history UI is maintained separately. Its website loading
path runs in the browser and therefore still depends on CORS; the MCP tool uses
the local server instead of duplicating or controlling that UI.
