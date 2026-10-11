// 经验值规则（纯函数）：单一事实来源，改数值只改这里
import { ReviewGrade } from '../../lib/enums';

/** 答对一道练习的基础经验 */
export const XP_CORRECT = 10;
/** 练完一整批（进入结算页）的额外奖励 */
export const XP_SESSION_BONUS = 20;
/** 连击达到该值后才开始有额外加成 */
export const XP_COMBO_THRESHOLD = 3;
/** 连击每超出一档追加的经验 */
export const XP_COMBO_BONUS_STEP = 2;

/** 复习四档评分对应经验：忘了也给一点，避免惩罚感过强 */
export const XP_REVIEW: Record<ReviewGrade, number> = {
  Again: 1,
  Hard: 3,
  Good: 5,
  Easy: 5,
};

/**
 * 单次作答经验。
 * @param correct 是否答对
 * @param comboAfter 计入本次之后的连击数（答对时 = 连击+1；答错传 0）
 */
export function xpForAnswer(correct: boolean, comboAfter: number): number {
  if (!correct) return 0;
  const base = XP_CORRECT;
  if (comboAfter > XP_COMBO_THRESHOLD) {
    return base + (comboAfter - XP_COMBO_THRESHOLD + 1) * XP_COMBO_BONUS_STEP;
  }
  return base;
}

/** 结算页经验 = 逐题经验之和 + 整批奖励 */
export function xpForSession(answerXpSum: number, total: number): number {
  return answerXpSum + (total > 0 ? XP_SESSION_BONUS : 0);
}

export function isSessionPerfect(correctCount: number, total: number): boolean {
  return total > 0 && correctCount === total;
}

/** 正确率，分母为 0 时返回 null（UI 显示「—」而不是 NaN） */
export function accuracy(correctCount: number, total: number): number | null {
  if (total <= 0) return null;
  return correctCount / total;
}
