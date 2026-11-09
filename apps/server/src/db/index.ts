import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';

/** 默认数据库路径：仓库/服务目录下的 .data/youzhong.db，可用 DB_FILE 覆盖 */
function resolveDbFile(): string {
  if (process.env.DB_FILE) return resolve(process.cwd(), process.env.DB_FILE);
  return resolve(process.cwd(), '.data/youzhong.db');
}

const DB_FILE = resolveDbFile();
mkdirSync(dirname(DB_FILE), { recursive: true });

export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const schema = readFileSync(resolve(import.meta.dirname, 'schema.sql'), 'utf8');
db.exec(schema);
// user_version 由迁移脚本顺序推进，当前 schema 为 v2
const schemaVersion = Number(db.pragma('user_version', { simple: true }) as number);
if (schemaVersion < 1) db.pragma('user_version = 1');
// v2：内置清单从「收件箱」改名为「笔记本」（permission 标记仍是 inbox，只改显示名）
if (schemaVersion < 2) {
  const renamed = db
    .prepare("UPDATE projects SET name = '笔记本' WHERE permission = 'inbox' AND name <> '笔记本'")
    .run();
  if (renamed.changes) console.log(`[db] 内置清单已改名：收件箱 → 笔记本（${renamed.changes} 个账号）`);
  db.pragma('user_version = 2');
}

console.log(`[db] SQLite 就绪 ${DB_FILE}`);

export function dbFile(): string {
  return DB_FILE;
}

/** 备份：调用 SQLite 在线备份，避免直接拷贝 WAL 造成不一致 */
export function backupTo(target: string): void {
  mkdirSync(dirname(target), { recursive: true });
  db.backup(target);
}

export function now(): number {
  return Date.now();
}
