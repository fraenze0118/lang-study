// 数据备份（M5）：全表导出/导入 JSON，零额外依赖
import { getDb } from '../../db/database';

const TABLES = [
  'languages',
  'levels',
  'units',
  'items',
  'item_examples',
  'users',
  'user_item_states',
  'review_logs',
  'chat_sessions',
  'chat_messages',
];

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
  db.execSync('BEGIN');
  try {
    for (const table of [...TABLES].reverse()) {
      db.runSync(`DELETE FROM ${table}`);
    }
    for (const table of TABLES) {
      const rows = data[table] as Record<string, unknown>[] | undefined;
      if (!Array.isArray(rows) || rows.length === 0) continue;
      for (const row of rows) {
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
  }
}
