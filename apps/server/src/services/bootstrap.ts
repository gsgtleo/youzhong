import { projects, settings, tasks, users } from '../db/repositories';
import { hashPassword, newId, randomToken } from '../lib/security';

function stamp(offsetDays: number, hour = 9, minute = 0, allDay = false): string {
  const base = new Date();
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays, allDay ? 0 : hour, allDay ? 0 : minute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00.000${sign}${pad(
    Math.floor(abs / 60),
  )}${pad(abs % 60)}`;
}

/** 新用户初始化：笔记本 + 少量示例任务，避免空屏 */
export function seedUserData(userId: string, displayName: string): void {
  const inbox = projects.create(userId, { name: '笔记本', permission: 'inbox', color: '#0E9F8A' });
  const work = projects.create(userId, { name: '工作', color: '#3B82F6' });
  const life = projects.create(userId, { name: '生活', color: '#22A06B' });

  // 新账号只放一条操作引导；SEED_DEMO=true 时才额外生成示例任务（默认关闭，保持干净）
  const demo = process.env.SEED_DEMO === 'true';
  const seed = [
    ...(demo
      ? [
          { projectId: work.id, title: '梳理本周最重要的三件事', priority: 5 as const, day: 0, hour: 10 },
          { projectId: work.id, title: '同步项目进度给团队', priority: 3 as const, day: 1, hour: 14 },
          { projectId: life.id, title: '采购：洗衣液、厨房纸', priority: 1 as const, day: 2, allDay: true },
        ]
      : []),
    // 引导任务放到今天，保证首次进入「今天」不是空屏
    { projectId: inbox.id, title: `${displayName}，点这里试试任务详情：日期、提醒、子任务、标签都在右侧`, priority: 0 as const, day: 0, hour: 9 },
  ];

  seed.forEach((item, index) => {
    tasks.upsert(userId, {
      id: newId(),
      projectId: item.projectId,
      title: item.title,
      priority: item.priority,
      status: 0,
      dueDate: item.day === undefined ? undefined : stamp(item.day, item.hour ?? 9, 0, Boolean(item.allDay)),
      isAllDay: Boolean(item.allDay),
      tags: [],
      items: [],
      reminders: [],
      sortOrder: index,
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
    });
  });

  settings.save(userId, { weekStartsOn: 1, ruleId: 'priority', reminderMinutes: [15], dailyDigest: true, dailyDigestHour: 9 });
}

/** 首次启动创建管理员，密码取 ADMIN_PASSWORD，否则随机生成并打印一次 */
export function ensureAdmin(): void {
  if (users.count() > 0) return;
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? randomToken(9);
  const admin = users.create({
    username,
    displayName: process.env.ADMIN_DISPLAY_NAME ?? '管理员',
    passwordHash: hashPassword(password),
    role: 'admin',
  });
  seedUserData(admin.id, admin.displayName);

  if (!process.env.ADMIN_PASSWORD) {
    console.log('==========================================================');
    console.log(`[init] 已创建管理员账号：${username}`);
    console.log(`[init] 初始密码：${password}`);
    console.log('[init] 请登录后立即修改密码（设置 → 账号 → 修改密码）');
    console.log('==========================================================');
  } else {
    console.log(`[init] 已创建管理员账号：${username}（密码来自 ADMIN_PASSWORD）`);
  }
}
