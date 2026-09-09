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
import threading
from typing import Any, Literal
import re

from .session import FORMATS, MODEL_ASSETS, show
from .diagnostics import VERSION, build_info
from .depth import DepthCalibration, show_depth, show_colmap


CORE_TOOLS = frozenset({"open_3d_files", "visualize_points", "inspect_3d_scene", "capture_3d_view", "set_3d_camera", "navigate_3d_view", "list_3d_scenes", "close_3d_scene"})
APP_TOOLS = frozenset({"read_viewer_data", "submit_viewer_reply"})


class SceneManager:
    def __init__(self, roots, max_scenes=8, renderer="inline"):
        self.renderer = renderer
        self.roots = [Path(root).expanduser().resolve(strict=True) for root in roots]
        if not self.roots or any(not root.is_dir() for root in self.roots):
            raise ValueError("Provide at least one existing workspace directory")
        self.max_scenes = max_scenes
        self.scenes = {}
        self._lock = threading.RLock()

    def path(self, name):
        file = Path(name).expanduser()
        file = (file if file.is_absolute() else self.roots[0] / file).resolve(strict=True)
        if not any(file.is_relative_to(root) for root in self.roots):
            raise ValueError("File is outside the configured --root directories")
        if not file.is_file() or file.suffix.lower() not in FORMATS | MODEL_ASSETS:
            raise ValueError("Expected a supported 3D file")
        return file

    def get(self, scene_id):
        if scene_id not in self.scenes:
            raise ValueError("Unknown scene_id; use list_3d_scenes")
        return self.scenes[scene_id]

    def add(self, factory, ctx=None, external_browser=False):
        with self._lock:
            if len(self.scenes) >= self.max_scenes:
                raise ValueError("Close an existing scene before opening another (limit 8)")
            scene_id = uuid.uuid4().hex
            viewer = factory()
            self.scenes[scene_id] = viewer
            try:
                try:
                    host = getattr(ctx, "client_capabilities", None) if self.renderer == "auto" else None
                except (RuntimeError, ValueError):
                    host = None
                data = host.model_dump(by_alias=True) if hasattr(host, "model_dump") else {}
                inline = "io.modelcontextprotocol/ui" in (data.get("extensions") or {})
                if self.renderer == "headless" or (self.renderer == "auto" and not inline and not external_browser):
                    viewer.start_headless()
            except Exception:
                self.scenes.pop(scene_id)
                viewer.close()
                raise
            return self.describe(scene_id)

    def describe(self, scene_id):
        viewer = self.get(scene_id)
        with viewer._lock:
            manifest = viewer._manifest()
        return {"scene_id": scene_id, "build": build_info(), "url": viewer.url, "revision": manifest["revision"],
                "files": [entry["name"] for entry in manifest["files"]],
                "status": "submitted", "renderer_mode": "headless" if viewer._headless else "inline", "connection": viewer._bridge.connection(), "renderer_id": viewer._bridge.renderer_id(), "note": "Use inspect_3d_scene to verify rendering. Inline MCP App renders via MCP. No browser tab is opened unless explicitly requested."}

    def close(self):
        for viewer in self.scenes.values():
            viewer.close()
        self.scenes.clear()


def browser_default(ctx, requested):
    if requested is not None:
        return requested
    return False

def create_server(roots, *, extensions=None, transport="stdio", task_store=None, tools="full", renderer="inline"):
    if tools not in {"core", "full"}: raise ValueError("tools must be core or full")
    if renderer not in {"auto", "inline", "headless"}: raise ValueError("renderer must be auto, inline or headless")
    from mcp.server import MCPServer
    from mcp.server.mcpserver import Image, Context
    from mcp_types import ToolAnnotations, CallToolResult, TextContent, ImageContent
    from pydantic import Field
    from typing import Annotated

    def explain_errors(fn):
        @wraps(fn)
        def run(*args, **kwargs):
            try:
                return fn(*args, **kwargs)
            except (RendererError, TimeoutError, ValueError, FileNotFoundError, PermissionError, RuntimeError) as error:
                code = ("renderer_timeout" if isinstance(error, TimeoutError) else
                        "renderer_error" if isinstance(error, RendererError) else
                        "permission_denied" if isinstance(error, PermissionError) else
                        "not_found" if isinstance(error, FileNotFoundError) else "invalid_argument")
                payload = {"ok": False, "error": {"code": code, "message": str(error)}}
                return CallToolResult(is_error=True, structured_content=payload,
                    content=[TextContent(type="text", text=json.dumps(payload))])
        return run

    def image_result(result, png=None):
        content = [TextContent(type="text", text=json.dumps(result))]
        if png:
            base64.b64decode(png, validate=True)
            content.append(ImageContent(type="image", data=png, mime_type="image/png"))
        return CallToolResult(content=content, structured_content=result)

    points_type = Annotated[list[tuple[float, float, float]], Field(min_length=1, max_length=20000)]
    manager = SceneManager(roots, renderer=renderer)
    task_extension = None
    if task_store is not None:
        from .tasks import ViewerTasks, invoke_complete
        task_extension = ViewerTasks(task_store)
        extensions = [*(extensions or []), task_extension]

    @asynccontextmanager
    async def lifespan(server):
        try:
            yield {}
        finally:
            if task_store is not None: await task_store.close()
            manager.close()

    server = MCPServer("3d-visualizer", version=VERSION, lifespan=lifespan, extensions=extensions,
        instructions="Inspect 3D data inline. Reuse scene_id; replies are compact by default, detail=full adds attributes and coordinate conventions. Inspect after loading and capture to verify. Compare build IDs and rendered_revision; submitted is not rendered. Use source units, never assume meters. Browser opening and URL downloads must be explicit. Alignment is asynchronous: poll status; complex align-all is opt-in. See viewer://capabilities and viewer://workflows for supported formats.")
    def tool(**options):
        def register(fn):
            if tools == "full" or fn.__name__ in CORE_TOOLS | APP_TOOLS:
                return server.tool(**options)(fn)
            return fn
        return register

    readonly = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)
    local = ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=False)

    ui_meta = {"ui": {"resourceUri": "ui://ply-visualizer/viewer.html"}}

    @server.resource("ui://ply-visualizer/viewer.html", mime_type="text/html;profile=mcp-app",
                     meta={"ui": {"csp": {"connectDomains": [], "resourceDomains": []}, "prefersBorder": True}})
    def viewer_app() -> str:
        """Interactive 3D viewer rendered directly in the MCP App; no nested iframe or localhost fetch."""
        return (Path(__file__).parent / "_mcp_app" / "viewer.html").read_text(encoding="utf-8")

    @tool(annotations=local, meta=ui_meta, structured_output=True)
    @explain_errors
    def open_3d_files(paths: Annotated[list[str], Field(min_length=1, max_length=32)], ctx: Context, open_browser: bool | None = None, scene_id: str | None = None) -> dict[str, Any]:
        """Open local point clouds/meshes/splats/animated models together. Pass scene_id to append while preserving camera and existing objects. Include explicit supporting .bin/textures for GLTF/DAE/FBX; no implicit disk or network reads. Paths must be under configured roots. Returns a persistent scene_id and local URL; inspect to verify loading."""
        files = [manager.path(path) for path in paths]
        if scene_id is not None:
            manager.get(scene_id).add_files(files)
            return manager.describe(scene_id)
        return manager.add(lambda: show(*files, open_browser=browser_default(ctx, open_browser)), ctx, bool(open_browser))

    @tool(annotations=local, meta=ui_meta, structured_output=True)
    @explain_errors
    def open_depth_image(path: str, ctx: Context, calibration: DepthCalibration | None = None,
                         rgb: str | None = None, confidence: str | None = None, mask: str | None = None,
                         scene_id: str | None = None, colmap_image: str | None = None,
                         colmap_variant: Literal["geometric", "photometric"] = "geometric") -> dict[str, Any]:
        """Project a depth/disparity raster inline using explicit calibration from surrounding files/context. Read viewer://depth-calibration for coefficient ordering and encoding. Calibration dimensions must match the raster; no parameter guessing. Supports NPY/NPZ, TIFF, PNG8/16, EXR, PFM and COLMAP dense .bin. Optional aligned RGB (HxWx3, 0..255), confidence and mask files. Pass scene_id to append without moving the camera. For a COLMAP dense workspace, set path=workspace and colmap_image=exact image name; calibration comes from its undistorted sparse model. Inspect after loading for pixel counts, provenance and projection diagnostics; picks/exports retain original pixel coordinates and raw values."""
        existing = manager.get(scene_id) if scene_id else None
        if colmap_image is not None:
            if calibration is not None or any(v is not None for v in (rgb, confidence, mask)):
                raise ValueError("COLMAP workspace mode derives calibration; use raster mode for explicit calibration/companions")
            root = Path(path).expanduser()
            root = (root if root.is_absolute() else manager.roots[0] / root).resolve(strict=True)
            if not root.is_dir() or not any(root.is_relative_to(allowed) for allowed in manager.roots):
                raise ValueError("COLMAP workspace must be a directory inside configured roots")
            factory = lambda: show_colmap(root, image=colmap_image, variant=colmap_variant, session=existing, open_browser=False)
        else:
            if calibration is None: raise ValueError("Explicit calibration is required; read parameter files/context and provide width,height,fx,fy,cx,cy,kind. No calibration is inferred from image pixels.")
            inputs = {key: manager.path(value) if value is not None else None for key, value in (("rgb", rgb), ("confidence", confidence), ("mask", mask))}
            depth_path = manager.path(path)
            factory = lambda: show_depth(depth_path, calibration=calibration, session=existing, open_browser=False, **inputs)
        if scene_id:
            factory()
            return manager.describe(scene_id)
        return manager.add(factory, ctx)

    @server.resource("viewer://depth-calibration")
    def depth_calibration_schema() -> str:
        """Explicit depth encoding, camera model coefficients, and provenance conventions."""
        return json.dumps({
            "required": ["width", "height", "fx", "fy", "cx", "cy", "kind"],
            "intrinsics": "Pixel coordinates at the exact raster resolution. Adjust for crop/resize explicitly; never infer focal length or metric scale from pixels.",
            "kind": {"z": "axial meters", "depth": "ray range meters", "disparity": "rectified horizontal pixel disparity; Z=fx*baseline/(raw*value_scale+value_offset+disparity_offset)", "inverse_depth": "inverse axial meters; Z=1/(raw*value_scale+value_offset)"},
            "raw_values": "For depth/z: meters=raw*value_scale+value_offset. invalid_values (default [0]), nonfinite values, mask=0 and low confidence are removed before conversion; nonpositive depth is removed. min/max_depth are in output depth units.",
            "models": {"pinhole-ideal": [], "pinhole-opencv": ["k1", "k2", "p1", "p2", "k3", "k4", "k5", "k6", "s1", "s2", "s3", "s4", "tauX", "tauY"], "fisheye-opencv": ["k1", "k2", "k3", "k4"], "fisheye-kb3": ["k0", "k1", "k2", "k3"], "fisheye624": ["k0", "k1", "k2", "k3", "k4", "k5", "p0", "p1", "s0", "s1", "s2", "s3"], "fisheye-equidistant": [], "e57-pinhole": [], "e57-spherical": [], "e57-cylindrical": []},
            "coefficients": "pinhole-opencv accepts 4,5,8,12,14 in listed order; other models require exactly the listed count. See the shared camera model documentation for model equations. Rectified input must use rectified intrinsics and zero distortion; disparity requires image_rectified=true and pinhole-ideal.",
            "coordinates": "convention defaults opencv: +X right,+Y down,+Z forward. opengl: +X right,+Y up,-Z forward. camera_to_world: optional column-major affine 4x4, operating in chosen camera convention. Input pixel (0,0) is top left.",
            "sources": "Map each parameter/group to the source calibration file and key, or explicit user assumption. Agent reads context; server never scans arbitrary directories.",
            "selection": "array_key required for ambiguous NPZ; channel required for multi-channel depth. Picks and subset exports include pixel_u,pixel_v,raw_depth_value,depth_value,confidence when supplied, and source_row=v*width+u.",
            "colmap": "Use path=dense workspace, colmap_image=exact name, colmap_variant=geometric(default) or photometric. Uses sparse undistorted camera, rescales its intrinsics to depth resolution, and inverts the stored world-to-camera pose. Units remain reconstruction units, not assumed meters."
        })

    @tool(annotations=local, meta=ui_meta, structured_output=True)
    @explain_errors
    def visualize_points(points: points_type, ctx: Context, colors: points_type | None = None,
                         target: points_type | None = None, vectors: points_type | None = None,
                         vector_scale: float = 1.0, open_browser: bool | None = None) -> dict[str, Any]:
        """Visualize up to 20,000 XYZ points, optional RGB (integer 0..255), target overlay, or anchored vector arrows. Use files for larger data; coordinates are not automatically normalized."""
        return manager.add(lambda: show(points, colors=colors, target=target, vectors=vectors,
                                      vector_scale=vector_scale, open_browser=browser_default(ctx, open_browser)), ctx, bool(open_browser))

    @tool(annotations=ToolAnnotations(readOnlyHint=False, destructiveHint=False, openWorldHint=True), meta=ui_meta, structured_output=True)
    @explain_errors
    def open_3d_url(url: str | list[str], ctx: Context, filename: str | None = None,
                    scene_id: str | None = None,
                    max_bytes: Annotated[int, Field(ge=1, le=1024 * 1024 * 1024)] = 256 * 1024 * 1024) -> dict[str, Any]:
        """Download one URL or a list of direct HTTP(S) 3D files into one scene; pass scene_id to append. Self-contained models recommended; external resources are not fetched implicitly. Download each file on the local MCP server and open it inline. This makes a network request to the supplied URL and redirects; no browser CORS is needed. Supports the same formats as local files plus gzip. Supply filename for extensionless/signed URLs. Defaults to a 256 MiB transfer/decompressed limit, at most 1 GiB; 30-second socket and 120-second transfer limits. No login/cookies or webpage extraction. Temporary files are deleted when the scene closes."""
        from .remote import open_remote
        if scene_id is not None: manager.get(scene_id)
        urls = [url] if isinstance(url, str) else url
        if not 1 <= len(urls) <= 32: raise ValueError("Provide 1..32 URLs")
        if len(urls) > 1 and filename: raise ValueError("filename is only supported for one URL")
        from contextlib import ExitStack
        with ExitStack() as cleanup:
            downloads = [cleanup.enter_context(open_remote(item, filename, max_bytes)) for item in urls]
            files = [file for download in downloads for file in download._files]
            if scene_id is None:
                result = manager.add(lambda: show(*files, open_browser=False), ctx)
                viewer = manager.get(result["scene_id"])
            else:
                viewer = manager.get(scene_id)
                viewer.add_files(files)
                result = manager.describe(scene_id)
            for download in downloads:
                viewer._downloads.append(download._temporary)
                download._temporary = None
            return result

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def update_3d_scene(scene_id: str, points: points_type, colors: points_type | None = None,
                        target: points_type | None = None, vectors: points_type | None = None,
                        vector_scale: float = 1.0) -> dict[str, Any]:
        """Replace the existing scene's geometry while preserving its camera. Omitted overlays/vectors are removed. Reuses the active inline viewer or explicit browser fallback."""
        manager.get(scene_id).update(points, colors=colors, target=target, vectors=vectors, vector_scale=vector_scale)
        return manager.describe(scene_id)

    @tool(annotations=readonly, structured_output=True)
    @explain_errors
    def list_3d_scenes() -> dict[str, Any]:
        """List scenes owned by this MCP process and their local viewer URLs."""
        with manager._lock:
            return {"scenes": [manager.describe(scene_id) for scene_id in manager.scenes]}

    @tool(annotations=readonly)
    @explain_errors
    def inspect_3d_scene(scene_id: str, detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Inspect loaded geometry and build IDs (Python package/server and actual renderer; renderer_matches_bundle detects an old widget). Read coordinate conventions/units, camera position/direction/rotation center, projection and viewport, object transforms, opacity/color, exposure/background, selection criteria, geometry counts and bounds from the active inline viewer or explicit browser fallback. Times out if no renderer responds. Compare rendered_revision with the submitted revision."""
        result = manager.get(scene_id)._bridge.request("inspect", {"detail": detail})
        build = build_info()
        actual = result.get("renderer_build", {})
        expected = build["renderer_bundle"].get("renderer_build_id")
        return {**result, "build": build, "renderer_matches_bundle": bool(expected and actual.get("renderer_build_id") == expected)}

    @tool(annotations=local)
    @explain_errors
    def set_3d_camera(scene_id: str, fit: bool = False, position: tuple[float, float, float] | None = None,
        target: tuple[float, float, float] | None = None, up: tuple[float, float, float] | None = None,
        rotation: tuple[float, float, float] | None = None,
        fov: Annotated[float, Field(gt=0, lt=180)] | None = None, detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Partially update camera position, target (rotation center), up or vertical FOV in degrees. Rotation is absolute XYZ Euler degrees; it moves target along camera -Z at the previous pivot distance. Rotation cannot combine with target/up. Fit frames visible geometry, optionally at the new FOV. Returns applied view state."""
        if fit and any(v is not None for v in (position, target, up, rotation)):
            raise ValueError("Use fit or explicit camera vectors, not both")
        if rotation is not None and (target is not None or up is not None):
            raise ValueError("Use rotation or target/up, not both")
        if not all(math.isfinite(v) for vector in (position, target, up, rotation) if vector is not None for v in vector):
            raise ValueError("Camera vectors must be finite")
        if up is not None and not any(up): raise ValueError("up must be nonzero")
        return command(scene_id, "camera", dict(detail=detail, fit=fit, position=position, target=target, up=up, rotation=rotation, fov=fov))

    @tool(annotations=readonly)
    @explain_errors
    def capture_3d_view(scene_id: str) -> Image:
        """Return an actual PNG of the rendered 3D canvas (maximum 1024 pixels per side) so the agent can visually inspect the result. Requires an active inline viewer or explicit browser fallback."""
        result = manager.get(scene_id)._bridge.request("capture")
        return Image(data=base64.b64decode(result["png"], validate=True), format="png")

    @tool(annotations=local)
    @explain_errors
    def close_3d_scene(scene_id: str) -> dict[str, Any]:
        """Release a viewer's local server and temporary data. Does not delete the user's source files. Any active viewer disconnects."""
        with manager._lock:
            manager.get(scene_id).close()
            del manager.scenes[scene_id]
        return {"closed": scene_id}

    def command(scene_id, operation, arguments):
        return manager.get(scene_id)._bridge.request(operation, {k: v for k, v in arguments.items() if v is not None})

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def navigate_3d_view(scene_id: str,
        action: Literal["fit", "preset", "orbit", "pan", "zoom", "origin", "pivot", "pick"],
        preset: Literal["front", "back", "top", "bottom", "left", "right", "isometric"] | None = None,
        vector: tuple[float, float, float] | None = None,
        screen: tuple[Annotated[float, Field(ge=0, le=1)], Annotated[float, Field(ge=0, le=1)]] | None = None,
        yaw: float = 0, pitch: float = 0,
        factor: Annotated[float, Field(gt=0, le=100)] = 1, detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Navigate without UI. Fit tightly; presets use Y-up OpenGL. Orbit angles are degrees. Pan/pivot use world XYZ. Zoom <1 moves closer. Pick uses normalized canvas XY (top-left=0,0) and sets rotation center on visible geometry, like double-click. Origin resets pivot to 0,0,0."""
        if action == "preset" and preset is None: raise ValueError("preset is required")
        if action in ("pan", "pivot") and vector is None: raise ValueError("vector is required")
        if action == "pick" and screen is None: raise ValueError("screen is required")
        if not all(math.isfinite(v) for v in (* (vector or ()), yaw, pitch, factor)):
            raise ValueError("Coordinates and angles must be finite")
        return command(scene_id, "navigate", dict(detail=detail, action=action, preset=preset, vector=vector, screen=screen, yaw=yaw, pitch=pitch, factor=factor))

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def set_3d_appearance(scene_id: str, brightness: Annotated[float, Field(ge=-10, le=10)] | None = None,
                          background: Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")] | None = None,
        axes: bool | None = None, grid: bool | None = None, legend: bool | None = None,
        gamma_correction: bool | None = None,
        theme: Literal["dark-modern", "light-modern"] | None = None, detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Set exposure stops, background #RRGGBB, persistent pivot axes, coordinate grid, object/color legend and UI theme. gamma_correction matches the UI toggle: true treats source RGB as linear (extra gamma appearance); false decodes sRGB before shading. Enabled grid/legend are also included in agent PNG captures. Axes may briefly appear during interaction when persistent axes are off."""
        return command(scene_id, "appearance", dict(detail=detail, brightness=brightness, background=background, axes=axes, grid=grid, legend=legend, gamma_correction=gamma_correction, theme=theme))

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def set_3d_object(scene_id: str, object_index: Annotated[int, Field(ge=0)],
        point_size: Annotated[float, Field(gt=0, le=1000)] | None = None,
        point_size_mode: Literal["adaptive", "fixed"] | None = None,
        point_size_pixels: Annotated[float, Field(ge=1, le=64)] | None = None,
        opacity: Annotated[float, Field(ge=0, le=1)] | None = None,
        visible: bool | None = None, mode: Literal["points", "mesh"] | None = None,
        color: Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")] | None = None,
        color_mode: Annotated[str, Field(pattern=r"^(original|recolored|assigned|[0-9]+|intensity|intensity-grayscale|intensity-viridis|intensity-colors|scalar:[^:]+:(viridis|grayscale|colors))$")] | None = None, detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Set overlay opacity (0..1), visibility, world-unit point size (or point_size_mode=adaptive for a camera-dependent 2/4/8 pixel target; point_size_pixels=1..64 explicitly sets that target and enables adaptive sizing), points/mesh representation, fixed RGB color or original/intensity/scalar coloring. Get object_index, scalar_fields and available_color_modes from inspection; these include palette indices and projected colors when available. Mesh requires faces. Fixed color and color_mode are mutually exclusive."""
        if point_size is not None and (point_size_mode == "adaptive" or point_size_pixels is not None): raise ValueError("Choose point_size or adaptive sizing")
        if point_size_pixels is not None and point_size_mode == "fixed": raise ValueError("point_size_pixels enables adaptive mode; do not combine with fixed")
        if color is not None and color_mode is not None: raise ValueError("Provide color or color_mode")
        return command(scene_id, "object", dict(detail=detail, object_index=object_index, point_size_mode=point_size_mode, point_size_pixels=point_size_pixels, opacity=opacity, point_size=point_size, visible=visible, mode=mode, color=color, color_mode=color_mode))

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def transform_3d_object(scene_id: str, object_index: Annotated[int, Field(ge=0)],
        action: Literal["matrix", "translate", "rotate", "quaternion", "scale", "invert", "reset", "undo"],
        vector: tuple[float, float, float] | None = None,
        angle: float | None = None, quaternion: tuple[float, float, float, float] | None = None,
        matrix: Annotated[list[float], Field(min_length=16, max_length=16)] | None = None,
        space: Literal["local", "world"] = "local", replace: bool = False,
        pivot: Literal["center"] | tuple[float, float, float] | None = None, detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Transform one cloud/mesh without changing source files or camera. Translate/scale use vector XYZ; rotate uses vector axis plus angle degrees (90 for quarter turns); quaternion uses XYZW, normalized. Matrix is affine 4x4 COLUMN-MAJOR, matching inspection (transpose row-major UI input). Default composes current*delta in local space; world uses delta*current. pivot=center rotates/scales around the current bounding-box center; explicit XYZ pivot uses the chosen space; omitted pivot is the coordinate origin. Undo restores the last of up to 50 agent edits per object. replace=True sets an absolute transform. Invert/reset act on the current matrix. Inspect local_to_world to verify. Visibility, point size and coloring use set_3d_object."""
        if pivot is not None and (replace or action not in ("rotate", "quaternion", "scale")): raise ValueError("pivot requires composed rotation or scale")
        if pivot is not None and pivot != "center" and not all(math.isfinite(v) for v in pivot): raise ValueError("pivot must be finite")
        if action in ("translate", "scale", "rotate") and vector is None: raise ValueError("vector is required")
        if action == "rotate" and (angle is None or not any(vector)): raise ValueError("Nonzero rotation axis and angle are required")
        if action == "quaternion" and (quaternion is None or not any(quaternion)): raise ValueError("Nonzero XYZW quaternion is required")
        if action == "matrix" and matrix is None: raise ValueError("16 column-major matrix values are required")
        if not all(math.isfinite(v) for v in (*(vector or ()), *(quaternion or ()), *(matrix or ()), angle or 0)):
            raise ValueError("Transform values must be finite")
        if action == "matrix" and [matrix[i] for i in (3, 7, 11, 15)] != [0, 0, 0, 1]:
            raise ValueError("Matrix must be affine: last row 0,0,0,1")
        return command(scene_id, "transform", dict(detail=detail, object_index=object_index, action=action, vector=vector, angle=angle, quaternion=quaternion, matrix=matrix, space=space, replace=replace, pivot=pivot))

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def measure_3d_scene(scene_id: str, action: Literal["list", "distance", "path_point", "undo", "close_path", "clear"],
        start: tuple[float, float, float] | None = None, end: tuple[float, float, float] | None = None, detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Add/list/clear visible measurements in scene units. Distance uses start/end XYZ; path_point appends end to the active path; undo removes its last point; close_path toggles closure."""
        if action == "distance" and (start is None or end is None): raise ValueError("start and end are required")
        if action == "path_point" and end is None: raise ValueError("end is required")
        if not all(math.isfinite(v) for v in (*(start or ()), *(end or ()))): raise ValueError("Coordinates must be finite")
        return command(scene_id, "measure", dict(detail=detail, action=action, start=start, end=end))

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def control_3d_video(scene_id: str, action: Literal["list", "add", "remove", "goto", "update", "loop", "play", "stop"],
        object_index: Annotated[int, Field(ge=0)] | None = None,
        time: Annotated[float, Field(ge=0)] | None = None,
        speed: Annotated[float, Field(gt=0, le=100)] | None = None,
        index: Annotated[int, Field(ge=0)] | None = None, enabled: bool | None = None,
        duration: Annotated[float, Field(gt=0, le=3600)] | None = None,
        dwell: Annotated[float, Field(ge=0, le=3600)] | None = None, detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Control camera keyframes, or model animation when object_index is supplied. Model: list clips, update(index/speed), play, stop (pause), loop(enabled), goto(time in seconds, pauses). GLB/GLTF/FBX/DAE retain supported embedded animation; 3DS is static. With no object_index, manage camera keyframes: Add captures current camera. Update sets segment duration/dwell in seconds. Loop requires enabled; play needs two keyframes; stop restores camera. Returns reusable keyframe poses."""
        if object_index is None and action in ("remove", "goto", "update") and index is None: raise ValueError("index is required")
        if action == "loop" and enabled is None: raise ValueError("enabled is required")
        return command(scene_id, "video", dict(detail=detail, action=action, index=index, enabled=enabled, duration=duration, dwell=dwell, object_index=object_index, time=time, speed=speed))

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def align_3d_clouds(scene_id: str,
        action: Literal["auto", "icp", "correspondences", "align_all", "refine_all", "status", "undo"],
        source_index: Annotated[int, Field(ge=0)] | None = None,
        target_index: Annotated[int, Field(ge=0)] = 0,
        strategy: Literal["anchor", "nested", "complex"] = "anchor",
        up_axis: Literal["x", "y", "z"] = "y",
        against_all_others: bool = False,
        source_points: Annotated[list[tuple[float, float, float]], Field(min_length=3, max_length=256)] | None = None,
        target_points: Annotated[list[tuple[float, float, float]], Field(min_length=3, max_length=256)] | None = None, detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Start a registration job, then poll action=status until job.state is completed/failed; submitted is not aligned. Reuses the viewer's Rust solvers. auto: level/up-axis yaw sweep then ICP; icp: refine an already close pair; correspondences: fit >=3 non-collinear paired world XYZ landmarks. source_index moves, target_index stays fixed. align_all/refine_all hold target fixed; strategies anchor (each to anchor), nested (grow aligned union), complex (grow with extra hypotheses). For auto/icp, against_all_others matches the moving cloud to the union of all other clouds. No scale/nonrigid estimation. up_axis describes the DATA, not the camera (default y); use z for Z-up scans. Clear temporary selections first. Undo restores transforms from the last accepted agent job. Inspection/capture remain available; geometry refresh waits for alignment. Partial align-all failures are reported per object."""
        if action in ("auto", "icp", "correspondences") and source_index is None: raise ValueError("source_index is required")
        if action == "correspondences":
            if source_points is None or target_points is None or len(source_points) != len(target_points): raise ValueError("Provide equal-length source_points and target_points, at least 3 pairs")
            if not all(math.isfinite(v) and abs(v) <= 3.4028234663852886e38 for p in source_points + target_points for v in p): raise ValueError("Landmarks must be finite float32 world coordinates")
        elif source_points is not None or target_points is not None: raise ValueError("Landmarks are only used by correspondences")
        if against_all_others and action not in ("auto", "icp"): raise ValueError("against_all_others is only used by auto/icp")
        if action != "align_all" and strategy != "anchor": raise ValueError("nested/complex strategies apply to align_all only")
        return command(scene_id, "alignment", dict(detail=detail, action=action, source_index=source_index, target_index=target_index, strategy=strategy, up_axis=up_axis, against_all_others=against_all_others, source_points=source_points, target_points=target_points))

    @tool(annotations=readonly, structured_output=True)
    @explain_errors
    def pick_3d_point(scene_id: str, screen: tuple[Annotated[float, Field(ge=0, le=1)], Annotated[float, Field(ge=0, le=1)]], detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Pick normalized canvas XY without moving the camera. Returns hit/miss, world XYZ, object and decoded point indices and scalar attributes. Mesh/splat picks may have null indices; never infer object identity from those."""
        return command(scene_id, "pick", dict(detail=detail, screen=screen))

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def manage_3d_views(scene_id: str, action: Literal["save", "restore", "list", "delete", "undo"],
                        name: Annotated[str, Field(min_length=1, max_length=100)] | None = None, detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Save/restore named camera views for this renderer session; undo the last agent camera change (up to 50). Names are not persisted after closing/reloading the widget. Does not restore geometry or filters."""
        if action in ("save", "restore", "delete") and name is None: raise ValueError("name is required")
        return command(scene_id, "views", dict(detail=detail, action=action, name=name))

    @tool(annotations=local)
    @explain_errors
    def select_3d_region(scene_id: str, action: Literal["select", "clear"] = "select",
        object_index: Annotated[int, Field(ge=0)] = 0,
        field: str | None = None, values: list[float] | None = None,
        bounds: tuple[float, float, float, float, float, float] | None = None,
        plane: tuple[float, float, float, float] | None = None,
        isolate: bool = True, focus: bool = True, highlight: bool = True, preview: bool = True, detail: Literal["summary", "full"] = "summary") -> CallToolResult:
        """One-step select/isolate/focus with PNG preview. Select all points in an object, or intersect scalar field values, world box [minX,minY,minZ,maxX,maxY,maxZ], and plane halfspace ax+by+cz+d>=0. Creates a reversible highlighted point subset; clear restores prior visibility. Label IDs are numeric, not semantic object names: inspect attributes/pick first. No automatic segmentation; point clouds only. Replaces the previous selection. Disable highlight to preserve original colors. Moving the plane requires another select call."""
        if (field is None) != (values is None): raise ValueError("field and values must be supplied together")
        if values is not None and not 0 < len(values) <= 1024: raise ValueError("Provide 1..1024 values")
        if not all(math.isfinite(v) for v in (*(values or ()), *(bounds or ()), *(plane or ()))): raise ValueError("Region values must be finite")
        if bounds and any(bounds[i] > bounds[i+3] for i in range(3)): raise ValueError("Box min must not exceed max")
        if plane and not any(plane[:3]): raise ValueError("Plane normal must be nonzero")
        result = command(scene_id, "selection", dict(detail=detail, action=action, object_index=object_index, field=field, values=values, bounds=bounds, plane=plane, isolate=isolate, focus=focus, highlight=highlight, preview=preview))
        png = result.pop("png", None)
        return image_result(result, png)

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def manage_3d_selections(scene_id: str, action: Literal["save", "list", "delete", "activate", "visible", "union", "intersection", "subtract"],
        name: Annotated[str, Field(min_length=1, max_length=100)] | None = None,
        other: Annotated[str, Field(min_length=1, max_length=100)] | None = None,
        visible: bool | None = None, isolate: bool = False, focus: bool = False,
        detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Name the active selection; retain up to 20 independent subsets. Toggle each name's visibility or activate/focus it. Union/intersection/subtract combine two names from the same source into a new active selection; save it to retain it. Defaults isolate=False and focus=False preserve existing visibility and camera. Empty set results return status=empty, clear the active selection, and cannot export the previous result. Geometry updates expire selections; scene-state export persists them."""
        if action != "list" and name is None: raise ValueError("name is required")
        if action in ("union", "intersection", "subtract") and other is None: raise ValueError("other is required")
        if action == "visible" and visible is None: raise ValueError("visible is required")
        return command(scene_id, "named_selections", dict(action=action,name=name,other=other,visible=visible,isolate=isolate,focus=focus,detail=detail))

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def manage_3d_scene_states(scene_id: str, action: Literal["save", "restore", "list", "delete", "export", "import", "export_models"],
        name: Annotated[str, Field(min_length=1, max_length=100)] | None = None,
        path: str | None = None, restore: bool = False, detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Save/restore complete camera, transforms, selection/named subsets, visibility, color, opacity and presentation. Export/import a .json under configured roots to persist after restarting. Reopen identical geometry in the same order before import; import stores a state; restore=True imports and applies it in one call. Existing files are never overwritten. Maximum 20 states, 4 MiB each. JSON does not embed geometry or playback. action=export_models writes all visible models as a new .glb (no name required), including supported native animation clips. GLB excludes Gaussian splats, grid/UI, source-row attributes and point-size settings; use subset PLY for analysis attributes. Export limit 256 MiB."""
        if action == "export_models":
            if path is None: raise ValueError("path is required")
            from .inspection_files import export_subset
            return export_subset(manager,scene_id,path,models=True)
        if action != "list" and name is None: raise ValueError("name is required")
        if action in ("export", "import"):
            if path is None: raise ValueError("path is required")
            from .inspection_files import scene_state_file
            return scene_state_file(manager,scene_id,action,name,path,restore=restore)
        return command(scene_id,"scene_states",dict(action=action,name=name,detail=detail))

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def export_3d_selection(scene_id: str, path: str,
        name: Annotated[str, Field(min_length=1, max_length=100)] | None = None) -> dict[str, Any]:
        """Write the active or named subset to a NEW binary .ply under configured roots (maximum 256 MiB). Preserve decoded RGB, normals, scalar attributes, decoded indices, and original source_row when available (depth raster: pixel_v*width+pixel_u). Coordinates are object-local; header stores local_to_world and source origin. Returns a path, never point data/base64. No overwrite; not a lossless copy of the original file's numeric types."""
        from .inspection_files import export_subset
        return export_subset(manager,scene_id,path,name)

    @tool(annotations=local, structured_output=True)
    @explain_errors
    def compare_3d_clouds(scene_id: str, action: Literal["enable", "disable", "status", "distance", "recompute"],
        left: Annotated[int, Field(ge=0)] = 0, right: Annotated[int, Field(ge=0)] = 1,
        method: Literal["nearest", "paired"] = "nearest",
        max_distance: Annotated[float, Field(gt=0)] = 0.1,
        detail: Literal["summary", "full"] = "summary") -> dict[str, Any]:
        """Enable linked side-by-side WebGL views with the same camera (EDL off in split mode); disable restores ordinary rendering. Distance colors left by world-space distance to right: nearest within max_distance, unmatched=NaN; paired uses corresponding decoded order and requires equal counts. Distance limit: one million combined points. Changes mark distances stale; recompute with action=recompute,left=<source> reuses recorded settings. Restored distance fields require an explicit distance computation. No alignment is run."""
        return command(scene_id,"comparison",dict(action=action,left=left,right=right,method=method,max_distance=max_distance,detail=detail))

    @tool(annotations=readonly)
    @explain_errors
    def preview_3d_views(scene_id: str,
        presets: Annotated[list[Literal["front", "back", "top", "bottom", "left", "right", "isometric"]], Field(min_length=1,max_length=4)] = ["front", "top", "isometric"]) -> CallToolResult:
        """Return one labeled multi-view PNG to choose a useful angle, preserving the original camera. Disable split comparison first. Includes enabled grid, legend and selection summary."""
        result=command(scene_id,"multi_view",dict(presets=presets))
        png=result.pop("png")
        return image_result(result, png)

    @tool(annotations=readonly, meta={"ui": {"visibility": ["app"]}}, structured_output=True)
    @explain_errors
    def read_viewer_data(scene_id: str, resource: str, offset: Annotated[int, Field(ge=0)] = 0, renderer_id: Annotated[str, Field(min_length=1, max_length=128)] | None = None, after: Annotated[int, Field(ge=-1)] = -1) -> dict[str, Any]:
        """App-only transport: session metadata, pending commands or bounded geometry chunks."""
        viewer = manager.get(scene_id)
        if resource == "agent/events":
            return {"generation": viewer.wait_change(after, timeout=5)}
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

    @tool(annotations=local, meta={"ui": {"visibility": ["app"]}}, structured_output=True)
    @explain_errors
    def submit_viewer_reply(scene_id: str, reply: dict[str, Any]) -> dict[str, Any]:
        """App-only transport: acknowledge a rendered command result."""
        return {"accepted": manager.get(scene_id)._bridge.receive(reply)}

    @server.resource("viewer://workflows")
    def workflows() -> str:
        """Short task recipes with success checks; tool schemas define exact arguments."""
        return json.dumps({
            "inspect_unknown_scan": [
                "open_3d_files(paths=[...]) or explicitly requested open_3d_url(url=...). Keep scene_id.",
                "inspect_3d_scene(detail=full): verify renderer_matches_bundle, rendered_revision, counts, attributes, coordinates and units.",
                "preview_3d_views(presets=[front,top,left,isometric]); choose an angle with navigate_3d_view(action=preset).",
                "capture_3d_view: verify actual geometry and legend before describing findings."
            ],
            "compare_prediction_reference": [
                "Open both files together, or append using scene_id; inspect actual object indices.",
                "compare_3d_clouds(action=enable,left=prediction,right=reference) links cameras.",
                "action=distance: paired requires corresponding rows; otherwise nearest needs max_distance in source units.",
                "Check distance.stale=False, summary.nonfinite_count and range. After edits use action=recompute,left=prediction.",
                "Capture both views; unmatched points are not zero error."
            ],
            "select_export_labeled_object": [
                "Inspect attributes with detail=full and discover actual labels; numeric labels have no inferred semantic name.",
                "select_3d_region(field=label,values=[chosen],highlight=False) isolates/focuses by default.",
                "Check isError=False, selected_points and preview. Region errors preserve the old selection: never export after failure.",
                "Optionally manage_3d_selections(action=save,name=object); export_3d_selection(path=new.ply,name=object).",
                "Verify returned points match selected_points. Named set algebra may succeed empty, clearing the active selection."
            ]
        })

    @server.resource("viewer://capabilities")
    def capabilities() -> str:
        """Supported formats, file roots, transport and rendering workflow."""
        import json
        return json.dumps({"build": build_info(), "formats": sorted(FORMATS), "roots": [str(root) for root in manager.roots],
                           "transport": transport, "tool_profile": tools, "renderer_mode": renderer, "headless_available": True, "tasks_extension": task_store is not None, "http_api": "/api/v1" if transport == "streamable-http" else None, "workflows": "viewer://workflows", "inline_mcp_app": True, "inline_requires": "MCP Apps host with app-to-server tools and WebGL",
                           "depth": {"tool": "open_depth_image", "calibration": "viewer://depth-calibration", "formats": ["npy", "npz", "tif", "tiff", "png8/16", "exr", "pfm", "COLMAP dense bin"], "discovery": "agent reads accompanying context and supplies explicit calibration"},
                           "workflow": ["open_3d_files, visualize_points or open_depth_image", "inspect_3d_scene", "set_3d_camera", "capture_3d_view", "close_3d_scene"]})

    if task_extension is not None:
        task_extension.invoke = lambda name, args: invoke_complete(server, name, args)
    return server


def main(argv=None):
    parser = argparse.ArgumentParser(description="Local 3D viewer MCP server (stdio).")
    parser.add_argument("--root", action="append", help="Allowed 3D file directory; repeat for multiple roots. Defaults to current directory.")
    parser.add_argument("--tools", choices=["core", "full"], default="core", help="core: everyday inspection; full: depth, selection, comparison and export")
    parser.add_argument("--renderer", choices=["auto", "inline", "headless"], default="auto", help="auto uses an MCP Apps host when advertised, otherwise headless Chromium")
    parser.add_argument("--task-state-dir", help="Enable persisted MCP Tasks in this single-process state directory")
    args = parser.parse_args(argv)
    try:
        task_store = None
        if args.task_state_dir:
            from .tasks import TaskStore
            directory = Path(args.task_state_dir)
            directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            task_store = TaskStore(directory / 'tasks.sqlite')
        server = create_server(args.root or [str(Path.cwd())], task_store=task_store, tools=args.tools, renderer=args.renderer)
    except ImportError:
        parser.exit(1, 'Install MCP support: uv tool install "3d-visualizer[mcp]"\n')
    except (ValueError, OSError) as error:
        parser.exit(1, f"3d-visualizer-mcp: {error}\n")
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
