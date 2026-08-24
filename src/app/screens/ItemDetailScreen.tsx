import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RootStackParamList } from '../navigation';
import { getExamplesByItem, getItem } from '../../db/repo';
import { checkSentence, startSession } from '../../features/ask/service';
import SpeakerButton from '../../components/SpeakerButton';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export default function ItemDetailScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const item = getItem(itemId);
  const examples = getExamplesByItem(itemId);
  const [sentence, setSentence] = useState('');
  const [checking, setChecking] = useState(false);

  if (!item) {
    return (
      <View style={styles.center}>
        <Text>未找到条目</Text>
      </View>
    );
  }

  const onCheckSentence = async () => {
    const text = sentence.trim();
    if (!text || checking) return;
    setChecking(true);
    try {
      const sessionId = startSession(itemId);
      await checkSentence({ sessionId, itemId, sentence: text });
      navigation.navigate('Ask', { sessionId, itemId });
    } catch (e) {
      // 忽略，直接进入答疑页
      const sessionId = startSession(itemId);
      navigation.navigate('Ask', { sessionId, itemId });
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.surfaceRow}>
        <Text style={styles.surface}>{item.surface}</Text>
        <SpeakerButton text={item.reading} size={24} />
      </View>
      <Text style={styles.reading}>{item.reading}</Text>
      <Text style={styles.meaning}>{item.meaning}</Text>
      {item.pos ? <Text style={styles.meta}>词性：{item.pos}</Text> : null}
      {item.pattern ? <Text style={styles.meta}>句型：{item.pattern}</Text> : null}

      {examples.length > 0 && <Text style={styles.subTitle}>例句</Text>}
      {examples.map((ex) => (
        <View key={ex.id} style={styles.example}>
          <View style={styles.jaRow}>
            <Text style={styles.ja}>{ex.ja}</Text>
            <SpeakerButton text={ex.ja} size={16} />
          </View>
          <Text style={styles.kana}>{ex.kana}</Text>
          <Text style={styles.zh}>{ex.zh}</Text>
        </View>
      ))}

      <Pressable style={styles.askBtn} onPress={() => navigation.navigate('Ask', { itemId })}>
        <Text style={styles.askBtnText}>问 AI</Text>
      </Pressable>

      <Text style={styles.subTitle}>造句给 AI 点评</Text>
      <TextInput
        style={styles.sentenceInput}
        value={sentence}
        onChangeText={setSentence}
        placeholder="用这个单词/语法造个句子…"
        multiline
      />
      <Pressable style={styles.checkBtn} onPress={onCheckSentence} disabled={checking}>
        <Text style={styles.checkBtnText}>{checking ? '点评中…' : '点评'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  surface: { fontSize: 32, fontWeight: '700' },
  surfaceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  jaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reading: { fontSize: 20, color: '#666', marginTop: 4 },
  meaning: { fontSize: 18, color: '#333', marginTop: 8 },
  meta: { fontSize: 14, color: '#64748b', marginTop: 4 },
  subTitle: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  example: { paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: '#cbd5e1', marginBottom: 8 },
  ja: { fontSize: 16, fontWeight: '600' },
  kana: { fontSize: 13, color: '#666' },
  zh: { fontSize: 14, color: '#333' },
  askBtn: { backgroundColor: '#ea580c', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  askBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sentenceInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, minHeight: 60, fontSize: 15, marginBottom: 8 },
  checkBtn: { backgroundColor: '#16a34a', padding: 12, borderRadius: 10, alignItems: 'center' },
  checkBtnText: { color: '#fff', fontWeight: '700' },
});
