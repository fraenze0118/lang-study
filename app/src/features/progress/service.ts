// 进度服务：记录作答经验、聚合每日经验、给出概览（连续天数 + 今日目标 + 统计）
//
// 重要边界：每日经验与连续天数**跨语种共享**（换语种学习不应断签）。
// 按语种隔离的是知识库/复习/统计，见 features/knowledge 与 userRepo 的 languageId 参数。
import { getOrCreateUser, getProgressStats } from '../../db/userRepo';
import { DEFAULT_USER_ID } from '../../lib/constants';
import { getActiveLanguageId } from '../profile/languageService';
import { AnswerLogInput, getAnswerXpSince, getReviewXpSince, insertAnswerLog } from './repo';
import { computeStreak, DayTotal, localDateKey, startOfRecentWindow, StreakInfo } from './streak';

export type { DayTotal, StreakInfo } from './streak';

/** 记录一次练习作答 / 自评（复习评分走 review_logs，不在这里重复记） */
export function logAnswer(userId: string, input: AnswerLogInput): void {
  insertAnswerLog(userId, input);
}

/**
 * 每日经验总量（answer_logs + review_logs）。
 * @param days 回溯天数（含今天）
 *
 * 时区换算在 JS 侧完成（SQL 里做本地日聚合很别扭），因此 SQL 只做时间范围过滤，
 * 数据量在这个 App 的规模下完全可接受。
 */
export function getDayTotals(userId: string, days: number): DayTotal[] {
  const now = Date.now();
  // 边界按本地自然日 00:00 取，避免 DST / 跨月时用 24h 近似导致首日漏算
  const earliest = startOfRecentWindow(localDateKey(now), Math.max(1, days));

  const totals = new Map<string, number>();
  const add = (at: number, xp: number) => {
    const key = localDateKey(at);
    totals.set(key, (totals.get(key) ?? 0) + xp);
  };

  for (const row of getAnswerXpSince(userId, earliest)) add(row.at, row.xp);
  for (const row of getReviewXpSince(userId, earliest)) add(row.at, row.xp);

  return [...totals.entries()]
    .map(([date, xp]) => ({ date, xp }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface ProgressOverview {
  streak: StreakInfo;
  xpToday: number;
  /** 以下三项为**当前语种**的统计 */
  languageId: string;
  learnedCount: number;
  masteredCount: number;
  dueCount: number;
}

/** 首页状态条与结算页共用的概览 */
export function getOverview(
  userId: string = DEFAULT_USER_ID,
  streakWindowDays = 370,
): ProgressOverview {
  const user = getOrCreateUser(userId);
  const languageId = getActiveLanguageId();
  const stats = getProgressStats(userId, languageId);
  const days = getDayTotals(userId, streakWindowDays);
  const streak = computeStreak(days, user.dailyGoalXp, localDateKey(Date.now()));

  return {
    streak,
    xpToday: streak.todayXp,
    languageId,
    learnedCount: stats.learnedCount,
    masteredCount: stats.masteredCount,
    dueCount: stats.dueCount,
  };
}
