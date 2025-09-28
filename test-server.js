const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Serve static files
app.use('/out', express.static(path.join(__dirname, 'out')));
app.use('/testfiles', express.static(path.join(__dirname, 'testfiles')));

// Create test HTML page that loads the webview
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PLY Visualizer - E2E Test</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background: #1e1e1e;
            color: white;
        }
        #status {
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            padding: 10px;
            border-radius: 5px;
            z-index: 1000;
        }
        .test-controls {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            padding: 10px;
            border-radius: 5px;
            z-index: 1000;
        }
        button {
            background: #007acc;
            color: white;
            border: none;
            padding: 8px 16px;
            margin: 4px;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background: #005a9e;
        }
    </style>
</head>
<body>
    <div id="status">
        <h3>PLY Visualizer - E2E Test</h3>
        <p>Status: <span id="status-text">Loading...</span></p>
        <p>Canvas: <span id="canvas-status">Not found</span></p>
        <p>Points: <span id="points-count">0</span></p>
    </div>

    <div class="test-controls">
        <h4>Test Controls</h4>
        <button onclick="loadSampleFile()">Load Sample PLY</button>
        <button onclick="clearScene()">Clear Scene</button>
        <button onclick="runTests()">Run Tests</button>
    </div>

    <script src="/out/webview/main.js"></script>
    <script>
        // Test utilities
        let pointsLoaded = 0;
        
        function updateStatus() {
            const statusEl = document.getElementById('status-text');
            const canvasEl = document.getElementById('canvas-status');
            const pointsEl = document.getElementById('points-count');
            
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvasEl.textContent = 'Found ✅';
                canvasEl.style.color = '#00ff00';
            } else {
                canvasEl.textContent = 'Not found ❌';
                canvasEl.style.color = '#ff0000';
            }
            
            statusEl.textContent = 'Ready';
            statusEl.style.color = '#00ff00';
            pointsEl.textContent = pointsLoaded;
        }
        
        function loadSampleFile() {
            // Simulate loading the sample PLY file
            const sampleData = {
                type: 'fileData',
                fileName: 'sample_pointcloud.ply',
                vertices: generateTestVertices(1250),
                faces: [],
                hasColors: true,
                hasNormals: true,
                vertexCount: 1250,
                faceCount: 0
            };
            
            // Dispatch the message as if it came from the extension
            window.dispatchEvent(new MessageEvent('message', { data: sampleData }));
            pointsLoaded = 1250;
            updateStatus();
        }
        
        function clearScene() {
            // Clear the scene by reloading
            location.reload();
        }
        
        function runTests() {
            const results = {
                canvasExists: !!document.querySelector('canvas'),
                svelteLoaded: !!window.app,
                threeJsLoaded: !!window.THREE,
                timestamp: new Date().toISOString()
            };
            
            // Store results for Playwright to read
            window.testResults = results;
            console.log('Test results:', results);
            
            return results;
        }
        
        function generateTestVertices(count) {
            const vertices = [];
            for (let i = 0; i < count; i++) {
                vertices.push({
                    x: (Math.random() - 0.5) * 10,
                    y: (Math.random() - 0.5) * 10,
                    z: (Math.random() - 0.5) * 10,
                    nx: Math.random() - 0.5,
                    ny: Math.random() - 0.5,
                    nz: Math.random() - 0.5,
                    red: Math.floor(Math.random() * 256),
                    green: Math.floor(Math.random() * 256),
                    blue: Math.floor(Math.random() * 256),
                });
            }
            return vertices;
        }
        
        // Update status periodically
        setInterval(updateStatus, 1000);
        
        // Initial status update
        setTimeout(updateStatus, 100);
        
        // Listen for scene additions
        window.addEventListener('addToScene', (event) => {
            console.log('Scene object added:', event.detail);
            pointsLoaded += event.detail.pointCount || 0;
            updateStatus();
        });
    </script>
</body>
</html>
  `;
  res.send(html);
});

app.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
});
