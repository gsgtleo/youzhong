import { create } from 'zustand';
import type { CalendarEvent, Project, ProjectGroup, Snapshot, Tag, Task } from '@youzhong/shared';
import { normalizeSnapshot } from '@/api/adapters';

interface AppState {
  ready: boolean;
  loading: boolean;
  syncing: boolean;
  mode: 'live' | 'mock' | 'server';
  authed: boolean;
  error?: string;
  lastSync?: number;

  tasks: Record<string, Task>;
  projects: Project[];
  groups: ProjectGroup[];
  tags: Tag[];
  events: CalendarEvent[];

  hydrate: (snapshot: Snapshot) => void;
  setMeta: (patch: Partial<Pick<AppState, 'mode' | 'authed' | 'error' | 'lastSync' | 'loading' | 'syncing' | 'ready'>>) => void;
  upsertTask: (task: Task) => void;
  removeTask: (id: string) => void;
  upsertEvent: (event: CalendarEvent) => void;
  removeEvent: (id: string) => void;
  addProject: (project: Project) => void;
  patchProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
}

export const useApp = create<AppState>((set) => ({
  ready: false,
  loading: false,
  syncing: false,
  mode: 'mock',
  authed: false,
  tasks: {},
  projects: [],
  groups: [],
  tags: [],
  events: [],

  hydrate: (snapshot) => {
    const normalized = normalizeSnapshot(snapshot);
    const tasks: Record<string, Task> = {};
    normalized.tasks.forEach((task) => {
      tasks[task.id] = task;
    });
    set((state) => ({
      tasks,
      projects: normalized.projects.length ? normalized.projects : state.projects,
      groups: normalized.projectGroups,
      tags: normalized.tags,
      events: normalized.events,
      mode: normalized.mode,
      authed: normalized.mode !== 'mock',
      ready: true,
      loading: false,
      syncing: false,
      error: undefined,
      lastSync: Date.now(),
    }));
  },

  setMeta: (patch) => set(patch),

  upsertTask: (task) =>
    set((state) => ({
      tasks: { ...state.tasks, [task.id]: task },
    })),

  removeTask: (id) =>
    set((state) => {
      const next = { ...state.tasks };
      delete next[id];
      return { tasks: next };
    }),

  upsertEvent: (event) =>
    set((state) => {
      const exists = state.events.some((item) => item.id === event.id);
      return { events: exists ? state.events.map((item) => (item.id === event.id ? event : item)) : [...state.events, event] };
    }),

  removeEvent: (id) => set((state) => ({ events: state.events.filter((item) => item.id !== id) })),

  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),

  patchProject: (id, patch) =>
    set((state) => ({ projects: state.projects.map((project) => (project.id === id ? { ...project, ...patch } : project)) })),

  removeProject: (id) =>
    set((state) => {
      const tasks = { ...state.tasks };
      Object.values(tasks).forEach((task) => {
        if (task.projectId === id) delete tasks[task.id];
      });
      return { projects: state.projects.filter((project) => project.id !== id), tasks };
    }),
}));
