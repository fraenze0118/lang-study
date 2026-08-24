import { Conjugation, Pos, Transitivity, UnitKind } from '../lib/enums';

export interface Example {
  ja: string;
  kana: string;
  zh: string;
}

interface BaseItem {
  surface: string;
  reading?: string; // 语法句型可缺省，导入时用 surface 兜底
  meaning: string;
  examples?: Example[];
}

export interface KanaItem extends BaseItem {
  type: 'kana';
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

export type SyllabusItem = KanaItem | WordItem | GrammarItem;

export interface SyllabusUnit {
  title: string;
  kind: UnitKind;
  items: SyllabusItem[];
}

export interface Syllabus {
  language: { id: string; code: string; name: string };
  level: { id: string; code: 'N5'; sortOrder: number; targetVocab: number };
  units: SyllabusUnit[];
}

// N5 小样本大纲（MVP 先跑通结构，后续按 06-syllabus.md 第 8 节扩充）
export const N5_SYLLABUS: Syllabus = {
  language: { id: 'ja', code: 'ja', name: 'Japanese' },
  level: { id: 'ja-n5', code: 'N5', sortOrder: 1, targetVocab: 800 },
  units: [
    {
      title: '五十音（平假名·入门）',
      kind: 'kana',
      items: [
        { type: 'kana', surface: 'あ', reading: 'a', meaning: '平假名 a' },
        { type: 'kana', surface: 'い', reading: 'i', meaning: '平假名 i' },
        { type: 'kana', surface: 'う', reading: 'u', meaning: '平假名 u' },
        { type: 'kana', surface: 'え', reading: 'e', meaning: '平假名 e' },
        { type: 'kana', surface: 'お', reading: 'o', meaning: '平假名 o' },
        { type: 'kana', surface: 'か', reading: 'ka', meaning: '平假名 ka' },
        { type: 'kana', surface: 'き', reading: 'ki', meaning: '平假名 ki' },
        { type: 'kana', surface: 'く', reading: 'ku', meaning: '平假名 ku' },
        { type: 'kana', surface: 'け', reading: 'ke', meaning: '平假名 ke' },
        { type: 'kana', surface: 'こ', reading: 'ko', meaning: '平假名 ko' },
      ],
    },
    {
      title: '问候与自我介绍',
      kind: 'scene',
      items: [
        {
          type: 'word',
          surface: '私',
          reading: 'わたし',
          accent: '⓪',
          pos: 'noun',
          meaning: '我',
          examples: [{ ja: '私は学生です。', kana: 'わたしはがくせいです。', zh: '我是学生。' }],
        },
        {
          type: 'word',
          surface: '名前',
          reading: 'なまえ',
          pos: 'noun',
          meaning: '名字',
          examples: [{ ja: '私の名前は田中です。', kana: 'わたしのなまえはたなかです。', zh: '我的名字是田中。' }],
        },
        { type: 'word', surface: '学生', reading: 'がくせい', pos: 'noun', meaning: '学生' },
        { type: 'word', surface: '先生', reading: 'せんせい', pos: 'noun', meaning: '老师' },
        { type: 'word', surface: '友達', reading: 'ともだち', pos: 'noun', meaning: '朋友' },
        {
          type: 'grammar',
          surface: '～は～です',
          pattern: 'N1 は N2 です',
          grammarCategory: '句型',
          meaning: '～是～',
          examples: [{ ja: '私は学生です。', kana: 'わたしはがくせいです。', zh: '我是学生。' }],
        },
      ],
    },
    {
      title: '日常物品',
      kind: 'theme',
      items: [
        {
          type: 'word',
          surface: '本',
          reading: 'ほん',
          pos: 'noun',
          meaning: '书',
          examples: [{ ja: 'これは本です。', kana: 'これはほんです。', zh: '这是书。' }],
        },
        { type: 'word', surface: '机', reading: 'つくえ', pos: 'noun', meaning: '桌子' },
        { type: 'word', surface: '電話', reading: 'でんわ', pos: 'noun', meaning: '电话' },
        {
          type: 'word',
          surface: '水',
          reading: 'みず',
          pos: 'noun',
          meaning: '水',
          examples: [{ ja: '水を飲みます。', kana: 'みずをのみます。', zh: '喝水。' }],
        },
        { type: 'word', surface: 'ご飯', reading: 'ごはん', pos: 'noun', meaning: '饭' },
        {
          type: 'grammar',
          surface: 'これ／それ／あれ',
          grammarCategory: '指示词',
          meaning: '这／那／那（更远）',
          examples: [{ ja: 'これは本です。', kana: 'これはほんです。', zh: '这是书。' }],
        },
        {
          type: 'grammar',
          surface: 'の',
          grammarCategory: '助词',
          meaning: '的（表所属）',
          examples: [{ ja: '私の本です。', kana: 'わたしのほんです。', zh: '我的书。' }],
        },
      ],
    },
    {
      title: '数字与颜色',
      kind: 'theme',
      items: [
        { type: 'word', surface: '一', reading: 'いち', pos: 'noun', meaning: '一' },
        { type: 'word', surface: '二', reading: 'に', pos: 'noun', meaning: '二' },
        { type: 'word', surface: '三', reading: 'さん', pos: 'noun', meaning: '三' },
        { type: 'word', surface: '四', reading: 'よん', pos: 'noun', meaning: '四' },
        { type: 'word', surface: '五', reading: 'ご', pos: 'noun', meaning: '五' },
        { type: 'word', surface: '赤', reading: 'あか', pos: 'noun', meaning: '红色' },
        { type: 'word', surface: '青', reading: 'あお', pos: 'noun', meaning: '蓝色' },
        { type: 'word', surface: '白', reading: 'しろ', pos: 'noun', meaning: '白色' },
      ],
    },
    {
      title: '日常动作',
      kind: 'theme',
      items: [
        { type: 'word', surface: '行く', reading: 'いく', pos: 'verb', conjugation: 'godan', transitivity: 'intransitive', meaning: '去' },
        { type: 'word', surface: '来る', reading: 'くる', pos: 'verb', conjugation: 'ka-hen', transitivity: 'intransitive', meaning: '来' },
        { type: 'word', surface: '見る', reading: 'みる', pos: 'verb', conjugation: 'ichidan', transitivity: 'transitive', meaning: '看' },
        { type: 'word', surface: '聞く', reading: 'きく', pos: 'verb', conjugation: 'godan', transitivity: 'transitive', meaning: '听' },
        { type: 'word', surface: '話す', reading: 'はなす', pos: 'verb', conjugation: 'godan', transitivity: 'transitive', meaning: '说' },
        { type: 'word', surface: '読む', reading: 'よむ', pos: 'verb', conjugation: 'godan', transitivity: 'transitive', meaning: '读' },
      ],
    },
  ],
};
