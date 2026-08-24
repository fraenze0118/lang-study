import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RootStackParamList } from '../navigation';
import { listItems, getStats } from '../../features/knowledge/service';
import { KnowledgeItem, ProgressStats } from '../../db/userRepo';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import { ItemType } from '../../lib/enums';

type Props = NativeStackScreenProps<RootStackParamList, 'Knowledge'>;

export default function KnowledgeScreen({ navigation }: Props) {
  const [tab, setTab] = useState<ItemType>('word');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [stats, setStats] = useState<ProgressStats>({ learnedCount: 0, masteredCount: 0, dueCount: 0 });

  useFocusEffect(
    useCallback(() => {
      setStats(getStats(DEFAULT_USER_ID));
      setItems(listItems({ type: tab, query }, DEFAULT_USER_ID));
    }, [tab, query]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <Stat label="已学" value={stats.learnedCount} />
        <Stat label="已掌握" value={stats.masteredCount} />
        <Stat label="待复习" value={stats.dueCount} />
      </View>

      <View style={styles.tabs}>
        {(['word', 'grammar'] as ItemType[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={tab === t ? styles.tabTextActive : styles.tabText}>
              {t === 'word' ? '单词库' : '语法库'}
            </Text>
          </Pressable>
        ))}
        <Pressable style={styles.reviewBtn} onPress={() => navigation.navigate('Review')}>
          <Text style={styles.reviewBtnText}>开始复习</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="搜索（假名/汉字/释义）…"
      />

      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 ? (
          <Text style={styles.empty}>还没有学过任何内容，先去对话里学一批吧</Text>
        ) : (
          items.map((i) => (
            <Pressable
              key={i.itemId}
              style={styles.row}
              onPress={() => navigation.navigate('ItemDetail', { itemId: i.itemId })}
            >
              <View style={styles.rowMain}>
                <Text style={styles.surface}>{i.surface}</Text>
                <Text style={styles.reading}>{i.reading}</Text>
              </View>
              <Text style={styles.meaning}>{i.meaning}</Text>
              <Text style={styles.state}>{i.masteryState}</Text>
            </Pressable>
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
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 12, alignItems: 'center', paddingVertical: 14 },
  statValue: { fontSize: 22, fontWeight: '700', color: '#ea580c' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  tabActive: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
  tabText: { color: '#334155' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  reviewBtn: { marginLeft: 'auto', backgroundColor: '#16a34a', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  reviewBtnText: { color: '#fff', fontWeight: '700' },
  search: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, marginTop: 12, fontSize: 15 },
  list: { paddingBottom: 24 },
  empty: { color: '#999', textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  rowMain: { flexDirection: 'row', alignItems: 'baseline', width: 130 },
  surface: { fontSize: 18, fontWeight: '600', marginRight: 6 },
  reading: { fontSize: 13, color: '#666' },
  meaning: { fontSize: 14, color: '#333', flex: 1, marginLeft: 8 },
  state: { fontSize: 12, color: '#ea580c' },
});
