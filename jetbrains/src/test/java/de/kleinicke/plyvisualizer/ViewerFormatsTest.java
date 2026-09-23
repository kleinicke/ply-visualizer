package de.kleinicke.plyvisualizer;
import org.junit.Test;
import static org.junit.Assert.*;
public class ViewerFormatsTest {
    @Test public void registersGeometryWithoutTakingOverImagesOrGenericBinary() {
        for (String suffix : new String[]{"PLY", "obj", "las", "glb", "sog", "nrrd"}) assertEquals("ply", ViewerFormats.kind(suffix));
        for (String suffix : new String[]{"tif", "tiff", "pfm", "png", "jpg", "jpeg", "exr", "npy", "npz", "json", "bin", "nhdr", "java", ""}) assertNull(ViewerFormats.kind(suffix));
        assertNull(ViewerFormats.kind(null));
    }
}
