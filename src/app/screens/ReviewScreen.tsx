import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DueReviewSummary } from '../../db/userRepo';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import { getQueue, grade } from '../../features/review/service';
import { ReviewGrade } from '../../lib/enums';
import SpeakerButton from '../../components/SpeakerButton';

const GRADES: { grade: ReviewGrade; label: string; color: string }[] = [
  { grade: 'Again', label: 'Again\n忘了', color: '#dc2626' },
  { grade: 'Hard', label: 'Hard\n吃力', color: '#d97706' },
  { grade: 'Good', label: 'Good\n记得', color: '#16a34a' },
  { grade: 'Easy', label: 'Easy\n轻松', color: '#2563eb' },
];

export default function ReviewScreen() {
  const [queue, setQueue] = useState<DueReviewSummary[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setQueue(getQueue(DEFAULT_USER_ID));
  }, []);

  const current = queue[index];

  if (!current) {
    return (
      <View style={styles.center}>
        <Text style={styles.done}>今日复习已完成 🎉</Text>
      </View>
    );
  }

  const rate = (g: ReviewGrade) => {
    try {
      grade(current.stateId, g, 0);
    } catch (e) {
      // 评分失败不阻断流程
    }
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} / {queue.length}
      </Text>

      <Pressable style={styles.card} onPress={() => setRevealed(true)}>
        <Text style={styles.surface}>{current.surface}</Text>
        {revealed ? (
          <>
            <Text style={styles.reading}>{current.reading}</Text>
            <Text style={styles.meaning}>{current.meaning}</Text>
            <SpeakerButton text={current.reading} size={24} />
          </>
        ) : (
          <Text style={styles.hint}>点击翻面查看释义</Text>
        )}
      </Pressable>

      {revealed && (
        <View style={styles.buttons}>
          {GRADES.map((g) => (
            <Pressable
              key={g.grade}
              style={[styles.gradeBtn, { backgroundColor: g.color }]}
              onPress={() => rate(g.grade)}
            >
              <Text style={styles.gradeLabel}>{g.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progress: { textAlign: 'center', color: '#888', marginBottom: 12 },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  surface: { fontSize: 40, fontWeight: '700' },
  reading: { fontSize: 22, color: '#666', marginTop: 16 },
  meaning: { fontSize: 20, color: '#333', marginTop: 8 },
  hint: { color: '#aaa', marginTop: 16 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 16 },
  gradeBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  gradeLabel: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 14 },
  done: { fontSize: 20, fontWeight: '700', color: '#16a34a' },
});
