# 3D JetBrains release plan

Progress and remaining gates are recorded in [VALIDATION.md](VALIDATION.md).

The shared 3D viewer UI is a suitable basis for a first release. A standalone 3D
development plugin now lives in this repository. Its ZIP is an unpublished
preview; the release gates below remain open.

## Before a first release

1. Standalone packaging is implemented: separate ID/name/archive, local 3D
   assets and generated associations. Confirm the final identity before first
   publication; later unification must not surprise existing users.
2. Test a release candidate installed from disk into a clean IDE. Verify opening
   and reopening files, file picking, drag/drop, multiple objects, camera
   controls, measurements, visibility, export/save/cancel/overwrite, and useful
   loading/error feedback. Choose an explicit settings/view-state persistence
   policy and verify it. The current editor does not restore state on reopen.
3. Verify representative samples from every advertised format family, including
   point clouds, meshes, splats, LiDAR and scan archives. Registration is not
   verification. Resolve companion files or explicitly narrow support for glTF,
   OBJ materials/textures and detached volumes. Add explicit import actions for
   ambiguous KITTI BIN, JSON and depth images, or list these as unavailable.
4. Run JetBrains Plugin Verifier against the advertised IDE versions and install
   on each advertised OS. So far the live IDE check is PyCharm Community
   2024.3.5 on macOS ARM64; plugin-structure validation alone is insufficient.
5. Prepare the platform-specific Marketplace description, real screenshots,
   icon, changelog, license/dependency notices and support links. Configure
   signing, then build a versioned release archive.
6. Upload the first release manually using a JetBrains Marketplace account.
   Subsequent versions can use token-based Gradle publishing. No upload or
   Marketplace account changes have been made during this work.

## Documentation

Keep the feature overview, illustrations and general concepts shared. Keep
installation, file-opening commands, shortcuts and limitations
platform-specific. The JetBrains README labels this as an unpublished
development preview. Do not imply full cross-platform parity in the product
README or listing.

Sources:
[Publishing a plugin](https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html)
and
[JCEF integration](https://plugins.jetbrains.com/docs/intellij/embedded-browser-jcef.html).
