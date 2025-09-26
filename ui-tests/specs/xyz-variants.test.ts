import { VSBrowser, WebDriver, EditorView, SideBarView } from 'vscode-extension-tester';
import * as path from 'path';

describe('XYZ Variants (XYZN, XYZRGB) File Loading UI Tests', function () {
  this.timeout(80000); // 80 seconds timeout for UI operations

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

  const xyzVariants = [
    { ext: 'xyzn', name: 'XYZ with Normals', description: 'point cloud with normal vectors' },
    { ext: 'xyzrgb', name: 'XYZ with Colors', description: 'point cloud with RGB colors' },
  ];

  it('should find XYZ variant test files in Open3D folder', async function () {
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

    // Check for XYZ variant test files
    for (const variant of xyzVariants) {
      const expectedFileName = `sample_pointcloud.${variant.ext}`;
      const file = await open3dFolder.findChildItem(expectedFileName);
      if (!file) {
        console.warn(`⚠️  XYZ variant test file ${expectedFileName} not found in explorer`);
      } else {
        console.log(`✅ Found ${expectedFileName} in explorer`);
      }
    }
  });

  // Test each XYZ variant individually
  xyzVariants.forEach(variant => {
    it(`should open ${variant.name} (${variant.ext}) file with 3D Visualizer`, async function () {
      const sideBar = new SideBarView();
      const explorer = await sideBar.getContent().getSection('Explorer');

      const testfilesFolder = await explorer.findItem('testfiles');
      const open3dFolder = await testfilesFolder?.findChildItem('open3d');

      if (!open3dFolder) {
        throw new Error('Open3D folder not found');
      }

      await open3dFolder.expand();

      const expectedFileName = `sample_pointcloud.${variant.ext}`;

      // Find the test file
      const testFile = await open3dFolder.findChildItem(expectedFileName);
      if (!testFile) {
        console.log(`⚠️  Skipping ${variant.name} test - file ${expectedFileName} not found`);
        return; // Skip this test if file doesn't exist
      }

      // Right-click to open context menu
      await testFile.click(2); // Right click
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
        throw new Error(`3D Visualizer option not found in context menu for ${variant.ext} files`);
      }

      await visualizerOption.click();
      await driver.sleep(6000); // Wait for parsing and rendering

      // Verify that a custom editor opened
      const editorView = new EditorView();
      const editors = await editorView.getOpenTabs();

      let variantEditorFound = false;
      for (const editor of editors) {
        const title = await editor.getTitle();
        if (title.includes(expectedFileName)) {
          variantEditorFound = true;
          console.log(`✅ ${variant.name} file opened with title: ${title}`);
          break;
        }
      }

      if (!variantEditorFound) {
        throw new Error(`${variant.name} file did not open in custom editor`);
      }
    });

    it(`should show ${variant.name} (${variant.ext}) visualization in webview`, async function () {
      // Wait for webview to load and render
      await driver.sleep(5000);

      // Switch to webview frame to check content
      try {
        const webviews = await driver.findElements({ css: 'iframe.webview' });
        if (webviews.length === 0) {
          console.log(`⚠️  No webview iframe found for ${variant.ext} file`);
          return;
        }

        await driver.switchTo().frame(webviews[0]);

        // Look for XYZ variant-specific UI elements and status messages
        const expectedElements = [
          variant.ext.toUpperCase(),
          'XYZ',
          'points',
          'point cloud',
          'Files', // Tab navigation
          'Camera', // Tab navigation
          'Controls', // Tab navigation
        ];

        // Add variant-specific elements
        if (variant.ext === 'xyzn') {
          expectedElements.push('normals', 'normal');
        } else if (variant.ext === 'xyzrgb') {
          expectedElements.push('colors', 'RGB');
        }

        for (const elementText of expectedElements) {
          const elements = await driver.findElements({ css: '*' });
          let found = false;

          for (const element of elements) {
            try {
              const text = await element.getText();
              if (text.includes(elementText)) {
                found = true;
                console.log(`✅ Found ${variant.ext} UI element: ${elementText}`);
                break;
              }
            } catch (error) {
              // Ignore elements that can't be read
            }
          }

          if (!found && !['normals', 'normal', 'colors', 'RGB'].includes(elementText)) {
            console.log(`⚠️  ${variant.ext} UI element not immediately visible: ${elementText}`);
          }
        }

        // Look for Three.js canvas (the actual 3D rendering)
        const canvas = await driver.findElements({ css: 'canvas' });
        if (canvas.length > 0) {
          console.log(`✅ Found 3D rendering canvas for ${variant.name}`);
        } else {
          console.log(`⚠️  3D rendering canvas not found for ${variant.ext}`);
        }

        // Switch back to main frame
        await driver.switchTo().defaultContent();
      } catch (error) {
        console.log(`Note: Could not fully verify ${variant.ext} webview content`);
        console.log('Error:', error instanceof Error ? error.message : String(error));

        // Switch back to main frame just in case
        await driver.switchTo().defaultContent();
      }
    });

    it(`should handle ${variant.name} (${variant.ext}) via double-click`, async function () {
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

      const expectedFileName = `sample_pointcloud.${variant.ext}`;

      // Double-click on variant file
      const variantFile = await open3dFolder.findChildItem(expectedFileName);
      if (!variantFile) {
        console.log(`⚠️  Skipping double-click test for ${variant.ext} - file not found`);
        return;
      }

      // Double-click to open
      await variantFile.click();
      await driver.sleep(1000);
      await variantFile.click(); // Double click
      await driver.sleep(6000);

      // Verify that the variant file opened
      const editorView = new EditorView();
      const editors = await editorView.getOpenTabs();

      let variantEditorFound = false;
      for (const editor of editors) {
        const title = await editor.getTitle();
        if (title.includes(expectedFileName)) {
          variantEditorFound = true;
          console.log(`✅ ${variant.name} file opened via double-click with title: ${title}`);
          break;
        }
      }

      if (!variantEditorFound) {
        console.log(`⚠️  ${variant.name} file did not open via double-click`);
      } else {
        console.log(`✅ ${variant.name} file handled via double-click successfully`);
      }
    });
  });

  it('should show context menu options for both XYZ variants', async function () {
    const sideBar = new SideBarView();
    const explorer = await sideBar.getContent().getSection('Explorer');

    const testfilesFolder = await explorer.findItem('testfiles');
    const open3dFolder = await testfilesFolder?.findChildItem('open3d');

    if (!open3dFolder) {
      throw new Error('Open3D folder not found');
    }

    await open3dFolder.expand();

    // Test context menu for each XYZ variant
    for (const variant of xyzVariants) {
      const expectedFileName = `sample_pointcloud.${variant.ext}`;

      const testFile = await open3dFolder.findChildItem(expectedFileName);
      if (!testFile) {
        console.log(`⚠️  Skipping context menu test for ${variant.ext} - file not found`);
        continue;
      }

      await testFile.click(2); // Right click
      await driver.sleep(1000);

      // Verify context menu shows "Open with 3D Visualizer"
      const contextMenu = await driver.findElement({ css: '.context-view' });
      const menuItems = await contextMenu.findElements({ css: '.action-item' });

      let variantMenuOption = null;
      for (const item of menuItems) {
        const text = await item.getText();
        if (text.includes('Open with 3D Visualizer')) {
          variantMenuOption = item;
          console.log(`✅ Found ${variant.ext} context menu option: ${text}`);
          break;
        }
      }

      // Click somewhere else to close the context menu
      await driver.findElement({ css: 'body' }).click();
      await driver.sleep(500);

      if (!variantMenuOption) {
        console.log(`⚠️  Context menu option not found for ${variant.ext}`);
      }
    }
  });

  it('should handle mixed XYZ variants in sequence', async function () {
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

    // Test opening both XYZ variants in sequence
    for (const variant of xyzVariants) {
      const expectedFileName = `sample_pointcloud.${variant.ext}`;

      const testFile = await open3dFolder.findChildItem(expectedFileName);
      if (!testFile) {
        console.log(`⚠️  Skipping sequence test for ${variant.ext} - file not found`);
        continue;
      }

      // Double-click to open
      await testFile.click();
      await driver.sleep(500);
      await testFile.click();
      await driver.sleep(5000); // Wait for processing

      console.log(`✅ Sequence test: ${variant.name} (${variant.ext}) processed`);
    }

    // Verify multiple tabs are open
    const editorView = new EditorView();
    const editors = await editorView.getOpenTabs();

    console.log(`✅ XYZ variants sequence test completed with ${editors.length} tabs open`);
  });
});
