import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { KnowledgeGroup } from '../features/knowledge/group';
import { KnowledgeItem } from '../db/userRepo';
import { colors, radius, spacing, type } from '../lib/theme';
import { tapFeedback } from '../lib/haptics';
import ProgressBar from './ProgressBar';

export function colorOfMastery(mastery: string): string {
  if (mastery === 'mastered') return colors.success;
  if (mastery === 'learning') return colors.primary;
  return colors.masteryNew;
}

export default function GroupedList({
  groups,
  onPress,
}: {
  groups: KnowledgeGroup[];
  onPress: (itemId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sections = groups.map((g) => ({
    title: g.title,
    data: collapsed[g.title] ? [] : g.items,
  }));

  return (
    <SectionList<KnowledgeItem>
      sections={sections}
      keyExtractor={(item) => item.itemId}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.content}
      renderSectionHeader={({ section }) => {
        const g = groups.find((x) => x.title === section.title);
        const mastered = g?.items.filter((i) => i.masteryState === 'mastered').length ?? 0;
        const count = g?.items.length ?? 0;
        const isCollapsed = !!collapsed[section.title];
        return (
          <Pressable
            style={styles.header}
            onPress={() => {
              tapFeedback();
              setCollapsed((c) => ({ ...c, [section.title]: !c[section.title] }));
            }}
          >
            <View style={styles.headerMain}>
              <Text style={styles.headerTitle}>{section.title}</Text>
              <Text style={styles.headerMeta}>
                {count} 条 · 已掌握 {mastered}
              </Text>
              <ProgressBar
                ratio={count > 0 ? mastered / count : 0}
                height={5}
                color={colors.success}
                style={styles.headerBar}
              />
            </View>
            <Text style={styles.chevron}>{isCollapsed ? '▸' : '▾'}</Text>
          </Pressable>
        );
      }}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => onPress(item.itemId)}>
          <View style={[styles.dot, { backgroundColor: colorOfMastery(item.masteryState) }]} />
          <Text style={styles.surface}>{item.surface}</Text>
          <Text style={styles.reading}>{item.reading}</Text>
          <Text style={styles.meaning} numberOfLines={1}>
            {item.meaning}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.empty}>没有内容</Text>}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.appBg,
  },
  headerMain: { flex: 1 },
  headerTitle: { ...type.h2, fontSize: 16 },
  headerMeta: { ...type.caption, marginTop: 2 },
  headerBar: { marginTop: spacing.xs, maxWidth: 140 },
  chevron: { fontSize: 14, color: colors.textSecondary, marginLeft: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  dot: { width: 10, height: 10, borderRadius: radius.pill, marginRight: spacing.sm },
  surface: { ...type.jaSmall, marginRight: spacing.sm },
  reading: { ...type.caption, marginRight: spacing.sm },
  meaning: { ...type.caption, color: colors.text, flex: 1 },
  empty: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
