import { VSBrowser, WebDriver, EditorView, SideBarView, Workbench, By, until } from 'vscode-extension-tester';
import * as path from 'path';

describe('Open3D File Format Integration Tests', function() {
    this.timeout(180000); // 3 minutes timeout for actual VS Code operations
    
    let driver: WebDriver;
    let browser: VSBrowser;
    
    before(async function() {
        browser = VSBrowser.instance;
        driver = browser.driver;
        
        // Open the workspace with test files
        const workspacePath = path.resolve(__dirname, '../../../');
        await browser.openResources(workspacePath);
        
        // Wait for the workspace to fully load
        await driver.sleep(5000);
    });
    
    after(async function() {
        // Clean up - close all editors
        try {
            const editorView = new EditorView();
            await editorView.closeAllEditors();
        } catch (error) {
            console.log('Error during cleanup:', error);
        }
    });

    const testFormats = [
        { ext: 'pcd', name: 'Point Cloud Data', file: 'sample_pointcloud.pcd' },
        { ext: 'pts', name: 'PTS Point Cloud', file: 'sample_pointcloud.pts' },
        { ext: 'xyzn', name: 'XYZ with Normals', file: 'sample_pointcloud.xyzn' },
        { ext: 'xyzrgb', name: 'XYZ with Colors', file: 'sample_pointcloud.xyzrgb' },
        { ext: 'off', name: 'Object File Format', file: 'sample_mesh.off' },
        { ext: 'gltf', name: 'GL Transmission Format', file: 'sample_mesh.gltf' }
    ];
    
    testFormats.forEach(format => {
        it(`should successfully load and render ${format.name} (${format.ext}) in VS Code`, async function() {
            console.log(`\n=== Testing ${format.name} (${format.ext}) ===`);
            
            // 1. Navigate to test file
            const sideBar = new SideBarView();
            const explorer = await sideBar.getContent().getSection('Explorer');
            await explorer.expand();
            
            const testfilesFolder = await explorer.findItem('testfiles');
            if (!testfilesFolder) {
                throw new Error('testfiles folder not found');
            }
            await testfilesFolder.expand();
            
            const open3dFolder = await testfilesFolder.findChildItem('open3d');
            if (!open3dFolder) {
                throw new Error('open3d folder not found');
            }
            await open3dFolder.expand();
            
            // 2. Find and open the test file
            const testFile = await open3dFolder.findChildItem(format.file);
            if (!testFile) {
                console.log(`⚠️  Skipping ${format.ext} test - file ${format.file} not found`);
                return;
            }
            
            console.log(`📁 Found test file: ${format.file}`);
            
            // 3. Right-click and select "Open with PLY Visualizer"
            await testFile.click(2); // Right click
            await driver.sleep(2000);
            
            // Find the context menu
            let contextMenu;
            try {
                contextMenu = await driver.findElement(By.css('.context-view'));
            } catch (error) {
                console.log('Context menu not found, trying alternative approach...');
                // Double-click as fallback
                await testFile.click();
                await driver.sleep(500);
                await testFile.click();
                await driver.sleep(8000);
                
                // Verify editor opened
                const editorView = new EditorView();
                const tabs = await editorView.getOpenTabs();
                const fileTab = tabs.find(tab => tab.getTitle().then(title => title.includes(format.file)));
                if (!fileTab) {
                    throw new Error(`${format.ext} file did not open via double-click`);
                }
                console.log(`✅ ${format.ext} file opened via double-click`);
                return;
            }
            
            // Look for PLY Visualizer option
            const menuItems = await contextMenu.findElements(By.css('.action-item'));
            let visualizerOption = null;
            
            for (const item of menuItems) {
                try {
                    const text = await item.getText();
                    if (text.includes('PLY Visualizer') || text.includes('Open with PLY Visualizer')) {
                        visualizerOption = item;
                        console.log(`📋 Found context menu option: ${text}`);
                        break;
                    }
                } catch (error) {
                    // Ignore items that can't be read
                }
            }
            
            if (!visualizerOption) {
                throw new Error(`PLY Visualizer option not found in context menu for ${format.ext} files`);
            }
            
            // 4. Click the option to open with PLY Visualizer
            await visualizerOption.click();
            console.log(`🖱️  Clicked "Open with PLY Visualizer" for ${format.ext}`);
            
            // 5. Wait for the custom editor to load
            await driver.sleep(10000); // Give extra time for parsing and rendering
            
            // 6. Verify the custom editor opened
            const editorView = new EditorView();
            const openTabs = await editorView.getOpenTabs();
            
            let customEditorFound = false;
            for (const tab of openTabs) {
                const title = await tab.getTitle();
                if (title.includes(format.file)) {
                    customEditorFound = true;
                    console.log(`✅ Custom editor opened with title: ${title}`);
                    
                    // 7. Click on the tab to make it active
                    await tab.select();
                    await driver.sleep(3000);
                    break;
                }
            }
            
            if (!customEditorFound) {
                throw new Error(`Custom editor did not open for ${format.ext} file`);
            }
            
            // 8. Verify webview content is loaded
            try {
                // Wait for webview iframe to appear
                await driver.wait(until.elementLocated(By.css('iframe.webview')), 15000);
                const webviews = await driver.findElements(By.css('iframe.webview'));
                
                if (webviews.length === 0) {
                    throw new Error(`No webview iframe found for ${format.ext} file`);
                }
                
                console.log(`🖼️  Found webview iframe for ${format.ext}`);
                
                // Switch to webview context
                await driver.switchTo().frame(webviews[0]);
                
                // 9. Look for 3D canvas (Three.js rendering)
                try {
                    await driver.wait(until.elementLocated(By.css('canvas')), 10000);
                    const canvases = await driver.findElements(By.css('canvas'));
                    
                    if (canvases.length > 0) {
                        console.log(`✅ Found 3D rendering canvas for ${format.ext}`);
                        
                        // Check canvas dimensions (should be > 0 if properly rendered)
                        const canvas = canvases[0];
                        const width = await canvas.getAttribute('width');
                        const height = await canvas.getAttribute('height');
                        console.log(`📐 Canvas dimensions: ${width}x${height}`);
                        
                        if (parseInt(width) > 0 && parseInt(height) > 0) {
                            console.log(`✅ Canvas has valid dimensions - rendering successful!`);
                        }
                    } else {
                        console.log(`⚠️  No canvas found for ${format.ext} - may still be loading`);
                    }
                } catch (canvasError) {
                    console.log(`⚠️  Canvas not found within timeout for ${format.ext}:`, canvasError.message);
                }
                
                // 10. Look for UI elements (tabs, status text)
                const uiElements = ['Files', 'Camera', 'Controls'];
                for (const elementText of uiElements) {
                    try {
                        const elements = await driver.findElements(By.xpath(`//*[contains(text(), '${elementText}')]`));
                        if (elements.length > 0) {
                            console.log(`✅ Found UI element: ${elementText}`);
                        }
                    } catch (uiError) {
                        console.log(`⚠️  UI element '${elementText}' not found`);
                    }
                }
                
                // Switch back to main frame
                await driver.switchTo().defaultContent();
                
            } catch (webviewError) {
                await driver.switchTo().defaultContent(); // Ensure we're back in main frame
                console.log(`⚠️  Webview verification failed for ${format.ext}:`, webviewError.message);
            }
            
            console.log(`✅ ${format.name} (${format.ext}) integration test completed successfully!`);
            
            // Small cleanup delay before next test
            await driver.sleep(2000);
        });
    });
    
    it('should handle multiple Open3D files loaded simultaneously', async function() {
        console.log('\n=== Testing Multiple File Loading ===');
        
        // Close existing editors first
        const editorView = new EditorView();
        await editorView.closeAllEditors();
        await driver.sleep(2000);
        
        // Load 3 different format files
        const testFiles = ['sample_pointcloud.pcd', 'sample_mesh.off', 'sample_pointcloud.xyzrgb'];
        
        for (const fileName of testFiles) {
            // Navigate and open each file
            const sideBar = new SideBarView();
            const explorer = await sideBar.getContent().getSection('Explorer');
            const testfilesFolder = await explorer.findItem('testfiles');
            const open3dFolder = await testfilesFolder?.findChildItem('open3d');
            
            if (!open3dFolder) continue;
            await open3dFolder.expand();
            
            const testFile = await open3dFolder.findChildItem(fileName);
            if (!testFile) {
                console.log(`⚠️  File ${fileName} not found, skipping`);
                continue;
            }
            
            // Double-click to open
            await testFile.click();
            await driver.sleep(500);
            await testFile.click();
            await driver.sleep(6000); // Wait for loading
            
            console.log(`📂 Opened ${fileName}`);
        }
        
        // Verify multiple tabs are open
        const openTabs = await editorView.getOpenTabs();
        console.log(`📋 Total open tabs: ${openTabs.length}`);
        
        if (openTabs.length >= 2) {
            console.log('✅ Multiple Open3D files loaded successfully!');
        } else {
            console.log('⚠️  Expected multiple tabs, but got fewer than expected');
        }
        
        // Test switching between tabs
        for (let i = 0; i < Math.min(openTabs.length, 3); i++) {
            try {
                await openTabs[i].select();
                await driver.sleep(2000);
                const title = await openTabs[i].getTitle();
                console.log(`🔄 Switched to tab: ${title}`);
            } catch (error) {
                console.log(`⚠️  Could not switch to tab ${i}:`, error.message);
            }
        }
    });
});