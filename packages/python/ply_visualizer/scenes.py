"""Build immutable scene revisions consumed by the shared browser host."""
from itertools import repeat, zip_longest
import math
from pathlib import Path

from .arrays import point_rows


def build_scene(directory, points, *, colors=None, target=None, vectors=None,
                vector_scale=1.0, max_vectors=256, batched=False, labels=None, step=None):
    from .session import _points_file

    if not math.isfinite(vector_scale):
        raise ValueError("vector_scale must be finite")
    if not isinstance(max_vectors, int) or not 1 <= max_vectors <= 2000:
        raise ValueError("max_vectors must be an integer in 1..2000")
    if step is not None and (not isinstance(step, int) or isinstance(step, bool)):
        raise ValueError("step must be an integer")
    count = len(points) if batched else 1
    if count == 0:
        raise ValueError("batch must not be empty")
    if labels is not None and (not batched or len(labels) != count):
        raise ValueError("labels must match the batch size")
    if batched:
        for value, name in ((colors, "colors"), (target, "target"), (vectors, "vectors")):
            if value is not None and len(value) != count:
                raise ValueError(f"{name} must match the batch size")
    scene = {"files": [], "batches": [str(labels[i]) if labels is not None else f"Sample {i}" for i in range(count)], "vectors": [], "step": step}
    files = []
    for batch in range(count):
        select = lambda value: value[batch] if batched and value is not None else value
        cloud, rgb, reference, directions = map(select, (points, colors, target, vectors))
        if cloud is None:
            raise ValueError("points must contain an (N, 3) array")
        if directions is not None and not hasattr(cloud, "__len__"):
            cloud = list(point_rows(cloud, "points"))
        for name, data, color in (("prediction" if reference is not None else "points", cloud, rgb), ("target", reference, None)):
            if data is None:
                continue
            folder = Path(directory) / str(len(files))
            folder.mkdir()
            # Default overlay colors are explicit RGB data and survive updates.
            if reference is not None and color is None:
                if not hasattr(data, "__len__"):
                    data = list(point_rows(data, name))
                color = repeat((255, 150, 40) if name == "prediction" else (30, 200, 255), len(data))
            file = _points_file(data, color, folder)
            files.append(file)
            scene["files"].append({"name": f"{name}.ply", "batch": batch})
        arrows = []
        if directions is not None:
            missing = object()
            # Validate all vectors, but render a bounded, evenly spaced subset.
            stride = max(1, math.ceil(len(cloud) / max_vectors))
            for index, (origin, direction) in enumerate(zip_longest(point_rows(cloud, "points"), point_rows(directions, "vectors"), fillvalue=missing)):
                if origin is missing or direction is missing:
                    raise ValueError("vectors must match the point count")
                values = [float(v) for v in (*origin, *direction)]
                if len(values) != 6 or not all(math.isfinite(v) for v in values):
                    raise ValueError("vectors and origins must contain finite (N, 3) values")
                if index % stride == 0:
                    arrows.append(values[:3] + [v * vector_scale for v in values[3:]])
                    if not all(math.isfinite(v) and abs(v) <= 3.4028234663852886e38 for v in arrows[-1]):
                        raise ValueError("scaled vectors must be finite float32-compatible values")
        scene["vectors"].append(arrows)
    return files, scene
