// 画像服务：读取/更新画像 + 难度反馈 + 水平评估（v2）
import { chatJson } from '../../ai/client';
import {
  AssessmentQuestionResult,
  AssessmentQuestionSchema,
  buildAssessmentPrompt,
  systemPrompt,
} from '../../ai/prompts';
import { getDb } from '../../db/database';
import {
  getUser,
  getOrCreateUser,
  insertDifficultyFeedback,
  markAssessed,
  updateDifficulty,
} from '../../db/userRepo';
import { Feedback, Goal, LEVEL_CODES, LevelCode } from '../../lib/enums';
import { User } from '../../lib/types';
import { DEFAULT_USER_ID } from '../learn/service';

export interface ProfilePatch {
  goal?: Goal;
  levelCode?: LevelCode;
  sessionSize?: number;
  difficultyBias?: number;
  interests?: string | null;
}

export interface AssessmentQuestion {
  id: string;
  level: LevelCode;
  prompt: string;
  options: string[];
  answer: string;
}

export function getProfile(userId = DEFAULT_USER_ID): User {
  return getOrCreateUser(userId);
}

export function updateProfile(userId: string, patch: ProfilePatch): User {
  const current = getOrCreateUser(userId);
  const goal = patch.goal ?? current.goal;
  const levelCode = patch.levelCode ?? current.levelCode;
  const sessionSize = patch.sessionSize ?? current.sessionSize;
  const difficultyBias = patch.difficultyBias ?? current.difficultyBias;
  const interests = patch.interests !== undefined ? patch.interests : current.interests;

  getDb().runSync(
    'UPDATE users SET goal = ?, level_code = ?, session_size = ?, difficulty_bias = ?, interests = ? WHERE id = ?',
    goal,
    levelCode,
    sessionSize,
    difficultyBias,
    interests,
    userId,
  );
  return getUser(userId)!;
}

// 难度反馈：too_easy → bias+1；too_hard → bias-1；越界则升降级
export function applyDifficultyFeedback(userId: string, feedback: Feedback): User {
  const current = getOrCreateUser(userId);
  let bias = current.difficultyBias;
  let level = current.levelCode;

  if (feedback === 'too_easy') bias += 1;
  if (feedback === 'too_hard') bias -= 1;
  if (bias > 2) {
    level = shiftLevel(level, +1);
    bias = 0;
  }
  if (bias < -2) {
    level = shiftLevel(level, -1);
    bias = 0;
  }

  updateDifficulty(userId, level, bias);
  insertDifficultyFeedback(userId, null, feedback);
  return getUser(userId)!;
}

export function shiftLevel(level: LevelCode, delta: number): LevelCode {
  const idx = LEVEL_CODES.indexOf(level);
  const next = Math.min(LEVEL_CODES.length - 1, Math.max(0, idx + delta));
  return LEVEL_CODES[next];
}

// 生成一道指定等级的评估题
export async function generateAssessmentQuestion(
  level: LevelCode,
  userId = DEFAULT_USER_ID,
): Promise<AssessmentQuestion> {
  const user = getOrCreateUser(userId);
  const resp = await chatJson<AssessmentQuestionResult>(
    [
      { role: 'system', content: systemPrompt(user.levelCode, user.difficultyBias) },
      { role: 'user', content: buildAssessmentPrompt(level) },
    ],
    AssessmentQuestionSchema,
  );
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level: (resp.level as LevelCode) ?? level,
    prompt: resp.prompt,
    options: resp.options,
    answer: resp.answer,
  };
}

// 完成评估：写入等级 + 标记已评估
export function completeAssessment(userId: string, level: LevelCode): User {
  markAssessed(userId, level);
  return getUser(userId)!;
}
