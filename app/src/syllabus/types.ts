// 大纲数据结构（语种无关）
import { Conjugation, Pos, Transitivity, UnitKind } from '../lib/enums';

export interface SyllabusExample {
  /** 目标语言原文（键名为历史遗留，各语种共用） */
  ja: string;
  /** 发音标注：日语假名 / 韩语罗马音 */
  pronunciation: string;
  zh: string;
}

interface BaseItem {
  surface: string;
  /** 字母入门类条目可省略（导入时用 surface 兜底） */
  reading?: string;
  meaning: string;
  examples?: SyllabusExample[];
}

export interface ScriptItem extends BaseItem {
  /** 字母/文字入门条目：日语 'kana'，韩语 'hangul' */
  type: 'kana' | 'hangul';
}

export interface WordItem extends BaseItem {
  type: 'word';
  pos: Pos;
  accent?: string;
  conjugation?: Conjugation;
  transitivity?: Transitivity;
  relatedItemIds?: string[];
}

export interface GrammarItem extends BaseItem {
  type: 'grammar';
  pattern?: string;
  grammarCategory?: string;
}

export type SyllabusItem = ScriptItem | WordItem | GrammarItem;

export interface SyllabusUnit {
  title: string;
  kind: UnitKind;
  items: SyllabusItem[];
}

export interface SyllabusLevel {
  id: string;
  code: string;
  sortOrder: number;
  targetVocab: number;
}

export interface Syllabus {
  language: { id: string; code: string; name: string };
  level: SyllabusLevel;
  units: SyllabusUnit[];
}
