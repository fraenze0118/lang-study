// 学习服务（M1）：生成每日学习包，AI 讲解/例句/练习
import { chatJson } from '../../ai/client';
import {
  buildLearnPackagePrompt,
  LearnPackageResponse,
  LearnPackageResponseSchema,
  systemPrompt,
} from '../../ai/prompts';
import {
  getItemsByUnit,
  getItemsWithoutState,
  getLevelByCode,
  getUnit,
  getUnits,
  insertExample,
} from '../../db/repo';
import { createUserItemStates, getDueReviews, getOrCreateUser } from '../../db/userRepo';
import { ItemType } from '../../lib/enums';
import { Item, Unit } from '../../lib/types';

export interface ItemSummary {
  itemId: string;
  type: ItemType;
  surface: string;
  reading: string;
  meaning: string;
}

export interface Example {
  ja: string;
  kana: string;
  zh: string;
}

export interface Lesson {
  itemId: string;
  explanation: string;
  examples: Example[];
}

export interface GrammarLesson {
  explanation: string;
  structure: string;
  tips: string;
  examples: Example[];
}

export interface Exercise {
  type: 'choice' | 'fill' | 'translate';
  prompt: string;
  options?: string[] | null;
  answer: string;
  explanation: string;
}

export interface LearnPackage {
  packageId: string;
  unit: { id: string; title: string };
  newWords: ItemSummary[];
  grammarPoint: { itemId: string; surface: string; pattern: string; meaning: string } | null;
  lessons: Lesson[];
  grammar: GrammarLesson | null;
  exercises: Exercise[];
}

export interface TodayTask {
  newItems: ItemSummary[];
  dueReviews: ItemSummary[];
}

export const DEFAULT_USER_ID = 'local';

export function getToday(userId = DEFAULT_USER_ID): TodayTask {
  const user = getOrCreateUser(userId);
  const levelId = getLevelByCode('ja', user.levelCode)?.id;
  if (!levelId) return { newItems: [], dueReviews: [] };

  const units = getUnits(levelId);
  let newItems: ItemSummary[] = [];
  for (const unit of units) {
    const unlearned = getItemsWithoutState(userId, unit.id);
    if (unlearned.length > 0) {
      newItems = unlearned.slice(0, user.sessionSize).map(toSummary);
      break;
    }
  }

  const dueReviews = getDueReviews(userId).map((d) => ({
    itemId: d.itemId,
    type: d.type,
    surface: d.surface,
    reading: d.reading,
    meaning: d.meaning,
  }));
  return { newItems, dueReviews };
}

export async function generatePackage(
  userId = DEFAULT_USER_ID,
  unitId?: string,
): Promise<LearnPackage> {
  const user = getOrCreateUser(userId);
  const levelId = getLevelByCode('ja', user.levelCode)?.id;
  if (!levelId) throw new Error('未找到当前等级的配置');

  const units = getUnits(levelId);
  const unit = unitId ? getUnit(unitId) : pickUnitWithUnlearned(userId, units);
  if (!unit) throw new Error('没有可学习的单元（可能已全部学完）');

  const unlearned = getItemsWithoutState(userId, unit.id);
  const words = unlearned.filter((i) => i.type === 'word').slice(0, user.sessionSize);
  const grammar = unlearned.find((i) => i.type === 'grammar') ?? null;

  const resp = await chatJson<LearnPackageResponse>(
    [
      { role: 'system', content: systemPrompt(user.levelCode) },
      {
        role: 'user',
        content: buildLearnPackagePrompt({
          levelCode: user.levelCode,
          unitTitle: unit.title,
          words,
          grammar,
        }),
      },
    ],
    LearnPackageResponseSchema,
  );

  // 首次学习后落库：标记 learning + 保存 AI 例句
  const learnedIds = [...words.map((w) => w.id), ...(grammar ? [grammar.id] : [])];
  if (learnedIds.length > 0) createUserItemStates(userId, learnedIds);
  persistExamples(resp);

  return {
    packageId: `${unit.id}-${Date.now()}`,
    unit: { id: unit.id, title: unit.title },
    newWords: words.map(toSummary),
    grammarPoint: grammar
      ? {
          itemId: grammar.id,
          surface: grammar.surface,
          pattern: grammar.pattern ?? '',
          meaning: grammar.meaning,
        }
      : null,
    lessons: resp.lessons,
    grammar: resp.grammar
      ? {
          explanation: resp.grammar.explanation,
          structure: resp.grammar.structure,
          tips: resp.grammar.tips,
          examples: resp.grammar.examples,
        }
      : null,
    exercises: resp.exercises,
  };
}

function pickUnitWithUnlearned(userId: string, units: Unit[]): Unit | null {
  for (const unit of units) {
    if (getItemsWithoutState(userId, unit.id).length > 0) return unit;
  }
  return null;
}

function toSummary(i: Item): ItemSummary {
  return { itemId: i.id, type: i.type, surface: i.surface, reading: i.reading, meaning: i.meaning };
}

function persistExamples(resp: LearnPackageResponse): void {
  for (const lesson of resp.lessons) {
    for (const ex of lesson.examples) {
      insertExample(lesson.itemId, ex.ja, ex.kana, ex.zh, 'ai');
    }
  }
  if (resp.grammar) {
    for (const ex of resp.grammar.examples) {
      insertExample(resp.grammar.itemId, ex.ja, ex.kana, ex.zh, 'ai');
    }
  }
}
