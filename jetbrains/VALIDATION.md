# JetBrains release-candidate validation

## 0.1.1 compatibility update (2026-09-09)

- Prepared build range `243`–`253.*`, keeping the original minimum SDK.
- Plugin Verifier reports **Compatible** for PC-243.26053.29 (2024.3.5) and
  PY-253.33813.50 (2025.3.6.1). Intermediate branches were not separately
  tested.
- Both Java tests passed. Regenerated stale format associations from the shared
  manifest (3DS, DAE and FBX were missing).
- Signed archive:
  `build/distributions/ply-visualizer-jetbrains-0.1.1-signed.zip`;
  `verifyPluginSignature` passed. Uploaded through the signed-in browser on
  2026-09-10: Marketplace confirmed **Upload Successful**, pending review (up to
  two business days). The saved API token was rejected as invalid.
- Binary compatibility is verified; a live JCEF interaction test on 2025.3 has
  not been performed. The earlier live testing below applies to 2024.3.5.

## Original 0.1.0 validation

Date: 2026-09-07. Candidate: 0.1.0, `de.kleinicke.plyvisualizer` / **3D
Visualizer**. Publication status: **uploaded by the user; Marketplace approval
not confirmed**. The uploaded 0.1.0 ZIP contains the original cube icon. The
source now uses the shared product branding for the next update; the uploaded
ZIP has not been rebuilt.

## Completed

- Java tests and plugin build passed.
- A signed ZIP was produced and `verifyPluginSignature` passed. The final plugin
  metadata includes its description, changelog and icon; the archive includes
  project and dependency notices. See
  [Marketplace upload instructions](MARKETPLACE.md).
- Plugin Verifier 1.410 reported **Compatible** against PyCharm Community
  2024.3.5 / PC-243.26053.29. The manifest now limits the advertised IDE build
  range to 243–243.*; wider versions require additional verification.
- The final signed ZIP was extracted into a fresh isolated plugin directory and
  loaded by a fresh PyCharm profile on macOS ARM64. This exercises the packaged
  plugin; installing through the Settings UI itself remains unchecked.
- Live JCEF interaction regression passed: initial load, adding another object,
  visibility off/on, camera rotation, measurement picking/clearing, useful
  malformed-file errors, and no page errors or website footer.
- Java resource-server/Chromium smoke tests passed first-open and reopen for:
  PLY, STL, OBJ, self-contained glTF/GLB, OFF, LAS, LAZ, E57, binary PCD, PTS,
  XYZN, XYZRGB, SPLAT, SPZ, NRRD, X3R and a 70 MB real X3A archive. Sources
  include committed small fixtures and local real scan/splat samples.
- Screenshot evidence is under `build/release-evidence/`.

The live regression can be rerun with a PLY file open in an isolated IDE:

```sh
# From the repository root; point JCEF_ENDPOINT at that test IDE's debug port.
JCEF_ENDPOINT=http://127.0.0.1:9226 node jetbrains/scripts/check-live-ide.mjs
```

The script reloads the selected viewer, adds the local STL fixture, changes
visibility and rotates the camera. It is intended for test instances only.

## Remaining release gates

- Complete native file picking, OS drag/drop, export save/cancel/overwrite, and
  large-file interaction checks in the installed IDE.
- Complete remaining registered-format coverage for KSPLAT and SOG.
- Validate other advertised platforms or explicitly publish the tested scope.
- Complete the Marketplace form using `MARKETPLACE.md` and the real screenshots.
- Keep the local signing key securely backed up. The build also accepts
  `JETBRAINS_CERTIFICATE_CHAIN`, `JETBRAINS_PRIVATE_KEY`, and optionally
  `JETBRAINS_PRIVATE_KEY_PASSWORD` from the environment. Never commit secrets.
- Upload the first plugin manually through the user's Marketplace account. The
  user has an account and saved a token locally; no browser session is available
  here to submit the form. Subsequent uploads can use the configured
  `JETBRAINS_PUBLISH_TOKEN` and `publishPlugin` task.

Settings policy for this preview: closing/reopening an editor reloads its file;
camera and scene state are not restored. This is documented behavior, not a
claim of persistent IDE document state.

Frame cadence: this runtime uses JCEF windowless rendering configured at 60 FPS
before browser creation, up from the runtime's 30 FPS default. The documented
JCEF API range is 1–60; the web/VS Code host can follow a 120 Hz display, but
120 FPS has not been established in this JetBrains runtime. Raising the number
alone is not a verified solution. See the
[JCEF API](https://github.com/chromiumembedded/java-cef/blob/master/java/org/cef/browser/CefBrowser.java).

Do not describe this candidate as Marketplace-released until these gates are
resolved. See [RELEASE.md](RELEASE.md) for the original checklist.
