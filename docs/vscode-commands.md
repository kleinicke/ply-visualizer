# VS Code command reference

Open the command palette and search for **3D Visualizer**. File conversion
commands also appear in supported file context menus. Availability depends on
the selected file and installed extension version.

| Command                              | Purpose                                                                   | Command ID                           |
| ------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------ |
| Load Remote URL                      | Download and open a direct file URL; see [remote files](remote-files.md). | `plyViewer.openRemoteUrl`            |
| Open with 3D Visualizer              | Open a selected local file in the custom viewer.                          | `plyViewer.openFile`                 |
| Open Multiple Point Cloud Files      | Load several local files together for inspection.                         | `plyViewer.openMultipleFiles`        |
| Open COLMAP Reconstruction           | Choose a COLMAP reconstruction through its dedicated loader.              | `plyViewer.openColmapReconstruction` |
| Open DICOM Folder as Volume          | Choose a DICOM series directory and load it as a volume.                  | `plyViewer.openDicomFolder`          |
| Play Point Cloud Sequence (Wildcard) | Choose files using a wildcard and play them as a sequence.                | `plyViewer.playPointCloudSequence`   |
| Show Timing Output                   | Show the viewer’s loading and timing diagnostics.                         | `plyViewer.showTimingOutput`         |
| Convert TIFF to Point Cloud          | Project TIFF depth values using camera/depth settings.                    | `plyViewer.convertTifToPointCloud`   |
| Load JSON as 3D Pose                 | Interpret a supported JSON pose layout as a 3D pose.                      | `plyViewer.loadJsonAsPose`           |
| Convert PFM to Point Cloud           | Project PFM depth values using camera/depth settings.                     | `plyViewer.convertDepthToPointCloud` |
| Convert NPY/NPZ to Point Cloud       | Open NumPy data through the point-cloud/depth workflow.                   | `plyViewer.convertNpyToPointCloud`   |
| Convert PNG Depth to Point Cloud     | Project PNG depth values using camera/depth settings.                     | `plyViewer.convertPngToPointCloud`   |
| Convert EXR Depth to Point Cloud     | Project EXR depth values using camera/depth settings.                     | `plyViewer.convertExrToPointCloud`   |
| Reset All Settings                   | Reset saved extension settings.                                           | `plyViewer.resetSettings`            |
| Select Dataset Scene                 | Choose a scene from the dataset integration.                              | `plyViewer.selectDataset`            |
| Clear Dataset Cache                  | Clear cached dataset data.                                                | `plyViewer.clearDatasetCache`        |

Depth conversion needs valid camera parameters and a depth/disparity image; it
does not estimate depth from a normal photograph. See the
[depth workflow](viewer-guide.md#depth-and-disparity).

The remote URL input also supports previous/next history using Up/Down and its
arrow buttons. These are input actions, not separate workflow entry points.

MCP tools belong to the Python server and use a separate
[tool catalog](mcp-tools.md); they are not VS Code command IDs.
