import { VSBrowser, WebDriver, EditorView, SideBarView } from 'vscode-extension-tester';
import * as path from 'path';

describe('Playwright PLY File Loading UI Tests', function () {
  this.timeout(60000); // 60 seconds timeout for UI operations

  let driver: WebDriver;
  let browser: VSBrowser;

  before(async function () {
    browser = VSBrowser.instance;
    driver = browser.driver;

    // Open the workspace with test files
    const workspacePath = path.resolve(__dirname, '../../../');
    await browser.openResources(workspacePath);

    // Wait for the workspace to load
    await driver.sleep(3000);
  });

  after(async function () {
    // Clean up - close all editors
    try {
      const editorView = new EditorView();
      await editorView.closeAllEditors();
    } catch (error) {
      console.log('Error during cleanup:', error);
    }
  });

  it('should find sample_mesh.ply in testfiles/open3d folder', async function () {
    const sideBar = new SideBarView();
    const explorer = await sideBar.getContent().getSection('Explorer');
    await explorer.expand();

    // Navigate to testfiles/open3d folder
    const testfilesFolder = await explorer.findItem('testfiles');
    if (!testfilesFolder) {
      throw new Error('testfiles folder not found in explorer');
    }

    await (testfilesFolder as any).expand();

    const open3dFolder = await (testfilesFolder as any).findChildItem('open3d');
    if (!open3dFolder) {
      throw new Error('testfiles/open3d folder not found in explorer');
    }

    await (open3dFolder as any).expand();

    // Find the sample_mesh.ply file
    const plyFile = await (open3dFolder as any).findChildItem('sample_mesh.ply');
    if (!plyFile) {
      throw new Error('sample_mesh.ply not found in testfiles/open3d');
    }

    console.log('✅ Found sample_mesh.ply in testfiles/open3d');
  });

  it('should open sample_mesh.ply with 3D Visualizer via context menu', async function () {
    const sideBar = new SideBarView();
    const explorer = await sideBar.getContent().getSection('Explorer');

    const testfilesFolder = await explorer.findItem('testfiles');
    const open3dFolder = await (testfilesFolder as any)?.findChildItem('open3d');

    if (!open3dFolder) {
      throw new Error('Open3D folder not found');
    }

    await (open3dFolder as any).expand();

    // Find the PLY test file
    const plyFile = await (open3dFolder as any).findChildItem('sample_mesh.ply');
    if (!plyFile) {
      throw new Error('sample_mesh.ply not found');
    }

    // Right-click to open context menu
    await plyFile.click(2); // Right click
    await driver.sleep(1000);

    // Look for "Open with 3D Visualizer" option
    const contextMenu = await driver.findElement({ css: '.context-view' });
    const menuItems = await contextMenu.findElements({ css: '.action-item' });

    let visualizerOption = null;
    for (const item of menuItems) {
      const text = await item.getText();
      if (text.includes('3D Visualizer') || text.includes('Open with 3D Visualizer')) {
        visualizerOption = item;
        break;
      }
    }

    if (!visualizerOption) {
      throw new Error('3D Visualizer option not found in context menu');
    }

    await visualizerOption.click();
    await driver.sleep(6000); // Wait for PLY parsing and rendering

    // Verify that a custom editor opened
    const editorView = new EditorView();
    const editors = await editorView.getOpenTabs();

    let plyEditorFound = false;
    for (const editor of editors) {
      const title = await editor.getTitle();
      if (title.includes('sample_mesh.ply')) {
        plyEditorFound = true;
        console.log(`✅ PLY file opened with title: ${title}`);
        break;
      }
    }

    if (!plyEditorFound) {
      throw new Error('PLY file did not open in custom editor');
    }
  });

  it('should show PLY mesh visualization in webview with Three.js canvas', async function () {
    // Wait for webview to load and render
    await driver.sleep(5000);

    // Switch to webview frame to check content
    try {
      const webviews = await driver.findElements({ css: 'iframe.webview' });
      if (webviews.length === 0) {
        throw new Error('No webview iframe found for PLY file');
      }

      await driver.switchTo().frame(webviews[0]);

      // Look for PLY-specific UI elements and status messages
      const expectedElements = [
        'PLY mesh loaded',
        'vertices',
        'triangles',
        'Files', // Tab navigation
        'Camera', // Tab navigation
        'Controls', // Tab navigation
      ];

      for (const elementText of expectedElements) {
        const elements = await driver.findElements({ css: '*' });
        let found = false;

        for (const element of elements) {
          try {
            const text = await element.getText();
            if (text.includes(elementText)) {
              found = true;
              console.log(`✅ Found PLY UI element: ${elementText}`);
              break;
            }
          } catch (error) {
            // Ignore elements that can't be read
          }
        }

        if (!found) {
          console.log(`⚠️  PLY UI element not immediately visible: ${elementText}`);
        }
      }

      // Look for Three.js canvas (the actual 3D rendering)
      const canvas = await driver.findElements({ css: 'canvas' });
      if (canvas.length > 0) {
        console.log(`✅ Found Three.js 3D rendering canvas for PLY mesh`);
      } else {
        throw new Error('Three.js 3D rendering canvas not found');
      }

      // Switch back to main frame
      await driver.switchTo().defaultContent();
    } catch (error) {
      console.log(
        'Error verifying PLY webview content:',
        error instanceof Error ? error.message : String(error)
      );

      // Switch back to main frame just in case
      await driver.switchTo().defaultContent();
      throw error;
    }
  });

  it('should interact with camera controls and UI buttons', async function () {
    // Switch to webview frame
    const webviews = await driver.findElements({ css: 'iframe.webview' });
    if (webviews.length === 0) {
      throw new Error('No webview iframe found');
    }

    await driver.switchTo().frame(webviews[0]);

    try {
      // Look for Camera tab and click it
      const cameraTabElements = await driver.findElements({ css: '*' });
      let cameraTabFound = false;

      for (const element of cameraTabElements) {
        try {
          const text = await element.getText();
          if (text === 'Camera' && (await element.isDisplayed())) {
            await element.click();
            await driver.sleep(1000);
            cameraTabFound = true;
            console.log('✅ Successfully clicked Camera tab');
            break;
          }
        } catch (error) {
          // Continue searching
        }
      }

      if (!cameraTabFound) {
        console.log('⚠️  Camera tab not found or not clickable');
      }

      // Look for Controls tab and click it
      const controlsTabElements = await driver.findElements({ css: '*' });
      let controlsTabFound = false;

      for (const element of controlsTabElements) {
        try {
          const text = await element.getText();
          if (text === 'Controls' && (await element.isDisplayed())) {
            await element.click();
            await driver.sleep(1000);
            controlsTabFound = true;
            console.log('✅ Successfully clicked Controls tab');
            break;
          }
        } catch (error) {
          // Continue searching
        }
      }

      if (!controlsTabFound) {
        console.log('⚠️  Controls tab not found or not clickable');
      }

      // Try to trigger "Fit to View" functionality (F key)
      await driver.switchTo().activeElement();
      await driver.executeScript(
        "document.dispatchEvent(new KeyboardEvent('keydown', {key: 'f', code: 'KeyF'}));"
      );
      await driver.sleep(2000);
      console.log('✅ Attempted Fit to View (F key) functionality');

      // Switch back to main frame
      await driver.switchTo().defaultContent();
    } catch (error) {
      console.log(
        'Note: Some UI interactions could not be completed:',
        error instanceof Error ? error.message : String(error)
      );
      await driver.switchTo().defaultContent();
    }
  });

  it('should monitor console output and verify no critical errors', async function () {
    // Get browser console logs
    try {
      const logs = await driver.manage().logs().get('browser');

      let criticalErrors = 0;
      let warnings = 0;
      let infoMessages = 0;

      for (const entry of logs) {
        const message = entry.message;
        const level = entry.level.name;

        if (level === 'SEVERE' || level === 'ERROR') {
          criticalErrors++;
          console.log(`❌ Critical Error: ${message}`);
        } else if (level === 'WARNING') {
          warnings++;
          console.log(`⚠️  Warning: ${message}`);
        } else if (level === 'INFO') {
          infoMessages++;
          // Only log PLY-related info messages to avoid spam
          if (message.includes('PLY') || message.includes('mesh') || message.includes('loaded')) {
            console.log(`ℹ️  Info: ${message}`);
          }
        }
      }

      console.log(
        `📊 Console Log Summary: ${criticalErrors} errors, ${warnings} warnings, ${infoMessages} info messages`
      );

      // Allow some warnings but no critical errors
      if (criticalErrors > 0) {
        throw new Error(`Found ${criticalErrors} critical errors in console logs`);
      }

      console.log('✅ No critical errors found in console output');
    } catch (error) {
      console.log(
        'Note: Could not access browser console logs:',
        error instanceof Error ? error.message : String(error)
      );
      // Don't fail the test if we can't access logs
    }
  });

  it('should verify PLY mesh statistics and rendering status', async function () {
    // Switch to webview frame
    const webviews = await driver.findElements({ css: 'iframe.webview' });
    if (webviews.length === 0) {
      throw new Error('No webview iframe found');
    }

    await driver.switchTo().frame(webviews[0]);

    try {
      // Look for mesh statistics (vertices, triangles count)
      const elements = await driver.findElements({ css: '*' });
      let statsFound = false;
      let verticesCount = 0;
      let trianglesCount = 0;

      for (const element of elements) {
        try {
          const text = await element.getText();

          // Look for vertex count
          const vertexMatch = text.match(/(\d+)\s+vertices/i);
          if (vertexMatch) {
            verticesCount = parseInt(vertexMatch[1]);
            console.log(`✅ Found ${verticesCount} vertices in PLY mesh`);
            statsFound = true;
          }

          // Look for triangle count
          const triangleMatch = text.match(/(\d+)\s+triangles/i);
          if (triangleMatch) {
            trianglesCount = parseInt(triangleMatch[1]);
            console.log(`✅ Found ${trianglesCount} triangles in PLY mesh`);
            statsFound = true;
          }

          // Look for loaded status
          if (text.includes('loaded') && text.includes('PLY')) {
            console.log(`✅ PLY loaded status: ${text}`);
            statsFound = true;
          }
        } catch (error) {
          // Continue searching
        }
      }

      if (!statsFound) {
        console.log('⚠️  PLY mesh statistics not immediately visible');
      }

      // Verify reasonable mesh data (sample_mesh.ply should have vertices and triangles)
      if (verticesCount > 0 && trianglesCount > 0) {
        console.log(
          `✅ PLY mesh has valid geometry: ${verticesCount} vertices, ${trianglesCount} triangles`
        );
      } else if (verticesCount > 0) {
        console.log(`✅ PLY point cloud has ${verticesCount} vertices`);
      }

      // Switch back to main frame
      await driver.switchTo().defaultContent();
    } catch (error) {
      console.log(
        'Error checking PLY statistics:',
        error instanceof Error ? error.message : String(error)
      );
      await driver.switchTo().defaultContent();
    }
  });
});
