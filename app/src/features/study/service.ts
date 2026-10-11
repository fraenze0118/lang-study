// 学习会话服务：AI 推荐 / 自定义生成 + 沉浸学习 + 落库进复习 + 预取下一批
//
// 多语种：所有"当前学什么"的信息都来自 getActiveContext()（活跃语种 + 该语种的水平/难度），
// 不再读取 users.level_code（那是已废弃的全局单一水平）。
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
  getItemBySurfaceReading,
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
import { ItemType, Pos, StudyMode } from '../../lib/enums';
import { Item } from '../../lib/types';
import { DEFAULT_USER_ID } from '../../lib/constants';
import { getActiveContext, ActiveContext } from '../profile/languageService';

export interface PreviewItem {
  itemId?: string;
  type?: ItemType;
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
  category?: string;
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

/**
 * 推荐模式：优先取当前语种大纲里未学的单词；无则 AI 生成（DB 驱动 + AI 兜底）。
 * `skipScriptUnits` 为 true 时跳过该语种的字母入门单元（如日语五十音、韩语谚音）。
 */
export async function suggestPreview(userId = DEFAULT_USER_ID): Promise<ContentPreview> {
  const ctx = getActiveContext(userId);
  const levelId = getLevelByCode(ctx.languageId, ctx.levelCode)?.id;
  const items: PreviewItem[] = [];

  if (levelId) {
    const units = getUnits(levelId).filter(
      (u) => !(ctx.skipScriptUnits && u.kind === ctx.profile.scriptUnitKind),
    );
    for (const unit of units) {
      for (const it of getItemsWithoutState(userId, unit.id)) {
        if (it.type !== 'word') continue;
        items.push({
          itemId: it.id,
          type: it.type,
          surface: it.surface,
          reading: it.reading,
          pos: it.pos,
          meaning: it.meaning,
          level: ctx.levelCode,
          isNew: false,
        });
        if (items.length >= ctx.sessionSize) break;
      }
      if (items.length >= ctx.sessionSize) break;
    }
  }

  if (items.length > 0) {
    return { mode: 'suggest', items, grammar: null, reason: '根据你的水平，推荐这些未学单词' };
  }
  return generateAiPreview(userId, ctx, undefined, 'suggest');
}

// 自定义模式：AI 生成新条目预览
export async function generateCustomPreview(
  topic: string,
  userId = DEFAULT_USER_ID,
): Promise<ContentPreview> {
  return generateAiPreview(userId, getActiveContext(userId), topic, 'custom', 'word');
}

// 语法模式：AI 生成一批语法点（而非单词）
export async function generateGrammarPreview(
  topic?: string,
  userId = DEFAULT_USER_ID,
): Promise<ContentPreview> {
  return generateAiPreview(userId, getActiveContext(userId), topic, 'custom', 'grammar');
}

async function generateAiPreview(
  userId: string,
  ctx: ActiveContext,
  topic: string | undefined,
  mode: StudyMode,
  contentType: 'word' | 'grammar' = 'word',
): Promise<ContentPreview> {
  const known = getRecentLearnedItems(userId, ctx.languageId, 30)
    .map((k) => `${k.surface}(${k.meaning})`)
    .join('、');

  const resp = await chatJson<ContentPreviewResult>(
    [
      {
        role: 'system',
        content: systemPrompt(ctx.languageId, ctx.levelCode, ctx.difficultyBias),
      },
      {
        role: 'user',
        content: buildContentPreviewPrompt({
          languageId: ctx.languageId,
          mode: mode === 'custom' ? 'custom' : 'suggest',
          topic,
          levelCode: ctx.levelCode,
          difficultyBias: ctx.difficultyBias,
          known,
          count: ctx.sessionSize,
          contentType,
        }),
      },
    ],
    ContentPreviewSchema,
  );

  // 去重：同语种已存在「写法+读音」的条目不再推荐
  const items = resp.items
    .map((i) => ({
      type: contentType,
      surface: i.surface,
      reading: i.reading,
      pos: i.pos ?? null,
      meaning: i.meaning,
      level: i.level,
      isNew: true,
    }))
    .filter((i) => !getItemBySurfaceReading(i.surface, i.reading, ctx.languageId));

  return {
    mode,
    topic,
    category: resp.category ?? undefined,
    items,
    grammar:
      contentType === 'grammar'
        ? null
        : resp.grammar
          ? {
              surface: resp.grammar.surface,
              pattern: resp.grammar.pattern,
              meaning: resp.grammar.meaning,
            }
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
  const ctx = getActiveContext(userId);
  const p = ctx.profile;

  const items: StudyItem[] = [];
  for (const preview of input.preview.items) {
    if (preview.isNew || !preview.itemId) {
      // 去重：同语种已存在同「写法+读音」的条目则复用，不重复插入
      const existingItem = getItemBySurfaceReading(preview.surface, preview.reading, ctx.languageId);
      if (existingItem) {
        items.push({
          id: existingItem.id,
          surface: existingItem.surface,
          reading: existingItem.reading,
          pos: existingItem.pos,
          meaning: existingItem.meaning,
        });
        continue;
      }
      const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const isGrammar = preview.type === 'grammar';
      const item: Item = {
        id,
        unitId: null,
        languageId: ctx.languageId,
        type: preview.type ?? 'word',
        surface: preview.surface,
        reading: isGrammar ? preview.surface : preview.reading,
        accent: null,
        pos: isGrammar ? null : ((preview.pos as Pos) ?? null),
        conjugation: null,
        transitivity: null,
        meaning: preview.meaning,
        pattern: isGrammar ? preview.surface : null,
        grammarCategory: isGrammar ? '语法' : null,
        onyomiKunyomi: null,
        relatedItemIds: null,
        category: isGrammar ? '语法' : (input.preview.category ?? input.preview.topic ?? 'AI 推荐'),
        source: 'ai',
        levelCode: preview.level ?? ctx.levelCode,
        createdAt: Date.now(),
        sortOrder: 0,
      };
      if (validateItem(item, p.validation)) {
        insertItem(item);
        items.push({
          id,
          surface: preview.surface,
          reading: item.reading,
          pos: item.pos,
          meaning: preview.meaning,
        });
      }
    } else {
      const existing = getItem(preview.itemId);
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
      languageId: ctx.languageId,
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
      category: '语法',
      source: 'ai',
      levelCode: ctx.levelCode,
      createdAt: Date.now(),
      sortOrder: 0,
    });
    grammarWithId = { id: gid, surface: g.surface, pattern: g.pattern, meaning: g.meaning };
  }

  if (items.length === 0 && !grammarWithId) throw new Error('没有可学习的条目');

  const resp = await chatJson<LearnPackageResponse>(
    [
      {
        role: 'system',
        content: systemPrompt(ctx.languageId, ctx.levelCode, ctx.difficultyBias),
      },
      {
        role: 'user',
        content: buildStudySessionPrompt({
          languageId: ctx.languageId,
          levelCode: ctx.levelCode,
          difficultyBias: ctx.difficultyBias,
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

/** 切换语种后必须丢弃预取/待用批次，否则会把旧语种的内容带进新语种 */
export function clearBatchCache(): void {
  cachedBatch = null;
  pendingSession = null;
}

/**
 * 生成条目质量校验：字段非空 + 按语种的发音标注规则。
 * 规则来自 LanguageProfile.validation，取代原先写死的"假名不含汉字"。
 */
function validateItem(
  item: Item,
  validation: { readingMustMatch?: RegExp; readingMustNotMatch?: RegExp },
): boolean {
  if (!item.surface || !item.meaning) return false;
  if (item.type === 'grammar') return true; // 语法句型可含汉字
  if (!item.reading) return false;
  if (validation.readingMustMatch && !validation.readingMustMatch.test(item.reading)) return false;
  if (validation.readingMustNotMatch && validation.readingMustNotMatch.test(item.reading)) return false;
  return true;
}

function persistExamples(resp: LearnPackageResponse): void {
  for (const lesson of resp.lessons) {
    for (const ex of lesson.examples) {
      insertExample(lesson.itemId, ex.ja, ex.pronunciation, ex.zh, 'ai');
    }
  }
  if (resp.grammar) {
    for (const ex of resp.grammar.examples) {
      insertExample(resp.grammar.itemId, ex.ja, ex.pronunciation, ex.zh, 'ai');
    }
  }
}
