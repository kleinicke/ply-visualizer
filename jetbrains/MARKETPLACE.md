# First Marketplace upload

The first upload is manual. The token is for publishing later versions; do not
paste it into the plugin description or upload it as an attachment.

## ZIP to select

`build/distributions/ply-visualizer-jetbrains-0.1.0-signed.zip`

This is the plugin distribution ZIP, not a ZIP of the repository, the JAR inside
the distribution, or the Tauri app. Version 0.1.0 is a first preview; review
[validation](VALIDATION.md) for the tested scope and remaining checks.

## Listing fields

- Name: **3D Visualizer**
- License: **MIT** (third-party notices are included in the archive)
- Source: `https://github.com/kleinicke/ply-visualizer`
- Documentation:
  `https://github.com/kleinicke/ply-visualizer/tree/main/jetbrains`
- Issues: `https://github.com/kleinicke/ply-visualizer/issues`
- Suggested category: visualization/data tools, using the closest available
  category.

Suggested short description:

> Inspect local point clouds, meshes and scan data directly in your IDE.

Suggested full description:

> 3D Visualizer opens local 3D data in editor tabs with interactive camera
> navigation, multiple objects, visibility controls, measurements, point
> appearance settings and export tools.
>
> This first preview uses the same viewer engine as the VS Code extension.
> Release checks cover PLY, STL, OBJ, self-contained glTF/GLB, OFF, LAS/LAZ,
> E57, PCD, PTS, XYZN/XYZRGB, SPLAT/SPZ, NRRD and Stonex X3R/X3A samples.
>
> Requires an IntelliJ Platform 2024.3 IDE running the JetBrains Runtime with
> JCEF. Validated on PyCharm Community 2024.3.5 on macOS ARM64; other platforms
> have not yet been validated.
>
> Use self-contained assets. External glTF/OBJ companion files are not resolved,
> and camera/scene state is not restored after closing an editor. The separate
> scientific image viewer is not included.

The plugin ZIP already embeds the description, change notes, icon, license and
dependency notices. A real viewer screenshot is available under
`build/release-evidence/jcef-viewer.png`. The complete IDE screenshot is
`build/release-evidence/pycharm-3d-visualizer.png`.

## Upload steps

1. In **Add new plugin**, select the signed ZIP above.
2. Complete the listing with the fields and description above, reviewing the
   preview limitations and any remaining gates in `VALIDATION.md`.
3. Submit the plugin for JetBrains review. Submission is not immediate public
   availability; Marketplace review must complete.
4. Record the resulting Marketplace plugin URL/ID in this repository. Only then
   use token-based publishing for subsequent versions with a new version number.

## Signing and credentials

Local signing material is in `../.local/jetbrains-signing/`, excluded from Git
and VS Code packaging. Keep a secure backup of the key and certificate. Gradle
uses these local files automatically, or accepts the signing environment
variables documented in `VALIDATION.md`. The public certificate is included in
the signed ZIP; the private key and publishing token are not.

The user-created `../jetbrains_token.md` is excluded from Git and packaging and
restricted to the owner's filesystem permissions. Its contents were not needed
for the initial signed build. Later publishing uses `JETBRAINS_PUBLISH_TOKEN`.

```sh
./gradlew test verifyPlugin verifyPluginSignature
```

Reference:
[JetBrains first-upload instructions](https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html).
