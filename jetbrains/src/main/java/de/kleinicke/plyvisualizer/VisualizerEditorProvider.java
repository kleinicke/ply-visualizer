package de.kleinicke.plyvisualizer;

import com.intellij.openapi.fileEditor.*;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.project.DumbAware;
import com.intellij.openapi.vfs.VirtualFile;
import org.jetbrains.annotations.NotNull;

public final class VisualizerEditorProvider implements FileEditorProvider, DumbAware {
    @Override public boolean accept(@NotNull Project project, @NotNull VirtualFile file) {
        if (file.isDirectory() || !file.isInLocalFileSystem()) return false;
        return ViewerFormats.kind(file.getExtension()) != null;
    }
    @Override public @NotNull FileEditor createEditor(@NotNull Project project, @NotNull VirtualFile file) {
        return new VisualizerEditor(file);
    }
    @Override public @NotNull String getEditorTypeId() { return "kleinicke.plyVisualizer"; }
    @Override public @NotNull FileEditorPolicy getPolicy() { return FileEditorPolicy.PLACE_BEFORE_DEFAULT_EDITOR; }
}
