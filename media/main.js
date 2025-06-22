// @ts-check

(function() {
    // Check if THREE is available
    if (typeof THREE === 'undefined') {
        console.error('THREE.js is not loaded. Cannot initialize PLY viewer.');
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
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThreeJS);
    } else {
        initThreeJS();
    }

})(); 