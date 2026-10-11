// SQLite DDL（多语种版本，对应 docs/features/multi-language/multi-language.md）
// 说明：
// - `order` 为 SQL 保留字，故使用 `sort_order`。
// - 语种归属：`items.language_id` 显式存储（AI 生成条目 unit_id 为 NULL，无法从单元反推）。
// - `user_languages` 承载"按语种"的用户画像（水平/难度偏移/是否跳过字母单元）。
// - `app_preferences` 存 App 级偏好（当前活跃语种等）。

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
  language_id      TEXT REFERENCES languages(id),
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
  category         TEXT,
  source           TEXT NOT NULL DEFAULT 'syllabus',
  level_code       TEXT,
  created_at       INTEGER,
  sort_order       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS item_examples (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       TEXT NOT NULL REFERENCES items(id),
  ja            TEXT NOT NULL,          -- 目标语言原文（键名为历史遗留，韩语/俄语同用此列）
  pronunciation TEXT NOT NULL,          -- 发音标注：日语假名 / 韩语罗马音 / 俄语拉丁转写
  zh            TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  native_language  TEXT NOT NULL DEFAULT 'zh',
  level_code       TEXT NOT NULL DEFAULT 'N5',
  difficulty_bias  INTEGER NOT NULL DEFAULT 0,
  goal             TEXT NOT NULL DEFAULT 'both',
  session_size     INTEGER NOT NULL DEFAULT 8,
  interests        TEXT,
  assessment_done  INTEGER NOT NULL DEFAULT 0,
  daily_goal_xp    INTEGER NOT NULL DEFAULT 50
);

-- 按语种的用户画像（v5）：水平/难度偏移/是否跳过字母入门单元都随语种独立
CREATE TABLE IF NOT EXISTS user_languages (
  user_id           TEXT NOT NULL REFERENCES users(id),
  language_id       TEXT NOT NULL REFERENCES languages(id),
  level_code        TEXT NOT NULL,
  difficulty_bias   INTEGER NOT NULL DEFAULT 0,
  skip_script_units INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  PRIMARY KEY (user_id, language_id)
);

-- App 级偏好（v5）：当前活跃语种等
CREATE TABLE IF NOT EXISTS app_preferences (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
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

-- 练习作答 / 自评事件（v4）：每日经验与连续天数的唯一事实来源
CREATE TABLE IF NOT EXISTS answer_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  session_id  TEXT,
  item_id     TEXT,
  step_kind   TEXT NOT NULL,              -- 'exercise'（自动判分）| 'selfcheck'（翻译自评/复习评分）
  correct     INTEGER NOT NULL,           -- 0/1
  xp          INTEGER NOT NULL DEFAULT 0,
  answered_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  item_id     TEXT,
  language_id TEXT REFERENCES languages(id),
  kind        TEXT NOT NULL DEFAULT 'agent',
  created_at  INTEGER NOT NULL
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
CREATE INDEX IF NOT EXISTS idx_items_language ON items(language_id, type);
CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_answer_logs_user_time ON answer_logs(user_id, answered_at);
`;
