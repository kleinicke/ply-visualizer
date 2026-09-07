package de.kleinicke.plyvisualizer;

import org.junit.Test;
import java.net.*;
import java.net.http.*;
import java.nio.file.*;
import static org.junit.Assert.*;

public class ViewerServerTest {
    @Test public void streamsOnlyTheSelectedFileAndRejectsCrossSiteRequests() throws Exception {
        Path source = Files.createTempFile("viewer-µ-", ".ply");
        Files.write(source, new byte[]{0, 1, 2, (byte)255});
        try (ViewerServer server = new ViewerServer(source, "ply")) {
            HttpClient client = HttpClient.newHttpClient();
            URI root = URI.create(server.url()).resolve("../");
            var response = client.send(HttpRequest.newBuilder(root.resolve("source")).build(), HttpResponse.BodyHandlers.ofByteArray());
            assertEquals(200, response.statusCode());
            assertArrayEquals(Files.readAllBytes(source), response.body());
            assertEquals(404, client.send(HttpRequest.newBuilder(root.resolve("other.ply")).build(), HttpResponse.BodyHandlers.discarding()).statusCode());
            assertEquals(404, client.send(HttpRequest.newBuilder(root.resolve("../../source")).build(), HttpResponse.BodyHandlers.discarding()).statusCode());
            assertEquals(403, client.send(HttpRequest.newBuilder(root.resolve("source")).header("Sec-Fetch-Site", "cross-site").build(), HttpResponse.BodyHandlers.discarding()).statusCode());
            assertEquals(405, client.send(HttpRequest.newBuilder(root.resolve("source")).POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.discarding()).statusCode());
        } finally { Files.deleteIfExists(source); }
    }
}
