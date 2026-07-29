import { create } from 'zustand';

interface UiState {
  isMobileNavOpen: boolean;
  isSidebarCollapsed: boolean;
  setMobileNavOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isMobileNavOpen: false,
  isSidebarCollapsed: false,
  setMobileNavOpen: (open) => {
    set({ isMobileNavOpen: open });
  },
  toggleSidebarCollapsed: () => {
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed }));
  },
}));
