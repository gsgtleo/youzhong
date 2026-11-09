/**
 * 本地应急脚本：重置账号密码（忘记密码时用）
 * 用法：cd apps/server && npx tsx reset-password.ts admin 新密码
 */
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { hashPassword } from './src/lib/security';

const [username, password] = process.argv.slice(2);
if (!username || !password || password.length < 8) {
  console.error('用法：npx tsx reset-password.ts <用户名> <至少8位新密码>');
  process.exit(1);
}

const dbFile = process.env.DB_FILE ?? '.data/youzhong.db';
const db = new Database(dbFile);
const row = db.prepare('SELECT username FROM users WHERE username = ?').get(username);
if (!row) {
  console.error(`用户 ${username} 不存在`);
  process.exit(1);
}
db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hashPassword(password), username);
db.prepare('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = ?)').run(username);
console.log(`已重置 ${username} 的密码，并清空其会话（所有客户端需重新登录）`);
db.close();
