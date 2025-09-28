# Point Cloud Double-Click Selection Plan

This note captures the intended behaviour for double-click targeting in the
point cloud viewer and explains how each known issue is addressed. It can be
used as a reference for future maintenance or alternative implementations.

## Goals

- Pick the **front-most** visible element directly under the cursor (camera
  profiles, poses, triangle meshes, then point clouds).
- Ensure the rotation pivot always lands on the **exact vertex** or intersection
  point that was selected.
- Support dense clouds where multiple points overlap in screen space without
  allowing background points to “win”.
- Provide a sensible click experience for both **very near** and **very
  distant** points.

## Point-Cloud Specific Strategy

1. **Typed `Points` filter**
   - Limit the candidate meshes to actual `THREE.Points` instances with
     `THREE.PointsMaterial` and no index buffer. This keeps the raycast helper
     focused on point clouds only.

2. **Shared helper trio**
   - `computeRenderedPointSize(material, distance, canvas)` replicates Three’s
     size-attenuation logic so the selection radius matches rendered diameter.
   - `computeSelectionPixelRadius(renderedSize, distance, clamp)` converts to a
     pixel radius with padding and optional max cap.
   - `convertPixelsToWorldUnits(pixelRadius, distance, canvas)` transforms that
     radius into world units given the current projection.

3. **Primary raycast hit**
   - For each points mesh, the helper calculates the world threshold
     (`max(worldRadius, relativeLimit)`) and calls
     `raycaster.intersectObject(mesh, false)`.
   - The `relativeLimit` is clamped to `~2 %` of the camera-to-mesh distance so
     extremely near points demand much more precise hits.
   - When a hit contains `intersection.index`, a new `THREE.Vector3` is built
     from the buffer attribute, transformed by `mesh.matrixWorld`, and stored as
     `worldPoint`. That point is returned so the pivot matches a real vertex.

4. **Fallback pixel-distance walk**
   - Reuses the same helper trio while iterating each vertex. The closest
     screen-distance match is snapped to its vertex position before returning.

5. **Safety checks**
   - Ignore points behind the camera, enforce a minimum distance (`0.0001 m`),
     and if a vertex is too close adjust the target along the camera forward
     vector to keep the camera from collapsing onto the pivot.

## Mesh Interaction Order

- The double-click handler tries in this order: camera profiles → pose keypoints
  → **triangle meshes** → point clouds.
- Triangle meshes use a standard `THREE.Raycaster` with
  `intersectObjects(triangleMeshes, false)` so the first hit lies exactly on the
  surface and is used as the rotation target.
- Point clouds only run if the mesh selection did not yield a hit. This ensures
  surfaces take precedence when both occupy the same pixel.

## Addressed Issues

| Issue                                                 | Resolution                                                                                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Double-click selects background point in dense cloud  | Raycast returns the nearest hit along the ray; fallback also considers depth ordering via closest pixel distance.                                                            |
| Rotation center lands between vertices                | When hit metadata includes a vertex index, the world position is reconstructed from the geometry to ensure an exact point.                                                   |
| Close points mis-detected because threshold too large | Threshold is clamped by a fraction of camera distance, so near-field interactions demand much smaller world-space distances.                                                 |
| Cursor feels insensitive at long distance             | Screen-space pixel radius is converted into world units per click, so far-away points still fall inside the raycast threshold when they occupy the same on-screen footprint. |

## Extensibility Notes

- The relative-limit constant (`~2%`) can be tuned or exposed as a preference if
  users need tighter or looser behaviour.
- Additional logging hooks are available in `selectPointCloudWithLogging` for
  debugging. Keeping them in sync with the raycast helper is recommended.
- The same helpers (`computeRenderedPointSize`, `computeSelectionPixelRadius`,
  and `convertPixelsToWorldUnits`) should be reused wherever point-hit areas are
  needed to ensure consistent UX.

---

Author: GPT-5 Codex (interactive session documentation)
