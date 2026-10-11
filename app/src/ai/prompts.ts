import { z } from 'zod';
import { EXERCISE_KINDS } from '../lib/enums';
import { getLanguageProfile, LanguageProfile } from '../lib/languages';
import { Item } from '../lib/types';

// —— 结构化输出 Schema（对应 04-ai-prompts.md 第 3.1/3.2 节）——
// 注意：`ja` 键存目标语言原文，`pronunciation` 存发音标注（日语假名 / 韩语罗马音）。
// 键名是历史遗留，为避免改动 AI 契约而保留 `ja`。

export const ExampleSchema = z.object({
  ja: z.string(),
  pronunciation: z.string(),
  zh: z.string(),
});

export const LessonSchema = z.object({
  itemId: z.string(),
  explanation: z.string(),
  examples: z.array(ExampleSchema).min(1),
});

export const GrammarLessonSchema = z.object({
  itemId: z.string(),
  explanation: z.string(),
  structure: z.string(),
  tips: z.string(),
  examples: z.array(ExampleSchema).min(1),
});

export const ExerciseSchema = z.object({
  type: z.enum(EXERCISE_KINDS),
  prompt: z.string(),
  options: z.array(z.string()).nullable().optional(),
  answer: z.string(),
  explanation: z.string(),
});

export const LearnPackageResponseSchema = z.object({
  lessons: z.array(LessonSchema),
  grammar: GrammarLessonSchema.nullable().optional(),
  exercises: z.array(ExerciseSchema).min(1),
});

export type LearnPackageResponse = z.infer<typeof LearnPackageResponseSchema>;

export const CheckSentenceSchema = z.object({
  isCorrect: z.boolean(),
  corrections: z.array(
    z.object({ wrong: z.string(), right: z.string(), reason: z.string() }),
  ),
  improved: z.string(),
  encouragement: z.string(),
});

export type CheckSentenceResult = z.infer<typeof CheckSentenceSchema>;

// —— 提示词 ——

export function systemPrompt(
  languageId: string,
  levelCode: string,
  difficultyBias = 0,
): string {
  const p = getLanguageProfile(languageId);
  return [
    `你是一名专业、耐心的${p.teacherLabel}教师，面向中文母语学习者。`,
    `学习者当前预估等级：${levelCode}（${p.levelSystem}），难度偏移：${difficultyBias}（正=更难，负=更简单）。`,
    '请遵守：',
    `1. 讲解系统给定条目时，只讲该条目；自定义主题时可生成新条目，但必须给全字段（书写/${p.readingLabel}/词性/中文释义/等级）。`,
    `2. ${p.readingRule}，并同时给出中文翻译（zh）。`,
    '3. 词汇和语法难度按（等级 + 难度偏移）控制，不超纲。',
    '4. 讲解用中文，简洁、准确、结构化。',
    '5. 除答疑输出 Markdown 外，其余输出必须是合法 JSON，符合给定 schema。',
    ...p.teacherRules.map((rule, i) => `${6 + i}. ${rule}`),
  ].join('\n');
}

export function buildAskPrompt(ctx: {
  languageId: string;
  item: Item | null;
  levelCode: string;
  recent: { surface: string; meaning: string }[];
  history: string;
  question: string;
}): string {
  const p = getLanguageProfile(ctx.languageId);
  const itemDesc = ctx.item
    ? `当前条目：${ctx.item.surface}（${ctx.item.reading}，${ctx.item.pos ?? ''}）${ctx.item.meaning}${
        ctx.item.pattern ? `，句型：${ctx.item.pattern}` : ''
      }`
    : '（自由提问，无特定条目）';
  const recentDesc = ctx.recent.map((r) => `${r.surface}(${r.meaning})`).join('、');

  return [
    `学习者等级：${ctx.levelCode}（${p.levelSystem}）。`,
    itemDesc,
    `最近已学：${recentDesc || '（暂无）'}`,
    '',
    '之前的对话：',
    ctx.history || '（无）',
    '',
    `学生问题：${ctx.question}`,
    '',
    `请用中文回答，${p.readingRule}，并给出中文翻译；`,
    ...p.teacherRules,
    '不超出学习者当前等级。',
  ].join('\n');
}

export function buildCheckSentencePrompt(ctx: {
  languageId: string;
  item: Item | null;
  levelCode: string;
  sentence: string;
}): string {
  const p = getLanguageProfile(ctx.languageId);
  const itemDesc = ctx.item
    ? `相关条目：${ctx.item.surface}（${ctx.item.reading}）${ctx.item.meaning}`
    : '（自由造句）';

  return [
    `学习者等级：${ctx.levelCode}（${p.levelSystem}）。`,
    itemDesc,
    `学习者造的句子：${ctx.sentence}`,
    '',
    `请点评这个${p.teacherLabel}句子：指出错误、解释原因、给出正确版本和更好的表达，并适当鼓励。`,
    `${p.readingRule}。`,
    '按 JSON schema 输出。',
  ].join('\n');
}

// —— v2：意图路由 + 内容预览 ——

export const IntentRouteSchema = z.object({
  intent: z.enum(['study_suggest', 'study_custom', 'review', 'qa', 'difficulty_feedback'] as const),
  topic: z.string().nullable().optional(),
  question: z.string().nullable().optional(),
  feedback: z.enum(['too_easy', 'too_hard'] as const).nullable().optional(),
  confidence: z.number(),
  reply: z.string(),
});
export type IntentRouteResult = z.infer<typeof IntentRouteSchema>;

export const PreviewItemSchema = z.object({
  surface: z.string(),
  reading: z.string(),
  pos: z.string().nullable().optional(),
  meaning: z.string(),
  level: z.string(),
  isNew: z.boolean(),
});

export const ContentPreviewSchema = z.object({
  items: z.array(PreviewItemSchema).min(1),
  category: z.string().nullable().optional(),
  grammar: z
    .object({ surface: z.string(), pattern: z.string(), meaning: z.string() })
    .nullable()
    .optional(),
  reason: z.string(),
});
export type ContentPreviewResult = z.infer<typeof ContentPreviewSchema>;

export function buildStudySessionPrompt(ctx: {
  languageId: string;
  levelCode: string;
  difficultyBias: number;
  items: { id: string; surface: string; reading: string; pos: string | null; meaning: string }[];
  grammar: { id: string; surface: string; pattern: string; meaning: string } | null;
}): string {
  const p = getLanguageProfile(ctx.languageId);
  const itemLines = ctx.items
    .map((it) => `- ${it.id} | ${it.surface}（${it.reading}，${it.pos ?? ''}）：${it.meaning}`)
    .join('\n');
  const grammarLine = ctx.grammar
    ? `语法点（id: ${ctx.grammar.id}）：${ctx.grammar.surface}（${ctx.grammar.pattern}）：${ctx.grammar.meaning}`
    : '本次无语法点。';

  return [
    `学习者等级：${ctx.levelCode}（${p.levelSystem}），难度偏移：${ctx.difficultyBias}。`,
    `为以下${p.teacherLabel}条目生成讲解与例句：`,
    itemLines,
    grammarLine,
    '',
    '输出 JSON：',
    `{ "lessons": [{ "itemId": "条目id（用上面给的 id）", "explanation": "中文讲解", "examples": [{ "ja": "目标语言原文", "pronunciation": "${p.readingLabel}", "zh": "中文翻译" }] }], "grammar": { "itemId", "explanation", "structure", "tips", "examples": [...] } | null, "exercises": [{ "type": "choice|fill|translate", "prompt", "options", "answer", "explanation" }] }`,
    `要求：lessons 的 itemId 用上面每个条目的 id；grammar.itemId 用上面语法点的 id；每个条目至少 2 个例句；exercises 3~5 道；${p.readingRule}。`,
    `注意：例句的发音标注必须放在 "pronunciation" 字段，不要用其他字段名。`,
  ].join('\n');
}

export function buildIntentRoutePrompt(ctx: {
  languageId: string;
  message: string;
  levelCode: string;
  dueCount: number;
}): string {
  const p = getLanguageProfile(ctx.languageId);
  return [
    `学习者等级：${ctx.levelCode}（${p.levelSystem}），待复习：${ctx.dueCount} 条。当前学习语种：${p.teacherLabel}。`,
    `用户消息：${ctx.message}`,
    '',
    '请判断用户意图，输出 JSON：',
    '{ "intent": "study_suggest|study_custom|review|qa|difficulty_feedback", "topic": "string|null", "question": "string|null", "feedback": "too_easy|too_hard|null", "confidence": 0.0-1.0, "reply": "给用户的简短中文回复" }',
    '规则：',
    '- 想学新内容但没指定主题 → study_suggest',
    `- 想学指定主题（如"流行词""商务${p.teacherLabel}"）→ study_custom，topic 填主题`,
    '- 想复习 → review',
    '- 提问/答疑 → qa，question 填问题',
    '- 抱怨太难/太简单 → difficulty_feedback，feedback 填 too_hard / too_easy',
  ].join('\n');
}

export function buildContentPreviewPrompt(ctx: {
  languageId: string;
  mode: 'suggest' | 'custom';
  topic?: string;
  levelCode: string;
  difficultyBias: number;
  known: string;
  count: number;
  contentType?: 'word' | 'grammar';
}): string {
  const p = getLanguageProfile(ctx.languageId);
  const isGrammar = ctx.contentType === 'grammar';
  const goal = isGrammar
    ? `用户想学习${p.teacherLabel}语法点${ctx.topic ? `（主题：${ctx.topic}）` : ''}`
    : ctx.mode === 'custom' && ctx.topic
      ? `用户想学主题「${ctx.topic}」的新${p.teacherLabel}内容`
      : `按用户水平推荐一批合适的${p.teacherLabel}新内容`;

  const ask = isGrammar
    ? `请提议 ${ctx.count} 个${p.teacherLabel}语法点（每个给出句型/结构、中文含义），输出 JSON：`
    : `请提议 ${ctx.count} 个${p.teacherLabel}学习条目（词为主，可含 1 个语法点），输出 JSON：`;

  const levelRange = p.levels.map((l) => l.label).join('~');
  const example = isGrammar
    ? '{ "items": [{ "surface": "…", "reading": "…", "pos": null, "meaning": "中文含义", "level": "' +
      levelRange +
      '", "isNew": true }], "category": null, "grammar": null, "reason": "推荐理由" }'
    : '{ "items": [{ "surface": "...", "reading": "...", "pos": "noun", "meaning": "...", "level": "' +
      levelRange +
      '", "isNew": true }], "category": "日常生活词汇", "grammar": { "surface": "...", "pattern": "...", "meaning": "..." } | null, "reason": "推荐理由" }';

  return [
    `学习语种：${p.teacherLabel}。学习者等级：${ctx.levelCode}（${p.levelSystem}），难度偏移：${ctx.difficultyBias}。`,
    `已学内容（避免重复）：${ctx.known || '（暂无）'}`,
    goal,
    ask,
    example,
    '要求：',
    '- isNew=true（新生成条目）。',
    `- reading 填${p.readingLabel}（${p.readingLabel === '假名' ? '平假名/片假名' : '拉丁字母转写'}）。`,
    '- level 必须取该语种等级之一：' + levelRange + '。',
    '- pos 必须取以下值之一：verb / noun / i-adj / na-adj / adverb / particle / conjunction / interjection / expression。',
    // meaning 是列表页展示用的：
    // 之前模型会把整段讲解（含例句、辨析）塞进来，导致知识库列表出现大段文字。
    '- **meaning 只给简短词义**，不超过 12 个字，形如「务必、一定」「有礼貌的」。',
    '- **禁止在 meaning 里写例句、辨析、语法说明或序号**（如"例："、"辨析："、"1."）。',
    '- category：给整批内容起一个简短中文主题名（如"日常生活词汇""流行语"），用于分类；语法模式可为 null。',
    '- 难度按（等级 + 难度偏移）控制。',
  ].join('\n');
}
