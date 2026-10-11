import {
  ChatKind,
  Conjugation,
  ExerciseKind,
  Feedback,
  Goal,
  ItemSource,
  ItemType,
  LevelCode,
  MasteryState,
  Pos,
  ReviewGrade,
  StudyMode,
  Transitivity,
  UnitKind,
} from './enums';

export interface Language {
  id: string;
  code: string;
  name: string;
}

export interface Level {
  id: string;
  languageId: string;
  code: LevelCode;
  sortOrder: number;
  targetVocab: number | null;
}

export interface Unit {
  id: string;
  levelId: string;
  title: string;
  kind: UnitKind;
  sortOrder: number;
}

export interface Item {
  id: string;
  unitId: string | null; // AI 生成条目可为 null
  /** 所属语种。AI 生成条目 unitId 为 null，必须显式记录，不能靠单元反推 */
  languageId: string | null;
  type: ItemType;
  surface: string;
  reading: string;
  accent: string | null;
  pos: Pos | null;
  conjugation: Conjugation | null;
  transitivity: Transitivity | null;
  meaning: string;
  pattern: string | null;
  grammarCategory: string | null;
  onyomiKunyomi: string | null; // JSON string
  relatedItemIds: string | null; // JSON string
  category: string | null; // 主题分类：大纲词=单元标题，AI 词=生成主题
  source: ItemSource;
  levelCode: LevelCode | null;
  createdAt: number | null; // epoch ms
  sortOrder: number;
}

/**
 * 字母表条目：在 Item 基础上带所属单元标题。
 * 字母表需要按单元分段（平假名 / 片假名 / 音节拼合 / 收音…），
 * 而 Item 只有 unitId，所以查询时一并取出标题。
 */
export interface ScriptItemRow extends Item {
  unitTitle: string | null;
}

export interface ItemExample {
  id: number;
  itemId: string;
  /** 目标语言原文（键名为历史遗留：日语/韩语/俄语共用此列） */
  ja: string;
  /** 发音标注：日语假名 / 韩语罗马音 / 俄语拉丁转写 */
  pronunciation: string;
  zh: string;
  source: 'manual' | 'ai';
}

export interface User {
  id: string;
  nativeLanguage: string;
  /**
   * @deprecated 旧的多语种前字段。真实水平按语种存在 `user_languages`，
   * 请用 `getActiveContext()` 获取当前语种的水平与难度偏移。
   */
  levelCode: LevelCode;
  /** @deprecated 同上，见 `user_languages.difficulty_bias` */
  difficultyBias: number; // -2..+2
  goal: Goal;
  sessionSize: number; // 每次学习建议条目数（全局偏好，不按语种分）
  /** @deprecated 字母入门偏好已迁到 `user_languages.skip_script_units` */
  interests: string | null; // JSON string
  assessmentDone: number; // 0/1
  dailyGoalXp: number; // 每日目标经验值，0 = 不设目标
}

/** 按语种的用户画像（user_languages） */
export interface UserLanguage {
  userId: string;
  languageId: string;
  levelCode: string;
  difficultyBias: number; // -2..+2
  /** 1 = 已认得该语种的字母/文字，推荐时跳过入门单元 */
  skipScriptUnits: number;
  createdAt: number;
}

/** languages 表 */
export interface LanguageRow {
  id: string;
  code: string;
  name: string;
}

export interface UserItemState {
  id: number;
  userId: string;
  itemId: string;
  masteryState: MasteryState;
  fsrsState: number; // ts-fsrs State 枚举值
  stability: number;
  difficulty: number;
  due: number | null; // epoch ms
  lastReviewAt: number | null; // epoch ms
  reps: number;
  lapses: number;
}

export interface ReviewLog {
  id: number;
  userId: string;
  itemId: string;
  grade: ReviewGrade;
  elapsedMs: number;
  reviewedAt: number; // epoch ms
}

export interface DifficultyFeedback {
  id: number;
  userId: string;
  itemId: string | null;
  feedback: Feedback;
  createdAt: number;
}

export interface StudySession {
  id: string;
  userId: string;
  mode: StudyMode;
  itemCount: number;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  itemId: string | null;
  /** 该会话所属语种（v5）；对话按语种隔离 */
  languageId: string | null;
  kind: ChatKind;
  createdAt: number; // epoch ms
}

export interface ChatMessage {
  id: number;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number; // epoch ms
}

/** 练习作答 / 自评事件（v4）：驱动每日目标进度与连续天数 */
export type AnswerStepKind = 'exercise' | 'selfcheck';

export interface AnswerLog {
  id: number;
  userId: string;
  sessionId: string | null;
  itemId: string | null;
  stepKind: AnswerStepKind;
  correct: number; // 0/1
  xp: number;
  answeredAt: number; // epoch ms
}

/** 练习题（与 ai/prompts.ts 的 ExerciseSchema 结构一致） */
export interface Exercise {
  type: ExerciseKind;
  prompt: string;
  options?: string[] | null;
  answer: string;
  explanation: string;
}
