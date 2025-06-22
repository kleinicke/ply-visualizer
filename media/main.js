// @ts-check

(function() {
    // Check if THREE is available
    if (typeof THREE === 'undefined') {
        console.error('THREE.js is not loaded. Cannot initialize PLY visualizer.');
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error-message').textContent = 'Three.js library failed to load. Please refresh the page.';
        document.getElementById('error').classList.remove('hidden');
        return;
    }

    const vscode = acquireVsCodeApi();
    
    let scene, camera, renderer, controls;
    let currentMesh = null;
    let currentGeometry = null;
    let currentMaterial = null;
    let isWireframe = false;
    let showAsPoints = false;
    let plyData = null;
    
    // Multi-file support
    let isMultiViewer = false;
    let multiPlyData = [];
    let multiMeshes = [];
    let fileVisibility = [];
    let useOriginalColors = false; // Toggle between assigned colors and original colors
    
    // Predefined colors for different files
    const FILE_COLORS = [
        [1.0, 0.0, 0.0], // Red
        [0.0, 1.0, 0.0], // Green
        [0.0, 0.0, 1.0], // Blue
        [1.0, 1.0, 0.0], // Yellow
        [1.0, 0.0, 1.0], // Magenta
        [0.0, 1.0, 1.0], // Cyan
        [1.0, 0.5, 0.0], // Orange
        [0.5, 0.0, 1.0], // Purple
        [0.0, 0.5, 0.0], // Dark Green
        [0.5, 0.5, 0.5]  // Gray
    ];

    // Initialize Three.js scene
    function initThreeJS() {
        const container = document.getElementById('viewer-container');
        const canvas = document.getElementById('three-canvas');
        
        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1e1e1e);

        // Camera
        camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            10000
        );

        // Renderer
        renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true 
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 0.1;
        controls.maxDistance = 1000;

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);

        // Handle window resize
        window.addEventListener('resize', onWindowResize, false);

        // Start render loop
        animate();
    }

    function onWindowResize() {
        const container = document.getElementById('viewer-container');
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    function createGeometryFromPlyData(data) {
        const geometry = new THREE.BufferGeometry();
        
        // Extract vertices
        const vertices = new Float32Array(data.vertices.length * 3);
        const colors = data.hasColors ? new Float32Array(data.vertices.length * 3) : null;
        const normals = data.hasNormals ? new Float32Array(data.vertices.length * 3) : null;

        for (let i = 0; i < data.vertices.length; i++) {
            const vertex = data.vertices[i];
            const i3 = i * 3;
            
            vertices[i3] = vertex.x;
            vertices[i3 + 1] = vertex.y;
            vertices[i3 + 2] = vertex.z;

            if (colors && vertex.red !== undefined) {
                colors[i3] = vertex.red / 255;
                colors[i3 + 1] = (vertex.green || 0) / 255;
                colors[i3 + 2] = (vertex.blue || 0) / 255;
            }

            if (normals && vertex.nx !== undefined) {
                normals[i3] = vertex.nx;
                normals[i3 + 1] = vertex.ny || 0;
                normals[i3 + 2] = vertex.nz || 0;
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        if (colors) {
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        if (normals) {
            geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        } else {
            geometry.computeVertexNormals();
        }

        // Add faces if available
        if (data.faces && data.faces.length > 0) {
            const indices = [];
            for (const face of data.faces) {
                if (face.indices.length >= 3) {
                    // Triangulate face (simple fan triangulation)
                    for (let i = 1; i < face.indices.length - 1; i++) {
                        indices.push(face.indices[0], face.indices[i], face.indices[i + 1]);
                    }
                }
            }
            if (indices.length > 0) {
                geometry.setIndex(indices);
            }
        }

        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        return geometry;
    }

    function createMaterial(hasColors, hasNormals) {
        const materialParams = {
            vertexColors: hasColors,
            side: THREE.DoubleSide,
        };

        if (showAsPoints) {
            // Use a very small fixed point size to avoid blinking/overlapping
            const pointSize = 0.001; // Much smaller to prevent z-fighting
            
            console.log('Using fixed point size:', pointSize);
            
            return new THREE.PointsMaterial({
                ...materialParams,
                size: pointSize,
                sizeAttenuation: false,
                transparent: false
            });
        } else if (isWireframe) {
            return new THREE.MeshBasicMaterial({
                ...materialParams,
                wireframe: true
            });
        } else {
            return new THREE.MeshLambertMaterial(materialParams);
        }
    }

    function displayPlyData(data) {
        // Remove existing mesh
        if (currentMesh) {
            scene.remove(currentMesh);
            if (currentGeometry) currentGeometry.dispose();
            if (currentMaterial) currentMaterial.dispose();
        }

        // Create geometry
        currentGeometry = createGeometryFromPlyData(data);
        
        // Create mesh or points - default to points for point clouds, mesh for models with faces
        const shouldShowAsPoints = showAsPoints || data.faceCount === 0;
        
        // Update the showAsPoints variable to match the actual rendering decision
        showAsPoints = shouldShowAsPoints;
        
        // Create material AFTER updating showAsPoints
        currentMaterial = createMaterial(data.hasColors, data.hasNormals);
        
        // Store the rendering mode for display in info panel
        const renderingMode = shouldShowAsPoints ? 'Points' : 'Mesh';
        
        if (shouldShowAsPoints) {
            currentMesh = new THREE.Points(currentGeometry, currentMaterial);
            console.log('Rendering as POINTS');
        } else {
            currentMesh = new THREE.Mesh(currentGeometry, currentMaterial);
            console.log('Rendering as MESH');
        }

        scene.add(currentMesh);

        // Fit camera to object
        fitCameraToObject(currentMesh);

        // Update file statistics
        updateFileStats(data, renderingMode);

        // Hide loading indicator
        document.getElementById('loading').classList.add('hidden');
        
        console.log('PLY Data loaded:', {
            vertices: data.vertexCount,
            faces: data.faceCount,
            hasColors: data.hasColors,
            hasNormals: data.hasNormals,
            boundingBox: currentGeometry.boundingBox,
            renderingAs: shouldShowAsPoints ? 'points' : 'mesh'
        });
    }

    function displayMultiPlyData(dataArray) {
        isMultiViewer = true;
        multiPlyData = dataArray;
        multiMeshes = [];
        fileVisibility = [];

        // Clear existing meshes
        while (scene.children.length > 0) {
            const child = scene.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            scene.remove(child);
        }

        // Re-add lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        scene.add(directionalLight);

        // Create mesh for each file
        for (let i = 0; i < dataArray.length; i++) {
            const data = dataArray[i];
            const geometry = createGeometryFromPlyData(data);
            
            console.log(`Creating geometry for file ${i}:`, {
                hasColors: data.hasColors,
                vertexCount: data.vertexCount,
                geometryHasColors: geometry.attributes.color !== undefined,
                sampleVertex: data.vertices[0] // Show first vertex to see what properties it has
            });
            
            const material = createMaterialForFile(data, i);
            
            const shouldShowAsPoints = data.faceCount === 0;
            const mesh = shouldShowAsPoints ? 
                new THREE.Points(geometry, material) : 
                new THREE.Mesh(geometry, material);
            
            scene.add(mesh);
            multiMeshes.push(mesh);
            fileVisibility.push(true);
        }

        // Fit camera to all objects
        fitCameraToAllObjects();

        // Update UI
        updateMultiFileStats();
        updateFileList();

        // Hide loading indicator
        document.getElementById('loading').classList.add('hidden');
    }

    function createMaterialForFile(data, fileIndex) {
        const shouldShowAsPoints = data.faceCount === 0;
        
        console.log(`Creating material for file ${fileIndex}:`, {
            useOriginalColors,
            hasColors: data.hasColors,
            shouldShowAsPoints,
            fileName: data.fileName
        });
        
        if (shouldShowAsPoints) {
            const materialParams = {
                size: 0.001,
                sizeAttenuation: false,
                transparent: false
            };
            
            if (useOriginalColors) {
                if (data.hasColors) {
                    materialParams.vertexColors = true;
                    console.log(`Using vertex colors for file ${fileIndex}`);
                } else {
                    // No colors available, use white/gray for "original" look
                    materialParams.color = new THREE.Color(0.7, 0.7, 0.7);
                    console.log(`No colors available for file ${fileIndex}, using neutral gray`);
                }
            } else {
                const color = FILE_COLORS[fileIndex % FILE_COLORS.length];
                materialParams.color = new THREE.Color(color[0], color[1], color[2]);
                console.log(`Using assigned color for file ${fileIndex}:`, color);
            }
            
            return new THREE.PointsMaterial(materialParams);
        } else {
            const materialParams = {
                side: THREE.DoubleSide
            };
            
            if (useOriginalColors) {
                if (data.hasColors) {
                    materialParams.vertexColors = true;
                    console.log(`Using vertex colors for mesh file ${fileIndex}`);
                } else {
                    // No colors available, use white/gray for "original" look
                    materialParams.color = new THREE.Color(0.7, 0.7, 0.7);
                    console.log(`No colors available for mesh file ${fileIndex}, using neutral gray`);
                }
            } else {
                const color = FILE_COLORS[fileIndex % FILE_COLORS.length];
                materialParams.color = new THREE.Color(color[0], color[1], color[2]);
                console.log(`Using assigned color for mesh file ${fileIndex}:`, color);
            }
            
            return new THREE.MeshLambertMaterial(materialParams);
        }
    }

    function fitCameraToAllObjects() {
        if (multiMeshes.length === 0) return;

        const box = new THREE.Box3();
        for (const mesh of multiMeshes) {
            if (mesh.visible) {
                box.expandByObject(mesh);
            }
        }

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

        cameraZ *= 2;

        camera.position.set(center.x, center.y, center.z + cameraZ);
        camera.lookAt(center);
        
        controls.target.copy(center);
        controls.maxDistance = cameraZ * 10;
        controls.update();
    }

    function updateMultiFileStats() {
        const totalVertices = multiPlyData.reduce((sum, data) => sum + data.vertexCount, 0);
        const totalFaces = multiPlyData.reduce((sum, data) => sum + data.faceCount, 0);
        
        const statsDiv = document.getElementById('file-stats');
        statsDiv.innerHTML = `
            <div><strong>Total Files:</strong> ${multiPlyData.length}</div>
            <div><strong>Total Vertices:</strong> ${totalVertices.toLocaleString()}</div>
            <div><strong>Total Faces:</strong> ${totalFaces.toLocaleString()}</div>
        `;
    }

    function updateFileList() {
        const fileListDiv = document.getElementById('file-list');
        if (!fileListDiv) return;

        let html = `<h5>Files (${useOriginalColors ? 'Original Colors' : 'Assigned Colors'}):</h5>`;
        html += `<button id="toggle-colors" style="margin-bottom: 8px; font-size: 10px; padding: 4px 8px;">${useOriginalColors ? 'Use Assigned Colors' : 'Use Original Colors'}</button>`;
        
        for (let i = 0; i < multiPlyData.length; i++) {
            const data = multiPlyData[i];
            let colorIndicator = '';
            
            if (useOriginalColors && data.hasColors) {
                colorIndicator = '<span class="color-indicator" style="background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff); border: 1px solid #666;"></span>';
            } else {
                const color = FILE_COLORS[i % FILE_COLORS.length];
                const colorHex = `#${Math.round(color[0] * 255).toString(16).padStart(2, '0')}${Math.round(color[1] * 255).toString(16).padStart(2, '0')}${Math.round(color[2] * 255).toString(16).padStart(2, '0')}`;
                colorIndicator = `<span class="color-indicator" style="background-color: ${colorHex}"></span>`;
            }
            
            html += `
                <div class="file-item">
                    <input type="checkbox" id="file-${i}" ${fileVisibility[i] ? 'checked' : ''}>
                    ${colorIndicator}
                    <label for="file-${i}">${data.fileName || `File ${i + 1}`}</label>
                    <span class="file-info">(${data.vertexCount.toLocaleString()} vertices)</span>
                </div>
            `;
        }
        fileListDiv.innerHTML = html;
        
        // Add event listeners after setting innerHTML
        for (let i = 0; i < multiPlyData.length; i++) {
            const checkbox = document.getElementById(`file-${i}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => toggleFileVisibility(i));
            }
        }
        
        // Add color toggle button listener
        const colorToggleBtn = document.getElementById('toggle-colors');
        if (colorToggleBtn) {
            colorToggleBtn.addEventListener('click', toggleColorMode);
        }
    }

    function toggleFileVisibility(fileIndex) {
        if (fileIndex >= 0 && fileIndex < multiMeshes.length) {
            fileVisibility[fileIndex] = !fileVisibility[fileIndex];
            multiMeshes[fileIndex].visible = fileVisibility[fileIndex];
        }
    }

    function toggleAllFiles() {
        const allVisible = fileVisibility.every(visible => visible);
        const newVisibility = !allVisible;
        
        for (let i = 0; i < fileVisibility.length; i++) {
            fileVisibility[i] = newVisibility;
            multiMeshes[i].visible = newVisibility;
        }
        
        updateFileList();
    }

    function toggleColorMode() {
        if (!isMultiViewer) return;
        
        useOriginalColors = !useOriginalColors;
        console.log('Toggling color mode to:', useOriginalColors ? 'Original Colors' : 'Assigned Colors');
        
        // Recreate materials for all meshes
        for (let i = 0; i < multiMeshes.length; i++) {
            const oldMaterial = multiMeshes[i].material;
            const newMaterial = createMaterialForFile(multiPlyData[i], i);
            multiMeshes[i].material = newMaterial;
            
            if (oldMaterial) oldMaterial.dispose();
        }
        
        // Update the file list to show current color mode
        updateFileList();
    }

    function fitCameraToObject(object) {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

        cameraZ *= 2; // Add some padding

        camera.position.set(center.x, center.y, center.z + cameraZ);
        camera.lookAt(center);
        
        controls.target.copy(center);
        controls.maxDistance = cameraZ * 10;
        controls.update();
    }

    function updateFileStats(data, renderingMode) {
        const statsDiv = document.getElementById('file-stats');
        statsDiv.innerHTML = `
            <div><strong>Format:</strong> ${data.format}</div>
            <div><strong>Version:</strong> ${data.version}</div>
            <div><strong>Vertices:</strong> ${data.vertexCount.toLocaleString()}</div>
            <div><strong>Faces:</strong> ${data.faceCount.toLocaleString()}</div>
            <div><strong>Colors:</strong> ${data.hasColors ? 'Yes' : 'No'}</div>
            <div><strong>Normals:</strong> ${data.hasNormals ? 'Yes' : 'No'}</div>
            <div><strong>Rendering Mode:</strong> ${renderingMode || (showAsPoints ? 'Points' : 'Mesh')}</div>
            ${data.comments.length > 0 ? `<div><strong>Comments:</strong><br>${data.comments.join('<br>')}</div>` : ''}
        `;
    }

    function showError(message) {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error-message').textContent = message;
        document.getElementById('error').classList.remove('hidden');
    }

    function resetCamera() {
        if (currentMesh) {
            fitCameraToObject(currentMesh);
        }
    }

    function toggleWireframe() {
        if (!currentMesh || !plyData || !currentGeometry) return;
        
        isWireframe = !isWireframe;
        
        // Recreate material
        const oldMaterial = currentMaterial;
        currentMaterial = createMaterial(plyData.hasColors, plyData.hasNormals);
        currentMesh.material = currentMaterial;
        
        if (oldMaterial) oldMaterial.dispose();
        
        // Update the file stats to reflect current mode
        updateFileStats(plyData);
    }

    function togglePoints() {
        if (!currentMesh || !plyData || !currentGeometry) return;
        
        showAsPoints = !showAsPoints;
        
        // Remove current mesh
        scene.remove(currentMesh);
        
        // Create new mesh/points
        const oldMaterial = currentMaterial;
        currentMaterial = createMaterial(plyData.hasColors, plyData.hasNormals);
        
        if (showAsPoints) {
            currentMesh = new THREE.Points(currentGeometry, currentMaterial);
        } else {
            currentMesh = new THREE.Mesh(currentGeometry, currentMaterial);
        }
        
        scene.add(currentMesh);
        
        if (oldMaterial) oldMaterial.dispose();
        
        // Update the file stats to show new rendering mode
        updateFileStats(plyData);
    }

    // Event listeners
    document.getElementById('reset-camera').addEventListener('click', resetCamera);
    document.getElementById('toggle-wireframe').addEventListener('click', toggleWireframe);
    document.getElementById('toggle-points').addEventListener('click', togglePoints);
    
    // Multi-viewer event listeners
    const toggleAllBtn = document.getElementById('toggle-all');
    if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', toggleAllFiles);
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'plyData':
                try {
                    plyData = message.data;
                    displayPlyData(plyData);
                } catch (error) {
                    console.error('Error displaying PLY data:', error);
                    showError('Failed to display PLY data: ' + error.message);
                }
                break;
            case 'multiPlyData':
                try {
                    displayMultiPlyData(message.data);
                } catch (error) {
                    console.error('Error displaying multi PLY data:', error);
                    showError('Failed to display PLY data: ' + error.message);
                }
                break;
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThreeJS);
    } else {
        initThreeJS();
    }

})(); 