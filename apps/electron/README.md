# PLY Visualizer — Electron desktop app

Standalone Linux/Windows build of the shared engine (`engine/`), rendered by
Chromium exactly like the VS Code extension's webview.

## Run / build

Needs Node 24 (`nvm use 24`) and the repo's root `npm ci`.

```sh
cd apps/electron
npm install                 # electron + electron-builder
npm run dev                 # build engine page, launch app
npm run dist:linux          # release/*.AppImage and .tar.gz
npm run dist:win            # NSIS installer + zip (on Windows)
npm run dist:mac            # dmg + zip, x64 and arm64 (on macOS)
```

### Releases

`.github/workflows/desktop-release.yml` builds all three platforms on GitHub's
runners and publishes a release with the installers and `SHA256SUMS.txt`. Bump
`version` in `package.json`, then push a matching tag:

```sh
git tag desktop-v0.1.3
git push fork desktop-v0.1.3
```

Builds are unsigned (macOS Gatekeeper and Windows SmartScreen warn on first
launch; the release notes explain how to proceed).

## Opening files

| File menu                                               | Effect                                      |
| ------------------------------------------------------- | ------------------------------------------- |
| Open Files… `Ctrl+O`                                    | Replace the scene with the chosen files     |
| Open Folder… `Ctrl+Shift+O`                             | Replace the scene with a folder (recursive) |
| Open Recent                                             | Recent files and folders                    |
| Add Files to Scene… `Ctrl+Alt+O` / Add Folder to Scene… | Add to the current scene                    |
| Advanced Open ▸ Open/Add Files/Folder with Subsampling… | Load one file at a time, thinning each      |
| Clear Scene, New Window, Close Window, Quit             |                                             |

The command line (`plyviz a.ply b.ply`, `plyviz some/folder`), drag and drop
(files or folders) and the page's "+ Add Point Cloud" work too. Each launch is
its own independent window.

Files from an opened folder are named by their path relative to it
(`kitchen/methodA.ply`, OS separator). If the folder has no files at its top
level, a dialog offers to group by subfolder ("Don't ask again" remembers the
answer); otherwise everything is shown.

### Large files and memory (src/memory.js, engine/src/utils/subsample.ts)

A normal open loads everything, but first estimates the memory it needs (point
counts from PLY/PCD/LAS headers, ~60 bytes per loaded point) and warns when that
exceeds 80% of the memory that is free (Linux `MemAvailable`; on macOS free +
inactive + purgeable pages). The warning offers **Subsample…**, Load Anyway, or
Cancel. Large drops (over 256 MB) are checked the same way.

**Advanced Open** asks how to subsample: fit everything into N% of RAM, keep N%
of each file's points, or keep at most N points per file, with a live estimate
of the result. Files are then read, parsed and thinned one at a time (uniform
random subset, original order, seeded by the file name), so only one full-size
file is in memory at once. Meshes and Gaussian splats are loaded whole.

## File actions (engine/src/fileActions.ts)

Click a file's name to select it; Ctrl/Cmd-click toggles and Shift-click
extends. The selection gets an action bar above the list, and right-clicking a
row opens the same actions as a menu: **Subsample…** (keep N% or at most N
points per file of the loaded clouds; the dropped points are freed until the
file is reopened), **Solo**, **Show**, **Hide**, **Remove**. Each action runs on
the selected files it applies to. Visibility is the checkbox.

## Group (engine/src/utils/regexGroups.ts)

**Group** in the file list splits the files with a regular expression: the text
of its first capture group is the group (whole match if there is none, “(no
match)” otherwise). One group at a time is listed and drawn; `←` `→` (or `,`
`.`, PageUp/PageDown) switch groups, and a solo carries over to the file whose
name is the same apart from the captured text. Recent patterns and presets
(top-level folder, first name part, …) are one click away; `?` explains it all.

## Solo mode (engine/src/soloMode.ts)

DAW-style: solo never edits a cloud's own visibility checkbox; it is restored
when solo ends.

| Input                                      | Effect                                  |
| ------------------------------------------ | --------------------------------------- |
| `S` on a sidebar row / click in solo panel | Solo only that object (again: end solo) |
| Ctrl/Shift-click                           | Add/remove from the solo set            |
| `1`–`9` / `Shift+1`–`9`                    | Solo / add the Nth object               |
| `[` `]`, `↑` `↓` (`←` `→` without groups)  | Step solo to previous/next (wraps)      |
| `0` / `Esc`                                | End solo                                |

The floating solo panel is draggable (header) and resizable (corner grip), has
list and tiled layouts (column count adjustable), and an `a…z` toggle that
shortens long names by collapsing the parts every name shares
(`engine/src/utils/smartAbbreviate.ts`), keeping `key=` whenever a value
differs. Hover any item for its full name. Layout is remembered.

## Files

- `src/main.js` — windows, menus, folder scanning, recents, prompts, `app://`
  protocol (page + opened files only)
- `src/preload.js` — minimal bridge (open-files, path separator, folder drops)
- `src/desktop.js` — feeds opened files into the engine's browser file path; the
  subsampling dialog and one-file-at-a-time loading
- `src/memory.js` — free memory and load-size estimates
- `scripts/build-web.mjs` — builds `engine/dist`, strips analytics and
  website-only links, injects `desktop.js`
