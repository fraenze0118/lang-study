// 用户、学习状态、难度反馈数据访问
import { State } from 'ts-fsrs';
import { getDb } from './database';
import { Feedback, ItemType, LevelCode } from '../lib/enums';
import { User, UserItemState } from '../lib/types';

export function getUser(id: string): User | null {
  return getDb().getFirstSync<User>(
    `SELECT id, native_language AS nativeLanguage, level_code AS levelCode,
            difficulty_bias AS difficultyBias, goal, session_size AS sessionSize,
            interests, assessment_done AS assessmentDone
     FROM users WHERE id = ?`,
    id,
  );
}

export function createUser(user: User): void {
  getDb().runSync(
    `INSERT INTO users (id, native_language, level_code, difficulty_bias, goal, session_size, interests, assessment_done)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    user.id,
    user.nativeLanguage,
    user.levelCode,
    user.difficultyBias,
    user.goal,
    user.sessionSize,
    user.interests,
    user.assessmentDone,
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
  };
  createUser(user);
  return user;
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
  limit = 20,
): { surface: string; meaning: string }[] {
  return getDb().getAllSync<{ surface: string; meaning: string }>(
    `SELECT i.surface, i.meaning
     FROM user_item_states s
     JOIN items i ON i.id = s.item_id
     WHERE s.user_id = ?
     ORDER BY s.last_review_at DESC, s.id DESC
     LIMIT ?`,
    userId,
    limit,
  );
}

export interface ProgressStats {
  learnedCount: number;
  masteredCount: number;
  dueCount: number;
}

export function getProgressStats(userId: string): ProgressStats {
  const row = getDb().getFirstSync<{ learned: number; mastered: number; due: number }>(
    `SELECT
       COUNT(*) AS learned,
       SUM(CASE WHEN mastery_state = 'mastered' THEN 1 ELSE 0 END) AS mastered,
       SUM(CASE WHEN due <= ? AND mastery_state != 'new' THEN 1 ELSE 0 END) AS due
     FROM user_item_states WHERE user_id = ?`,
    Date.now(),
    userId,
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

export function getLearnedItems(userId: string): LearnedItem[] {
  return getDb().getAllSync<LearnedItem>(
    `SELECT i.id AS itemId, i.surface, i.reading, i.meaning, s.mastery_state AS masteryState
     FROM user_item_states s
     JOIN items i ON i.id = s.item_id
     WHERE s.user_id = ?
     ORDER BY s.id DESC`,
    userId,
  );
}

export interface KnowledgeItem {
  itemId: string;
  type: ItemType;
  surface: string;
  reading: string;
  meaning: string;
  levelCode: string | null;
  masteryState: string;
}

export function getKnowledgeItems(userId: string): KnowledgeItem[] {
  return getDb().getAllSync<KnowledgeItem>(
    `SELECT i.id AS itemId, i.type, i.surface, i.reading, i.meaning,
            i.level_code AS levelCode, s.mastery_state AS masteryState
     FROM user_item_states s
     JOIN items i ON i.id = s.item_id
     WHERE s.user_id = ?
     ORDER BY s.id DESC`,
    userId,
  );
}

export function getDueReviews(userId: string, limit = 100): DueReviewSummary[] {
  return getDb().getAllSync<DueReviewSummary>(
    `SELECT s.id AS stateId, s.item_id AS itemId, i.type, i.surface, i.reading, i.meaning
     FROM user_item_states s
     JOIN items i ON i.id = s.item_id
     WHERE s.user_id = ? AND s.due <= ? AND s.mastery_state != 'new'
     ORDER BY s.due ASC
     LIMIT ?`,
    userId,
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
