// 数据备份（M5）：全表导出/导入 JSON，零额外依赖
import { getDb } from '../../db/database';

// 必须与 src/db/schema.ts 里的业务表保持一致（新增表务必同步登记，否则导入会丢数据）
const TABLES = [
  'languages',
  'levels',
  'units',
  'items',
  'item_examples',
  'users',
  'user_languages',
  'app_preferences',
  'difficulty_feedback',
  'study_sessions',
  'user_item_states',
  'review_logs',
  'answer_logs',
  'chat_sessions',
  'chat_messages',
];

// 各表的“时间列”，用于恢复时按时间倒序插入，还原用户看到的列表顺序
const TIME_COLUMN: Record<string, string | null> = {
  languages: null,
  levels: null,
  units: null,
  items: 'created_at',
  item_examples: null,
  users: null,
  user_languages: 'created_at',
  app_preferences: null,
  difficulty_feedback: 'created_at',
  study_sessions: 'created_at',
  user_item_states: null,
  review_logs: 'reviewed_at',
  answer_logs: 'answered_at',
  chat_sessions: 'created_at',
  chat_messages: 'created_at',
};

export function exportAll(): string {
  const db = getDb();
  const data: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    data[table] = db.getAllSync<Record<string, unknown>>(`SELECT * FROM ${table}`);
  }
  return JSON.stringify({ version: 1, exportedAt: Date.now(), data }, null, 2);
}

export function importAll(json: string): void {
  const parsed = JSON.parse(json) as { data?: Record<string, unknown[]> };
  const data = parsed?.data;
  if (!data || typeof data !== 'object') throw new Error('备份文件格式不正确');

  const db = getDb();
  // 导入期间关闭外键检查，避免删除/插入顺序触碰外键；事务结束后恢复。
  // 若数据库本就没开外键，这个 PRAGMA 也是无害的。
  try {
    db.execSync('PRAGMA foreign_keys = OFF');
  } catch {
    // 部分平台不支持该 PRAGMA，忽略
  }

  db.execSync('BEGIN');
  try {
    // 依赖顺序与被引用的顺序相反：先清子表，再清父表
    for (const table of [...TABLES].reverse()) {
      db.runSync(`DELETE FROM ${table}`);
    }
    // 清空自增计数器，否则按原 id 插回旧数据后，新插入会撞主键
    for (const table of TABLES) {
      try {
        db.runSync('DELETE FROM sqlite_sequence WHERE name = ?', table);
      } catch {
        // 该表没有 AUTOINCREMENT 时 sqlite_sequence 不存在，忽略
      }
    }

    for (const table of TABLES) {
      const rows = data[table] as Record<string, unknown>[] | undefined;
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const timeColumn = TIME_COLUMN[table] ?? null;
      // review_logs / chat_messages 等按 id 升序，即插入顺序，恢复后列表顺序与导出前一致
      const ordered = [...rows].sort((a, b) => {
        if (timeColumn) {
          const av = Number(a[timeColumn] ?? 0);
          const bv = Number(b[timeColumn] ?? 0);
          if (av !== bv) return av - bv;
        }
        return Number(a.id ?? 0) - Number(b.id ?? 0);
      });
      for (const row of ordered) {
        const cols = Object.keys(row);
        const placeholders = cols.map(() => '?').join(', ');
        const colList = cols.map((c) => `"${c}"`).join(', ');
        db.runSync(
          `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`,
          ...cols.map((c) => row[c] as string | number | null),
        );
      }
    }
    db.execSync('COMMIT');
  } catch (e) {
    db.execSync('ROLLBACK');
    throw e;
  } finally {
    try {
      db.execSync('PRAGMA foreign_keys = ON');
    } catch {
      // 忽略
    }
  }
}
