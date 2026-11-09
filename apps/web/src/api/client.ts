import type { CalendarEvent, Project, Snapshot, Task } from '@youzhong/shared';
import { HttpError, request } from './http';

export { HttpError as ApiClientError };

export const api = {
  snapshot: () => request<Snapshot>('/snapshot'),

  createTask: (task: Task) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify({ task }) }),

  updateTask: (task: Task) => request<Task>(`/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ task }) }),

  deleteTask: (id: string, projectId: string) =>
    request<void>(`/tasks/${id}?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' }),

  createProject: (name: string, color?: string) => request<Project>('/projects', { method: 'POST', body: JSON.stringify({ name, color }) }),

  updateProject: (id: string, project: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ project }) }),

  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  createEvent: (event: CalendarEvent) => request<CalendarEvent>('/events', { method: 'POST', body: JSON.stringify({ event }) }),

  updateEvent: (event: CalendarEvent) => request<CalendarEvent>(`/events/${event.id}`, { method: 'PATCH', body: JSON.stringify({ event }) }),

  deleteEvent: (id: string) => request<void>(`/events/${id}`, { method: 'DELETE' }),
};

export function isUnauthorized(error: unknown): boolean {
  return error instanceof HttpError && error.status === 401;
}
