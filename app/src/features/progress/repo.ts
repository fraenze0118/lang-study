// 进度数据访问（v4）：作答事件读写 + 按本地日聚合
import { getDb } from '../../db/database';
import { AnswerStepKind } from '../../lib/types';
import { XP_REVIEW } from './xp';

export interface AnswerLogInput {
  sessionId?: string | null;
  itemId?: string | null;
  stepKind: AnswerStepKind;
  correct: boolean;
  xp: number;
}

export function insertAnswerLog(userId: string, input: AnswerLogInput): void {
  getDb().runSync(
    `INSERT INTO answer_logs (user_id, session_id, item_id, step_kind, correct, xp, answered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    userId,
    input.sessionId ?? null,
    input.itemId ?? null,
    input.stepKind,
    input.correct ? 1 : 0,
    Math.max(0, Math.round(input.xp)),
    Date.now(),
  );
}

export interface TimedXp {
  at: number;
  xp: number;
}

/** 练习/自评事件（时间戳 + 经验），用于在 JS 里按本地日分桶 */
export function getAnswerXpSince(userId: string, since: number): TimedXp[] {
  return getDb().getAllSync<TimedXp>(
    `SELECT answered_at AS at, xp FROM answer_logs WHERE user_id = ? AND answered_at >= ?`,
    userId,
    since,
  );
}

/** 复习事件：按 grade 折算经验（复用 XP_REVIEW，保证与实时计算一致） */
export function getReviewXpSince(userId: string, since: number): TimedXp[] {
  const rows = getDb().getAllSync<{ at: number; grade: string }>(
    `SELECT reviewed_at AS at, grade FROM review_logs WHERE user_id = ? AND reviewed_at >= ?`,
    userId,
    since,
  );
  return rows.map((r) => ({ at: r.at, xp: XP_REVIEW[r.grade as keyof typeof XP_REVIEW] ?? 0 }));
}

/** 有作答记录的最早时间（无记录返回 null） */
export function getEarliestActivityAt(userId: string): number | null {
  const row = getDb().getFirstSync<{ at: number | null }>(
    `SELECT MIN(at) AS at FROM (
       SELECT MIN(answered_at) AS at FROM answer_logs WHERE user_id = ?
       UNION ALL
       SELECT MIN(reviewed_at) AS at FROM review_logs WHERE user_id = ?
     )`,
    userId,
    userId,
  );
  return row?.at ?? null;
}
