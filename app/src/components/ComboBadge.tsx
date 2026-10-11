// 连击徽章：连击 ≥3 时点亮并做脉冲
import { Animated, StyleSheet, Text, View } from 'react-native';
import { usePulse } from '../lib/anim';
import { colors, radius, spacing, type } from '../lib/theme';
import { XP_COMBO_THRESHOLD } from '../features/progress/xp';
import AppIcon from './AppIcon';

interface Props {
  combo: number;
  compact?: boolean;
}

export default function ComboBadge({ combo, compact = false }: Props) {
  const pulse = usePulse(combo);
  const active = combo >= XP_COMBO_THRESHOLD;

  if (combo <= 1) return null;

  return (
    <Animated.View
      style={[
        styles.chip,
        active ? styles.chipActive : styles.chipIdle,
        { transform: [{ scale: pulse }] },
      ]}
    >
      <AppIcon
        name="streak"
        size={14}
        color={active ? colors.streak : colors.textTertiary}
      />
      <Text style={[styles.text, active ? styles.textActive : styles.textIdle]}>{combo}</Text>
      {!compact && active ? <Text style={styles.bonus}>加成中</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  chipIdle: { backgroundColor: colors.surfaceSunken },
  chipActive: { backgroundColor: colors.primarySoft },
  text: { ...type.captionStrong },
  textIdle: { color: colors.textTertiary },
  textActive: { color: colors.primaryText },
  bonus: { ...type.caption, color: colors.primaryText, fontWeight: '700' },
});
