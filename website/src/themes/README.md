# VS Code Themes for PLY Visualizer

This directory contains VS Code theme definitions in JSON format for the PLY
Visualizer website.

## Adding New Themes

To add a new VS Code theme:

### 1. Create Theme JSON File

Create a new JSON file in this directory (e.g., `light-modern.json`):

```json
{
  "name": "light-modern",
  "displayName": "Light Modern",
  "colors": {
    "editor.background": "#FFFFFF",
    "editor.foreground": "#000000"
    // ... all other color definitions
  }
}
```

### 2. Register Theme in themes.ts

Add the theme configuration to the `THEME_CONFIGS` array in `../themes.ts`:

```typescript
const THEME_CONFIGS = [
  {
    name: 'dark-modern',
    displayName: 'Dark Modern',
    file: 'themes/dark-modern.json',
  },
  {
    name: 'light-modern',
    displayName: 'Light Modern',
    file: 'themes/light-modern.json',
  },
];
```

### 3. Getting Official VS Code Theme Colors

VS Code themes can be found in the official repository:

- Dark Modern:
  https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/dark_modern.json
- Dark+:
  https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/dark_plus.json
- Light Modern:
  https://github.com/microsoft/vscode/blob/main/extensions/theme-defaults/themes/light_modern.json

Or extract from your local VS Code installation:

- Windows: `%USERPROFILE%\.vscode\extensions\vscode.theme-*`
- macOS: `~/.vscode/extensions/vscode.theme-*`
- Linux: `~/.vscode/extensions/vscode.theme-*`

### 4. Color Mapping

The system automatically converts theme colors to CSS variables:

- `editor.background` → `--vscode-editor-background`
- `sideBar.foreground` → `--vscode-sideBar-foreground`
- etc.

## Current Themes

- **Dark Modern**: Official VS Code dark theme with modern styling
- More themes can be added as needed...

## Theme Structure

Each theme JSON must contain:

- `name`: Unique theme identifier (kebab-case)
- `displayName`: Human-readable name
- `colors`: Object with VS Code color definitions

## Usage

Themes are loaded dynamically and cached for performance. The theme system
supports:

- Automatic theme detection and loading
- Theme persistence via localStorage
- Fallback handling for missing themes
- Theme selector UI component (for future use)
