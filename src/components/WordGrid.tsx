import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { KnowledgeItem } from '../db/userRepo';
import { colorOfMastery } from './GroupedList';
import { colors, radius, spacing, type } from '../lib/theme';

export default function WordGrid({
  items,
  onPress,
}: {
  items: KnowledgeItem[];
  onPress: (itemId: string) => void;
}) {
  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.itemId}
      numColumns={3}
      contentContainerStyle={styles.content}
      columnWrapperStyle={styles.wrap}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.cell, { borderColor: colorOfMastery(item.masteryState) }]}
          onPress={() => onPress(item.itemId)}
        >
          <Text style={styles.surface} numberOfLines={1}>
            {item.surface}
          </Text>
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
  wrap: { gap: spacing.sm, marginBottom: spacing.sm },
  cell: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  surface: { ...type.jaSmall, fontSize: 16 },
  meaning: { ...type.caption, marginTop: 2 },
  empty: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
