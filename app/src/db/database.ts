import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

const DB_NAME = 'lang-study.db';
const SCHEMA_VERSION = 5;

/** 历史库里唯一被播种过的语种；用于 v4→v5 回填 */
const LEGACY_LANGUAGE_ID = 'ja';

let db: SQLite.SQLiteDatabase | null = null;

/** 建库时校验的关键结构：表 → 必须存在的列（空数组表示只校验表本身） */
const REQUIRED_SCHEMA: Record<string, string[]> = {
  languages: [],
  levels: [],
  units: [],
  items: ['language_id'],
  item_examples: ['pronunciation'],
  user_languages: [],
  app_preferences: [],
  user_item_states: [],
};

/**
 * 校验库结构是否与当前代码匹配。
 *
 * 为什么需要：迁移只信任 `PRAGMA user_version`。如果某次迁移中途失败、
 * 或者设备上残留了一份"版本号已是新值、表结构却还是旧的"数据库，
 * 迁移守卫会直接放行，随后任何查询都会以
 * `no such column: language_id` 之类的错误崩在页面里（很难定位）。
 * 这里显式核对关键表与列，让启动阶段就能发现并自愈。
 */
function hasRequiredSchema(database: SQLite.SQLiteDatabase): boolean {
  for (const [table, columns] of Object.entries(REQUIRED_SCHEMA)) {
    if (!hasTable(database, table)) {
      console.warn(`[db] missing table: ${table}`);
      return false;
    }
    for (const col of columns) {
      if (!hasColumn(database, table, col)) {
        console.warn(`[db] missing column: ${table}.${col}`);
        return false;
      }
    }
  }
  return true;
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    const opened = SQLite.openDatabaseSync(DB_NAME);
    let needsRebuild = false;

    // 迁移失败也要兜住：旧库结构千奇百怪，任何一步 ALTER/UPDATE 都可能抛错。
    // 之前这里直接把异常抛给调用方，自愈逻辑根本执行不到，App 会每次启动都崩。
    try {
      migrate(opened);
    } catch (e) {
      console.warn('[db] migration failed -> will rebuild', e);
      needsRebuild = true;
    }

    if (!needsRebuild) {
      needsRebuild = !hasRequiredSchema(opened);
      if (needsRebuild) console.warn('[db] schema incomplete -> rebuilding');
    }

    if (needsRebuild) {
      // 原地 DROP + 重建：不删文件，避开 Android 上"文件仍被占用"的问题
      rebuildSchema(opened);
      if (!hasRequiredSchema(opened)) {
        throw new Error('数据库结构不完整，且重建后仍未修复');
      }
    }

    db = opened;
  }
  return db;
}

/** 建库时会用到的全部表（rebuildSchema 需要逐个 DROP） */
const ALL_TABLES = [
  'app_preferences',
  'user_languages',
  'answer_logs',
  'chat_messages',
  'chat_sessions',
  'review_logs',
  'user_item_states',
  'difficulty_feedback',
  'study_sessions',
  'users',
  'item_examples',
  'items',
  'units',
  'levels',
  'languages',
];

/**
 * 在原地把这个库重建为空结构。
 *
 * 为什么不用 deleteDatabaseSync：实测在 Android 上 `closeSync()` 之后文件**仍然
 * 被占用**，删除会抛
 *   Unable to delete database '.../files/SQLite/lang-study.db' that is currently
 *   open. Close it prior to deletion.
 * 于是"坏了就删库重来"这条自救路径在真机上根本走不通。DROP + 重建不碰文件，
 * 因此没有句柄问题。
 */
export function rebuildSchema(database: SQLite.SQLiteDatabase): void {
  // 关外键：否则按依赖顺序删表会很挑剔
  database.execSync('PRAGMA foreign_keys = OFF');
  for (const t of ALL_TABLES) {
    database.execSync(`DROP TABLE IF EXISTS ${t}`);
  }
  database.execSync('DROP TABLE IF EXISTS sqlite_sequence');
  database.execSync(SCHEMA_SQL);
  database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  database.execSync('PRAGMA foreign_keys = ON');
}

function hasColumn(database: SQLite.SQLiteDatabase, table: string, column: string): boolean {
  const cols = database.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.some((c) => c.name === column);
}

function hasTable(database: SQLite.SQLiteDatabase, table: string): boolean {
  const row = database.getFirstSync<{ name: string }>(
    'SELECT name FROM sqlite_master WHERE type = ? AND name = ?',
    'table',
    table,
  );
  return !!row;
}

/** 补列是不幂等的，必须先探测列是否存在（旧库升上来时可能已经补过）。 */
function addColumnIfMissing(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  ddl: string,
): void {
  if (!hasTable(database, table)) return;
  if (!hasColumn(database, table, column)) {
    database.execSync(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

/** 只改列名，不重建表：SQLite >= 3.25 支持 RENAME COLUMN。 */
function renameColumnIfNeeded(
  database: SQLite.SQLiteDatabase,
  table: string,
  from: string,
  to: string,
): void {
  if (!hasTable(database, table)) return;
  if (hasColumn(database, table, from) && !hasColumn(database, table, to)) {
    database.execSync(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
  }
}

/**
 * v4 → v5：多语种支持。所有更早版本最终都走到这里。
 * 全部操作幂等，可重复执行。
 *
 * 重要：`items.language_id` 必须显式存储 —— AI 生成的条目 unit_id 为 NULL，
 * 无法通过 unit → level 反推语种。
 */
function migrateToV5(database: SQLite.SQLiteDatabase): void {
  database.execSync(SCHEMA_SQL); // 先确保新表（user_languages / app_preferences）存在

  // 必须先建好被引用的语种占位行：items.language_id 是外键，
  // 若在 languages 为空时就回填，开启外键检查的库会直接失败。
  database.runSync(
    'INSERT OR IGNORE INTO languages (id, code, name) VALUES (?, ?, ?)',
    LEGACY_LANGUAGE_ID,
    LEGACY_LANGUAGE_ID,
    'Japanese',
  );

  addColumnIfMissing(database, 'items', 'language_id', 'language_id TEXT REFERENCES languages(id)');
  addColumnIfMissing(
    database,
    'chat_sessions',
    'language_id',
    'language_id TEXT REFERENCES languages(id)',
  );
  renameColumnIfNeeded(database, 'item_examples', 'kana', 'pronunciation');

  // 回填 items.language_id：先按单元反推，再兜底给历史 AI 条目（unit_id 为 NULL）
  database.execSync(
    `UPDATE items SET language_id = (
       SELECT l.language_id FROM units u JOIN levels l ON l.id = u.level_id WHERE u.id = items.unit_id
     )
     WHERE language_id IS NULL AND unit_id IS NOT NULL`,
  );
  database.runSync('UPDATE items SET language_id = ? WHERE language_id IS NULL', LEGACY_LANGUAGE_ID);
  database.runSync('UPDATE chat_sessions SET language_id = ? WHERE language_id IS NULL', LEGACY_LANGUAGE_ID);

  // 按语种画像：把每个用户现有水平迁移为「日语」那一行
  const users = database.getAllSync<{
    id: string;
    level_code: string;
    difficulty_bias: number;
    interests: string | null;
  }>('SELECT id, level_code, difficulty_bias, interests FROM users');

  const now = Date.now();
  for (const u of users) {
    // interests 里可能存着 skipKanaUnits（旧的字母入门偏好）
    let skipScript = 0;
    if (u.interests) {
      try {
        const parsed: unknown = JSON.parse(u.interests);
        if (parsed && typeof parsed === 'object' && (parsed as { skipKanaUnits?: boolean }).skipKanaUnits) {
          skipScript = 1;
        }
      } catch {
        // 脏数据按 0 处理
      }
    }
    database.runSync(
      `INSERT OR IGNORE INTO user_languages
         (user_id, language_id, level_code, difficulty_bias, skip_script_units, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      u.id,
      LEGACY_LANGUAGE_ID,
      u.level_code ?? 'N5',
      u.difficulty_bias ?? 0,
      skipScript,
      now,
    );
  }

  database.runSync(
    `INSERT OR IGNORE INTO app_preferences (key, value) VALUES ('active_language_id', ?)`,
    LEGACY_LANGUAGE_ID,
  );
}

function migrate(database: SQLite.SQLiteDatabase): void {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version >= SCHEMA_VERSION) {
    database.execSync(SCHEMA_SQL); // 幂等确保表存在
    return;
  }

  if (version === 0) {
    // 全新库：直接建表（种子数据由 syllabus 播种负责）
    database.execSync(SCHEMA_SQL);
    database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    return;
  }

  if (version === 4) {
    migrateToV5(database);
    database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    return;
  }

  if (version === 3) {
    // v3 → v4：每日目标列 + answer_logs 表（保留数据），再升 v5
    addColumnIfMissing(database, 'users', 'daily_goal_xp', 'daily_goal_xp INTEGER NOT NULL DEFAULT 50');
    migrateToV5(database);
    database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    return;
  }

  if (version === 2) {
    // v2 → v3 → v4 → v5：补 category 并回填（保留数据）
    addColumnIfMissing(database, 'items', 'category', 'category TEXT');
    database.execSync(
      `UPDATE items SET category = (SELECT u.title FROM units u WHERE u.id = items.unit_id)
       WHERE unit_id IS NOT NULL AND category IS NULL`,
    );
    database.execSync(
      `UPDATE items SET category = 'AI 推荐' WHERE unit_id IS NULL AND source = 'ai' AND category IS NULL`,
    );
    addColumnIfMissing(database, 'users', 'daily_goal_xp', 'daily_goal_xp INTEGER NOT NULL DEFAULT 50');
    migrateToV5(database);
    database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    return;
  }

  // v1 → 结构变化大，旧测试数据可丢弃，直接重建到最新
  database.execSync(`
    DROP TABLE IF EXISTS app_preferences;
    DROP TABLE IF EXISTS user_languages;
    DROP TABLE IF EXISTS answer_logs;
    DROP TABLE IF EXISTS chat_messages;
    DROP TABLE IF EXISTS chat_sessions;
    DROP TABLE IF EXISTS review_logs;
    DROP TABLE IF EXISTS user_item_states;
    DROP TABLE IF EXISTS difficulty_feedback;
    DROP TABLE IF EXISTS study_sessions;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS item_examples;
    DROP TABLE IF EXISTS items;
    DROP TABLE IF EXISTS units;
    DROP TABLE IF EXISTS levels;
    DROP TABLE IF EXISTS languages;
  `);
  database.execSync(SCHEMA_SQL);
  database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
