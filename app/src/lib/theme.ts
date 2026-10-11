// 设计令牌（方案 A：中性系统 + 单一强调色）
//
// 设计原则（改动样式前先读这段）：
// 1. 中性色占 85~90% 面积，品牌橙只出现在**行动点**（主按钮、当前选中态）。
//    任何"为了好看"而加橙色装饰的做法都不符合本系统。
// 2. 字阶 9 档，按 ~1.15 / 1.2 模数递进，不再逐像素挑字号。
// 3. 圆角 5 档、间距走 4pt 网格、层次用 3 级阴影而非边框。
// 4. 图标一律用 @expo/vector-icons（Ionicons），**禁止 emoji**：
//    emoji 在不同平台字形不同且自带彩色，会立刻拉低产品感。
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  // —— 品牌色（只用于行动点与选中态）——
  primary: '#ea580c',
  primaryDeep: '#c2410c', // 3D 按钮底边 / 强调文字
  primaryText: '#9a3412', // 暖色底上的文字
  primarySoft: '#fff7ed', // 极浅暖底（选中态背景）
  primaryBorder: '#fed7aa',

  // —— 中性色阶（界面主体）——
  // 用中性灰做页面底、白做卡片，靠明度差分层，而不是靠描边
  appBg: '#f6f7f9',
  surface: '#ffffff', // 卡片 / 面板
  surfaceSunken: '#eff1f4', // 次级块（统计格、输入框）
  border: '#e4e7ec', // 需要描边时的极浅线
  borderStrong: '#d0d5dd',
  trackBg: '#eceef2', // 进度条轨道

  // —— 文字层级（4 档，用对比度建立主次）——
  text: '#101828',
  textSecondary: '#475467',
  textTertiary: '#667085',
  textDisabled: '#98a2b3',
  textOnPrimary: '#ffffff',

  // —— 语义色（成对：底 + 文字）——
  success: '#12a150',
  successDeep: '#0e8443',
  successSoft: '#e7f7ee',
  successText: '#067647',
  danger: '#e5484d',
  dangerDeep: '#c62a2f',
  dangerSoft: '#fdecec',
  dangerText: '#b42318',
  warning: '#d97706',
  warningSoft: '#fef6e7',
  warningText: '#b54708',
  info: '#2e6ff2',
  infoSoft: '#eaf1fe',
  infoText: '#1d4ed8',

  // —— 掌握度（知识库 / 分组用）——
  masteryNew: '#98a2b3',
  masteryLearning: '#ea580c',
  masteryMastered: '#12a150',

  // —— 特殊 ——
  streak: '#f97316',
  streakIdle: '#98a2b3',
  overlay: 'rgba(16, 24, 40, 0.45)',
  // 小标题（kicker）：全大写/字距拉开时的低对比标签色
  kicker: '#667085',

  // —— v2 遗留别名（映射到新中性体系）——
  // 迁移期间保留，避免一次性改动 20 个文件；新代码请用上面的语义名。
  /** @deprecated 用 surface（卡片白） */
  bg: '#ffffff',
  /** @deprecated 用 border（浅描边） */
  cardBorder: '#e4e7ec',
  /** @deprecated 用 primarySoft（选中态暖底） */
  primarySoftStrong: '#ffedd5',
  /** @deprecated 用 warning */
  amber: '#d97706',
} as const;

/** 4pt 网格 */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** 圆角 5 档 */
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

/** 3D 按钮底边厚度（保留游戏化手感） */
export const BUTTON_DEPTH = 4;

/**
 * 字阶：9 档。
 * 选型理由：body 16 是长文本阅读的基准（例句/讲解会大量使用），
 * 上下按 ~1.15 / 1.2 递进，display 40 留给日语词条这种"视觉主角"。
 * 新增样式请复用下列角色，不要临时挑字号。
 */
export const type = {
  /** 40 大字：词条主角（学习页闪卡） */
  display: { fontSize: 40, lineHeight: 48, fontWeight: '700', color: colors.text } as TextStyle,
  /** 32：结算页数字、字母表字形 */
  title1: { fontSize: 32, lineHeight: 40, fontWeight: '700', color: colors.text } as TextStyle,
  /** 26：页面标题 */
  title2: { fontSize: 26, lineHeight: 34, fontWeight: '700', color: colors.text } as TextStyle,
  /** 22：区块标题 */
  title3: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: colors.text } as TextStyle,
  /** 18：卡片标题、强调正文 */
  headline: { fontSize: 18, lineHeight: 26, fontWeight: '600', color: colors.text } as TextStyle,
  /** 16：正文基准（例句、讲解） */
  body: { fontSize: 16, lineHeight: 24, color: colors.text } as TextStyle,
  /** 16 强调 */
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.text } as TextStyle,
  /** 14：次要正文、列表副标题 */
  subhead: { fontSize: 14, lineHeight: 20, color: colors.textSecondary } as TextStyle,
  /** 14 强调 */
  subheadStrong: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.text,
  } as TextStyle,
  /** 12：标签、说明 */
  caption: { fontSize: 12, lineHeight: 16, color: colors.textTertiary } as TextStyle,
  /** 12 强调 */
  captionStrong: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  } as TextStyle,

  // —— 以下为 v2 遗留别名，映射到上面的新字阶 ——
  // 迁移期间保留，避免一次性改动 20 个文件；新代码请直接用上面的角色名。
  /** @deprecated 用 display */
  jaWord: { fontSize: 40, lineHeight: 48, fontWeight: '700', color: colors.text } as TextStyle,
  /** @deprecated 用 title3（词条中等字号） */
  ja: { fontSize: 22, lineHeight: 30, fontWeight: '600', color: colors.text } as TextStyle,
  /** @deprecated 用 headline */
  jaSmall: { fontSize: 18, lineHeight: 26, fontWeight: '600', color: colors.text } as TextStyle,
  /** @deprecated 用 subhead（发音标注） */
  kana: { fontSize: 14, lineHeight: 20, color: colors.textSecondary } as TextStyle,
  /** @deprecated 用 body */
  zh: { fontSize: 16, lineHeight: 24, color: colors.text } as TextStyle,
  /** @deprecated 用 captionStrong */
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.textTertiary } as TextStyle,
  /** @deprecated 用 title3 */
  h1: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: colors.text } as TextStyle,
  /** @deprecated 用 headline */
  h2: { fontSize: 18, lineHeight: 26, fontWeight: '700', color: colors.text } as TextStyle,
  /** @deprecated 用 title1（统计大数字） */
  stat: { fontSize: 32, lineHeight: 40, fontWeight: '700', color: colors.primary } as TextStyle,
} as const;

/**
 * 3 级阴影：用明度与投影建立层级，取代"到处加 1px 边框"。
 * elevated = 卡片；floating = 浮起元素（按钮、选中卡）；overlay = 弹层。
 */
export const elevation = {
  elevated: {
    shadowColor: '#101828',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  } as ViewStyle,
  floating: {
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  } as ViewStyle,
  overlay: {
    shadowColor: '#101828',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  } as ViewStyle,
} as const;

/** 触控目标最小边长（无障碍） */
export const HIT_SIZE = 44;
