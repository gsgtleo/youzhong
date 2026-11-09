import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QuadrantRule, Priority } from '@youzhong/shared';
import { DEFAULT_ACCENT, type AccentId } from '@/lib/theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type SortBy = 'smart' | 'due' | 'priority' | 'created';
export type Density = 'comfortable' | 'compact';

export interface Filters {
  priorities: Priority[];
  tags: string[];
  projectIds: string[];
  onlyOpen: boolean;
}

interface UiState {
  theme: ThemeMode;
  /** 主题色（品牌色）预设，见 lib/theme.ts */
  accent: AccentId;
  weekStartsOn: 0 | 1;
  ruleId: QuadrantRule['id'];
  density: Density;

  selectedTaskId?: string;
  detailOpen: boolean;
  searchOpen: boolean;
  mobileMenuOpen: boolean;
  sidebarCollapsed: boolean;

  query: string;
  filters: Filters;
  sortBy: SortBy;

  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
  setWeekStartsOn: (value: 0 | 1) => void;
  setRuleId: (value: QuadrantRule['id']) => void;
  setDensity: (value: Density) => void;

  selectTask: (id?: string) => void;
  closeDetail: () => void;
  setSearchOpen: (value: boolean) => void;
  setMobileMenuOpen: (value: boolean) => void;
  toggleSidebar: () => void;

  setQuery: (value: string) => void;
  setSortBy: (value: SortBy) => void;
  togglePriority: (value: Priority) => void;
  toggleTag: (value: string) => void;
  toggleProject: (value: string) => void;
  setOnlyOpen: (value: boolean) => void;
  clearFilters: () => void;
}

const emptyFilters: Filters = { priorities: [], tags: [], projectIds: [], onlyOpen: true };

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: 'light',
      accent: DEFAULT_ACCENT,
      weekStartsOn: 1,
      ruleId: 'priority',
      density: 'comfortable',

      detailOpen: false,
      searchOpen: false,
      mobileMenuOpen: false,
      sidebarCollapsed: false,

      query: '',
      filters: emptyFilters,
      sortBy: 'smart',

      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setWeekStartsOn: (weekStartsOn) => set({ weekStartsOn }),
      setRuleId: (ruleId) => set({ ruleId }),
      setDensity: (density) => set({ density }),

      selectTask: (id) => set({ selectedTaskId: id, detailOpen: Boolean(id) }),
      closeDetail: () => set({ detailOpen: false }),
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setQuery: (query) => set({ query }),
      setSortBy: (sortBy) => set({ sortBy }),
      togglePriority: (value) =>
        set((state) => ({ filters: { ...state.filters, priorities: toggle(state.filters.priorities, value) } })),
      toggleTag: (value) => set((state) => ({ filters: { ...state.filters, tags: toggle(state.filters.tags, value) } })),
      toggleProject: (value) =>
        set((state) => ({ filters: { ...state.filters, projectIds: toggle(state.filters.projectIds, value) } })),
      setOnlyOpen: (onlyOpen) => set((state) => ({ filters: { ...state.filters, onlyOpen } })),
      clearFilters: () => set({ filters: emptyFilters, query: '' }),
    }),
    {
      name: 'youzhong-ui',
      partialize: (state) => ({
        theme: state.theme,
        accent: state.accent,
        weekStartsOn: state.weekStartsOn,
        ruleId: state.ruleId,
        density: state.density,
        sortBy: state.sortBy,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
