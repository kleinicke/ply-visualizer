Standalone desktop build of the 3D point cloud and mesh viewer from
[kleinicke/ply-visualizer](https://github.com/kleinicke/ply-visualizer), with
DAW-style solo, a solo panel, regex groups and folder opening. See the
[README]({{REPO_URL}}/tree/{{TAG}}#what-this-fork-adds).

| Platform                      | Download                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Linux (x64)                   | `.AppImage` (run directly), `.deb` (Debian/Ubuntu), `.rpm` (Fedora/openSUSE) or `.tar.gz` |
| Windows (x64)                 | `-setup.exe` installer or portable `.zip`                                                 |
| macOS (Apple Silicon / Intel) | `.dmg` (`arm64` / `x64`) or `.zip`                                                        |

The builds are not signed with a paid developer certificate:

- **macOS**: the app is ad-hoc signed, so the first launch is blocked as coming
  from an unidentified developer. Open it once, then allow it in _System
  Settings → Privacy & Security → Open Anyway_. Or, after moving it to
  Applications, clear the download quarantine in Terminal:
  `xattr -dr com.apple.quarantine "/Applications/PLY Visualizer.app"`
- **Windows** SmartScreen may warn: choose _More info → Run anyway_.
- **Linux**: `chmod +x` the AppImage, then run it; or install the package
  (`sudo apt install ./ply-visualizer-*.deb`,
  `sudo dnf install ./ply-visualizer-*.rpm`), which adds `plyviz` to the PATH
  and a desktop entry.

`SHA256SUMS.txt` lists the checksums of all files.
