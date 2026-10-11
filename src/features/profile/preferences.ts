// 用户偏好（存于 users.interests 的 JSON 字符串）
// 单独成文件：它是纯函数，不需要碰 DB，这样单测可以直接导入而不拉起 expo-sqlite。
//
// 注意：多语种改造后，"是否跳过字母入门单元"已迁到 user_languages.skip_script_units
// （按语种独立）。这里保留 skipKanaUnits 只是为了兼容旧数据读取。

export interface UserPreferences {
  /** @deprecated 已迁到 user_languages.skip_script_units */
  skipKanaUnits?: boolean;
}

/** 容错解析：null / 非 JSON / 非对象一律退化为空偏好 */
export function readPreferences(interestsJson: string | null): UserPreferences {
  if (!interestsJson) return {};
  try {
    const parsed: unknown = JSON.parse(interestsJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as UserPreferences;
  } catch {
    return {};
  }
}

export function writePreferences(prefs: UserPreferences): string {
  return JSON.stringify(prefs);
}
