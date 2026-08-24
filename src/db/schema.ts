// SQLite DDL（v2，对应 02-data-model.md）
// 说明：`order` 为 SQL 保留字，故使用 `sort_order`。

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS languages (
  id   TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS levels (
  id          TEXT PRIMARY KEY,
  language_id TEXT NOT NULL REFERENCES languages(id),
  code        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL,
  target_vocab INTEGER
);

CREATE TABLE IF NOT EXISTS units (
  id         TEXT PRIMARY KEY,
  level_id   TEXT NOT NULL REFERENCES levels(id),
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id               TEXT PRIMARY KEY,
  unit_id          TEXT REFERENCES units(id),
  type             TEXT NOT NULL,
  surface          TEXT NOT NULL,
  reading          TEXT NOT NULL,
  accent           TEXT,
  pos              TEXT,
  conjugation      TEXT,
  transitivity     TEXT,
  meaning          TEXT NOT NULL,
  pattern          TEXT,
  grammar_category TEXT,
  onyomi_kunyomi   TEXT,
  related_item_ids TEXT,
  source           TEXT NOT NULL DEFAULT 'syllabus',
  level_code       TEXT,
  created_at       INTEGER,
  sort_order       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS item_examples (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES items(id),
  ja      TEXT NOT NULL,
  kana    TEXT NOT NULL,
  zh      TEXT NOT NULL,
  source  TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  native_language  TEXT NOT NULL DEFAULT 'zh',
  level_code       TEXT NOT NULL DEFAULT 'N5',
  difficulty_bias  INTEGER NOT NULL DEFAULT 0,
  goal             TEXT NOT NULL DEFAULT 'both',
  session_size     INTEGER NOT NULL DEFAULT 8,
  interests        TEXT,
  assessment_done  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS difficulty_feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id),
  item_id    TEXT,
  feedback   TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  mode       TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_item_states (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL REFERENCES users(id),
  item_id         TEXT NOT NULL REFERENCES items(id),
  mastery_state   TEXT NOT NULL DEFAULT 'new',
  fsrs_state      INTEGER NOT NULL DEFAULT 0,
  stability       REAL NOT NULL DEFAULT 0,
  difficulty      REAL NOT NULL DEFAULT 0,
  due             INTEGER,
  last_review_at  INTEGER,
  reps            INTEGER NOT NULL DEFAULT 0,
  lapses          INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS review_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  item_id     TEXT NOT NULL REFERENCES items(id),
  grade       TEXT NOT NULL,
  elapsed_ms  INTEGER NOT NULL DEFAULT 0,
  reviewed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  item_id    TEXT,
  kind       TEXT NOT NULL DEFAULT 'agent',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id),
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_states_user_due ON user_item_states(user_id, due);
CREATE INDEX IF NOT EXISTS idx_items_unit ON items(unit_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_items_source_level ON items(source, level_code);
CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, created_at);
`;
