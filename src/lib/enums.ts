// 全局枚举定义（对应 02-data-model.md 第 1 节）

export const ITEM_TYPES = ['kana', 'word', 'grammar'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const LEVEL_CODES = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export type LevelCode = (typeof LEVEL_CODES)[number];

export const POS_VALUES = [
  'verb',
  'noun',
  'i-adj',
  'na-adj',
  'adverb',
  'particle',
  'conjunction',
  'interjection',
  'expression',
] as const;
export type Pos = (typeof POS_VALUES)[number];

export const CONJUGATION_VALUES = ['godan', 'ichidan', 'sa-hen', 'ka-hen'] as const;
export type Conjugation = (typeof CONJUGATION_VALUES)[number];

export const TRANSITIVITY_VALUES = ['intransitive', 'transitive', 'both'] as const;
export type Transitivity = (typeof TRANSITIVITY_VALUES)[number];

export const REVIEW_GRADES = ['Again', 'Hard', 'Good', 'Easy'] as const;
export type ReviewGrade = (typeof REVIEW_GRADES)[number];

export const MASTERY_STATES = ['new', 'learning', 'mastered'] as const;
export type MasteryState = (typeof MASTERY_STATES)[number];

export const UNIT_KINDS = ['theme', 'scene', 'kana'] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export const GOALS = ['exam', 'daily', 'both'] as const;
export type Goal = (typeof GOALS)[number];

// —— v2 新增 ——
export const ITEM_SOURCES = ['syllabus', 'ai'] as const;
export type ItemSource = (typeof ITEM_SOURCES)[number];

export const FEEDBACKS = ['too_easy', 'just_right', 'too_hard'] as const;
export type Feedback = (typeof FEEDBACKS)[number];

export const CHAT_KINDS = ['agent', 'qa'] as const;
export type ChatKind = (typeof CHAT_KINDS)[number];

export const STUDY_MODES = ['suggest', 'custom', 'review'] as const;
export type StudyMode = (typeof STUDY_MODES)[number];

export const INTENTS = [
  'study_suggest',
  'study_custom',
  'review',
  'qa',
  'difficulty_feedback',
] as const;
export type Intent = (typeof INTENTS)[number];
