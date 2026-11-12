# Changelog

Changes to the desktop app. Each version's section becomes the notes of its
GitHub release (`desktop-v<version>`), so keep the `## <version>` headings.

## 0.1.5

- Opening a folder follows symbolic links to files and subfolders, which were
  skipped before, and lists them under the link's own name.
- The All Sizes slider has a fixed range, the same as the per-file sliders.
  Its range used to grow with the size while dragging, so one drag could make
  points larger than the screen and stall rendering.

## 0.1.4

- **Subsampled loading:** File → Advanced Open opens files or folders with
  subsampling. Keep a percentage, keep at most N points, or fit everything
  into a share of the computer's memory. Subsampled files load one at a time.
- **Memory warning:** a normal open estimates the memory the files will need
  from their headers (per attribute and format, including 3DGS splats) and
  offers to subsample when it will not fit into free memory.
- **File selection and actions:** click a card to select it, Ctrl-click to
  toggle, Shift-click for a range. Right-click any card for its actions.
  Select all and Clear selection sit next to Collapse/Expand all.
  Actions: Subsample, Show, Hide, Remove.
- Subsampling loaded files runs in the background with a progress bar on the
  affected cards, without freezing the window.
- The subsample form and the grouping help open as dialogs.
- Selecting files no longer re-renders the scene, which made Select all slow
  with many large files.
- Fixed: after resizing the panel by its left edge, or dragging the solo panel
  by its header, the window could stop responding to clicks.
- macOS: the app quits when its last window closes.

## 0.1.3

- macOS: the app is ad-hoc signed, so macOS no longer reports it as
  "damaged". The first launch still needs *Open Anyway* in Privacy & Security.

## 0.1.2

- Fixed: File → Open Files / Open Folder added to the scene instead of
  replacing it.
- Linux: search keywords and all icon sizes in the desktop entry, and a
  New Window action.

## 0.1.1

- Linux `.deb` and `.rpm` packages, which install a `plyviz` command.

## 0.1.0

First desktop release: a standalone app for Linux, Windows and macOS around
the viewer from [kleinicke/ply-visualizer](https://github.com/kleinicke/ply-visualizer).

- DAW-style solo per file, and a solo panel listing the groups.
- Regex groups (replacing prefix grouping), with recent patterns.
- Opening whole folders, grouped by subfolder if wanted.
- Camera remembered separately for each group.
