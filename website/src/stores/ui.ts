import { writable } from 'svelte/store';

export interface UIState {
  activeTab: string;
  isLoading: boolean;
  error: string | null;
  status: string;
  showKeyboardShortcuts: boolean;
}

const initialState: UIState = {
  activeTab: 'files',
  isLoading: false,
  error: null,
  status: '',
  showKeyboardShortcuts: false,
};

export const uiStore = writable(initialState);

// Store actions - will be implemented in Phase 3
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
};
