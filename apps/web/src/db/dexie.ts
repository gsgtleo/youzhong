import Dexie, { type Table } from 'dexie';
import type { Snapshot } from '@youzhong/shared';

export interface CachedSnapshot {
  id: string;
  payload: Snapshot;
  savedAt: number;
}

export interface OutboxItem {
  id?: number;
  kind: 'save' | 'delete';
  taskId: string;
  projectId: string;
  payload?: string;
  attempts: number;
  createdAt: number;
  /** 上次尝试时间：退避窗口按它算，而不是按 createdAt */
  lastAttemptAt?: number;
  lastError?: string;
}

class YouzhongDatabase extends Dexie {
  snapshots!: Table<CachedSnapshot, string>;
  outbox!: Table<OutboxItem, number>;

  constructor() {
    super('youzhong');
    this.version(1).stores({
      snapshots: 'id',
      outbox: '++id, taskId, createdAt',
    });
  }
}

export const db = new YouzhongDatabase();

export async function cacheSnapshot(snapshot: Snapshot): Promise<void> {
  await db.snapshots.put({ id: 'latest', payload: snapshot, savedAt: Date.now() });
}

export async function readCachedSnapshot(): Promise<CachedSnapshot | undefined> {
  return db.snapshots.get('latest');
}

export async function clearLocalCache(): Promise<void> {
  await db.snapshots.clear();
  await db.outbox.clear();
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}
