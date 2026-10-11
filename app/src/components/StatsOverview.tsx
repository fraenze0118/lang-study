import { StyleSheet, Text, View } from 'react-native';
import { ProgressStats } from '../db/userRepo';
import { MasteryDistribution } from '../features/knowledge/service';
import { colors, radius, spacing, shadow, type } from '../lib/theme';
import ProgressBar from './ProgressBar';

export default function StatsOverview({
  stats,
  distribution,
  streakDays,
  todayXp,
  dailyGoalXp,
}: {
  stats: ProgressStats;
  distribution: MasteryDistribution;
  streakDays?: number;
  todayXp?: number;
  dailyGoalXp?: number;
}) {
  const total = distribution.new + distribution.learning + distribution.mastered || 1;
  const goal = dailyGoalXp ?? 0;

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Stat label="已学" value={stats.learnedCount} />
        <Stat label="已掌握" value={stats.masteredCount} />
        <Stat label="待复习" value={stats.dueCount} />
      </View>

      <View style={styles.bar}>
        <View style={[styles.seg, { flex: distribution.new / total, backgroundColor: colors.masteryNew }]} />
        <View style={[styles.seg, { flex: distribution.learning / total, backgroundColor: colors.primary }]} />
        <View style={[styles.seg, { flex: distribution.mastered / total, backgroundColor: colors.success }]} />
      </View>
      <View style={styles.legend}>
        <Legend color={colors.masteryNew} label={`新学 ${distribution.new}`} />
        <Legend color={colors.primary} label={`学习中 ${distribution.learning}`} />
        <Legend color={colors.success} label={`已掌握 ${distribution.mastered}`} />
      </View>

      {goal > 0 ? (
        <View style={styles.goalBox}>
          <View style={styles.goalHead}>
            <Text style={styles.goalLabel}>
              🔥 连续 {streakDays ?? 0} 天 · 今日目标
            </Text>
            <Text style={styles.goalValue}>
              {Math.min(todayXp ?? 0, goal)} / {goal} XP
            </Text>
          </View>
          <ProgressBar
            ratio={(todayXp ?? 0) / goal}
            height={8}
            color={(todayXp ?? 0) >= goal ? colors.success : colors.primary}
          />
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    ...shadow.card,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  statBox: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statValue: { ...type.stat, fontSize: 22 },
  statLabel: { ...type.caption, marginTop: 2 },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginTop: spacing.md,
    backgroundColor: colors.trackBg,
  },
  seg: { height: '100%' },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: radius.pill },
  legendText: { ...type.caption },
  goalBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  goalLabel: { ...type.label },
  goalValue: { ...type.label, color: colors.primary },
});
