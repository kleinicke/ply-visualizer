import de.kleinicke.plyvisualizer.ViewerServer;
import java.nio.file.Path;

class SmokeServer {
    public static void main(String[] args) throws Exception {
        try (ViewerServer server = new ViewerServer(Path.of(args[0]), args[1])) {
            System.out.println(server.url());
            System.out.flush();
            System.in.read();
        }
    }
}
