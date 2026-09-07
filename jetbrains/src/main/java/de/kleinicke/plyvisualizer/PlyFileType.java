package de.kleinicke.plyvisualizer;

import com.intellij.icons.AllIcons;
import com.intellij.openapi.fileTypes.FileType;
import org.jetbrains.annotations.NotNull;
import javax.swing.Icon;

public final class PlyFileType implements FileType {
    public static final PlyFileType INSTANCE = new PlyFileType();
    private PlyFileType() { }
    @Override public @NotNull String getName() { return "Scientific 3D"; }
    @Override public @NotNull String getDescription() { return "3D point cloud or mesh"; }
    @Override public @NotNull String getDefaultExtension() { return "ply"; }
    @Override public Icon getIcon() { return AllIcons.FileTypes.Image; }
    @Override public boolean isBinary() { return true; }
}
