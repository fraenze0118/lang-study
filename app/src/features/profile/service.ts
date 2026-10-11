// 画像服务：全局偏好（目标 / 每批条数 / 每日目标）+ 按语种的水平与难度
//
// 注意：水平与难度偏移**不再写 users 表**，一律走 user_languages（见 languageService）。
// users.level_code / difficulty_bias 是已废弃的全局单一水平，新代码不得读写。
import { getDb } from '../../db/database';
import {
  getOrCreateUser,
  getUser,
  insertDifficultyFeedback,
  updateDailyGoal as updateDailyGoalRow,
} from '../../db/userRepo';
import { Feedback, Goal } from '../../lib/enums';
import { shiftLevelCode } from '../../lib/languages';
import { User } from '../../lib/types';
import { DEFAULT_USER_ID } from '../../lib/constants';
import { ensureUserLanguage, getActiveContext, updateLanguageProfile } from './languageService';

/** 只包含全局（不按语种）的偏好 */
export interface ProfilePatch {
  goal?: Goal;
  sessionSize?: number;
  interests?: string | null;
}

export function getProfile(userId = DEFAULT_USER_ID): User {
  return getOrCreateUser(userId);
}

export function updateProfile(userId: string, patch: ProfilePatch): User {
  const current = getOrCreateUser(userId);
  const goal = patch.goal ?? current.goal;
  const sessionSize = patch.sessionSize ?? current.sessionSize;
  const interests = patch.interests !== undefined ? patch.interests : current.interests;

  getDb().runSync(
    'UPDATE users SET goal = ?, session_size = ?, interests = ? WHERE id = ?',
    goal,
    sessionSize,
    interests,
    userId,
  );
  return getUser(userId)!;
}

export function updateDailyGoal(userId: string, dailyGoalXp: number): void {
  updateDailyGoalRow(userId, dailyGoalXp);
}

/**
 * 用户自选初始水平（不再做逐题测评）。
 * 只影响**指定语种**；难度偏移归零，避免与旧评估残留叠加。
 */
export function setInitialLevel(
  userId: string,
  languageId: string,
  level: string,
  skipScriptUnits: boolean,
): void {
  ensureUserLanguage(userId, languageId, level);
  updateLanguageProfile(userId, languageId, {
    levelCode: level,
    difficultyBias: 0,
    skipScriptUnits,
  });
  getDb().runSync('UPDATE users SET assessment_done = 1 WHERE id = ?', userId);
}

/**
 * 难度反馈：too_easy → bias+1；too_hard → bias-1；越界则升降级（按语种）。
 * just_right 只记录，不改状态。
 */
export function applyDifficultyFeedback(
  userId: string,
  feedback: Feedback,
  languageId?: string,
): User {
  const ctx = getActiveContext(userId);
  const targetLanguage = languageId ?? ctx.languageId;

  let bias = ctx.difficultyBias;
  let level = ctx.levelCode;

  if (feedback === 'too_easy') bias += 1;
  if (feedback === 'too_hard') bias -= 1;
  if (bias > 2) {
    level = shiftLevelCode(targetLanguage, level, +1);
    bias = 0;
  }
  if (bias < -2) {
    level = shiftLevelCode(targetLanguage, level, -1);
    bias = 0;
  }

  updateLanguageProfile(userId, targetLanguage, { levelCode: level, difficultyBias: bias });
  insertDifficultyFeedback(userId, null, feedback);
  return getUser(userId) ?? getOrCreateUser(userId);
}
