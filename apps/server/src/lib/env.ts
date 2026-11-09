import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 极简 .env 读取（无第三方依赖）。模块被引入时就执行，
 * 必须在 index.ts 的**第一条 import** 引入，保证 db/路由读到的 process.env 已是最终值。
 * 查找顺序：./.env（服务目录，docker 挂载用）→ ../.env → ../../.env（仓库根）。
 * 已存在的环境变量优先，不会被覆盖。
 */
function loadEnv(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env'),
    resolve(process.cwd(), '../../.env'),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .forEach((line) => {
        const text = line.trim();
        if (!text || text.startsWith('#')) return;
        const index = text.indexOf('=');
        if (index <= 0) return;
        const key = text.slice(0, index).trim();
        let value = text.slice(index + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      });
    return; // 只加载第一个命中的文件
  }
}

loadEnv();
