import {
  ChatKind,
  Conjugation,
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
  source: ItemSource;
  levelCode: LevelCode | null;
  createdAt: number | null; // epoch ms
  sortOrder: number;
}

export interface ItemExample {
  id: number;
  itemId: string;
  ja: string;
  kana: string;
  zh: string;
  source: 'manual' | 'ai';
}

export interface User {
  id: string;
  nativeLanguage: string;
  levelCode: LevelCode;
  difficultyBias: number; // -2..+2
  goal: Goal;
  sessionSize: number; // 每次学习建议条目数
  interests: string | null; // JSON string
  assessmentDone: number; // 0/1
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
