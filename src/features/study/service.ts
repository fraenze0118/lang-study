// 学习会话服务：AI 推荐 / 自定义生成 + 沉浸学习 + 落库进复习 + 预取下一批
import { chatJson } from '../../ai/client';
import {
  buildContentPreviewPrompt,
  buildStudySessionPrompt,
  ContentPreviewResult,
  ContentPreviewSchema,
  LearnPackageResponse,
  LearnPackageResponseSchema,
  systemPrompt,
} from '../../ai/prompts';
import {
  getItem,
  getItemsWithoutState,
  getLevelByCode,
  getUnits,
  insertExample,
  insertItem,
} from '../../db/repo';
import {
  createUserItemStates,
  getOrCreateUser,
  getRecentLearnedItems,
  insertStudySession,
} from '../../db/userRepo';
import { LevelCode, Pos, StudyMode } from '../../lib/enums';
import { Item } from '../../lib/types';
import { DEFAULT_USER_ID } from '../learn/service';

export interface PreviewItem {
  itemId?: string;
  surface: string;
  reading: string;
  pos: string | null;
  meaning: string;
  level: string;
  isNew: boolean;
}

export interface PreviewGrammar {
  surface: string;
  pattern: string;
  meaning: string;
}

export interface ContentPreview {
  mode: StudyMode;
  topic?: string;
  items: PreviewItem[];
  grammar: PreviewGrammar | null;
  reason: string;
}

export interface StudyItem {
  id: string;
  surface: string;
  reading: string;
  pos: string | null;
  meaning: string;
}

export interface StudySessionData {
  sessionId: string;
  mode: StudyMode;
  items: StudyItem[];
  grammarItemId: string | null;
  lessons: LearnPackageResponse['lessons'];
  grammar: LearnPackageResponse['grammar'];
  exercises: LearnPackageResponse['exercises'];
}

// 推荐模式：优先取大纲未学单词；无则 AI 生成（DB 驱动 + AI 兜底）
export async function suggestPreview(userId = DEFAULT_USER_ID): Promise<ContentPreview> {
  const user = getOrCreateUser(userId);
  const levelId = getLevelByCode('ja', user.levelCode)?.id;
  const items: PreviewItem[] = [];

  if (levelId) {
    const units = getUnits(levelId);
    for (const unit of units) {
      for (const it of getItemsWithoutState(userId, unit.id)) {
        if (it.type !== 'word') continue;
        items.push({
          itemId: it.id,
          surface: it.surface,
          reading: it.reading,
          pos: it.pos,
          meaning: it.meaning,
          level: user.levelCode,
          isNew: false,
        });
        if (items.length >= user.sessionSize) break;
      }
      if (items.length >= user.sessionSize) break;
    }
  }

  if (items.length > 0) {
    return { mode: 'suggest', items, grammar: null, reason: '根据你的水平，推荐这些未学单词' };
  }
  return generateAiPreview(userId, undefined, 'suggest');
}

// 自定义模式：AI 生成新条目预览
export async function generateCustomPreview(
  topic: string,
  userId = DEFAULT_USER_ID,
): Promise<ContentPreview> {
  return generateAiPreview(userId, topic, 'custom');
}

async function generateAiPreview(
  userId: string,
  topic: string | undefined,
  mode: StudyMode,
): Promise<ContentPreview> {
  const user = getOrCreateUser(userId);
  const known = getRecentLearnedItems(userId, 30)
    .map((k) => `${k.surface}(${k.meaning})`)
    .join('、');

  const resp = await chatJson<ContentPreviewResult>(
    [
      { role: 'system', content: systemPrompt(user.levelCode, user.difficultyBias) },
      {
        role: 'user',
        content: buildContentPreviewPrompt({
          mode: mode === 'custom' ? 'custom' : 'suggest',
          topic,
          levelCode: user.levelCode,
          difficultyBias: user.difficultyBias,
          known,
          count: user.sessionSize,
        }),
      },
    ],
    ContentPreviewSchema,
  );

  return {
    mode,
    topic,
    items: resp.items.map((i) => ({
      surface: i.surface,
      reading: i.reading,
      pos: i.pos ?? null,
      meaning: i.meaning,
      level: i.level,
      isNew: true, // AI 生成的预览条目一律为新条目
    })),
    grammar: resp.grammar
      ? { surface: resp.grammar.surface, pattern: resp.grammar.pattern, meaning: resp.grammar.meaning }
      : null,
    reason: resp.reason,
  };
}

// 生成学习内容（插入 AI 条目、保存例句），但不标记已学
export async function generateSessionData(input: {
  mode: StudyMode;
  preview: ContentPreview;
  userId?: string;
}): Promise<StudySessionData> {
  const userId = input.userId ?? DEFAULT_USER_ID;
  const user = getOrCreateUser(userId);

  const items: StudyItem[] = [];
  for (const p of input.preview.items) {
    if (p.isNew || !p.itemId) {
      const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: Item = {
        id,
        unitId: null,
        type: 'word',
        surface: p.surface,
        reading: p.reading,
        accent: null,
        pos: (p.pos as Pos) ?? null,
        conjugation: null,
        transitivity: null,
        meaning: p.meaning,
        pattern: null,
        grammarCategory: null,
        onyomiKunyomi: null,
        relatedItemIds: null,
        source: 'ai',
        levelCode: (p.level as LevelCode) ?? user.levelCode,
        createdAt: Date.now(),
        sortOrder: 0,
      };
      if (validateItem(item)) {
        insertItem(item);
        items.push({ id, surface: p.surface, reading: p.reading, pos: p.pos, meaning: p.meaning });
      }
    } else {
      const existing = getItem(p.itemId);
      if (existing) {
        items.push({
          id: existing.id,
          surface: existing.surface,
          reading: existing.reading,
          pos: existing.pos,
          meaning: existing.meaning,
        });
      }
    }
  }

  // 语法点也作为条目落库
  let grammarWithId: { id: string; surface: string; pattern: string; meaning: string } | null = null;
  if (input.preview.grammar) {
    const g = input.preview.grammar;
    const gid = `ai-grammar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    insertItem({
      id: gid,
      unitId: null,
      type: 'grammar',
      surface: g.surface,
      reading: g.surface,
      accent: null,
      pos: null,
      conjugation: null,
      transitivity: null,
      meaning: g.meaning,
      pattern: g.pattern,
      grammarCategory: null,
      onyomiKunyomi: null,
      relatedItemIds: null,
      source: 'ai',
      levelCode: user.levelCode,
      createdAt: Date.now(),
      sortOrder: 0,
    });
    grammarWithId = { id: gid, surface: g.surface, pattern: g.pattern, meaning: g.meaning };
  }

  if (items.length === 0 && !grammarWithId) throw new Error('没有可学习的条目');

  const resp = await chatJson<LearnPackageResponse>(
    [
      { role: 'system', content: systemPrompt(user.levelCode, user.difficultyBias) },
      {
        role: 'user',
        content: buildStudySessionPrompt({
          levelCode: user.levelCode,
          difficultyBias: user.difficultyBias,
          items,
          grammar: grammarWithId,
        }),
      },
    ],
    LearnPackageResponseSchema,
  );

  persistExamples(resp);
  const sessionId = `study-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    sessionId,
    mode: input.mode,
    items,
    grammarItemId: grammarWithId?.id ?? null,
    lessons: resp.lessons,
    grammar: resp.grammar ?? null,
    exercises: resp.exercises,
  };
}

// 提交：标记已学 + 记录会话（进入复习队列）
export function commitSession(session: StudySessionData, userId = DEFAULT_USER_ID): void {
  const learnedIds = [
    ...session.items.map((i) => i.id),
    ...(session.grammarItemId ? [session.grammarItemId] : []),
  ];
  insertStudySession(session.sessionId, userId, session.mode, learnedIds.length);
  createUserItemStates(userId, learnedIds);
}

// —— 预取下一批（后台生成，跳过下次等待）——
let cachedBatch: { preview: ContentPreview; session: StudySessionData } | null = null;
let prefetching = false;
let pendingSession: StudySessionData | null = null;

export async function prefetchNextBatch(userId = DEFAULT_USER_ID): Promise<void> {
  if (prefetching || cachedBatch) return;
  prefetching = true;
  try {
    const preview = await suggestPreview(userId);
    const session = await generateSessionData({ mode: 'suggest', preview, userId });
    cachedBatch = { preview, session };
  } catch {
    // 预取失败忽略，下次走正常流程
  } finally {
    prefetching = false;
  }
}

export function takeCachedBatch(): { preview: ContentPreview; session: StudySessionData } | null {
  const b = cachedBatch;
  cachedBatch = null;
  return b;
}

export function setPendingSession(s: StudySessionData | null): void {
  pendingSession = s;
}

export function consumePendingSession(): StudySessionData | null {
  const s = pendingSession;
  pendingSession = null;
  return s;
}

// 生成条目质量校验：假名不含汉字、字段非空
function validateItem(item: Item): boolean {
  if (!item.surface || !item.reading || !item.meaning) return false;
  return !/[\u4e00-\u9faf]/.test(item.reading);
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
