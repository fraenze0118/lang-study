// 学习会话 → 步骤序列（纯函数）
// 目的：把「一屏堆全部」改成「一屏一步」的串行流程，同时不改动任何生成/落库逻辑。
import type { LearnPackageResponse } from '../../ai/prompts';
import type { Exercise } from '../../lib/types';
import type { StudyItem, StudySessionData } from './service';

type Lesson = LearnPackageResponse['lessons'][number];
type GrammarLesson = NonNullable<LearnPackageResponse['grammar']>;

export type StudyStep =
  | { kind: 'intro' }
  | { kind: 'word'; index: number; item: StudyItem }
  | { kind: 'lesson'; index: number; item: StudyItem | null; lesson: Lesson }
  | { kind: 'grammar'; grammar: GrammarLesson }
  | { kind: 'exercise'; index: number; exercise: Exercise }
  | { kind: 'summary' };

/**
 * 构建步骤序列：
 * intro → 每个条目一张卡（有对应讲解时合并成 lesson 卡，避免同一词重复展示）
 *       → grammar（若有） → 每道练习 → summary
 *
 * 必须保持纯函数且结果稳定：同一 session 多次调用返回等长、同序数组（进度条依赖它）。
 */
export function buildSteps(session: StudySessionData): StudyStep[] {
  const steps: StudyStep[] = [{ kind: 'intro' }];

  const lessonsByItem = new Map<string, Lesson>();
  for (const lesson of session.lessons) {
    // 同一 itemId 只取第一条，避免重复步骤
    if (!lessonsByItem.has(lesson.itemId)) lessonsByItem.set(lesson.itemId, lesson);
  }

  session.items.forEach((item, index) => {
    const lesson = lessonsByItem.get(item.id);
    if (lesson) {
      lessonsByItem.delete(item.id);
      steps.push({ kind: 'lesson', index, item, lesson });
    } else {
      steps.push({ kind: 'word', index, item });
    }
  });

  // 兜底：AI 返回了本批之外的 itemId 时也要展示，否则用户看不到已生成的内容
  for (const lesson of lessonsByItem.values()) {
    steps.push({ kind: 'lesson', index: steps.length, item: null, lesson });
  }

  if (session.grammar) {
    steps.push({ kind: 'grammar', grammar: session.grammar });
  }

  session.exercises.forEach((exercise, index) => {
    steps.push({ kind: 'exercise', index, exercise });
  });

  steps.push({ kind: 'summary' });
  return steps;
}

/** 本批需要作答的题目数（结算与进度用） */
export function countExerciseSteps(steps: StudyStep[]): number {
  return steps.filter((s) => s.kind === 'exercise').length;
}
