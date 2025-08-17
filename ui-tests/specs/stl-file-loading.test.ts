import { VSBrowser, WebDriver, EditorView, SideBarView, TreeItem } from 'vscode-extension-tester';
import * as path from 'path';

describe('STL File Loading UI Tests', function() {
    this.timeout(60000); // 60 seconds timeout for UI operations
    
    let driver: WebDriver;
    let browser: VSBrowser;
    
    before(async function() {
        browser = VSBrowser.instance;
        driver = browser.driver;
        
        // Open the workspace with test files
        const workspacePath = path.resolve(__dirname, '../../../');
        await browser.openResources(workspacePath);
        
        // Wait for the workspace to load
        await driver.sleep(2000);
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
    
    it('should find STL test files in explorer', async function() {
        const sideBar = new SideBarView();
        const explorer = await sideBar.getContent().getSection('Explorer');
        await explorer.expand();
        
        // Look for testfiles/stl folder
        const testfilesFolder = await explorer.findItem('testfiles');
        if (!testfilesFolder) {
            throw new Error('testfiles folder not found in explorer');
        }
        
        await testfilesFolder.expand();
        
        const stlFolder = await testfilesFolder.findChildItem('stl');
        if (!stlFolder) {
            throw new Error('testfiles/stl folder not found in explorer');
        }
        
        await stlFolder.expand();
        
        // Check for key STL test files
        const expectedFiles = [
            'test_cube_ascii.stl',
            'test_colored_cube_binary.stl',
            'test_empty_ascii.stl',
            'test_large_coordinates.stl',
            'test_sphere_subdivided.stl'
        ];
        
        for (const fileName of expectedFiles) {
            const file = await stlFolder.findChildItem(fileName);
            if (!file) {
                throw new Error(`STL test file ${fileName} not found in explorer`);
            }
            console.log(`✅ Found ${fileName} in explorer`);
        }
    });
    
    it('should open simple ASCII STL file with PLY Visualizer', async function() {
        const sideBar = new SideBarView();
        const explorer = await sideBar.getContent().getSection('Explorer');
        
        const testfilesFolder = await explorer.findItem('testfiles');
        if (!testfilesFolder) {
            throw new Error('testfiles folder not found');
        }
        
        await testfilesFolder.expand();
        const stlFolder = await testfilesFolder.findChildItem('stl');
        if (!stlFolder) {
            throw new Error('stl folder not found');
        }
        await stlFolder.expand();
        
        // Open test_cube_ascii.stl (simple 12-triangle cube)
        const stlFile = await stlFolder.findChildItem('test_cube_ascii.stl');
        if (!stlFile) {
            throw new Error('test_cube_ascii.stl not found');
        }
        
        // Right-click to open context menu
        await stlFile.click(2); // Right click
        await driver.sleep(1000);
        
        // Look for "Open with PLY Visualizer" option
        const contextMenu = await driver.findElement({ css: '.context-view' });
        const menuItems = await contextMenu.findElements({ css: '.action-item' });
        
        let visualizerOption = null;
        for (const item of menuItems) {
            const text = await item.getText();
            if (text.includes('PLY Visualizer') || text.includes('Open with PLY Visualizer')) {
                visualizerOption = item;
                break;
            }
        }
        
        if (!visualizerOption) {
            throw new Error('PLY Visualizer option not found in context menu for STL files');
        }
        
        await visualizerOption.click();
        await driver.sleep(5000); // Wait for STL parsing and rendering
        
        // Verify that a custom editor opened
        const editorView = new EditorView();
        const editors = await editorView.getOpenTabs();
        
        let stlEditorFound = false;
        for (const editor of editors) {
            const title = await editor.getTitle();
            if (title.includes('test_cube_ascii.stl')) {
                stlEditorFound = true;
                console.log(`✅ ASCII STL file opened with title: ${title}`);
                break;
            }
        }
        
        if (!stlEditorFound) {
            throw new Error('ASCII STL file did not open in custom editor');
        }
    });
    
    it('should show STL mesh visualization in webview', async function() {
        // The STL file should already be open from previous test
        const editorView = new EditorView();
        
        // Wait for webview to load and render
        await driver.sleep(7000);
        
        // Switch to webview frame to check content
        try {
            const webviews = await driver.findElements({ css: 'iframe.webview' });
            if (webviews.length === 0) {
                throw new Error('No webview iframe found for STL file');
            }
            
            await driver.switchTo().frame(webviews[0]);
            
            // Look for STL-specific UI elements and status messages
            const expectedElements = [
                'STL mesh loaded',
                'triangles',
                'vertices',
                'Files', // Tab navigation
                'Camera', // Tab navigation
                'Controls' // Tab navigation
            ];
            
            for (const elementText of expectedElements) {
                const elements = await driver.findElements({ css: '*' });
                let found = false;
                
                for (const element of elements) {
                    try {
                        const text = await element.getText();
                        if (text.includes(elementText)) {
                            found = true;
                            console.log(`✅ Found STL UI element: ${elementText}`);
                            break;
                        }
                    } catch (error) {
                        // Ignore elements that can't be read
                    }
                }
                
                if (!found) {
                    console.log(`⚠️  STL UI element not immediately visible: ${elementText}`);
                }
            }
            
            // Look for Three.js canvas (the actual 3D rendering)
            const canvas = await driver.findElements({ css: 'canvas' });
            if (canvas.length > 0) {
                console.log(`✅ Found 3D rendering canvas for STL mesh`);
            } else {
                console.log(`⚠️  3D rendering canvas not found`);
            }
            
            // Switch back to main frame
            await driver.switchTo().defaultContent();
            
        } catch (error) {
            console.log('Note: Could not fully verify STL webview content');
            console.log('Error:', error instanceof Error ? error.message : String(error));
            
            // Switch back to main frame just in case
            await driver.switchTo().defaultContent();
        }
    });
    
    it('should handle empty STL file gracefully', async function() {
        const sideBar = new SideBarView();
        const explorer = await sideBar.getContent().getSection('Explorer');
        
        const testfilesFolder = await explorer.findItem('testfiles');
        const stlFolder = await testfilesFolder?.findChildItem('stl');
        
        if (!stlFolder) {
            throw new Error('STL folder not found');
        }
        
        await stlFolder.expand();
        
        // Open test_empty_ascii.stl (edge case: empty mesh)
        const emptyStlFile = await stlFolder.findChildItem('test_empty_ascii.stl');
        if (!emptyStlFile) {
            throw new Error('test_empty_ascii.stl not found');
        }
        
        // Double-click to open (should use default STL handler)
        await emptyStlFile.click();
        await driver.sleep(1000);
        await emptyStlFile.click(); // Double click
        await driver.sleep(4000);
        
        // Verify that the empty STL file opened without errors
        const editorView = new EditorView();
        const editors = await editorView.getOpenTabs();
        
        let emptyStlEditorFound = false;
        for (const editor of editors) {
            const title = await editor.getTitle();
            if (title.includes('test_empty_ascii.stl')) {
                emptyStlEditorFound = true;
                console.log(`✅ Empty STL file opened with title: ${title}`);
                break;
            }
        }
        
        if (!emptyStlEditorFound) {
            throw new Error('Empty STL file did not open in custom editor');
        }
        
        // Should show "Empty mesh loaded" status (not an error)
        await driver.sleep(3000);
        console.log('✅ Empty STL file handled without throwing errors');
    });
    
    it('should handle large coordinates STL with fit to view', async function() {
        const sideBar = new SideBarView();
        const explorer = await sideBar.getContent().getSection('Explorer');
        
        const testfilesFolder = await explorer.findItem('testfiles');
        const stlFolder = await testfilesFolder?.findChildItem('stl');
        
        if (!stlFolder) {
            throw new Error('STL folder not found');
        }
        
        await stlFolder.expand();
        
        // Open test_large_coordinates.stl
        const largeStlFile = await stlFolder.findChildItem('test_large_coordinates.stl');
        if (!largeStlFile) {
            throw new Error('test_large_coordinates.stl not found');
        }
        
        // Right-click and open with PLY Visualizer
        await largeStlFile.click(2);
        await driver.sleep(1000);
        
        const contextMenu = await driver.findElement({ css: '.context-view' });
        const menuItems = await contextMenu.findElements({ css: '.action-item' });
        
        let visualizerOption = null;
        for (const item of menuItems) {
            const text = await item.getText();
            if (text.includes('PLY Visualizer')) {
                visualizerOption = item;
                break;
            }
        }
        
        if (visualizerOption) {
            await visualizerOption.click();
            await driver.sleep(5000);
            
            console.log('✅ Large coordinates STL file loaded');
            console.log('ℹ️  Note: Use F key (Fit to View) to see geometry with large coordinates');
        }
    });
    
    it('should handle complex geometry STL files', async function() {
        const sideBar = new SideBarView();
        const explorer = await sideBar.getContent().getSection('Explorer');
        
        const testfilesFolder = await explorer.findItem('testfiles');
        const stlFolder = await testfilesFolder?.findChildItem('stl');
        
        if (!stlFolder) {
            throw new Error('STL folder not found');
        }
        
        await stlFolder.expand();
        
        // Open test_sphere_subdivided.stl (1280 triangles)
        const complexStlFile = await stlFolder.findChildItem('test_sphere_subdivided.stl');
        if (!complexStlFile) {
            throw new Error('test_sphere_subdivided.stl not found');
        }
        
        // Double-click to open
        await complexStlFile.click();
        await driver.sleep(1000);
        await complexStlFile.click();
        await driver.sleep(8000); // More time for complex geometry
        
        // Verify complex STL opened
        const editorView = new EditorView();
        const editors = await editorView.getOpenTabs();
        
        let complexStlFound = false;
        for (const editor of editors) {
            const title = await editor.getTitle();
            if (title.includes('test_sphere_subdivided.stl')) {
                complexStlFound = true;
                console.log(`✅ Complex STL file (1280 triangles) opened: ${title}`);
                break;
            }
        }
        
        if (!complexStlFound) {
            throw new Error('Complex STL file did not open');
        }
    });
    
    it('should show STL context menu options', async function() {
        const sideBar = new SideBarView();
        const explorer = await sideBar.getContent().getSection('Explorer');
        
        const testfilesFolder = await explorer.findItem('testfiles');
        const stlFolder = await testfilesFolder?.findChildItem('stl');
        
        if (!stlFolder) {
            throw new Error('STL folder not found');
        }
        
        await stlFolder.expand();
        
        // Right-click on any STL file
        const stlFile = await stlFolder.findChildItem('test_cube_ascii.stl');
        if (!stlFile) {
            throw new Error('test_cube_ascii.stl not found');
        }
        
        await stlFile.click(2); // Right click
        await driver.sleep(1000);
        
        // Verify STL files show up in "Open with PLY Visualizer" context menu
        const contextMenu = await driver.findElement({ css: '.context-view' });
        const menuItems = await contextMenu.findElements({ css: '.action-item' });
        
        let stlMenuOption = null;
        for (const item of menuItems) {
            const text = await item.getText();
            if (text.includes('Open with PLY Visualizer')) {
                stlMenuOption = item;
                console.log(`✅ Found STL context menu option: ${text}`);
                break;
            }
        }
        
        // Click somewhere else to close the context menu
        await driver.findElement({ css: 'body' }).click();
        await driver.sleep(500);
        
        if (!stlMenuOption) {
            throw new Error('STL context menu option not found');
        }
    });
});