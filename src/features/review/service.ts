// 复习服务（M2）：FSRS 评分排程 + 到期复习队列
import { getDb } from '../../db/database';
import { DueReviewSummary, getDueReviews, getStateById } from '../../db/userRepo';
import { cardToSnapshot, masteryFromFsrsState, schedule, snapshotToCard } from '../../fsrs';
import { MasteryState, ReviewGrade } from '../../lib/enums';

export interface GradeResult {
  due: number; // epoch ms
  stability: number;
  difficulty: number;
  masteryState: MasteryState;
}

export function grade(stateId: number, g: ReviewGrade, elapsedMs: number): GradeResult {
  const state = getStateById(stateId);
  if (!state) throw new Error('复习状态不存在');

  const card = snapshotToCard({
    fsrsState: state.fsrsState,
    stability: state.stability,
    difficulty: state.difficulty,
    due: state.due,
    lastReviewAt: state.lastReviewAt,
    reps: state.reps,
    lapses: state.lapses,
  });

  const now = new Date();
  const nextCard = schedule(card, now, g);
  const snap = cardToSnapshot(nextCard);
  const masteryState = masteryFromFsrsState(nextCard.state);

  const db = getDb();
  db.runSync(
    `UPDATE user_item_states
     SET mastery_state = ?, fsrs_state = ?, stability = ?, difficulty = ?,
         due = ?, last_review_at = ?, reps = ?, lapses = ?
     WHERE id = ?`,
    masteryState,
    snap.fsrsState,
    snap.stability,
    snap.difficulty,
    snap.due,
    snap.lastReviewAt,
    snap.reps,
    snap.lapses,
    stateId,
  );
  db.runSync(
    'INSERT INTO review_logs (user_id, item_id, grade, elapsed_ms, reviewed_at) VALUES (?, ?, ?, ?, ?)',
    state.userId,
    state.itemId,
    g,
    elapsedMs,
    now.getTime(),
  );

  return {
    due: snap.due ?? Date.now(),
    stability: snap.stability,
    difficulty: snap.difficulty,
    masteryState,
  };
}

export function getQueue(userId: string, limit = 50): DueReviewSummary[] {
  return getDueReviews(userId, limit);
}
