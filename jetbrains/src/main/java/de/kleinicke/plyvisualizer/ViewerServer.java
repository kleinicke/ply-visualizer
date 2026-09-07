package de.kleinicke.plyvisualizer;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

/** A per-editor, loopback-only origin exposing bundled assets and one selected file. */
public final class ViewerServer implements AutoCloseable {
    private final HttpServer server;
    private final ExecutorService executor;
    private final Path file;
    private final String kind;
    private final String prefix = "/" + UUID.randomUUID() + "/";
    private final String authority;
    public ViewerServer(Path file, String kind) throws IOException {
        if (!Set.of("image", "ply").contains(kind)) throw new IllegalArgumentException("Unknown viewer");
        this.file = file.toRealPath();
        if (!Files.isRegularFile(this.file)) throw new IOException("Not a regular file");
        this.kind = kind;
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        authority = "127.0.0.1:" + server.getAddress().getPort();
        executor = Executors.newFixedThreadPool(2, runnable -> {
            Thread thread = new Thread(runnable, "scientific-viewer-http");
            thread.setDaemon(true);
            return thread;
        });
        server.setExecutor(executor);
        server.createContext("/", this::serve);
        server.start();
    }
    public String url() { return "http://" + authority + prefix + kind + "/index.html?host=jetbrains"; }
    private void serve(HttpExchange exchange) throws IOException {
        try (exchange) {
            if (!authority.equals(exchange.getRequestHeaders().getFirst("Host"))
                    || "cross-site".equals(exchange.getRequestHeaders().getFirst("Sec-Fetch-Site"))) {
                exchange.sendResponseHeaders(403, -1); return;
            }
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1); return;
            }
            String path = exchange.getRequestURI().getPath();
            if (!path.startsWith(prefix)) { exchange.sendResponseHeaders(404, -1); return; }
            String relative = path.substring(prefix.length());
            if (relative.contains("..") || relative.contains("\\") || relative.contains("\0")) {
                exchange.sendResponseHeaders(404, -1); return;
            }
            exchange.getResponseHeaders().set("Cache-Control", "no-store");
            exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
            exchange.getResponseHeaders().set("Referrer-Policy", "no-referrer");
            exchange.getResponseHeaders().set("Content-Security-Policy",
                "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; " +
                "style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; " +
                "connect-src 'self' blob: data:; worker-src 'self' blob:; " +
                "object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'");
            if (relative.equals("source")) {
                exchange.getResponseHeaders().set("Content-Type", "application/octet-stream");
                try (InputStream input = Files.newInputStream(file)) {
                    exchange.sendResponseHeaders(200, 0);
                    input.transferTo(exchange.getResponseBody());
                }
                return;
            }
            if (relative.equals("filename")) {
                byte[] name = file.getFileName().toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
                exchange.sendResponseHeaders(200, name.length);
                exchange.getResponseBody().write(name);
                return;
            }
            String resource = relative.equals("bridge.js") ? "/bridge.js" : "/viewers/" + relative;
            if (!relative.equals("bridge.js") && !relative.startsWith(kind + "/")) {
                exchange.sendResponseHeaders(404, -1); return;
            }
            try (InputStream input = ViewerServer.class.getResourceAsStream(resource)) {
                if (input == null) { exchange.sendResponseHeaders(404, -1); return; }
                exchange.getResponseHeaders().set("Content-Type", mime(relative));
                exchange.sendResponseHeaders(200, 0);
                input.transferTo(exchange.getResponseBody());
            }
        }
    }
    private static String mime(String path) {
        String extension = path.substring(path.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        return switch (extension) {
            case "html" -> "text/html; charset=utf-8";
            case "js" -> "text/javascript; charset=utf-8";
            case "css" -> "text/css; charset=utf-8";
            case "json", "map" -> "application/json";
            case "wasm" -> "application/wasm";
            case "png" -> "image/png";
            case "svg" -> "image/svg+xml";
            default -> "application/octet-stream";
        };
    }
    @Override public void close() { server.stop(0); executor.shutdownNow(); }
}
