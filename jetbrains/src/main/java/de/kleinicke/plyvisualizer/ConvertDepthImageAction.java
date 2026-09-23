package de.kleinicke.plyvisualizer;

import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.fileChooser.FileChooser;
import com.intellij.openapi.fileChooser.FileChooserDescriptor;
import com.intellij.openapi.project.DumbAwareAction;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.DialogWrapper;
import com.intellij.openapi.util.Disposer;
import com.intellij.openapi.vfs.VirtualFile;
import org.jetbrains.annotations.NotNull;

import javax.swing.*;
import java.awt.Dimension;
import java.util.Locale;
import java.util.Set;

/** Manual depth conversion without associating image files with the 3D editor. */
public final class ConvertDepthImageAction extends DumbAwareAction {
    private static final Set<String> EXTENSIONS = Set.of("tif", "tiff", "png", "pfm", "exr", "npy", "npz");

    @Override public void actionPerformed(@NotNull AnActionEvent event) {
        Project project = event.getProject();
        FileChooserDescriptor descriptor = new FileChooserDescriptor(true, false, false, false, false, false)
                .withTitle("Convert Depth Image to 3D")
                .withDescription("Choose a TIFF, PNG, PFM, EXR, NPY or NPZ depth image.")
                .withFileFilter(file -> file.isInLocalFileSystem() && file.getExtension() != null
                        && EXTENSIONS.contains(file.getExtension().toLowerCase(Locale.ROOT)));
        VirtualFile file = FileChooser.chooseFile(descriptor, project, null);
        if (file != null) new ConversionDialog(project, file).show();
    }

    private static final class ConversionDialog extends DialogWrapper {
        private final VisualizerEditor viewer;

        ConversionDialog(Project project, VirtualFile file) {
            super(project, false);
            setTitle("Convert Depth Image to 3D — " + file.getName());
            setModal(false);
            viewer = new VisualizerEditor(file);
            Disposer.register(getDisposable(), viewer);
            viewer.getComponent().setPreferredSize(new Dimension(1100, 800));
            setCancelButtonText("Close");
            init();
        }

        @Override protected JComponent createCenterPanel() { return viewer.getComponent(); }
        @Override public JComponent getPreferredFocusedComponent() { return viewer.getPreferredFocusedComponent(); }
        @Override protected Action @NotNull [] createActions() { return new Action[]{getCancelAction()}; }
    }
}
