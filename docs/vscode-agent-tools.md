# Agent tools in VS Code

The VS Code extension contributes all **25 public MCP viewer operations** as
native language-model tools. They act on the same viewer tabs you use manually.
There is no Python installation, localhost server or separate browser window.
The two MCP App transport helpers are intentionally omitted: VS Code uses its
webview message channel instead.

In VS Code Chat, choose Agent mode and enable the **3D Visualizer** tools in the
tool picker. Start with:

> Inspect the point cloud already open in 3D Visualizer. List its attributes,
> isolate label 20, frame it and show me a capture.

The agent calls `list_3d_scenes`, chooses the returned `scene_id`, and operates
on that exact tab. It can also create a scene with `open_3d_files`,
`open_3d_url`, `open_depth_image` or `visualize_points`. Passing `scene_id` to
an open tool appends to that tab and preserves the camera. `update_3d_scene`
replaces geometry in the existing renderer, retaining the camera and removing
omitted overlays. Tool names have the internal `viz3d_` prefix; prompt
references use the familiar MCP names, such as `#inspect_3d_scene`.

Capabilities include camera navigation/picking, point and mesh appearance,
transforms and undo, alignment, measurements, camera keyframes, per-model
animation playback/seek/speed, selections and named selections, scene-state
save/restore, subset PLY and model GLB export, linked comparisons, depth
projection and PNG/multi-view captures. Captures return actual image parts to
the agent; ordinary replies are compact JSON. Request `detail: "full"` for
matrices, coordinate conventions and detailed attributes.

For depth/disparity, the agent reads calibration from surrounding files or your
instructions, then passes explicit intrinsics, encoding and distortion to
`open_depth_image`. Optional aligned RGB, mask and confidence rasters are
supported. COLMAP dense workspaces use their undistorted sparse camera model.
See [depth calibration and recipes](depth-agent-workflows.md).

## Scope and operation semantics

- These tools work with agents that consume VS Code's Language Model Tools API.
  Other agent extensions can continue to use MCP; they do not automatically gain
  access to native tools merely by running inside VS Code.
- Loading/exporting files requires a trusted workspace. Paths resolve relative
  to its first folder and must remain inside an open workspace folder, including
  after resolving symlinks. Add another folder to the workspace when necessary.
- One native load is limited to 256 MiB total. Append additional batches to the
  same scene. Supply explicit companion buffers/textures with models. URL loads
  use direct HTTP(S), support gzip and have a 120-second transfer timeout.
- Artifacts never overwrite existing files. Scene-state JSON is limited to 4
  MiB; subset PLY and model GLB exports to 256 MiB. Scene-state JSON does not
  embed geometry: reopen identical geometry in the same order before restoring
  it.
- Commands are serialized per tab. Closing a tab rejects pending work.
  Cancellation before dispatch prevents it; cancellation after dispatch cannot
  roll back GPU work. A timeout reports unknown completion and blocks further
  commands on that connection: reload and inspect before retrying a mutation.
- Scene IDs last for the life of their tabs. Use `list_3d_scenes` after
  reopening. Native agent-created tabs are temporary; export state/artifacts
  when needed.

## Maintaining parity

Rendering operations call the same `executeAgentCommand` used by MCP. File IO
and transport stay in `src/agent/`; rendering stays in `engine/src/hosts/`.
Contributions are generated from the Python MCP schemas, so defaults, enum
values and argument shapes stay aligned:

```sh
PYTHONPATH=packages/python packages/python/.venv/bin/python scripts/generate-vscode-agent-tools.py
```

Run `npm run test:vscode-agent` for the focused native integration suite.

After changing either transport, run the native agent integration suite in a
real VS Code host and the shared MCP browser tests. Native tests cover manually
opened tabs as well as scenes created by tools. Do not substitute a standalone
browser render for the native webview check.
