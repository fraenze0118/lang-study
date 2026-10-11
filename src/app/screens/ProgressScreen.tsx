import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import { getLearnedItems, getProgressStats, LearnedItem, ProgressStats } from '../../db/userRepo';
import { getDayTotals, getOverview, ProgressOverview } from '../../features/progress/service';
import { localDateKey, recentDateKeys } from '../../features/progress/streak';
import { getActiveLanguageId } from '../../features/profile/languageService';
import { getLanguageProfile } from '../../lib/languages';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';
import ProgressBar from '../../components/ProgressBar';
import StreakChip from '../../components/StreakChip';
import PageHeader from '../../components/PageHeader';

const WEEK_DAYS = 7;

export default function ProgressScreen() {
  const [stats, setStats] = useState<ProgressStats>({
    learnedCount: 0,
    masteredCount: 0,
    dueCount: 0,
  });
  const [items, setItems] = useState<LearnedItem[]>([]);
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [weekXp, setWeekXp] = useState<number[]>([]);
  const [languageName, setLanguageName] = useState('');

  useFocusEffect(
    useCallback(() => {
      // 统计与已学列表只看当前语种；经验/连续天数是全局的
      const languageId = getActiveLanguageId();
      setLanguageName(getLanguageProfile(languageId).name);
      setStats(getProgressStats(DEFAULT_USER_ID, languageId));
      setItems(getLearnedItems(DEFAULT_USER_ID, languageId));
      try {
        setOverview(getOverview(DEFAULT_USER_ID));
        const todayKey = localDateKey(Date.now());
        const keys = recentDateKeys(todayKey, WEEK_DAYS);
        const totals = getDayTotals(DEFAULT_USER_ID, WEEK_DAYS);
        const byDate = new Map(totals.map((d) => [d.date, d.xp]));
        setWeekXp(keys.map((k) => byDate.get(k) ?? 0));
      } catch {
        // 忽略
      }
    }, []),
  );

  const todayKey = useMemo(() => localDateKey(Date.now()), []);
  const weekKeys = useMemo(() => recentDateKeys(todayKey, WEEK_DAYS), [todayKey]);
  const maxWeekXp = Math.max(1, ...weekXp);

  return (
    <View style={styles.flex}>
      <PageHeader title="学习记录" subtitle={languageName} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.stats}>
        <Stat label="已学" value={stats.learnedCount} />
        <Stat label="已掌握" value={stats.masteredCount} />
        <Stat label="待复习" value={stats.dueCount} />
      </View>

      {/* 今日目标 + 连续天数（全局） */}
      {overview && overview.streak.goalXp > 0 ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>今日目标</Text>
            <StreakChip days={overview.streak.current} todayDone={overview.streak.todayDone} />
          </View>
          <ProgressBar
            ratio={overview.xpToday / overview.streak.goalXp}
            height={10}
            color={overview.streak.todayDone ? colors.success : colors.primary}
          />
          <Text style={styles.cardMeta}>
            {Math.min(overview.xpToday, overview.streak.goalXp)} / {overview.streak.goalXp} XP
            {overview.streak.todayDone ? ' · 已达成 ✅' : ''}
          </Text>
        </View>
      ) : null}

      {/* 近 7 天经验柱状（不引入图表库，纯 View） */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>近 7 天经验</Text>
        <View style={styles.chart}>
          {weekXp.map((xp, i) => {
            const ratio = xp / maxWeekXp;
            const isToday = weekKeys[i] === todayKey;
            return (
              <View key={weekKeys[i]} style={styles.chartCol}>
                <Text style={styles.chartValue}>{xp > 0 ? xp : ''}</Text>
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: `${Math.max(4, ratio * 100)}%`,
                        backgroundColor: isToday ? colors.primary : colors.primaryBorder,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartLabel, isToday && styles.chartLabelToday]}>
                  {weekKeys[i].slice(5)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <Text style={styles.title}>已学条目</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>还没有学过任何内容</Text>
      ) : (
        items.map((i) => (
          <View key={i.itemId} style={styles.row}>
            <Text style={styles.surface}>{i.surface}</Text>
            <Text style={styles.reading}>{i.reading}</Text>
            <Text style={styles.meaning} numberOfLines={1}>
              {i.meaning}
            </Text>
          </View>
        ))
      )}
      </ScrollView>
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.appBg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, backgroundColor: colors.appBg },
  stats: { flexDirection: 'row', gap: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  statValue: { ...type.stat },
  statLabel: { ...type.caption, marginTop: spacing.xs },

  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardTitle: { ...type.h2, fontSize: 16 },
  cardMeta: { ...type.caption, marginTop: spacing.sm },

  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
    height: 120,
  },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  chartValue: { ...type.caption, fontSize: 10 },
  chartTrack: { flex: 1, width: '70%', justifyContent: 'flex-end', marginVertical: spacing.xs },
  chartBar: { width: '100%', borderRadius: radius.sm },
  chartLabel: { ...type.caption, fontSize: 10 },
  chartLabelToday: { color: colors.primary, fontWeight: '700' },

  title: { ...type.h2, marginTop: spacing.xl, marginBottom: spacing.sm },
  empty: { ...type.body, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  surface: { ...type.jaSmall, marginRight: spacing.sm },
  reading: { ...type.caption, marginRight: spacing.sm },
  meaning: { ...type.body, flex: 1 },
});
