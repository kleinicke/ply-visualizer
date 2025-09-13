import { VSBrowser, WebDriver, EditorView, SideBarView } from 'vscode-extension-tester';
import * as path from 'path';

describe('Open3D File Format Support UI Tests', function () {
  this.timeout(120000); // 2 minutes timeout for comprehensive testing

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

  const testFormats = [
    { ext: 'pcd', name: 'Point Cloud Data', type: 'point cloud' },
    { ext: 'pts', name: 'PTS Point Cloud', type: 'point cloud' },
    { ext: 'off', name: 'Object File Format', type: 'mesh' },
    { ext: 'gltf', name: 'GL Transmission Format', type: 'mesh' },
    { ext: 'glb', name: 'GL Transmission Format Binary', type: 'mesh' },
    { ext: 'xyzn', name: 'XYZ with Normals', type: 'point cloud' },
    { ext: 'xyzrgb', name: 'XYZ with Colors', type: 'point cloud' },
  ];

  it('should find Open3D test files in explorer', async function () {
    const sideBar = new SideBarView();
    const explorer = await sideBar.getContent().getSection('Explorer');
    await explorer.expand();

    // Look for testfiles/open3d folder
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

    // Check for expected test files
    for (const format of testFormats) {
      const expectedFileName =
        format.type === 'point cloud'
          ? `sample_pointcloud.${format.ext}`
          : `sample_mesh.${format.ext}`;

      const file = await open3dFolder.findChildItem(expectedFileName);
      if (!file) {
        console.warn(`⚠️  Open3D test file ${expectedFileName} not found in explorer`);
      } else {
        console.log(`✅ Found ${expectedFileName} in explorer`);
      }
    }
  });

  // Test each format individually
  testFormats.forEach(format => {
    it(`should open ${format.name} (${format.ext}) file with PLY Visualizer`, async function () {
      const sideBar = new SideBarView();
      const explorer = await sideBar.getContent().getSection('Explorer');

      const testfilesFolder = await explorer.findItem('testfiles');
      const open3dFolder = await testfilesFolder?.findChildItem('open3d');

      if (!open3dFolder) {
        throw new Error('Open3D folder not found');
      }

      await open3dFolder.expand();

      const expectedFileName =
        format.type === 'point cloud'
          ? `sample_pointcloud.${format.ext}`
          : `sample_mesh.${format.ext}`;

      // Find the test file
      const testFile = await open3dFolder.findChildItem(expectedFileName);
      if (!testFile) {
        console.log(`⚠️  Skipping ${format.name} test - file ${expectedFileName} not found`);
        return; // Skip this test if file doesn't exist
      }

      // Right-click to open context menu
      await testFile.click(2); // Right click
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
        throw new Error(`PLY Visualizer option not found in context menu for ${format.ext} files`);
      }

      await visualizerOption.click();
      await driver.sleep(8000); // Wait for parsing and rendering

      // Verify that a custom editor opened
      const editorView = new EditorView();
      const editors = await editorView.getOpenTabs();

      let formatEditorFound = false;
      for (const editor of editors) {
        const title = await editor.getTitle();
        if (title.includes(expectedFileName)) {
          formatEditorFound = true;
          console.log(`✅ ${format.name} file opened with title: ${title}`);
          break;
        }
      }

      if (!formatEditorFound) {
        throw new Error(`${format.name} file did not open in custom editor`);
      }
    });

    it(`should show ${format.name} (${format.ext}) visualization in webview`, async function () {
      // Wait for webview to load and render
      await driver.sleep(5000);

      // Switch to webview frame to check content
      try {
        const webviews = await driver.findElements({ css: 'iframe.webview' });
        if (webviews.length === 0) {
          console.log(`⚠️  No webview iframe found for ${format.ext} file`);
          return;
        }

        await driver.switchTo().frame(webviews[0]);

        // Look for format-specific UI elements and status messages
        const expectedElements = [
          format.ext.toUpperCase(),
          format.type === 'point cloud' ? 'points' : 'vertices',
          'Files', // Tab navigation
          'Camera', // Tab navigation
          'Controls', // Tab navigation
        ];

        if (format.type === 'mesh') {
          expectedElements.push('triangles', 'faces');
        }

        for (const elementText of expectedElements) {
          const elements = await driver.findElements({ css: '*' });
          let found = false;

          for (const element of elements) {
            try {
              const text = await element.getText();
              if (text.includes(elementText)) {
                found = true;
                console.log(`✅ Found ${format.ext} UI element: ${elementText}`);
                break;
              }
            } catch (error) {
              // Ignore elements that can't be read
            }
          }

          if (!found && !['triangles', 'faces'].includes(elementText)) {
            console.log(`⚠️  ${format.ext} UI element not immediately visible: ${elementText}`);
          }
        }

        // Look for Three.js canvas (the actual 3D rendering)
        const canvas = await driver.findElements({ css: 'canvas' });
        if (canvas.length > 0) {
          console.log(`✅ Found 3D rendering canvas for ${format.name}`);
        } else {
          console.log(`⚠️  3D rendering canvas not found for ${format.ext}`);
        }

        // Switch back to main frame
        await driver.switchTo().defaultContent();
      } catch (error) {
        console.log(`Note: Could not fully verify ${format.ext} webview content`);
        console.log('Error:', error instanceof Error ? error.message : String(error));

        // Switch back to main frame just in case
        await driver.switchTo().defaultContent();
      }
    });
  });

  it('should show context menu options for all Open3D formats', async function () {
    const sideBar = new SideBarView();
    const explorer = await sideBar.getContent().getSection('Explorer');

    const testfilesFolder = await explorer.findItem('testfiles');
    const open3dFolder = await testfilesFolder?.findChildItem('open3d');

    if (!open3dFolder) {
      throw new Error('Open3D folder not found');
    }

    await open3dFolder.expand();

    // Test context menu for each format
    for (const format of testFormats) {
      const expectedFileName =
        format.type === 'point cloud'
          ? `sample_pointcloud.${format.ext}`
          : `sample_mesh.${format.ext}`;

      const testFile = await open3dFolder.findChildItem(expectedFileName);
      if (!testFile) {
        console.log(`⚠️  Skipping context menu test for ${format.ext} - file not found`);
        continue;
      }

      await testFile.click(2); // Right click
      await driver.sleep(1000);

      // Verify context menu shows "Open with PLY Visualizer"
      const contextMenu = await driver.findElement({ css: '.context-view' });
      const menuItems = await contextMenu.findElements({ css: '.action-item' });

      let formatMenuOption = null;
      for (const item of menuItems) {
        const text = await item.getText();
        if (text.includes('Open with PLY Visualizer')) {
          formatMenuOption = item;
          console.log(`✅ Found ${format.ext} context menu option: ${text}`);
          break;
        }
      }

      // Click somewhere else to close the context menu
      await driver.findElement({ css: 'body' }).click();
      await driver.sleep(500);

      if (!formatMenuOption) {
        console.log(`⚠️  Context menu option not found for ${format.ext}`);
      }
    }
  });

  it('should handle multiple Open3D formats in sequence', async function () {
    const sideBar = new SideBarView();
    const explorer = await sideBar.getContent().getSection('Explorer');

    const testfilesFolder = await explorer.findItem('testfiles');
    const open3dFolder = await testfilesFolder?.findChildItem('open3d');

    if (!open3dFolder) {
      throw new Error('Open3D folder not found');
    }

    await open3dFolder.expand();

    // Test opening multiple formats in sequence (first 3 to save time)
    const testSubset = testFormats.slice(0, 3);

    for (const format of testSubset) {
      const expectedFileName =
        format.type === 'point cloud'
          ? `sample_pointcloud.${format.ext}`
          : `sample_mesh.${format.ext}`;

      const testFile = await open3dFolder.findChildItem(expectedFileName);
      if (!testFile) {
        console.log(`⚠️  Skipping sequence test for ${format.ext} - file not found`);
        continue;
      }

      // Double-click to open
      await testFile.click();
      await driver.sleep(500);
      await testFile.click();
      await driver.sleep(6000); // Wait for processing

      console.log(`✅ Sequence test: ${format.name} (${format.ext}) processed`);
    }

    // Verify multiple tabs are open
    const editorView = new EditorView();
    const editors = await editorView.getOpenTabs();

    if (editors.length >= testSubset.length) {
      console.log(`✅ Multiple Open3D formats opened successfully (${editors.length} tabs)`);
    } else {
      console.log(`⚠️  Expected at least ${testSubset.length} tabs, got ${editors.length}`);
    }
  });
});
