// 用户、学习状态、难度反馈数据访问
import { State } from 'ts-fsrs';
import { getDb } from './database';
import { Feedback, ItemType, LevelCode } from '../lib/enums';
import { User, UserItemState, UserLanguage } from '../lib/types';

export function getUser(id: string): User | null {
  return getDb().getFirstSync<User>(
    `SELECT id, native_language AS nativeLanguage, level_code AS levelCode,
            difficulty_bias AS difficultyBias, goal, session_size AS sessionSize,
            interests, assessment_done AS assessmentDone, daily_goal_xp AS dailyGoalXp
     FROM users WHERE id = ?`,
    id,
  );
}

export function createUser(user: User): void {
  getDb().runSync(
    `INSERT INTO users (id, native_language, level_code, difficulty_bias, goal, session_size, interests, assessment_done, daily_goal_xp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    user.id,
    user.nativeLanguage,
    user.levelCode,
    user.difficultyBias,
    user.goal,
    user.sessionSize,
    user.interests,
    user.assessmentDone,
    user.dailyGoalXp,
  );
}

export function getOrCreateUser(id: string): User {
  const existing = getUser(id);
  if (existing) return existing;
  const user: User = {
    id,
    nativeLanguage: 'zh',
    levelCode: 'N5',
    difficultyBias: 0,
    goal: 'both',
    sessionSize: 5,
    interests: null,
    assessmentDone: 0,
    dailyGoalXp: 50,
  };
  createUser(user);
  return user;
}

/** 设置每日目标经验值（0 = 不设目标，不计连续天数） */
export function updateDailyGoal(userId: string, dailyGoalXp: number): void {
  getDb().runSync('UPDATE users SET daily_goal_xp = ? WHERE id = ?', Math.max(0, dailyGoalXp), userId);
}

export function getUserItemState(userId: string, itemId: string): UserItemState | null {
  return getDb().getFirstSync<UserItemState>(
    `SELECT id, user_id AS userId, item_id AS itemId, mastery_state AS masteryState,
            fsrs_state AS fsrsState, stability, difficulty, due,
            last_review_at AS lastReviewAt, reps, lapses
     FROM user_item_states WHERE user_id = ? AND item_id = ?`,
    userId,
    itemId,
  );
}

export function getStateById(id: number): UserItemState | null {
  return getDb().getFirstSync<UserItemState>(
    `SELECT id, user_id AS userId, item_id AS itemId, mastery_state AS masteryState,
            fsrs_state AS fsrsState, stability, difficulty, due,
            last_review_at AS lastReviewAt, reps, lapses
     FROM user_item_states WHERE id = ?`,
    id,
  );
}

// 首次学习后：标记 learning，进入 FSRS Learning 状态，due 为当前时间（马上可首次复习）
export function createUserItemStates(userId: string, itemIds: string[]): void {
  const db = getDb();
  const now = Date.now();
  for (const itemId of itemIds) {
    db.runSync(
      `INSERT OR IGNORE INTO user_item_states
         (user_id, item_id, mastery_state, fsrs_state, stability, difficulty, due, reps, lapses)
       VALUES (?, ?, 'learning', ?, 0, 0, ?, 0, 0)`,
      userId,
      itemId,
      State.Learning,
      now,
    );
  }
}

export interface DueReviewSummary {
  stateId: number;
  itemId: string;
  type: ItemType;
  surface: string;
  reading: string;
  meaning: string;
}

export function getRecentLearnedItems(
  userId: string,
  languageId: string,
  limit = 20,
): { surface: string; meaning: string }[] {
  return getDb().getAllSync<{ surface: string; meaning: string }>(
    `SELECT i.surface, i.meaning
     FROM user_item_states s
     JOIN items i ON i.id = s.item_id
     WHERE s.user_id = ? AND i.language_id = ?
     ORDER BY s.last_review_at DESC, s.id DESC
     LIMIT ?`,
    userId,
    languageId,
    limit,
  );
}

export interface ProgressStats {
  learnedCount: number;
  masteredCount: number;
  dueCount: number;
}

/** 按语种统计（加韩语后必须隔离，否则两个语种的词会混在一起） */
export function getProgressStats(userId: string, languageId: string): ProgressStats {
  const row = getDb().getFirstSync<{ learned: number; mastered: number; due: number }>(
    `SELECT
       COUNT(*) AS learned,
       SUM(CASE WHEN s.mastery_state = 'mastered' THEN 1 ELSE 0 END) AS mastered,
       SUM(CASE WHEN s.due <= ? AND s.mastery_state != 'new' THEN 1 ELSE 0 END) AS due
     FROM user_item_states s
     JOIN items i ON i.id = s.item_id
     WHERE s.user_id = ? AND i.language_id = ?`,
    Date.now(),
    userId,
    languageId,
  );
  return {
    learnedCount: row?.learned ?? 0,
    masteredCount: row?.mastered ?? 0,
    dueCount: row?.due ?? 0,
  };
}

export interface LearnedItem {
  itemId: string;
  surface: string;
  reading: string;
  meaning: string;
  masteryState: string;
}

export function getLearnedItems(userId: string, languageId: string): LearnedItem[] {
  return getDb().getAllSync<LearnedItem>(
    `SELECT i.id AS itemId, i.surface, i.reading, i.meaning, s.mastery_state AS masteryState
     FROM user_item_states s
     JOIN items i ON i.id = s.item_id
     WHERE s.user_id = ? AND i.language_id = ?
     ORDER BY s.id DESC`,
    userId,
    languageId,
  );
}

export interface KnowledgeItem {
  itemId: string;
  type: ItemType;
  surface: string;
  reading: string;
  meaning: string;
  levelCode: string | null;
  category: string | null;
  pos: string | null;
  masteryState: string;
}

export function getKnowledgeItems(userId: string, languageId: string): KnowledgeItem[] {
  return getDb().getAllSync<KnowledgeItem>(
    `SELECT i.id AS itemId, i.type, i.surface, i.reading, i.meaning,
            i.level_code AS levelCode, i.category, i.pos, s.mastery_state AS masteryState
     FROM user_item_states s
     JOIN items i ON i.id = s.item_id
     WHERE s.user_id = ? AND i.language_id = ?
     ORDER BY s.id DESC`,
    userId,
    languageId,
  );
}

export function getDueReviews(
  userId: string,
  languageId: string,
  limit = 100,
): DueReviewSummary[] {
  return getDb().getAllSync<DueReviewSummary>(
    `SELECT s.id AS stateId, s.item_id AS itemId, i.type, i.surface, i.reading, i.meaning
     FROM user_item_states s
     JOIN items i ON i.id = s.item_id
     WHERE s.user_id = ? AND i.language_id = ? AND s.due <= ? AND s.mastery_state != 'new'
     ORDER BY s.due ASC
     LIMIT ?`,
    userId,
    languageId,
    Date.now(),
    limit,
  );
}

// —— 难度反馈（v2）——
export function markAssessed(userId: string, levelCode: LevelCode): void {
  getDb().runSync(
    'UPDATE users SET level_code = ?, assessment_done = 1 WHERE id = ?',
    levelCode,
    userId,
  );
}

export function updateDifficulty(userId: string, levelCode: LevelCode, difficultyBias: number): void {
  getDb().runSync(
    'UPDATE users SET level_code = ?, difficulty_bias = ? WHERE id = ?',
    levelCode,
    difficultyBias,
    userId,
  );
}

export function insertDifficultyFeedback(userId: string, itemId: string | null, feedback: Feedback): void {
  getDb().runSync(
    'INSERT INTO difficulty_feedback (user_id, item_id, feedback, created_at) VALUES (?, ?, ?, ?)',
    userId,
    itemId,
    feedback,
    Date.now(),
  );
}

export function insertStudySession(
  id: string,
  userId: string,
  mode: string,
  itemCount: number,
): void {
  getDb().runSync(
    'INSERT INTO study_sessions (id, user_id, mode, item_count, created_at) VALUES (?, ?, ?, ?, ?)',
    id,
    userId,
    mode,
    itemCount,
    Date.now(),
  );
}

// —— 按语种的用户画像（v5，user_languages）——

export function getUserLanguage(userId: string, languageId: string): UserLanguage | null {
  return getDb().getFirstSync<UserLanguage>(
    `SELECT user_id AS userId, language_id AS languageId, level_code AS levelCode,
            difficulty_bias AS difficultyBias, skip_script_units AS skipScriptUnits,
            created_at AS createdAt
     FROM user_languages WHERE user_id = ? AND language_id = ?`,
    userId,
    languageId,
  );
}

export function listUserLanguages(userId: string): UserLanguage[] {
  return getDb().getAllSync<UserLanguage>(
    `SELECT user_id AS userId, language_id AS languageId, level_code AS levelCode,
            difficulty_bias AS difficultyBias, skip_script_units AS skipScriptUnits,
            created_at AS createdAt
     FROM user_languages WHERE user_id = ? ORDER BY created_at ASC`,
    userId,
  );
}

export function insertUserLanguage(
  userId: string,
  languageId: string,
  levelCode: string,
  skipScriptUnits = false,
): void {
  getDb().runSync(
    `INSERT OR IGNORE INTO user_languages
       (user_id, language_id, level_code, difficulty_bias, skip_script_units, created_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
    userId,
    languageId,
    levelCode,
    skipScriptUnits ? 1 : 0,
    Date.now(),
  );
}

export function updateUserLanguage(
  userId: string,
  languageId: string,
  patch: { levelCode?: string; difficultyBias?: number; skipScriptUnits?: boolean },
): void {
  const current = getUserLanguage(userId, languageId);
  if (!current) return;
  getDb().runSync(
    `UPDATE user_languages
     SET level_code = ?, difficulty_bias = ?, skip_script_units = ?
     WHERE user_id = ? AND language_id = ?`,
    patch.levelCode ?? current.levelCode,
    patch.difficultyBias ?? current.difficultyBias,
    patch.skipScriptUnits === undefined ? current.skipScriptUnits : patch.skipScriptUnits ? 1 : 0,
    userId,
    languageId,
  );
}

export function removeUserLanguage(userId: string, languageId: string): void {
  getDb().runSync('DELETE FROM user_languages WHERE user_id = ? AND language_id = ?', userId, languageId);
}

// —— App 级偏好（v5，app_preferences）——

export function getPreference(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>(
    'SELECT value FROM app_preferences WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export function setPreference(key: string, value: string): void {
  getDb().runSync(
    `INSERT INTO app_preferences (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}
