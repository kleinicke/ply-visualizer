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
npm run dist:win            # NSIS installer + zip (exe icon needs wine on Linux)
```

## Opening files

| File menu                                   | Effect                                      |
| ------------------------------------------- | ------------------------------------------- |
| Open Files… `Ctrl+O`                        | Replace the scene with the chosen files     |
| Open Folder… `Ctrl+Shift+O`                 | Replace the scene with a folder (recursive) |
| Open Recent                                 | Recent files and folders                    |
| Add Files… `Ctrl+Alt+O` / Add Folder…       | Add to the current scene                    |
| Clear Scene, New Window, Close Window, Quit |                                             |

The command line (`ply-visualizer a.ply b.ply`, `ply-visualizer some/folder`),
drag and drop (files or folders) and the page's "+ Add Point Cloud" work too.
Each launch is its own independent window.

Files from an opened folder are named by their path relative to it
(`kitchen/methodA.ply`, OS separator). If the folder has no files at its top
level, a dialog offers to group by subfolder ("Don't ask again" remembers the
answer); otherwise everything is shown.

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
- `src/desktop.js` — feeds opened files into the engine's browser file path
- `scripts/build-web.mjs` — builds `engine/dist`, strips analytics and
  website-only links, injects `desktop.js`
