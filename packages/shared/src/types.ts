/**
 * 前后端唯一真源：本项目的领域模型（任务 / 清单 / 日程 / 标签 / 用户设置）。
 * 服务端、网页端与安卓端共用同一套字段定义。
 */

export type Priority = 0 | 1 | 3 | 5; // 无 / 低 / 中 / 高

/** 0 = 未完成，2 = 已完成（-1 为 Open API 的已放弃状态，私有接口较少出现） */
export type TaskStatus = 0 | 2;

export interface Reminder {
  id: string;
  /** 绝对时间 "yyyy-MM-ddTHH:mm:ss.000+0800" 或相对触发器 "TRIGGER:-PT30M" */
  trigger: string;
}

export interface Subtask {
  id: string;
  title: string;
  status: TaskStatus;
  sortOrder?: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  priority: Priority;
  status: TaskStatus;
  /** 截止时间，形如 2026-10-26T14:00:00.000+0800 */
  dueDate?: string;
  startDate?: string;
  isAllDay?: boolean;
  timeZone?: string;
  reminders?: Reminder[];
  tags?: string[];
  items?: Subtask[];
  /** 重复规则（RRULE 片段），本期只读展示 */
  repeatFlag?: string;
  sortOrder?: number;
  parentId?: string;
  etag?: string;
  createdTime?: string;
  modifiedTime?: string;
  completedTime?: string;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  sortOrder?: number;
  groupId?: string;
  closed?: boolean;
  viewMode?: string;
  /** 系统内置清单标记：inbox 为笔记本（内置的临时记录清单） */
  permission?: string;
  kind?: string;
}

export interface ProjectGroup {
  id: string;
  name: string;
  sortOrder?: number;
}

export interface Tag {
  name: string;
  label?: string;
  color?: string;
  sortOrder?: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  /** yyyy-MM-ddTHH:mm:ss.000+0800 */
  startDate: string;
  endDate?: string;
  isAllDay?: boolean;
  color?: string;
  calendarId?: string;
  description?: string;
  location?: string;
}

export interface Snapshot {
  projects: Project[];
  projectGroups: ProjectGroup[];
  tags: Tag[];
  tasks: Task[];
  events: CalendarEvent[];
  serverTime: string;
  mode: 'live' | 'mock' | 'server';
}

export interface SessionStatus {
  authed: boolean;
  mode: 'live' | 'mock';
  /** 脱敏后的账号标识，例如 le***@gmail.com */
  account?: string;
  lastSync?: number;
  error?: string;
}

export type TaskPatch = Partial<Omit<Task, 'id'>>;

export type Quadrant = 'q1' | 'q2' | 'q3' | 'q4';

export interface QuadrantRule {
  id: 'priority' | 'urgency';
  name: string;
  description: string;
  /** 判定任务落在哪个象限 */
  quadrantOf(task: Task, now: Date): Quadrant;
  /** 拖拽落位后需要回写服务端的字段 */
  applyDrag(task: Task, target: Quadrant, now: Date): TaskPatch;
}

export type SmartListId = 'today' | 'week' | 'inbox' | 'completed' | 'all';

/* ------------------------------ 多用户 ------------------------------ */

export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'disabled';
  timezone: string;
  createdAt: number;
  lastLoginAt?: number;
}

export interface AuthSession {
  user: User;
  token?: string;
  expiresAt: number;
}

export interface PingResult {
  ok: boolean;
  name: string;
  version: string;
  apiVersion: number;
  serverTime: string;
  requiresAuth: boolean;
  features: string[];
}

export type ChannelType = 'dingtalk' | 'feishu';
export type ChannelEvent = 'due' | 'daily' | 'completed';

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  events: ChannelEvent[];
  lastStatus?: string;
  lastError?: string;
  lastSentAt?: number;
  createdAt: number;
  /** 仅创建/更新时回传，读取列表时脱敏 */
  webhook?: string;
  secret?: string;
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body?: string;
  taskId?: string;
  createdAt: number;
  read: boolean;
}

export interface UserSettings {
  weekStartsOn?: 0 | 1;
  ruleId?: 'priority' | 'urgency';
  reminderMinutes?: number[];
  dailyDigest?: boolean;
  dailyDigestHour?: number;
  theme?: 'light' | 'dark' | 'system';
}
