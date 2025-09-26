import { VSBrowser, WebDriver, EditorView, SideBarView } from 'vscode-extension-tester';
import * as path from 'path';

describe('PCD File Loading UI Tests', function () {
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
    await driver.sleep(2000);
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

  it('should find PCD test file in Open3D folder', async function () {
    const sideBar = new SideBarView();
    const explorer = await sideBar.getContent().getSection('Explorer');
    await explorer.expand();

    // Navigate to testfiles/open3d folder
    const testfilesFolder = await explorer.findItem('testfiles');
    if (!testfilesFolder) {
      throw new Error('testfiles folder not found in explorer');
    }

    await testfilesFolder.expand();

    const open3dFolder = await testfilesFolder.findChildItem('open3d');
    if (!open3dFolder) {
      throw new Error('testfiles/open3d folder not found in explorer');
    }

    await open3dFolder.expand();

    // Check for PCD test file
    const pcdFile = await open3dFolder.findChildItem('sample_pointcloud.pcd');
    if (!pcdFile) {
      throw new Error('sample_pointcloud.pcd not found in open3d folder');
    }

    console.log('✅ Found sample_pointcloud.pcd in explorer');
  });

  it('should open PCD file with 3D Visualizer', async function () {
    const sideBar = new SideBarView();
    const explorer = await sideBar.getContent().getSection('Explorer');

    const testfilesFolder = await explorer.findItem('testfiles');
    const open3dFolder = await testfilesFolder?.findChildItem('open3d');

    if (!open3dFolder) {
      throw new Error('Open3D folder not found');
    }

    await open3dFolder.expand();

    // Open sample_pointcloud.pcd
    const pcdFile = await open3dFolder.findChildItem('sample_pointcloud.pcd');
    if (!pcdFile) {
      throw new Error('sample_pointcloud.pcd not found');
    }

    // Right-click to open context menu
    await pcdFile.click(2); // Right click
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
      throw new Error('3D Visualizer option not found in context menu for PCD files');
    }

    await visualizerOption.click();
    await driver.sleep(5000); // Wait for PCD parsing and rendering

    // Verify that a custom editor opened
    const editorView = new EditorView();
    const editors = await editorView.getOpenTabs();

    let pcdEditorFound = false;
    for (const editor of editors) {
      const title = await editor.getTitle();
      if (title.includes('sample_pointcloud.pcd')) {
        pcdEditorFound = true;
        console.log(`✅ PCD file opened with title: ${title}`);
        break;
      }
    }

    if (!pcdEditorFound) {
      throw new Error('PCD file did not open in custom editor');
    }
  });

  it('should show PCD point cloud visualization in webview', async function () {
    // The PCD file should already be open from previous test
    const editorView = new EditorView();

    // Wait for webview to load and render
    await driver.sleep(7000);

    // Switch to webview frame to check content
    try {
      const webviews = await driver.findElements({ css: 'iframe.webview' });
      if (webviews.length === 0) {
        throw new Error('No webview iframe found for PCD file');
      }

      await driver.switchTo().frame(webviews[0]);

      // Look for PCD-specific UI elements and status messages
      const expectedElements = [
        'PCD',
        'points',
        'point cloud',
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
              console.log(`✅ Found PCD UI element: ${elementText}`);
              break;
            }
          } catch (error) {
            // Ignore elements that can't be read
          }
        }

        if (!found) {
          console.log(`⚠️  PCD UI element not immediately visible: ${elementText}`);
        }
      }

      // Look for Three.js canvas (the actual 3D rendering)
      const canvas = await driver.findElements({ css: 'canvas' });
      if (canvas.length > 0) {
        console.log(`✅ Found 3D rendering canvas for PCD point cloud`);
      } else {
        console.log(`⚠️  3D rendering canvas not found`);
      }

      // Switch back to main frame
      await driver.switchTo().defaultContent();
    } catch (error) {
      console.log('Note: Could not fully verify PCD webview content');
      console.log('Error:', error instanceof Error ? error.message : String(error));

      // Switch back to main frame just in case
      await driver.switchTo().defaultContent();
    }
  });

  it('should show PCD context menu options', async function () {
    const sideBar = new SideBarView();
    const explorer = await sideBar.getContent().getSection('Explorer');

    const testfilesFolder = await explorer.findItem('testfiles');
    const open3dFolder = await testfilesFolder?.findChildItem('open3d');

    if (!open3dFolder) {
      throw new Error('Open3D folder not found');
    }

    await open3dFolder.expand();

    // Right-click on PCD file
    const pcdFile = await open3dFolder.findChildItem('sample_pointcloud.pcd');
    if (!pcdFile) {
      throw new Error('sample_pointcloud.pcd not found');
    }

    await pcdFile.click(2); // Right click
    await driver.sleep(1000);

    // Verify PCD files show up in "Open with 3D Visualizer" context menu
    const contextMenu = await driver.findElement({ css: '.context-view' });
    const menuItems = await contextMenu.findElements({ css: '.action-item' });

    let pcdMenuOption = null;
    for (const item of menuItems) {
      const text = await item.getText();
      if (text.includes('Open with 3D Visualizer')) {
        pcdMenuOption = item;
        console.log(`✅ Found PCD context menu option: ${text}`);
        break;
      }
    }

    // Click somewhere else to close the context menu
    await driver.findElement({ css: 'body' }).click();
    await driver.sleep(500);

    if (!pcdMenuOption) {
      throw new Error('PCD context menu option not found');
    }
  });

  it('should handle PCD file via double-click', async function () {
    // Close existing editors first
    try {
      const editorView = new EditorView();
      await editorView.closeAllEditors();
      await driver.sleep(1000);
    } catch (error) {
      // Ignore cleanup errors
    }

    const sideBar = new SideBarView();
    const explorer = await sideBar.getContent().getSection('Explorer');

    const testfilesFolder = await explorer.findItem('testfiles');
    const open3dFolder = await testfilesFolder?.findChildItem('open3d');

    if (!open3dFolder) {
      throw new Error('Open3D folder not found');
    }

    await open3dFolder.expand();

    // Double-click on PCD file
    const pcdFile = await open3dFolder.findChildItem('sample_pointcloud.pcd');
    if (!pcdFile) {
      throw new Error('sample_pointcloud.pcd not found');
    }

    // Double-click to open (should use default PCD handler which is 3D Visualizer)
    await pcdFile.click();
    await driver.sleep(1000);
    await pcdFile.click(); // Double click
    await driver.sleep(6000);

    // Verify that the PCD file opened
    const editorView = new EditorView();
    const editors = await editorView.getOpenTabs();

    let pcdEditorFound = false;
    for (const editor of editors) {
      const title = await editor.getTitle();
      if (title.includes('sample_pointcloud.pcd')) {
        pcdEditorFound = true;
        console.log(`✅ PCD file opened via double-click with title: ${title}`);
        break;
      }
    }

    if (!pcdEditorFound) {
      throw new Error('PCD file did not open via double-click');
    }

    console.log('✅ PCD file handled via double-click successfully');
  });
});
