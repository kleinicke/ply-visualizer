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

Open files from the command line (`ply-visualizer a.ply b.ply`), drag and drop,
**File → Open / Add Files… (Ctrl+O)**, or the page's "+ Add Point Cloud". Each
launch opens its own independent window; use File → Open / Add Files… or drag
and drop to add files to an open scene.

## Solo mode (engine/src/soloMode.ts)

DAW-style: solo never edits a cloud's own visibility checkbox; it is restored
when solo ends.

| Input                                      | Effect                                  |
| ------------------------------------------ | --------------------------------------- |
| `S` on a sidebar row / click in solo panel | Solo only that object (again: end solo) |
| Ctrl/Shift-click                           | Add/remove from the solo set            |
| `1`–`9` / `Shift+1`–`9`                    | Solo / add the Nth object               |
| `[` `]`, `←` `→`, `↑` `↓`                  | Step solo to previous/next (wraps)      |
| `0` / `Esc`                                | End solo                                |

The floating solo panel is draggable (header) and resizable (corner grip), has
list and tiled layouts (column count adjustable), and an `a…z` toggle that
shortens long names by collapsing the parts every name shares
(`engine/src/utils/smartAbbreviate.ts`), keeping `key=` whenever a value
differs. Hover any item for its full name. Layout is remembered.

## Files

- `src/main.js` — window, menu, `app://` protocol (page + opened files only)
- `src/preload.js` — minimal bridge (open-files, dialog, title)
- `src/desktop.js` — feeds opened files into the engine's browser file path
- `scripts/build-web.mjs` — builds `engine/dist`, strips analytics and
  website-only links, injects `desktop.js`
