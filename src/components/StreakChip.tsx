// 连续天数芯片：今日已达成时点亮，否则灰化（不清零，只是提示）
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '../lib/theme';

interface Props {
  days: number;
  todayDone: boolean;
}

export default function StreakChip({ days, todayDone }: Props) {
  const active = todayDone && days > 0;

  return (
    <View style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      <Text style={styles.flame}>{active ? '🔥' : '🕯️'}</Text>
      <Text style={[styles.text, active ? styles.textActive : styles.textIdle]}>
        {days > 0 ? `${days} 天` : '连续 0 天'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder },
  chipIdle: { backgroundColor: colors.trackBg, borderColor: colors.border },
  flame: { fontSize: 14 },
  text: { ...type.label },
  textActive: { color: colors.primaryText },
  textIdle: { color: colors.textSecondary },
});
