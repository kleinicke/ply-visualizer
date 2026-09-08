# 3D Visualizer for JetBrains

Unpublished development preview, version 0.1.0. This builds a standalone 3D
plugin from this repository's engine. It does not need the TIFF repository or
bundle an image viewer. The VS Code extension and website retain their builds.

The plugin logo in `src/main/resources/META-INF/pluginIcon.svg` is a vector
adaptation of the repository's `icon.png`: the same blue/turquoise dotted logo
used by VS Code. Keep this branding aligned when updating either asset. Gradle
includes it automatically in future plugin distributions.

The Marketplace description is generated from the repository's root `README.md`,
the same source used by the VS Code listing. The Gradle `prepareDescription`
task renders Markdown to HTML and resolves relative links to GitHub before
`patchPluginXml` embeds it. Edit the root README to update both listings;
`build/marketplace-description.html` can also be copied into the Marketplace
description editor for an existing release.

## Build and try

Requirements: Node 24, root npm dependencies (`npm ci`), and JDK 21.

```sh
cd jetbrains
./gradlew test buildPlugin
./gradlew runIde
```

The default test project is `../../test_data`. Override it with
`-PviewerTestProject=/path/to/examples`. The development IDE uses a separate
sandbox under `build/idea-sandbox`; JCEF debugging uses port 9224.

The archive is `build/distributions/ply-visualizer-jetbrains-0.1.0.zip`. Install
it with Settings → Plugins → gear menu → Install Plugin from Disk. Use a clean
test IDE without the earlier combined image/3D prototype; both plugins can offer
editors for the same 3D files.

Identity: `de.kleinicke.plyvisualizer`, displayed as **3D Visualizer**. This is
a provisional pre-publication identity, independent of the VS Code extension ID.

## Scope and current limitations

`formats.json` records associations generated from the VS Code manifest.
Registration is not a claim that every format is release-validated.

- Local selected files are delivered to the existing Svelte/Three.js viewer.
- Website legal links, analytics and installation metadata are removed from the
  embedded build only.
- Separate files referenced by glTF, OBJ materials/textures and detached volumes
  are not resolved by the host. Prefer self-contained fixtures for testing.
- Generic BIN and detached NHDR associations are deferred. Image/depth and JSON
  interpretation are not automatically registered in this plugin.
- View state is not restored when an editor is closed and reopened.
- File picking, multi-object workflows, save/export/cancel/overwrite, large
  files and all claimed format families need explicit release-candidate
  validation.
- Initial SDK target: PyCharm Community 2024.3.5. The plugin requires JCEF;
  wider IDE-version and OS compatibility still requires testing.

No image-specific status widgets or Mac image pan/pinch adapters are included.
3D interaction uses the existing 3D engine controls.

## Checks

See [current release-candidate validation](VALIDATION.md) for completed checks,
the restricted IDE build range, and remaining publication gates.

```sh
node scripts/register-formats.mjs --check
./gradlew test buildPlugin
./gradlew verifyPlugin
JAVA_HOME=/path/to/jdk-21 node scripts/smoke-viewer.mjs /path/to/points.ply /path/to/mesh.stl
```

The smoke check opens and reopens each supplied file through the Java resource
server and Chromium. It checks decoding and absence of website footer links; it
does not substitute for installing the ZIP in a real IDE.

See [release checklist](RELEASE.md) before publishing. The repository's
[license](../LICENSE) applies; dependency notices must be audited for release.

## Validation recorded 2026-09-07

- `test buildPlugin` passed using this repository alone.
- The Chromium/Java-host smoke check passed first-open and reopen for
  `test_binary.ply`, `test_mesh.ply`, `test_cube_ascii.stl`, and `airboat.obj`.
- The standalone plugin ran in its own PyCharm Community 2024.3.5 sandbox on
  macOS ARM64. JCEF reported 250,072 points for `test_binary.ply`, successful
  file delivery, and no website footer navigation.
- This was a development-sandbox launch, not the fresh install-from-ZIP release
  gate. Plugin Verifier, broader platform checks and the interaction/save/export
  checklist have not been completed. Nothing was uploaded or published.
