// 活跃语种 + 按语种画像：页面与服务层统一通过 getActiveContext() 取上下文。
import {
  getOrCreateUser,
  getPreference,
  getUser,
  getUserLanguage,
  insertUserLanguage,
  listUserLanguages,
  setPreference,
  updateUserLanguage,
} from '../../db/userRepo';
import {
  DEFAULT_LANGUAGE_ID,
  getDefaultLevelCode,
  getLanguageProfile,
  hasLanguageProfile,
  LanguageProfile,
} from '../../lib/languages';
import { DEFAULT_USER_ID } from '../../lib/constants';

const ACTIVE_LANGUAGE_KEY = 'active_language_id';

/** 当前活跃语种 id；缺失或未知时回退默认语种 */
export function getActiveLanguageId(): string {
  try {
    const stored = getPreference(ACTIVE_LANGUAGE_KEY);
    if (stored && hasLanguageProfile(stored)) return stored;
  } catch {
    // 读偏好失败（如库未初始化）时回退
  }
  return DEFAULT_LANGUAGE_ID;
}

export function setActiveLanguageId(languageId: string): void {
  if (!hasLanguageProfile(languageId)) return;
  setPreference(ACTIVE_LANGUAGE_KEY, languageId);
}

export interface ActiveContext {
  languageId: string;
  profile: LanguageProfile;
  /** 当前语种下的水平 */
  levelCode: string;
  /** 当前语种下的难度偏移 */
  difficultyBias: number;
  /** 每批条目数（全局偏好） */
  sessionSize: number;
  /** 是否跳过字母入门单元（按语种） */
  skipScriptUnits: boolean;
}

/**
 * 保证该用户在该语种下有画像行；没有则用 profile 的入门等级建一行。
 */
export function ensureUserLanguage(userId: string, languageId: string, levelCode?: string) {
  getOrCreateUser(userId);
  const existing = getUserLanguage(userId, languageId);
  if (existing) return existing;
  const level = levelCode ?? getDefaultLevelCode(languageId);
  insertUserLanguage(userId, languageId, level, false);
  return getUserLanguage(userId, languageId)!;
}

/** 页面与服务层的主入口 */
export function getActiveContext(userId: string = DEFAULT_USER_ID): ActiveContext {
  const languageId = getActiveLanguageId();
  const profile = getLanguageProfile(languageId);
  const user = getOrCreateUser(userId);
  const row = ensureUserLanguage(userId, languageId);
  return {
    languageId,
    profile,
    levelCode: row.levelCode,
    difficultyBias: row.difficultyBias,
    sessionSize: user.sessionSize,
    skipScriptUnits: row.skipScriptUnits === 1,
  };
}

export function updateLanguageProfile(
  userId: string,
  languageId: string,
  patch: { levelCode?: string; difficultyBias?: number; skipScriptUnits?: boolean },
): void {
  ensureUserLanguage(userId, languageId, patch.levelCode);
  updateUserLanguage(userId, languageId, patch);
}

/** 用户已添加的语种（用于设置页列出"我在学哪些语种"） */
export function listMyLanguages(
  userId: string = DEFAULT_USER_ID,
): { languageId: string; profile: LanguageProfile; levelCode: string }[] {
  return listUserLanguages(userId)
    .filter((r) => hasLanguageProfile(r.languageId))
    .map((r) => ({
      languageId: r.languageId,
      profile: getLanguageProfile(r.languageId),
      levelCode: r.levelCode,
    }));
}

/** 把一个语种加入用户的学习列表（不改变当前活跃语种） */
export function addLanguage(userId: string, languageId: string, levelCode?: string): void {
  if (!hasLanguageProfile(languageId)) return;
  ensureUserLanguage(userId, languageId, levelCode);
}

export function getUserRecord(userId: string = DEFAULT_USER_ID) {
  return getUser(userId) ?? getOrCreateUser(userId);
}
