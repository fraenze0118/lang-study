// 设计令牌（v2 游戏化）：颜色 / 间距 / 圆角 / 字阶 / 阴影
// 约定：所有页面与组件只从这里取样式值，禁止再写裸 hex。
import type { TextStyle } from 'react-native';

export const colors = {
  // —— 品牌色（保留 v1 键名，避免破坏既有引用）——
  primary: '#ea580c', // 主色·温暖橙
  primarySoft: '#fff7ed',
  primaryBorder: '#fed7aa',
  primaryText: '#9a3412',
  primaryDeep: '#c2410c', // 3D 按钮底边 / 强调文字
  success: '#16a34a',
  danger: '#dc2626',
  amber: '#d97706',
  info: '#2563eb',
  bg: '#ffffff',
  surface: '#f8fafc',
  text: '#111827',
  textSecondary: '#64748b',
  border: '#e2e8f0',

  // —— 游戏化新增 ——
  appBg: '#fdfcfb', // 页面底色（暖白，替代裸 #fdfcfb）
  cardBorder: '#f1e5db', // 卡片边框（暖灰）
  successSoft: '#dcfce7',
  successText: '#15803d',
  successDeep: '#15803d', // 成功按钮底边
  dangerSoft: '#fee2e2',
  dangerText: '#b91c1c',
  dangerDeep: '#991b1b', // 危险按钮底边
  primarySoftStrong: '#ffedd5', // 比 primarySoft 更实一档的暖橙底（连击徽章等）
  streak: '#f97316', // 连续天数火焰
  streakIdle: '#cbd5e1', // 今日未达成的灰化火焰
  masteryNew: '#9ca3af',
  trackBg: '#f1f5f9', // 进度条轨道
  overlay: 'rgba(15, 23, 42, 0.45)',
  textOnPrimary: '#ffffff',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** 3D 按钮底边厚度（多邻国式“可按下去”的关键） */
export const BUTTON_DEPTH = 4;

export const type = {
  /** 日语词条：大字号，是视觉主角 */
  jaWord: { fontSize: 40, fontWeight: '700', lineHeight: 52, color: colors.text } as TextStyle,
  ja: { fontSize: 24, fontWeight: '600', lineHeight: 34, color: colors.text } as TextStyle,
  jaSmall: { fontSize: 17, fontWeight: '600', lineHeight: 24, color: colors.text } as TextStyle,
  kana: { fontSize: 15, lineHeight: 22, color: colors.textSecondary } as TextStyle,
  zh: { fontSize: 16, lineHeight: 24, color: colors.text } as TextStyle,
  body: { fontSize: 15, lineHeight: 22, color: colors.text } as TextStyle,
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary } as TextStyle,
  caption: { fontSize: 12, color: colors.textSecondary } as TextStyle,
  h1: { fontSize: 22, fontWeight: '700', color: colors.text } as TextStyle,
  h2: { fontSize: 18, fontWeight: '700', color: colors.text } as TextStyle,
  /** 大数字（统计、经验值） */
  stat: { fontSize: 26, fontWeight: '700', color: colors.primary } as TextStyle,
} as const;

export const shadow = {
  card: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;
