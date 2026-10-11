// ts-fsrs 封装：评分排程 + 卡片状态快照互转
import { Card, FSRS, Grade, Rating, State, createEmptyCard, fsrs } from 'ts-fsrs';
import { MasteryState, ReviewGrade } from '../lib/enums';

let instance: FSRS | null = null;

export function getFsrs(): FSRS {
  if (!instance) instance = fsrs();
  return instance;
}

const GRADE_MAP: Record<ReviewGrade, Grade> = {
  Again: Rating.Again,
  Hard: Rating.Hard,
  Good: Rating.Good,
  Easy: Rating.Easy,
};

// 对一张卡片按评分排程，返回更新后的卡片
export function schedule(card: Card, now: Date, grade: ReviewGrade): Card {
  return getFsrs().next(card, now, GRADE_MAP[grade]).card;
}

export interface CardSnapshot {
  fsrsState: number;
  stability: number;
  difficulty: number;
  due: number | null;
  lastReviewAt: number | null;
  reps: number;
  lapses: number;
}

export function cardToSnapshot(card: Card): CardSnapshot {
  return {
    fsrsState: card.state,
    stability: card.stability,
    difficulty: card.difficulty,
    due: card.due.getTime(),
    lastReviewAt: card.last_review ? card.last_review.getTime() : null,
    reps: card.reps,
    lapses: card.lapses,
  };
}

export function snapshotToCard(s: CardSnapshot): Card {
  const card = createEmptyCard();
  card.state = s.fsrsState as State;
  card.stability = s.stability;
  card.difficulty = s.difficulty;
  card.due = new Date(s.due ?? Date.now());
  card.reps = s.reps;
  card.lapses = s.lapses;
  if (s.lastReviewAt) card.last_review = new Date(s.lastReviewAt);
  return card;
}

// FSRS 状态 → 应用层掌握度
export function masteryFromFsrsState(state: State): MasteryState {
  if (state === State.New) return 'new';
  if (state === State.Review) return 'mastered';
  return 'learning'; // Learning / Relearning
}
