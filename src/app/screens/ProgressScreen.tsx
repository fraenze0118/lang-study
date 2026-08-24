import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import { getLearnedItems, getProgressStats, LearnedItem, ProgressStats } from '../../db/userRepo';

export default function ProgressScreen() {
  const [stats, setStats] = useState<ProgressStats>({ learnedCount: 0, masteredCount: 0, dueCount: 0 });
  const [items, setItems] = useState<LearnedItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      setStats(getProgressStats(DEFAULT_USER_ID));
      setItems(getLearnedItems(DEFAULT_USER_ID));
    }, []),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.stats}>
        <Stat label="已学" value={stats.learnedCount} />
        <Stat label="已掌握" value={stats.masteredCount} />
        <Stat label="待复习" value={stats.dueCount} />
      </View>

      <Text style={styles.title}>已学条目</Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>还没有学过任何内容</Text>
      ) : (
        items.map((i) => (
          <View key={i.itemId} style={styles.row}>
            <Text style={styles.surface}>{i.surface}</Text>
            <Text style={styles.reading}>{i.reading}</Text>
            <Text style={styles.meaning}>{i.meaning}</Text>
            <Text style={styles.state}>{i.masteryState}</Text>
          </View>
        ))
      )}
    </ScrollView>
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
  container: { padding: 16, backgroundColor: '#fff' },
  stats: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 12, alignItems: 'center', paddingVertical: 18 },
  statValue: { fontSize: 26, fontWeight: '700', color: '#ea580c' },
  statLabel: { fontSize: 13, color: '#64748b', marginTop: 4 },
  title: { fontSize: 17, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  empty: { color: '#999' },
  row: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  surface: { fontSize: 18, fontWeight: '600', marginRight: 8 },
  reading: { fontSize: 13, color: '#666', marginRight: 8 },
  meaning: { fontSize: 14, color: '#333', flex: 1 },
  state: { fontSize: 12, color: '#ea580c' },
});
