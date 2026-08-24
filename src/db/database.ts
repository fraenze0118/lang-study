import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

const DB_NAME = 'lang-study.db';
const SCHEMA_VERSION = 2;

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    migrate(db);
  }
  return db;
}

function migrate(database: SQLite.SQLiteDatabase): void {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version >= SCHEMA_VERSION) {
    database.execSync(SCHEMA_SQL); // 幂等确保表存在
    return;
  }

  // v1 → v2 结构变化大，旧测试数据可丢弃，直接重建
  database.execSync(`
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
