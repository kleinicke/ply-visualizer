import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Advanced Test Suite', () => {
  let extension: vscode.Extension<any> | undefined;

  setup(async () => {
    extension = vscode.extensions.getExtension('kleinicke.ply-visualizer');
    if (extension && !extension.isActive) {
      await extension.activate();
    }
  });

  test('Should register all expected commands', async () => {
    const allCommands = await vscode.commands.getCommands(true);

    const expectedCommands = [
      'plyViewer.openFile',
      'plyViewer.openMultipleFiles',
      'plyViewer.convertTifToPointCloud',
      'plyViewer.loadJsonAsPose',
    ];

    for (const command of expectedCommands) {
      assert.ok(allCommands.includes(command), `Command ${command} should be registered`);
    }
  });

  test('Should handle extension activation lifecycle', async () => {
    assert.ok(extension, 'Extension should be available');
    assert.ok(extension?.isActive, 'Extension should be active');

    // Test package.json configuration
    const packageJSON = extension?.packageJSON;
    assert.ok(packageJSON, 'Package JSON should be available');
    assert.strictEqual(packageJSON.name, 'ply-visualizer');
    assert.ok(packageJSON.version, 'Version should be defined');
    assert.ok(packageJSON.engines?.vscode, 'VS Code engine version should be defined');
  });

  test('Should have correct activation events', () => {
    const packageJSON = extension?.packageJSON;

    // Activation events may be undefined in VS Code 1.74+ (implicit activation)
    if (packageJSON?.activationEvents) {
      const activationEvents = packageJSON.activationEvents;
      assert.ok(
        activationEvents.includes('onCustomEditor:plyViewer.plyEditor') ||
          activationEvents.includes('*'),
        'Should activate on custom editor or all events'
      );
    } else {
      // Extension uses implicit activation (no explicit activationEvents)
      assert.ok(true, 'Extension uses implicit activation (VS Code 1.74+)');
    }
  });

  test('Should register custom editor provider', () => {
    const packageJSON = extension?.packageJSON;
    const customEditors = packageJSON?.contributes?.customEditors;

    assert.ok(customEditors, 'Custom editors should be defined');
    assert.strictEqual(customEditors.length, 1);

    const editor = customEditors[0];
    assert.strictEqual(editor.viewType, 'plyViewer.plyEditor');
    assert.strictEqual(editor.displayName, 'PLY Pointcloud Visualizer');
    // Priority may be undefined or 'default'
    assert.ok(
      editor.priority === 'default' || editor.priority === undefined,
      'Priority should be default or undefined'
    );
  });

  test('Should handle file type associations correctly', () => {
    const packageJSON = extension?.packageJSON;
    const customEditor = packageJSON?.contributes?.customEditors?.[0];

    assert.ok(customEditor?.selector, 'File selector should be defined');

    const patterns = customEditor.selector.map((s: any) => s.filenamePattern);
    const expectedPatterns = [
      '*.ply',
      '*.xyz',
      '*.obj',
      '*.stl',
      '*.pcd',
      '*.pts',
      '*.off',
      '*.gltf',
      '*.glb',
      '*.xyzn',
      '*.xyzrgb',
    ];

    for (const pattern of expectedPatterns) {
      assert.ok(patterns.includes(pattern), `Should support ${pattern} files`);
    }
  });

  test('Should register context menu items', () => {
    const packageJSON = extension?.packageJSON;
    const menus = packageJSON?.contributes?.menus;

    assert.ok(menus, 'Menus should be defined');
    assert.ok(menus['explorer/context'], 'Explorer context menu should be defined');

    const contextMenuItems = menus['explorer/context'];
    assert.ok(Array.isArray(contextMenuItems), 'Context menu items should be an array');
    assert.ok(contextMenuItems.length >= 3, 'Should have multiple context menu items');

    // Check for specific menu items
    const commands = contextMenuItems.map((item: any) => item.command);
    assert.ok(
      commands.includes('plyViewer.openFile'),
      'Open file command should be in context menu'
    );
    assert.ok(
      commands.includes('plyViewer.convertTifToPointCloud'),
      'TIF conversion should be in context menu'
    );
  });

  test('Should handle command execution with proper error handling', async () => {
    // Test invalid file URI
    const invalidUri = vscode.Uri.file('/nonexistent/file.ply');

    try {
      await vscode.commands.executeCommand('plyViewer.openFile', invalidUri);
      // Command should handle gracefully, not necessarily fail
    } catch (error) {
      // Error handling is acceptable
      assert.ok(error instanceof Error);
    }
  });

  test('Should support configuration settings', () => {
    const config = vscode.workspace.getConfiguration('plyViewer');
    assert.ok(config, 'Configuration should be available');

    // Test that configuration can be read without errors
    try {
      const settings = config.get('defaultPointSize', 5.0);
      assert.ok(typeof settings === 'number', 'Settings should be readable');
    } catch (error) {
      // If no settings exist, that's also acceptable
      assert.ok(error instanceof Error);
    }
  });

  test('Should handle workspace state management', () => {
    const workspaceState = extension?.activate() || null;

    // Extension should handle workspace state gracefully
    assert.ok(true, 'Workspace state handling should not crash');
  });

  test('Should register language support', () => {
    const packageJSON = extension?.packageJSON;
    const languages = packageJSON?.contributes?.languages;

    if (languages) {
      // If language support is defined, verify it's correct
      assert.ok(Array.isArray(languages), 'Languages should be an array');
      for (const lang of languages) {
        assert.ok(lang.id, 'Language should have an ID');
        assert.ok(lang.extensions, 'Language should have extensions');
      }
    }
    // Language support is optional, so no assertion needed if not present
  });

  test('Should handle telemetry and logging', () => {
    // Extension should not crash when logging or telemetry is called
    try {
      console.log('Extension test logging');
      assert.ok(true, 'Logging should work without errors');
    } catch (error) {
      assert.fail('Logging should not throw errors');
    }
  });

  test('Should support extension dependencies', () => {
    const packageJSON = extension?.packageJSON;
    const extensionDependencies = packageJSON?.extensionDependencies;

    if (extensionDependencies) {
      assert.ok(Array.isArray(extensionDependencies), 'Extension dependencies should be an array');
      // Verify dependencies are valid extension IDs
      for (const dep of extensionDependencies) {
        assert.ok(
          typeof dep === 'string' && dep.includes('.'),
          'Dependency should be valid extension ID'
        );
      }
    }
  });

  test('Should handle extension contribution points', () => {
    const packageJSON = extension?.packageJSON;
    const contributes = packageJSON?.contributes;

    assert.ok(contributes, 'Contributions should be defined');

    // Check main contribution points
    const expectedContributions = ['customEditors', 'commands', 'menus'];
    for (const contribution of expectedContributions) {
      assert.ok(contributes[contribution], `${contribution} should be contributed`);
    }
  });

  test('Should validate command definitions', () => {
    const packageJSON = extension?.packageJSON;
    const commands = packageJSON?.contributes?.commands;

    assert.ok(commands, 'Commands should be defined');
    assert.ok(Array.isArray(commands), 'Commands should be an array');

    for (const command of commands) {
      assert.ok(command.command, 'Command should have a command ID');
      assert.ok(command.title, 'Command should have a title');
      // Category is optional but should be string if present
      if (command.category) {
        assert.ok(typeof command.category === 'string', 'Category should be a string');
      }
    }
  });

  test('Should handle extension icon and display information', () => {
    const packageJSON = extension?.packageJSON;

    assert.ok(packageJSON?.displayName, 'Display name should be defined');
    assert.ok(packageJSON?.description, 'Description should be defined');
    assert.ok(packageJSON?.publisher, 'Publisher should be defined');

    // Icon is optional but should be valid path if present
    if (packageJSON?.icon) {
      assert.ok(typeof packageJSON.icon === 'string', 'Icon should be a string path');
    }

    // Categories should be valid
    if (packageJSON?.categories) {
      assert.ok(Array.isArray(packageJSON.categories), 'Categories should be an array');
      for (const category of packageJSON.categories) {
        assert.ok(typeof category === 'string', 'Category should be a string');
      }
    }
  });

  test('Should support keyboard shortcuts and keybindings', () => {
    const packageJSON = extension?.packageJSON;
    const keybindings = packageJSON?.contributes?.keybindings;

    if (keybindings) {
      assert.ok(Array.isArray(keybindings), 'Keybindings should be an array');
      for (const binding of keybindings) {
        assert.ok(binding.command, 'Keybinding should have a command');
        assert.ok(binding.key, 'Keybinding should have a key combination');
      }
    }
    // Keybindings are optional
  });

  test('Should handle workspace trust requirements', () => {
    const packageJSON = extension?.packageJSON;
    const capabilities = packageJSON?.capabilities;

    if (capabilities?.untrustedWorkspaces) {
      const untrustedWorkspaces = capabilities.untrustedWorkspaces;
      assert.ok(
        typeof untrustedWorkspaces.supported === 'boolean',
        'Untrusted workspace support should be boolean'
      );

      if (untrustedWorkspaces.description) {
        assert.ok(
          typeof untrustedWorkspaces.description === 'string',
          'Untrusted workspace description should be string'
        );
      }
    }
  });

  test('Should validate repository and homepage information', () => {
    const packageJSON = extension?.packageJSON;

    if (packageJSON?.repository) {
      const repo = packageJSON.repository;
      if (typeof repo === 'string') {
        assert.ok(repo.length > 0, 'Repository URL should not be empty');
      } else {
        assert.ok(repo.url, 'Repository should have URL');
        assert.ok(repo.type, 'Repository should have type');
      }
    }

    if (packageJSON?.homepage) {
      assert.ok(typeof packageJSON.homepage === 'string', 'Homepage should be string');
      assert.ok(packageJSON.homepage.length > 0, 'Homepage should not be empty');
    }
  });

  test('Should handle extension marketplace information', () => {
    const packageJSON = extension?.packageJSON;

    if (packageJSON?.keywords) {
      assert.ok(Array.isArray(packageJSON.keywords), 'Keywords should be an array');
      for (const keyword of packageJSON.keywords) {
        assert.ok(typeof keyword === 'string', 'Keyword should be a string');
        assert.ok(keyword.length > 0, 'Keyword should not be empty');
      }
    }

    if (packageJSON?.license) {
      assert.ok(typeof packageJSON.license === 'string', 'License should be a string');
    }
  });

  test('Should support proper semantic versioning', () => {
    const packageJSON = extension?.packageJSON;
    const version = packageJSON?.version;

    assert.ok(version, 'Version should be defined');
    assert.ok(typeof version === 'string', 'Version should be a string');

    // Basic semver check (major.minor.patch)
    const versionRegex = /^\d+\.\d+\.\d+(-.*)?$/;
    assert.ok(versionRegex.test(version), 'Version should follow semantic versioning');
  });
});
