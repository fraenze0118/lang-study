import { z } from 'zod';
import { Item } from '../lib/types';

// —— 结构化输出 Schema（对应 04-ai-prompts.md 第 3.1/3.2 节）——

export const ExampleSchema = z.object({
  ja: z.string(),
  kana: z.string(),
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
  type: z.enum(['choice', 'fill', 'translate'] as const),
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

export function systemPrompt(levelCode: string, difficultyBias = 0): string {
  return [
    '你是一名专业、耐心的日语教师，面向中文母语学习者。',
    `学习者当前预估等级：${levelCode}（JLPT），难度偏移：${difficultyBias}（正=更难，负=更简单）。`,
    '请遵守：',
    '1. 讲解系统给定条目时，只讲该条目；自定义主题时可生成新条目，但必须给全字段（书写/假名/词性/中文释义/等级）。',
    '2. 所有日语例句必须同时给出假名（kana）和中文翻译（zh）。',
    '3. 词汇和语法难度按（等级 + 难度偏移）控制，不超纲。',
    '4. 讲解用中文，简洁、准确、结构化。',
    '5. 除答疑输出 Markdown 外，其余输出必须是合法 JSON，符合给定 schema。',
    '6. 对于助词（は/が）、自他动词、敬语等易错内容，给出辨析与易错提示。',
  ].join('\n');
}

export function buildLearnPackagePrompt(ctx: {
  levelCode: string;
  unitTitle: string;
  words: Item[];
  grammar: Item | null;
}): string {
  const wordLines = ctx.words
    .map((w) => `- ${w.surface}（${w.reading}，${w.pos ?? ''}）：${w.meaning}`)
    .join('\n');
  const grammarLine = ctx.grammar
    ? `语法点：${ctx.grammar.surface}（${ctx.grammar.pattern ?? ''}）：${ctx.grammar.meaning}`
    : '本次无语法点。';

  return [
    `今天学习的单元是「${ctx.unitTitle}」，学习者等级 ${ctx.levelCode}。`,
    '',
    '需要为以下新词生成讲解与例句：',
    wordLines || '（无）',
    '',
    grammarLine,
    '',
    '请生成 JSON，结构如下：',
    '{',
    '  "lessons": [{ "itemId": "条目id", "explanation": "中文讲解", "examples": [{ "ja": "...", "kana": "...", "zh": "..." }] }],',
    '  "grammar": { "itemId": "...", "explanation": "...", "structure": "...", "tips": "...", "examples": [...] } | null,',
    '  "exercises": [{ "type": "choice|fill|translate", "prompt": "...", "options": ["..."]（choice 时必填）, "answer": "...", "explanation": "..." }]',
    '}',
    '要求：',
    '- lessons 覆盖每一个新词，每个词至少 2 个例句。',
    '- grammar 若本次无语法点则为 null，否则给出结构拆解与易错提示。',
    '- exercises 生成 3~5 道，覆盖当天新词和语法点。',
    '- 所有日语内容附假名。',
  ].join('\n');
}

export function buildAskPrompt(ctx: {
  item: Item | null;
  levelCode: string;
  recent: { surface: string; meaning: string }[];
  history: string;
  question: string;
}): string {
  const itemDesc = ctx.item
    ? `当前条目：${ctx.item.surface}（${ctx.item.reading}，${ctx.item.pos ?? ''}）${ctx.item.meaning}${
        ctx.item.pattern ? `，句型：${ctx.item.pattern}` : ''
      }`
    : '（自由提问，无特定条目）';
  const recentDesc = ctx.recent.map((r) => `${r.surface}(${r.meaning})`).join('、');

  return [
    `学习者等级：${ctx.levelCode}。`,
    itemDesc,
    `最近已学：${recentDesc || '（暂无）'}`,
    '',
    '之前的对话：',
    ctx.history || '（无）',
    '',
    `学生问题：${ctx.question}`,
    '',
    '请用中文回答，日语例句必须附假名（kana）和中文翻译；',
    '涉及助词（は/が）、自他动词、敬语时给出辨析；不超出学习者当前等级。',
  ].join('\n');
}

export function buildCheckSentencePrompt(ctx: {
  item: Item | null;
  levelCode: string;
  sentence: string;
}): string {
  const itemDesc = ctx.item
    ? `相关条目：${ctx.item.surface}（${ctx.item.reading}）${ctx.item.meaning}`
    : '（自由造句）';

  return [
    `学习者等级：${ctx.levelCode}。`,
    itemDesc,
    `学习者造的句子：${ctx.sentence}`,
    '',
    '请点评这个句子：指出错误、解释原因、给出正确版本和更好的表达，并适当鼓励。',
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
  grammar: z
    .object({ surface: z.string(), pattern: z.string(), meaning: z.string() })
    .nullable()
    .optional(),
  reason: z.string(),
});
export type ContentPreviewResult = z.infer<typeof ContentPreviewSchema>;

export function buildStudySessionPrompt(ctx: {
  levelCode: string;
  difficultyBias: number;
  items: { id: string; surface: string; reading: string; pos: string | null; meaning: string }[];
  grammar: { id: string; surface: string; pattern: string; meaning: string } | null;
}): string {
  const itemLines = ctx.items
    .map((it) => `- ${it.id} | ${it.surface}（${it.reading}，${it.pos ?? ''}）：${it.meaning}`)
    .join('\n');
  const grammarLine = ctx.grammar
    ? `语法点（id: ${ctx.grammar.id}）：${ctx.grammar.surface}（${ctx.grammar.pattern}）：${ctx.grammar.meaning}`
    : '本次无语法点。';

  return [
    `学习者等级：${ctx.levelCode}，难度偏移：${ctx.difficultyBias}。`,
    '为以下条目生成讲解与例句：',
    itemLines,
    grammarLine,
    '',
    '输出 JSON：',
    '{ "lessons": [{ "itemId": "条目id（用上面给的 id）", "explanation": "中文讲解", "examples": [{ "ja", "kana", "zh" }] }], "grammar": { "itemId", "explanation", "structure", "tips", "examples": [...] } | null, "exercises": [{ "type": "choice|fill|translate", "prompt", "options", "answer", "explanation" }] }',
    '要求：lessons 的 itemId 用上面每个条目的 id；grammar.itemId 用上面语法点的 id；每个条目至少 2 个例句；exercises 3~5 道；所有日语附假名。',
  ].join('\n');
}

export const AssessmentQuestionSchema = z.object({
  type: z.enum(['vocab', 'grammar', 'reading'] as const),
  level: z.string(),
  prompt: z.string(),
  options: z.array(z.string()).min(3),
  answer: z.string(),
});
export type AssessmentQuestionResult = z.infer<typeof AssessmentQuestionSchema>;

export function buildAssessmentPrompt(levelCode: string): string {
  return [
    `请出一道 JLPT ${levelCode} 水平的日语单选题（词汇/语法/短句理解），输出 JSON：`,
    '{ "type": "vocab|grammar|reading", "level": "N5~N1", "prompt": "题干（附假名）", "options": ["4个选项"], "answer": "正确选项文本" }',
    '要求：只有一个正确答案，answer 必须是 options 之一；难度贴合该等级。',
  ].join('\n');
}

export function buildIntentRoutePrompt(ctx: {
  message: string;
  levelCode: string;
  dueCount: number;
}): string {
  return [
    `学习者等级：${ctx.levelCode}，待复习：${ctx.dueCount} 条。`,
    `用户消息：${ctx.message}`,
    '',
    '请判断用户意图，输出 JSON：',
    '{ "intent": "study_suggest|study_custom|review|qa|difficulty_feedback", "topic": "string|null", "question": "string|null", "feedback": "too_easy|too_hard|null", "confidence": 0.0-1.0, "reply": "给用户的简短中文回复" }',
    '规则：',
    '- 想学新内容但没指定主题 → study_suggest',
    '- 想学指定主题（如"流行词""商务日语"）→ study_custom，topic 填主题',
    '- 想复习 → review',
    '- 提问/答疑 → qa，question 填问题',
    '- 抱怨太难/太简单 → difficulty_feedback，feedback 填 too_hard / too_easy',
  ].join('\n');
}

export function buildContentPreviewPrompt(ctx: {
  mode: 'suggest' | 'custom';
  topic?: string;
  levelCode: string;
  difficultyBias: number;
  known: string;
  count: number;
}): string {
  const goal =
    ctx.mode === 'custom' && ctx.topic
      ? `用户想学主题「${ctx.topic}」的新内容`
      : '按用户水平推荐一批合适的新内容';
  return [
    `学习者等级：${ctx.levelCode}，难度偏移：${ctx.difficultyBias}。`,
    `已学内容（避免重复）：${ctx.known || '（暂无）'}`,
    goal,
    `请提议 ${ctx.count} 个学习条目（词为主，可含 1 个语法点），输出 JSON：`,
    '{ "items": [{ "surface": "...", "reading": "...", "pos": "...", "meaning": "...", "level": "N5~N1", "isNew": true }], "grammar": { "surface": "...", "pattern": "...", "meaning": "..." } | null, "reason": "推荐理由" }',
    '要求：',
    '- 自定义主题时 isNew=true（新生成条目）；推荐模式优先选未学内容。',
    '- 难度按（等级 + 难度偏移）控制。',
  ].join('\n');
}
