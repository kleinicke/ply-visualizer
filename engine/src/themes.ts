/**
 * VS Code Theme System for 3D Visualizer Website
 *
 * This module provides a theme system that allows switching between different
 * VS Code color themes. Themes are loaded dynamically from JSON files.
 */

export interface VSCodeTheme {
  name: string;
  displayName: string;
  colors: Record<string, string>;
}

/**
 * Available theme configurations
 */
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
  // Add more themes here:
  // {
  //     name: 'dark-plus',
  //     displayName: 'Dark+',
  //     file: 'themes/dark-plus.json'
  // }
];

/**
 * Theme cache to avoid repeated network requests
 */
const themeCache = new Map<string, VSCodeTheme>();

/**
 * Load a theme from JSON file
 */
async function loadThemeFromFile(config: (typeof THEME_CONFIGS)[0]): Promise<VSCodeTheme> {
  // Check cache first
  if (themeCache.has(config.name)) {
    return themeCache.get(config.name)!;
  }

  try {
    const response = await fetch(`src/${config.file}`);
    if (!response.ok) {
      throw new Error(`Failed to load theme: ${response.statusText}`);
    }

    const theme: VSCodeTheme = await response.json();

    // Validate the theme structure
    if (!theme.name || !theme.displayName || !theme.colors) {
      throw new Error('Invalid theme structure');
    }

    // Cache the theme
    themeCache.set(config.name, theme);

    return theme;
  } catch (error) {
    console.error(`Error loading theme ${config.name}:`, error);
    throw error;
  }
}

/**
 * Get all available themes (async)
 */
export async function getAvailableThemes(): Promise<VSCodeTheme[]> {
  const themes: VSCodeTheme[] = [];

  for (const config of THEME_CONFIGS) {
    try {
      const theme = await loadThemeFromFile(config);
      themes.push(theme);
    } catch (error) {
      console.warn(`Failed to load theme ${config.name}, skipping...`);
    }
  }

  return themes;
}

/**
 * Apply a theme to the document by setting CSS custom properties
 */
export function applyTheme(theme: VSCodeTheme): void {
  const root = document.documentElement;

  // Convert theme colors to CSS custom properties
  Object.entries(theme.colors).forEach(([colorKey, colorValue]) => {
    // Convert dot notation to kebab case and add vscode prefix
    // e.g., "editor.background" -> "--vscode-editor-background"
    const cssVar = `--vscode-${colorKey.replace(/\./g, '-')}`;
    root.style.setProperty(cssVar, colorValue);
  });

  // Store the current theme in localStorage for persistence
  localStorage.setItem('ply-visualizer-theme', theme.name);

  console.log(`Applied theme: ${theme.displayName}`);
}

/**
 * Get the currently active theme name from localStorage
 */
export function getCurrentThemeName(): string {
  return localStorage.getItem('ply-visualizer-theme') || 'dark-modern';
}

/**
 * Get theme by name (async)
 */
export async function getThemeByName(name: string): Promise<VSCodeTheme | undefined> {
  const config = THEME_CONFIGS.find(config => config.name === name);
  if (!config) {
    return undefined;
  }

  try {
    return await loadThemeFromFile(config);
  } catch (error) {
    console.error(`Failed to load theme ${name}:`, error);
    return undefined;
  }
}

/**
 * Initialize the theme system and apply the default/saved theme
 */
export async function initializeThemes(): Promise<void> {
  const currentThemeName = getCurrentThemeName();

  try {
    const theme = await getThemeByName(currentThemeName);
    if (theme) {
      applyTheme(theme);
    } else {
      // Fallback to first available theme
      const themes = await getAvailableThemes();
      if (themes.length > 0) {
        applyTheme(themes[0]);
      }
    }
  } catch (error) {
    console.error('Failed to initialize themes:', error);
    // Could apply a minimal fallback theme here
  }
}

/**
 * Create a theme selector UI component (for future use)
 */
export async function createThemeSelector(): Promise<HTMLSelectElement> {
  const select = document.createElement('select');
  select.className = 'theme-selector';

  try {
    const themes = await getAvailableThemes();
    const currentThemeName = getCurrentThemeName();

    themes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.name;
      option.textContent = theme.displayName;
      option.selected = theme.name === currentThemeName;
      select.appendChild(option);
    });

    select.addEventListener('change', async event => {
      const target = event.target as HTMLSelectElement;
      const selectedTheme = await getThemeByName(target.value);
      if (selectedTheme) {
        applyTheme(selectedTheme);
      }
    });
  } catch (error) {
    console.error('Failed to create theme selector:', error);
    // Add a disabled option indicating the error
    const errorOption = document.createElement('option');
    errorOption.textContent = 'Themes unavailable';
    errorOption.disabled = true;
    select.appendChild(errorOption);
  }

  return select;
}
