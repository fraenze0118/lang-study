// 语种注册表：每个语种的差异（等级体系、文字、发音标注、TTS、提示词规则）集中在这里。
//
// 设计目标：新增一个语种只需
//   1) 在本文件注册一份 profile
//   2) 在 syllabus/registry.ts 加一份课程数据
// 不需要改 prompts / tts / UI 文案 / 查重逻辑。
import { ScriptItemType } from './enums';

export interface LanguageLevel {
  code: string;
  /** 界面展示用短标签，如 'N5'、'1 级' */
  label: string;
  /** 由易到难，从 1 开始 */
  order: number;
}

export interface StartingPoint {
  level: string;
  label: string;
  desc: string;
  /** true = 已认得该语种的字母/文字，推荐时跳过入门单元 */
  skipScript: boolean;
}

export interface LanguageProfile {
  id: string;
  code: string;
  /** 中文界面用名，如 '日语' */
  name: string;
  /** 该语言自称，如 '日本語' */
  nativeName: string;
  /** emoji 标记，用于切换器 */
  flag: string;

  /** 拼进提示词，如 '日语' → 「你是一名专业的日语教师」 */
  teacherLabel: string;
  /** 发音标注的名称，如 '假名' / '罗马音' */
  readingLabel: string;
  /** 拼进提示词，说明该标注写成什么样 */
  readingRule: string;

  /** 入门单元的类型（= 其中条目的 type）：'kana' / 'hangul' */
  scriptUnitKind: ScriptItemType;
  scriptUnitTitle: string;
  /** 入门单元里教的"字母"叫法，如 '假名' / '谚文' */
  scriptLabel: string;
  /** 入门页里"已认得字母"这一档的说法，如 '认得假名' */
  skipScriptLabel: string;

  /** 水平体系名称，如 'JLPT' / 'TOPIK' */
  levelSystem: string;
  levels: LanguageLevel[];

  ttsLocale: string;
  /** 设置页语音项的说法，如 '日语语音' */
  voiceLabel: string;

  /** 该语种的易错点，拼进提示词（取代原先写死的助词/自他动词/敬语） */
  teacherRules: string[];
  /** 用户提问时的补充指令，如 '日语例句附假名和中文翻译' */
  answerHint: string;
  /** 生成条目的质量校验：reading 字段必须/不得匹配 */
  validation: {
    /** reading 必须匹配（日语：全是假名） */
    readingMustMatch?: RegExp;
    /** reading 不得匹配（韩语：不得含谚文） */
    readingMustNotMatch?: RegExp;
  };

  startingPoints: StartingPoint[];
}

const JA: LanguageProfile = {
  id: 'ja',
  code: 'ja',
  name: '日语',
  nativeName: '日本語',
  flag: '🇯🇵',
  teacherLabel: '日语',
  readingLabel: '假名',
  readingRule: '日语例句必须附假名（kana）',
  scriptUnitKind: 'kana',
  scriptUnitTitle: '五十音（平假名·入门）',
  scriptLabel: '假名',
  skipScriptLabel: '认得假名',
  levelSystem: 'JLPT',
  levels: [
    { code: 'N5', label: 'N5', order: 1 },
    { code: 'N4', label: 'N4', order: 2 },
    { code: 'N3', label: 'N3', order: 3 },
    { code: 'N2', label: 'N2', order: 4 },
    { code: 'N1', label: 'N1', order: 5 },
  ],
  ttsLocale: 'ja-JP',
  voiceLabel: '日语语音',
  teacherRules: [
    '对于助词（は/が）、自他动词、敬语等易错内容，给出辨析与易错提示。',
  ],
  answerHint: '日语例句附假名和中文翻译',
  validation: {
    // 假名（平假名/片假名）不得混入汉字
    readingMustNotMatch: /[\u4e00-\u9faf]/,
  },
  startingPoints: [
    { level: 'N5', label: '完全零基础', desc: '从五十音开始：平假名、片假名，一个字母一个字母来', skipScript: false },
    { level: 'N5', label: '认得假名，词汇很少', desc: '跳过字母入门，直接从 N5 的基础单词和句型开始', skipScript: true },
    { level: 'N4', label: '学过一阵子，能应付简单句子', desc: '从 N4 的内容开始，补语法和词汇量', skipScript: true },
    { level: 'N3', label: '能日常交流，想进阶', desc: '从 N3 开始，偏表达与阅读理解', skipScript: true },
    { level: 'N2', label: '在备考 JLPT N2 / N1', desc: '直接上中高级内容', skipScript: true },
  ],
};

const KO: LanguageProfile = {
  id: 'ko',
  code: 'ko',
  name: '韩语',
  nativeName: '한국어',
  flag: '🇰🇷',
  teacherLabel: '韩语',
  readingLabel: '罗马音',
  readingRule: '韩语例句必须附罗马音（罗马字转写）',
  scriptUnitKind: 'hangul',
  scriptUnitTitle: '谚音入门（基本辅音·元音）',
  scriptLabel: '谚文',
  skipScriptLabel: '认得谚文',
  levelSystem: 'TOPIK',
  levels: [
    { code: 'TOPIK1', label: '1 级', order: 1 },
    { code: 'TOPIK2', label: '2 级', order: 2 },
    { code: 'TOPIK3', label: '3 级', order: 3 },
    { code: 'TOPIK4', label: '4 级', order: 4 },
    { code: 'TOPIK5', label: '5 级', order: 5 },
    { code: 'TOPIK6', label: '6 级', order: 6 },
  ],
  ttsLocale: 'ko-KR',
  voiceLabel: '韩语语音',
  teacherRules: [
    '注意韩语的敬语阶称（합니다体 / 해요体 / 반말）差异，给出使用场景提示。',
    '对于助词（은/는、이/가、을/를）的区别、以及动词活用（아/어요）的规则，给出辨析与易错提示。',
  ],
  answerHint: '韩语例句附罗马音和中文翻译',
  validation: {
    // 罗马音不得含谚文（Hangul Syllables / Jamo）
    readingMustNotMatch: /[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]/,
  },
  startingPoints: [
    { level: 'TOPIK1', label: '完全零基础', desc: '从谚文开始：基本辅音和元音，一个字母一个字母来', skipScript: false },
    { level: 'TOPIK1', label: '认得谚文，词汇很少', desc: '跳过字母入门，直接从 TOPIK 1 的基础单词和句型开始', skipScript: true },
    { level: 'TOPIK2', label: '学过一阵子，能说简单句', desc: '从 TOPIK 2 的内容开始，补语法和词汇量', skipScript: true },
    { level: 'TOPIK3', label: '能日常交流，想进阶', desc: '从 TOPIK 3 开始，偏表达与阅读', skipScript: true },
    { level: 'TOPIK4', label: '在备考 TOPIK 5 / 6 级', desc: '直接上中高级内容', skipScript: true },
  ],
};

/** 全部语种 profile，键为 language id */
export const LANGUAGE_PROFILES: Record<string, LanguageProfile> = {
  [JA.id]: JA,
  [KO.id]: KO,
};

/** 默认语种（历史库只播过日语） */
export const DEFAULT_LANGUAGE_ID = JA.id;

export function listLanguages(): LanguageProfile[] {
  return Object.values(LANGUAGE_PROFILES);
}

/**
 * 取语种 profile。未知 id 回退默认语种（不抛错：调用方多在渲染路径上，
 * 抛错会让整个页面白屏，回退更安全）。
 */
export function getLanguageProfile(id: string | null | undefined): LanguageProfile {
  if (id && LANGUAGE_PROFILES[id]) return LANGUAGE_PROFILES[id];
  return LANGUAGE_PROFILES[DEFAULT_LANGUAGE_ID];
}

export function hasLanguageProfile(id: string): boolean {
  return !!LANGUAGE_PROFILES[id];
}

/** 按 order 升序的等级列表（分组排序、选择器都用它） */
export function getLevelsSorted(id: string): LanguageLevel[] {
  return [...getLanguageProfile(id).levels].sort((a, b) => a.order - b.order);
}

/** 等级代码 → order；未知等级排到最后 */
export function getLevelOrder(id: string, levelCode: string | null): number {
  if (!levelCode) return Number.MAX_SAFE_INTEGER;
  const found = getLanguageProfile(id).levels.find((l) => l.code === levelCode);
  return found ? found.order : Number.MAX_SAFE_INTEGER;
}

/** 该语种的默认入门等级（最靠前的那一级） */
export function getDefaultLevelCode(id: string): string {
  const levels = getLevelsSorted(id);
  return levels.length > 0 ? levels[0].code : 'N5';
}

/**
 * 等级平移（越界夹到边界），用于难度反馈累积到阈值后的升降级。
 * 取代原先写死 JLPT 的 shiftLevel。
 */
export function shiftLevelCode(id: string, levelCode: string, delta: number): string {
  const levels = getLevelsSorted(id);
  if (levels.length === 0) return levelCode;
  const idx = levels.findIndex((l) => l.code === levelCode);
  if (idx < 0) return levels[0].code;
  const next = Math.min(levels.length - 1, Math.max(0, idx + delta));
  return levels[next].code;
}
