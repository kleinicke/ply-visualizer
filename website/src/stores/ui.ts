/**
 * UI Store - Phase 3: Reactive state management for user interface
 *
 * This store manages all UI state including panels, modals, themes,
 * and user preferences.
 */

import { writable } from 'svelte/store';

export interface PanelState {
  isVisible: boolean;
  isMinimized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface UIState {
  // Phase 3: Enhanced UI state management
  activeTab: string;
  isLoading: boolean;
  error: string | null;
  status: string;
  showKeyboardShortcuts: boolean;

  // Panel management
  panels: {
    files: PanelState;
    camera: PanelState;
    transformation: PanelState;
    performance: PanelState;
    depth: PanelState;
    sequence: PanelState;
  };

  // Theme and appearance
  theme: 'light' | 'dark' | 'auto';
  showAxes: boolean;
  showBoundingBox: boolean;
  showGrid: boolean;
  showLabels: boolean;
  useFlatLighting: boolean;

  // Preferences
  autoSave: boolean;
  showTooltips: boolean;
  confirmBeforeDelete: boolean;
  rememberLayout: boolean;

  // Modal state
  modals: {
    depthConverter: boolean;
    calibration: boolean;
    settings: boolean;
    about: boolean;
    shortcuts: boolean;
  };

  // Progress tracking
  progressBars: Map<string, { current: number; total: number; message: string }>;
}

const defaultPanelState: PanelState = {
  isVisible: true,
  isMinimized: false,
  position: { x: 0, y: 0 },
  size: { width: 300, height: 200 },
};

const initialState: UIState = {
  // Basic state
  activeTab: 'files',
  isLoading: false,
  error: null,
  status: '',
  showKeyboardShortcuts: false,

  // Panel management
  panels: {
    files: { ...defaultPanelState },
    camera: { ...defaultPanelState, isVisible: false },
    transformation: { ...defaultPanelState, isVisible: false },
    performance: { ...defaultPanelState, isVisible: false },
    depth: { ...defaultPanelState, isVisible: false },
    sequence: { ...defaultPanelState, isVisible: false },
  },

  // Theme and appearance
  theme: 'dark',
  showAxes: false,
  showBoundingBox: false,
  showGrid: false,
  showLabels: true,
  useFlatLighting: false,

  // Preferences
  autoSave: true,
  showTooltips: true,
  confirmBeforeDelete: true,
  rememberLayout: true,

  // Modal state
  modals: {
    depthConverter: false,
    calibration: false,
    settings: false,
    about: false,
    shortcuts: false,
  },

  // Progress tracking
  progressBars: new Map(),
};

export const uiStore = writable<UIState>(initialState);

// Phase 3: Enhanced UI management actions
export const uiActions = {
  setActiveTab: (tab: string) => {
    uiStore.update(state => ({
      ...state,
      activeTab: tab,
    }));
  },

  setLoading: (loading: boolean) => {
    uiStore.update(state => ({
      ...state,
      isLoading: loading,
    }));
  },

  setError: (error: string | null) => {
    uiStore.update(state => ({
      ...state,
      error,
    }));
  },

  setStatus: (status: string) => {
    uiStore.update(state => ({
      ...state,
      status,
    }));
  },

  togglePanel: (panelName: keyof UIState['panels']) => {
    uiStore.update(state => ({
      ...state,
      panels: {
        ...state.panels,
        [panelName]: {
          ...state.panels[panelName],
          isVisible: !state.panels[panelName].isVisible,
        },
      },
    }));
  },

  setPanelPosition: (panelName: keyof UIState['panels'], position: { x: number; y: number }) => {
    uiStore.update(state => ({
      ...state,
      panels: {
        ...state.panels,
        [panelName]: {
          ...state.panels[panelName],
          position,
        },
      },
    }));
  },

  toggleModal: (modalName: keyof UIState['modals']) => {
    uiStore.update(state => ({
      ...state,
      modals: {
        ...state.modals,
        [modalName]: !state.modals[modalName],
      },
    }));
  },

  setTheme: (theme: UIState['theme']) => {
    uiStore.update(state => ({
      ...state,
      theme,
    }));
  },

  toggleVisualizationSetting: (
    setting: 'showAxes' | 'showBoundingBox' | 'showGrid' | 'showLabels' | 'useFlatLighting'
  ) => {
    uiStore.update(state => ({
      ...state,
      [setting]: !state[setting],
    }));
  },

  setPreference: (
    preference: keyof Pick<
      UIState,
      'autoSave' | 'showTooltips' | 'confirmBeforeDelete' | 'rememberLayout'
    >,
    value: boolean
  ) => {
    uiStore.update(state => ({
      ...state,
      [preference]: value,
    }));
  },

  startProgress: (id: string, total: number, message: string) => {
    uiStore.update(state => {
      const newProgressBars = new Map(state.progressBars);
      newProgressBars.set(id, { current: 0, total, message });
      return {
        ...state,
        progressBars: newProgressBars,
      };
    });
  },

  updateProgress: (id: string, current: number, message?: string) => {
    uiStore.update(state => {
      const newProgressBars = new Map(state.progressBars);
      const existing = newProgressBars.get(id);
      if (existing) {
        newProgressBars.set(id, {
          ...existing,
          current,
          message: message || existing.message,
        });
      }
      return {
        ...state,
        progressBars: newProgressBars,
      };
    });
  },

  finishProgress: (id: string) => {
    uiStore.update(state => {
      const newProgressBars = new Map(state.progressBars);
      newProgressBars.delete(id);
      return {
        ...state,
        progressBars: newProgressBars,
      };
    });
  },

  reset: () => {
    uiStore.set(initialState);
  },
};
