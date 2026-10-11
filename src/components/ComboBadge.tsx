// 连击徽章：连击 ≥3 时显示并做脉冲
import { Animated, StyleSheet, Text, View } from 'react-native';
import { usePulse } from '../lib/anim';
import { colors, radius, spacing, type } from '../lib/theme';
import { XP_COMBO_THRESHOLD } from '../features/progress/xp';

interface Props {
  combo: number;
  /** 连击进度（本轮已答对数），用于显示 x/y */
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
      <Text style={[styles.text, active ? styles.textActive : styles.textIdle]}>
        🔥 {combo}
      </Text>
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
  chipIdle: { backgroundColor: colors.trackBg },
  chipActive: { backgroundColor: colors.primarySoftStrong },
  text: { ...type.label, fontSize: 14 },
  textIdle: { color: colors.textSecondary },
  textActive: { color: colors.primaryText },
  bonus: { fontSize: 11, color: colors.primaryText, fontWeight: '700' },
});
