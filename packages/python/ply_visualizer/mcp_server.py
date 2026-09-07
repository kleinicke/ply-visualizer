"""Local stdio MCP tools. Stdout is reserved for MCP protocol messages."""
import argparse
from functools import wraps
from .agent_bridge import RendererError
import json
import base64
from contextlib import asynccontextmanager
import math
from pathlib import Path
import uuid
from typing import Any, Literal
import re

from .session import FORMATS, show


class SceneManager:
    def __init__(self, roots, max_scenes=8):
        self.roots = [Path(root).expanduser().resolve(strict=True) for root in roots]
        if not self.roots or any(not root.is_dir() for root in self.roots):
            raise ValueError("Provide at least one existing workspace directory")
        self.max_scenes = max_scenes
        self.scenes = {}

    def path(self, name):
        file = Path(name).expanduser()
        file = (file if file.is_absolute() else self.roots[0] / file).resolve(strict=True)
        if not any(file.is_relative_to(root) for root in self.roots):
            raise ValueError("File is outside the configured --root directories")
        if not file.is_file() or file.suffix.lower() not in FORMATS:
            raise ValueError("Expected a supported 3D file")
        return file

    def get(self, scene_id):
        if scene_id not in self.scenes:
            raise ValueError("Unknown scene_id; use list_3d_scenes")
        return self.scenes[scene_id]

    def add(self, factory):
        if len(self.scenes) >= self.max_scenes:
            raise ValueError("Close an existing scene before opening another (limit 8)")
        scene_id = uuid.uuid4().hex
        self.scenes[scene_id] = factory()
        return self.describe(scene_id)

    def describe(self, scene_id):
        viewer = self.get(scene_id)
        with viewer._lock:
            manifest = viewer._manifest()
        return {"scene_id": scene_id, "url": viewer.url, "revision": manifest["revision"],
                "files": [entry["name"] for entry in manifest["files"]],
                "status": "submitted", "connection": viewer._bridge.connection(), "renderer_id": viewer._bridge.renderer_id(), "note": "Use inspect_3d_scene to verify rendering. Inline MCP App renders via MCP. No browser tab is opened unless explicitly requested."}

    def close(self):
        for viewer in self.scenes.values():
            viewer.close()
        self.scenes.clear()


def browser_default(ctx, requested):
    if requested is not None:
        return requested
    return False

def create_server(roots):
    from mcp.server import MCPServer
    from mcp.server.mcpserver import Image, Context
    from mcp.server.mcpserver.exceptions import ToolError
    from mcp_types import ToolAnnotations
    from pydantic import Field
    from typing import Annotated

    def explain_errors(fn):
        @wraps(fn)
        def run(*args, **kwargs):
            try:
                return fn(*args, **kwargs)
            except (RendererError, TimeoutError, ValueError, FileNotFoundError, PermissionError) as error:
                raise ToolError(str(error)) from error
        return run

    points_type = Annotated[list[tuple[float, float, float]], Field(min_length=1, max_length=20000)]
    manager = SceneManager(roots)

    @asynccontextmanager
    async def lifespan(server):
        try:
            yield {}
        finally:
            manager.close()

    server = MCPServer("ply-visualizer", version="0.4.0.dev2", lifespan=lifespan,
        instructions="Use this viewer for 3D point clouds, meshes, Gaussian splats, predicted/target geometry and vector fields. Prefer local file paths for large data. Reuse scene_id to update a scene. After creating a scene, inspect its coordinate_system, camera, presentation and selection, then capture to verify actual rendering. Use reported world axes and units; do not assume meters or Blender Z-up. After updates compare renderer_id and rendered_revision. Do not claim a submitted scene has rendered. The MCP widget renders directly and transfers geometry through app-only tools. No browser opens by default. Remote file upload is not supported.")
    readonly = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)
    local = ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=False)

    ui_meta = {"ui": {"resourceUri": "ui://ply-visualizer/viewer.html"}}

    @server.resource("ui://ply-visualizer/viewer.html", mime_type="text/html;profile=mcp-app",
                     meta={"ui": {"csp": {"connectDomains": [], "resourceDomains": []}, "prefersBorder": True}})
    def viewer_app() -> str:
        """Interactive 3D viewer rendered directly in the MCP App; no nested iframe or localhost fetch."""
        return (Path(__file__).parent / "_mcp_app" / "viewer.html").read_text(encoding="utf-8")

    @server.tool(annotations=local, meta=ui_meta, structured_output=True)
    @explain_errors
    def open_3d_files(paths: Annotated[list[str], Field(min_length=1, max_length=32)], ctx: Context, open_browser: bool | None = None) -> dict[str, Any]:
        """Open local point clouds/meshes/splats together. Paths must be under configured roots. Returns a persistent scene_id and local URL; inspect to verify loading."""
        files = [manager.path(path) for path in paths]
        return manager.add(lambda: show(*files, open_browser=browser_default(ctx, open_browser)))

    @server.tool(annotations=local, meta=ui_meta, structured_output=True)
    @explain_errors
    def visualize_points(points: points_type, ctx: Context, colors: points_type | None = None,
                         target: points_type | None = None, vectors: points_type | None = None,
                         vector_scale: float = 1.0, open_browser: bool | None = None) -> dict[str, Any]:
        """Visualize up to 20,000 XYZ points, optional RGB (integer 0..255), target overlay, or anchored vector arrows. Use files for larger data; coordinates are not automatically normalized."""
        return manager.add(lambda: show(points, colors=colors, target=target, vectors=vectors,
                                      vector_scale=vector_scale, open_browser=browser_default(ctx, open_browser)))

    @server.tool(annotations=local, structured_output=True)
    @explain_errors
    def update_3d_scene(scene_id: str, points: points_type, colors: points_type | None = None,
                        target: points_type | None = None, vectors: points_type | None = None,
                        vector_scale: float = 1.0) -> dict[str, Any]:
        """Replace the existing scene's geometry while preserving its camera. Omitted overlays/vectors are removed. Reuses the active inline viewer or explicit browser fallback."""
        manager.get(scene_id).update(points, colors=colors, target=target, vectors=vectors, vector_scale=vector_scale)
        return manager.describe(scene_id)

    @server.tool(annotations=readonly)
    @explain_errors
    def list_3d_scenes() -> list[dict]:
        """List scenes owned by this MCP process and their local viewer URLs."""
        return [manager.describe(scene_id) for scene_id in manager.scenes]

    @server.tool(annotations=readonly)
    @explain_errors
    def inspect_3d_scene(scene_id: str) -> dict[str, Any]:
        """Read coordinate conventions/units, camera position/direction/rotation center, projection and viewport, object transforms, opacity/color, exposure/background, selection criteria, geometry counts and bounds from the active inline viewer or explicit browser fallback. Times out if no renderer responds. Compare rendered_revision with the submitted revision."""
        return manager.get(scene_id)._bridge.request("inspect")

    @server.tool(annotations=local)
    @explain_errors
    def set_3d_camera(scene_id: str, fit: bool = False, position: tuple[float, float, float] | None = None,
                      target: tuple[float, float, float] | None = None, up: tuple[float, float, float] | None = None) -> dict[str, Any]:
        """Fit geometry into view, or set camera position and look-at target. Requires an active inline viewer or explicit browser fallback. Returns the applied camera and rendered scene information."""
        if fit:
            if any(value is not None for value in (position, target, up)):
                raise ValueError("Use fit or explicit camera vectors, not both")
        else:
            if position is None or target is None or position == target:
                raise ValueError("Provide different camera position and target vectors")
            if not all(math.isfinite(v) for vector in (position, target, up or (0, 1, 0)) for v in vector):
                raise ValueError("Camera vectors must be finite")
            if up is not None and not any(up):
                raise ValueError("up must be nonzero")
        return manager.get(scene_id)._bridge.request("camera", {"fit": fit, "position": position, "target": target, "up": up})

    @server.tool(annotations=readonly)
    @explain_errors
    def capture_3d_view(scene_id: str) -> Image:
        """Return an actual PNG of the rendered 3D canvas (maximum 1024 pixels per side) so the agent can visually inspect the result. Requires an active inline viewer or explicit browser fallback."""
        result = manager.get(scene_id)._bridge.request("capture")
        return Image(data=base64.b64decode(result["png"], validate=True), format="png")

    @server.tool(annotations=local)
    @explain_errors
    def close_3d_scene(scene_id: str) -> dict[str, Any]:
        """Release a viewer's local server and temporary data. Does not delete the user's source files. Any active viewer disconnects."""
        manager.get(scene_id).close()
        del manager.scenes[scene_id]
        return {"closed": scene_id}

    def command(scene_id, operation, arguments):
        return manager.get(scene_id)._bridge.request(operation, {k: v for k, v in arguments.items() if v is not None})

    @server.tool(annotations=local, structured_output=True)
    @explain_errors
    def navigate_3d_view(scene_id: str,
        action: Literal["fit", "preset", "orbit", "pan", "zoom", "origin", "pivot", "pick"],
        preset: Literal["front", "back", "top", "bottom", "left", "right", "isometric"] | None = None,
        vector: tuple[float, float, float] | None = None,
        screen: tuple[Annotated[float, Field(ge=0, le=1)], Annotated[float, Field(ge=0, le=1)]] | None = None,
        yaw: float = 0, pitch: float = 0,
        factor: Annotated[float, Field(gt=0, le=100)] = 1) -> dict[str, Any]:
        """Navigate without UI. Fit tightly; presets use Y-up OpenGL. Orbit angles are degrees. Pan/pivot use world XYZ. Zoom <1 moves closer. Pick uses normalized canvas XY (top-left=0,0) and sets rotation center on visible geometry, like double-click. Origin resets pivot to 0,0,0."""
        if action == "preset" and preset is None: raise ValueError("preset is required")
        if action in ("pan", "pivot") and vector is None: raise ValueError("vector is required")
        if action == "pick" and screen is None: raise ValueError("screen is required")
        if not all(math.isfinite(v) for v in (* (vector or ()), yaw, pitch, factor)):
            raise ValueError("Coordinates and angles must be finite")
        return command(scene_id, "navigate", dict(action=action, preset=preset, vector=vector, screen=screen, yaw=yaw, pitch=pitch, factor=factor))

    @server.tool(annotations=local, structured_output=True)
    @explain_errors
    def set_3d_appearance(scene_id: str, brightness: Annotated[float, Field(ge=-10, le=10)] | None = None,
                          background: Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")] | None = None) -> dict[str, Any]:
        """Set geometry exposure in stops (0 normal, +1 twice as bright) and background #RRGGBB. Capture includes this background."""
        return command(scene_id, "appearance", dict(brightness=brightness, background=background))

    @server.tool(annotations=local, structured_output=True)
    @explain_errors
    def set_3d_object(scene_id: str, object_index: Annotated[int, Field(ge=0)],
        point_size: Annotated[float, Field(gt=0, le=1000)] | None = None,
        opacity: Annotated[float, Field(ge=0, le=1)] | None = None,
        visible: bool | None = None, mode: Literal["points", "mesh"] | None = None,
        color: Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")] | None = None,
        color_mode: Annotated[str, Field(pattern=r"^(original|assigned|intensity|intensity-grayscale|scalar:[^:]+:(viridis|grayscale|colors))$")] | None = None) -> dict[str, Any]:
        """Set overlay opacity (0..1), object visibility, world-unit point size, points/mesh representation, fixed RGB color or original/intensity/scalar coloring. Get object_index and scalar_fields from inspection. Mesh requires faces. Fixed color and color_mode are mutually exclusive."""
        if color is not None and color_mode is not None: raise ValueError("Provide color or color_mode")
        return command(scene_id, "object", dict(object_index=object_index, opacity=opacity, point_size=point_size, visible=visible, mode=mode, color=color, color_mode=color_mode))

    @server.tool(annotations=local, structured_output=True)
    @explain_errors
    def measure_3d_scene(scene_id: str, action: Literal["list", "distance", "path_point", "undo", "close_path", "clear"],
        start: tuple[float, float, float] | None = None, end: tuple[float, float, float] | None = None) -> dict[str, Any]:
        """Add/list/clear visible measurements in scene units. Distance uses start/end XYZ; path_point appends end to the active path; undo removes its last point; close_path toggles closure."""
        if action == "distance" and (start is None or end is None): raise ValueError("start and end are required")
        if action == "path_point" and end is None: raise ValueError("end is required")
        if not all(math.isfinite(v) for v in (*(start or ()), *(end or ()))): raise ValueError("Coordinates must be finite")
        return command(scene_id, "measure", dict(action=action, start=start, end=end))

    @server.tool(annotations=local, structured_output=True)
    @explain_errors
    def control_3d_video(scene_id: str, action: Literal["list", "add", "remove", "goto", "update", "loop", "play", "stop"],
        index: Annotated[int, Field(ge=0)] | None = None, enabled: bool | None = None,
        duration: Annotated[float, Field(gt=0, le=3600)] | None = None,
        dwell: Annotated[float, Field(ge=0, le=3600)] | None = None) -> dict[str, Any]:
        """Manage camera keyframes and preview playback without UI. Add captures current camera. Update sets segment duration/dwell in seconds. Loop requires enabled; play needs two keyframes; stop restores camera. Returns reusable keyframe poses."""
        if action in ("remove", "goto", "update") and index is None: raise ValueError("index is required")
        if action == "loop" and enabled is None: raise ValueError("enabled is required")
        return command(scene_id, "video", dict(action=action, index=index, enabled=enabled, duration=duration, dwell=dwell))

    @server.tool(annotations=readonly, structured_output=True)
    @explain_errors
    def pick_3d_point(scene_id: str, screen: tuple[Annotated[float, Field(ge=0, le=1)], Annotated[float, Field(ge=0, le=1)]]) -> dict[str, Any]:
        """Pick normalized canvas XY without moving the camera. Returns hit/miss, world XYZ, object and decoded point indices and scalar attributes. Mesh/splat picks may have null indices; never infer object identity from those."""
        return command(scene_id, "pick", dict(screen=screen))

    @server.tool(annotations=local, structured_output=True)
    @explain_errors
    def manage_3d_views(scene_id: str, action: Literal["save", "restore", "list", "delete", "undo"],
                        name: Annotated[str, Field(min_length=1, max_length=100)] | None = None) -> dict[str, Any]:
        """Save/restore named camera views for this renderer session; undo the last agent camera change (up to 50). Names are not persisted after closing/reloading the widget. Does not restore geometry or filters."""
        if action in ("save", "restore", "delete") and name is None: raise ValueError("name is required")
        return command(scene_id, "views", dict(action=action, name=name))

    @server.tool(annotations=local)
    @explain_errors
    def select_3d_region(scene_id: str, action: Literal["select", "clear"] = "select",
        object_index: Annotated[int, Field(ge=0)] = 0,
        field: str | None = None, values: list[float] | None = None,
        bounds: tuple[float, float, float, float, float, float] | None = None,
        plane: tuple[float, float, float, float] | None = None,
        isolate: bool = True, focus: bool = True, highlight: bool = True, preview: bool = True) -> list[Image | str]:
        """One-step select/isolate/focus with PNG preview. Select all points in an object, or intersect scalar field values, world box [minX,minY,minZ,maxX,maxY,maxZ], and plane halfspace ax+by+cz+d>=0. Creates a reversible highlighted point subset; clear restores prior visibility. Label IDs are numeric, not semantic object names: inspect attributes/pick first. No automatic segmentation; point clouds only. Replaces the previous selection. Disable highlight to preserve original colors. Moving the plane requires another select call."""
        if (field is None) != (values is None): raise ValueError("field and values must be supplied together")
        if values is not None and not 0 < len(values) <= 1024: raise ValueError("Provide 1..1024 values")
        if not all(math.isfinite(v) for v in (*(values or ()), *(bounds or ()), *(plane or ()))): raise ValueError("Region values must be finite")
        if bounds and any(bounds[i] > bounds[i+3] for i in range(3)): raise ValueError("Box min must not exceed max")
        if plane and not any(plane[:3]): raise ValueError("Plane normal must be nonzero")
        result = command(scene_id, "selection", dict(action=action, object_index=object_index, field=field, values=values, bounds=bounds, plane=plane, isolate=isolate, focus=focus, highlight=highlight, preview=preview))
        png = result.pop("png", None)
        return [json.dumps(result)] + ([Image(data=base64.b64decode(png, validate=True), format="png")] if png else [])

    @server.tool(annotations=readonly, meta={"ui": {"visibility": ["app"]}}, structured_output=True)
    @explain_errors
    def read_viewer_data(scene_id: str, resource: str, offset: Annotated[int, Field(ge=0)] = 0, renderer_id: Annotated[str, Field(min_length=1, max_length=128)] | None = None) -> dict[str, Any]:
        """App-only transport: session metadata, pending commands or bounded geometry chunks."""
        viewer = manager.get(scene_id)
        with viewer._lock:
            if resource == "session.json":
                return viewer._manifest()
            if resource == "agent/command":
                return {"command": viewer._bridge.pending(renderer_id)}
            if resource.startswith("assets/"):
                name = resource[len("assets/"):]
                if not re.fullmatch(r"[a-zA-Z0-9_.-]+\.(js|wasm)", name):
                    raise ValueError("Unknown viewer asset")
                file = Path(__file__).parent / "_mcp_app" / name
            else:
                match = re.fullmatch(r"files/(\d{1,9})/(\d{1,9})", resource)
                if not match:
                    raise ValueError("Unknown viewer resource")
                revision, index = map(int, match.groups())
                snapshot = viewer._history.get(revision)
                if snapshot is None or index >= len(snapshot[0]):
                    raise ValueError("Scene revision expired; retry loading")
                file = snapshot[0][index]
            with file.open("rb") as source:
                import os
                size = os.fstat(source.fileno()).st_size
                if offset > size:
                    raise ValueError("Offset beyond end of file")
                source.seek(offset)
                return {"data": base64.b64encode(source.read(512 * 1024)).decode(), "size": size, "offset": offset}

    @server.tool(annotations=local, meta={"ui": {"visibility": ["app"]}}, structured_output=True)
    @explain_errors
    def submit_viewer_reply(scene_id: str, reply: dict[str, Any]) -> dict[str, Any]:
        """App-only transport: acknowledge a rendered command result."""
        return {"accepted": manager.get(scene_id)._bridge.receive(reply)}

    @server.resource("viewer://capabilities")
    def capabilities() -> str:
        """Supported formats, file roots, transport and rendering workflow."""
        import json
        return json.dumps({"formats": sorted(FORMATS), "roots": [str(root) for root in manager.roots],
                           "transport": "stdio", "inline_mcp_app": True, "inline_requires": "MCP Apps host with app-to-server tools and WebGL",
                           "workflow": ["open_3d_files or visualize_points", "inspect_3d_scene", "set_3d_camera", "capture_3d_view", "close_3d_scene"]})

    return server


def main():
    parser = argparse.ArgumentParser(description="Local 3D viewer MCP server (stdio).")
    parser.add_argument("--root", action="append", help="Allowed 3D file directory; repeat for multiple roots. Defaults to current directory.")
    args = parser.parse_args()
    try:
        server = create_server(args.root or [str(Path.cwd())])
    except ImportError:
        parser.exit(1, 'Install MCP support: uv tool install "ply-visualizer[mcp]"\n')
    except (ValueError, OSError) as error:
        parser.exit(1, f"ply-viewer-mcp: {error}\n")
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
