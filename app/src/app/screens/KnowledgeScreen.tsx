import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RootStackParamList } from '../navigation';
import { listItems, getStats } from '../../features/knowledge/service';
import { KnowledgeItem, ProgressStats } from '../../db/userRepo';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import { ItemType } from '../../lib/enums';
import { getActiveLanguageId } from '../../features/profile/languageService';
import { getLanguageProfile } from '../../lib/languages';
import { colorOfMastery } from '../../components/GroupedList';
import AlphabetGrid from '../../components/AlphabetGrid';
import PageHeader from '../../components/PageHeader';
import AppIcon from '../../components/AppIcon';
import { colors, radius, spacing, type } from '../../lib/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Knowledge'>;

/** 掌握度中文标签（原来直接显示英文枚举值 mastered/learning/new） */
function masteryLabel(state: string): string {
  if (state === 'mastered') return '已掌握';
  if (state === 'learning') return '学习中';
  return '新学';
}

type Tab = ItemType | 'alphabet';

export default function KnowledgeScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('word');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [stats, setStats] = useState<ProgressStats>({ learnedCount: 0, masteredCount: 0, dueCount: 0 });
  const alphabetLabel = `${getLanguageProfile(getActiveLanguageId()).scriptLabel}表`;
  const readingLabel = getLanguageProfile(getActiveLanguageId()).readingLabel;

  useFocusEffect(
    useCallback(() => {
      setStats(getStats(DEFAULT_USER_ID));
      // 字母表是独立页面，标签页本身不负责它的数据
      if (tab !== 'alphabet') setItems(listItems({ type: tab, query }, DEFAULT_USER_ID));
    }, [tab, query]),
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: 'word', label: '单词库' },
    { key: 'grammar', label: '语法库' },
    { key: 'alphabet', label: alphabetLabel },
  ];

  return (
    <View style={styles.container}>
      <PageHeader title="知识库" subtitle={getLanguageProfile(getActiveLanguageId()).name} />

      <View style={styles.body}>
        <View style={styles.statsRow}>
        <Stat label="已学" value={stats.learnedCount} />
        <Stat label="已掌握" value={stats.masteredCount} />
        <Stat label="待复习" value={stats.dueCount} />
      </View>

      {/* tab 区：三个 tab 占满可用宽度（横向可滚动兜底），
          「开始复习」收成图标按钮固定在右侧。
          原来是「三个 tab + 文字按钮」硬挤一行且不可滚动/换行，
          文字按钮被挤出屏幕右边缘。 */}
      <View style={styles.tabRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
          style={styles.tabsScroll}
        >
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={tab === t.key ? styles.tabTextActive : styles.tabText}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          style={styles.reviewBtn}
          accessibilityRole="button"
          accessibilityLabel={`开始复习，${stats.dueCount} 条待复习`}
          onPress={() => navigation.navigate('Review')}
        >
          {/* 用 play 而非 refresh：后者会被读成"刷新"。
              带文字是为了消除「待复习(统计)」与「开始复习(动作)」的歧义。 */}
          <AppIcon name="startReview" size={16} color={colors.textOnPrimary} />
          <Text style={styles.reviewBtnText}>复习</Text>
          {stats.dueCount > 0 ? <Text style={styles.reviewBadge}>{stats.dueCount}</Text> : null}
        </Pressable>
      </View>

      {/* 字母表不需要搜索框（按顺序浏览即可），也避免多一层视觉噪音 */}
      {tab !== 'alphabet' ? (
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={`搜索（${readingLabel}/释义）…`}
          placeholderTextColor={colors.textSecondary}
        />
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        {tab === 'alphabet' ? (
          <AlphabetGrid />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>还没有学过任何内容，先去对话里学一批吧</Text>
        ) : (
          items.map((i) => (
            <Pressable
              key={i.itemId}
              style={styles.row}
              onPress={() => navigation.navigate('ItemDetail', { itemId: i.itemId })}
            >
              <View style={styles.rowMain}>
                <View style={styles.surfaceRow}>
                  <Text style={styles.surface} numberOfLines={1}>
                    {i.surface}
                  </Text>
                  <Text style={styles.reading} numberOfLines={1}>
                    {i.reading}
                  </Text>
                </View>
              </View>
              <Text style={styles.meaning} numberOfLines={2}>
                {i.meaning}
              </Text>
              {/* 掌握度用颜色点 + 中文标签：原来直接显示英文枚举值 */}
              <View style={styles.stateRow}>
                <View style={[styles.dot, { backgroundColor: colorOfMastery(i.masteryState) }]} />
                <Text style={styles.state}>{masteryLabel(i.masteryState)}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
      </View>
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
  container: { flex: 1, backgroundColor: colors.appBg },
  // 页面内容统一内距；标题由 PageHeader 自己处理水平内距
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.trackBg,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  statValue: { ...type.title3 },
  statLabel: { ...type.caption, marginTop: 2 },
  // tab 与按钮同一行的容器：按钮 flexShrink: 0，tab 区可压缩
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  tabsScroll: { flex: 1 },
  // 注意：这里不要 flex:1，横向 ScrollView 的内容容器必须按内容宽度排布
  tabs: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: spacing.xs },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...type.subhead, color: colors.text },
  tabTextActive: { ...type.subhead, color: colors.textOnPrimary, fontWeight: '700' },
  reviewBtn: {
    // 关键：不允许被挤扁或推出屏幕
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  reviewBadge: { ...type.captionStrong, color: colors.textOnPrimary },
  reviewBtnText: { ...type.captionStrong, color: colors.textOnPrimary },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    ...type.body,
  },
  list: { paddingBottom: spacing.xl },
  empty: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  /**
   * 注意：这里曾经是 `width: 130`（按日语估的固定宽度）。
   * 韩语的「죄송합니다 + joesonghamnida」远超 130px，溢出后直接压在释义上造成叠字。
   * 现在改为可伸缩：给字号设上限（flexShrink + numberOfLines），让释义总能拿到空间。
   */
  rowMain: { flexShrink: 1, maxWidth: '55%' },
  surfaceRow: { flexDirection: 'row', alignItems: 'baseline' },
  surface: { ...type.jaSmall, marginRight: spacing.xs, flexShrink: 1 },
  reading: { ...type.caption, flexShrink: 1 },
  meaning: { ...type.body, flex: 1, marginLeft: spacing.md, color: colors.text },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  state: { ...type.caption },
});
