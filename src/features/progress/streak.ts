// 每日目标与连续天数（纯函数，无 IO）
// 约定：日期一律用「设备本地时区」的自然日 YYYY-MM-DD 分桶。

export interface DayTotal {
  /** 'YYYY-MM-DD'（本地时区） */
  date: string;
  xp: number;
}

export interface StreakInfo {
  /** 连续达成每日目标的天数 */
  current: number;
  todayXp: number;
  todayDone: boolean;
  goalXp: number;
}

/** epoch ms → 本地时区自然日 'YYYY-MM-DD' */
export function localDateKey(epochMs: number): string {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 本地自然日 -1 天（用于「今天还没达成时从昨天开始数」） */
function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() - 1);
  return localDateKey(dt.getTime());
}

/**
 * 计算连续达成天数。
 *
 * 规则：
 * - goalXp <= 0 视为「不设目标」：current = 0，todayDone = true（UI 据此隐藏连续显示）
 * - todayDone = 今天的 xp >= goalXp
 * - 今天尚未达成**不立即清零**（这一天还没过完），此时从昨天开始向前数
 * - 从起点向前逐日检查 xp >= goalXp，遇到不达标的当天即停止
 */
export function computeStreak(days: DayTotal[], goalXp: number, todayKey: string): StreakInfo {
  const xpByDate = new Map<string, number>();
  for (const d of days) {
    xpByDate.set(d.date, (xpByDate.get(d.date) ?? 0) + d.xp);
  }
  const todayXp = xpByDate.get(todayKey) ?? 0;

  if (goalXp <= 0) {
    return { current: 0, todayXp, todayDone: true, goalXp };
  }

  const todayDone = todayXp >= goalXp;
  let cursor = todayDone ? todayKey : previousDateKey(todayKey);
  let current = 0;

  // 上限保护：即使传入异常数据也不会死循环（10 年）
  for (let guard = 0; guard < 3660; guard++) {
    const xp = xpByDate.get(cursor) ?? 0;
    if (xp < goalXp) break;
    current += 1;
    cursor = previousDateKey(cursor);
  }

  return { current, todayXp, todayDone, goalXp };
}

/** 近 N 天（含今天）的日期键，从旧到新 */
export function recentDateKeys(todayKey: string, count: number): string[] {
  const keys: string[] = [];
  let cursor = todayKey;
  for (let i = 0; i < count; i++) {
    keys.unshift(cursor);
    cursor = previousDateKey(cursor);
  }
  return keys;
}

/**
 * 近 N 天（含今天）中最早那一天的本地 00:00 对应的 epoch ms。
 * 用于把 SQL 查询下推到时间范围，避免全表扫描。
 */
export function startOfRecentWindow(todayKey: string, count: number): number {
  if (count <= 1) return dateKeyToLocalStart(todayKey);
  const keys = recentDateKeys(todayKey, count);
  return dateKeyToLocalStart(keys[0]);
}

/** 'YYYY-MM-DD' → 本地当天 00:00 的 epoch ms */
export function dateKeyToLocalStart(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0).getTime();
}
