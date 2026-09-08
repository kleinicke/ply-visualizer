"""Explicit depth jobs for the shared Rust/WASM projection engine.

Calibration is supplied by callers (or read by an agent from surrounding files),
never inferred from pixel values. No NumPy or PyTorch runtime dependency.
"""
from dataclasses import asdict, dataclass, field
import json
import math
import os
from pathlib import Path
import struct
import tempfile


@dataclass
class DepthCalibration:
    """Intrinsics refer to the exact input raster; all lengths use meters.

    kind: z=axial depth, depth=ray range, disparity=rectified horizontal pixel
    disparity, inverse_depth=1/axial meters. Converted raw = raw*value_scale +
    value_offset; disparity uses fx*baseline/(converted_raw+disparity_offset).
    camera_to_world is a column-major affine matrix in the chosen convention.
    sources maps parameter names to calibration file paths/keys or explanations.
    """
    width: int
    height: int
    fx: float
    fy: float
    cx: float
    cy: float
    kind: str
    camera_model: str = "pinhole-ideal"
    coefficients: list[float] = field(default_factory=list)
    image_rectified: bool = False
    convention: str = "opencv"
    value_scale: float = 1.0
    value_offset: float = 0.0
    baseline: float | None = None
    disparity_offset: float = 0.0
    invalid_values: list[float] = field(default_factory=lambda: [0.0])
    min_depth: float | None = None
    max_depth: float | None = None
    min_confidence: float | None = None
    array_key: str | None = None
    channel: int | None = None
    camera_to_world: list[float] | None = None
    sources: dict[str, str] = field(default_factory=dict)

    def validate(self):
        counts = {"pinhole-ideal": [0], "pinhole-opencv": [4, 5, 8, 12, 14],
                  "fisheye-equidistant": [0], "fisheye-opencv": [4],
                  "fisheye-kb3": [4], "fisheye624": [12],
                  "e57-pinhole": [0], "e57-spherical": [0], "e57-cylindrical": [0]}
        if self.camera_model not in counts or len(self.coefficients) not in counts[self.camera_model]:
            raise ValueError("Unsupported camera model or coefficient count; read viewer://depth-calibration")
        if any(type(v) is not int or v <= 0 for v in (self.width, self.height)):
            raise ValueError("width and height must be positive integers matching the input raster")
        numbers = [self.fx, self.fy, self.cx, self.cy, self.value_scale, self.value_offset,
                   self.disparity_offset, *self.coefficients, *self.invalid_values]
        numbers += [v for v in (self.baseline, self.min_depth, self.max_depth, self.min_confidence) if v is not None]
        if not all(math.isfinite(v) for v in numbers) or self.fx <= 0 or self.fy <= 0:
            raise ValueError("Calibration values must be finite, with positive fx and fy")
        if self.kind not in ("z", "depth", "disparity", "inverse_depth"):
            raise ValueError("kind must be z, depth (ray range), disparity, or inverse_depth")
        if self.convention not in ("opencv", "opengl"):
            raise ValueError("convention must be opencv (+Y down,+Z forward) or opengl (+Y up,-Z forward)")
        if self.image_rectified and any(self.coefficients):
            raise ValueError("Rectified images must not apply distortion again; supply the rectified camera and zero coefficients")
        if self.kind == "disparity" and (not self.image_rectified or self.camera_model != "pinhole-ideal" or not self.baseline or self.baseline <= 0):
            raise ValueError("Disparity requires rectified pinhole-ideal intrinsics and a positive baseline in meters")
        if self.min_depth is not None and self.max_depth is not None and self.min_depth >= self.max_depth:
            raise ValueError("min_depth must be smaller than max_depth")
        if self.channel is not None and (type(self.channel) is not int or self.channel < 0):
            raise ValueError("channel must be a nonnegative integer")
        if self.camera_to_world is not None:
            m = self.camera_to_world
            if len(m) != 16 or not all(math.isfinite(v) for v in m) or [m[3], m[7], m[11], m[15]] != [0, 0, 0, 1]:
                raise ValueError("camera_to_world must be a finite column-major affine 4x4 matrix")
        return self


def _raster(source, directory, name):
    if isinstance(source, (str, os.PathLike)):
        path = Path(source).expanduser().resolve(strict=True)
        if not path.is_file(): raise ValueError(f"Not a file: {path}")
        return path
    # Move once, detach internally, and never mutate the caller's array.
    if hasattr(source, "detach"):
        if getattr(source, "is_complex", lambda: False)(): raise ValueError("Depth arrays must be real")
        source = source.detach().cpu()
        if hasattr(source, "resolve_neg"): source = source.resolve_neg()
    shape = list(getattr(source, "shape", []))
    if not shape:
        raise ValueError("Depth arrays require shape (H,W) or (H,W,C); pass a NumPy array or PyTorch tensor")
    if len(shape) not in (2, 3) or any(size <= 0 for size in shape):
        raise ValueError("Depth arrays require nonempty shape (H,W) or (H,W,C)")
    # NPY is understood by the shared Rust decoder; preserve NaN/Inf for filtering.
    header = repr({"descr": "<f4", "fortran_order": False, "shape": tuple(shape)})
    header += " " * ((64 - (10 + len(header) + 1) % 64) % 64) + "\n"
    path = directory / (name + ".npy")
    with path.open("wb") as out:
        out.write(b"\x93NUMPY\x01\x00" + struct.pack("<H", len(header)) + header.encode("ascii"))
        for row in source:
            values = row.reshape(-1).tolist()
            out.write(struct.pack("<" + "f" * len(values), *values))
    return path


def _publish(files, job, temporary, session, inline, open_browser):
    from .session import show
    descriptor = Path(temporary.name) / "depth.plydepth"
    descriptor.write_text(json.dumps({"version": 1, "asset_count": len(files), **job}, allow_nan=False))
    try:
        if session is not None:
            return session.add_files([descriptor, *files], temporary=temporary)
        result = show(descriptor, *files, inline=inline, open_browser=open_browser)
        result._downloads.append(temporary)
        return result
    except BaseException:
        temporary.cleanup()
        raise


def show_depth(depth, *, calibration, rgb=None, confidence=None, mask=None,
               session=None, inline=False, open_browser=None):
    """Show a path or HxW NumPy/PyTorch raster; append with session=existing.

    RGB must be aligned HxWx3 integer samples in 0..255. Mask is HxW nonzero
    valid; confidence is HxW, filtered by calibration.min_confidence.
    File inputs: NPY/NPZ, TIFF, PNG8/16, EXR, PFM, COLMAP dense .bin.
    Calibration dimensions must match; resize/crop calibration explicitly first.
    """
    calibration = (DepthCalibration(**calibration) if isinstance(calibration, dict) else calibration).validate()
    temporary = tempfile.TemporaryDirectory(prefix="ply-depth-")
    try:
        files, roles = [], {}
        for role, source in (("depth", depth), ("rgb", rgb), ("confidence", confidence), ("mask", mask)):
            if source is not None:
                roles[role] = len(files)
                files.append(_raster(source, Path(temporary.name), role))
        return _publish(files, {"roles": roles, "calibration": asdict(calibration)}, temporary, session, inline, open_browser)
    except BaseException:
        temporary.cleanup()
        raise


def show_colmap(workspace, *, image, variant="geometric", session=None, inline=False, open_browser=None):
    """Open one COLMAP dense image using its undistorted sparse calibration.

    Select image by its exact images.txt/bin name. Dense workspaces must contain
    sparse/{cameras,images}.{bin,txt} and stereo/depth_maps/<image>.<variant>.bin.
    No fallback to the original distorted reconstruction or scale guessing.
    """
    root = Path(workspace).expanduser().resolve(strict=True)
    if variant not in ("geometric", "photometric"): raise ValueError("variant must be geometric or photometric")
    def member(name):
        path = (root / name).resolve(strict=True)
        if not path.is_relative_to(root) or not path.is_file(): raise ValueError("COLMAP input must remain within the workspace")
        return path
    suffix = "bin" if (root / "sparse/cameras.bin").exists() else "txt"
    files = [member(f"stereo/depth_maps/{image}.{variant}.bin"),
             member(f"sparse/cameras.{suffix}"), member(f"sparse/images.{suffix}")]
    temporary = tempfile.TemporaryDirectory(prefix="ply-depth-")
    return _publish(files, {"roles": {"depth": 0, "cameras": 1, "images": 2},
                           "colmap_image": image}, temporary, session, inline, open_browser)
