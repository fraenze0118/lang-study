// 图标：全部经此组件使用，**不要直接写 emoji**
//
// 为什么单独封一层：
// 1. emoji 在不同平台字形不同、自带彩色，是"看起来像 demo"的最大来源；
// 2. 集中在此便于统一尺寸/颜色/线宽，避免各处自己调；
// 3. 语义名（如 'streak'）与具体图标解耦，将来换图标集只改这里。
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

/** 语义名 → Ionicons 图标名 */
export const icons = {
  // 导航与入口
  settings: 'settings-outline',
  review: 'refresh-outline',
  knowledge: 'library-outline',
  progress: 'stats-chart-outline',
  alphabet: 'text-outline',
  send: 'arrow-up-circle',
  chat: 'chatbubble-ellipses-outline',

  // 学习
  lesson: 'book-outline',
  speak: 'volume-medium-outline',
  tip: 'bulb-outline',
  grammar: 'construct-outline',

  // 状态与反馈
  correct: 'checkmark-circle',
  wrong: 'close-circle',
  close: 'close',
  warning: 'alert-circle-outline',
  streak: 'flame',
  streakIdle: 'flame-outline',
  trophy: 'trophy',
  celebrate: 'sparkles',
  perfect: 'ribbon',
  error: 'sad-outline',
  empty: 'leaf-outline',

  // 结构
  chevronRight: 'chevron-forward',
  chevronDown: 'chevron-down',
  caretDown: 'caret-down',
  check: 'checkmark',
  globe: 'globe-outline',
} as const;

export type IconName = keyof typeof icons;

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

export default function AppIcon({ name, size = 20, color = colors.textSecondary }: Props) {
  return <Ionicons name={icons[name] as never} size={size} color={color} />;
}
