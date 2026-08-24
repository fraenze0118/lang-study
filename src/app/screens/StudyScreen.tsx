import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation';
import {
  commitSession,
  consumePendingSession,
  generateSessionData,
  prefetchNextBatch,
  StudySessionData,
} from '../../features/study/service';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import SpeakerButton from '../../components/SpeakerButton';

type Props = NativeStackScreenProps<RootStackParamList, 'Study'>;

type Exercise = {
  type: 'choice' | 'fill' | 'translate';
  prompt: string;
  options?: string[] | null;
  answer: string;
  explanation: string;
};

export default function StudyScreen({ route, navigation }: Props) {
  const { preview } = route.params;
  const [session, setSession] = useState<StudySessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const committedRef = useRef(false);

  useEffect(() => {
    let active = true;
    const pre = consumePendingSession();
    if (pre) {
      setSession(pre);
    } else {
      generateSessionData({ mode: preview.mode, preview })
        .then((s) => {
          if (active) setSession(s);
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : String(e));
        });
    }
    return () => {
      active = false;
    };
  }, [preview]);

  // 离开页面时提交（标记已学 + 预取下一批）
  useEffect(() => {
    return () => {
      if (session && !committedRef.current) {
        committedRef.current = true;
        try {
          commitSession(session, DEFAULT_USER_ID);
          void prefetchNextBatch(DEFAULT_USER_ID);
        } catch {
          // 忽略
        }
      }
    };
  }, [session]);

  const finish = () => {
    if (session && !committedRef.current) {
      committedRef.current = true;
      commitSession(session, DEFAULT_USER_ID);
      void prefetchNextBatch(DEFAULT_USER_ID);
    }
    navigation.goBack();
  };

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>正在准备学习内容…</Text>
      </View>
    );
  }

  const toggle = (id: string) => setRevealed((r) => ({ ...r, [id]: !r[id] }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>本批词汇（{session.items.length}）</Text>
      {session.items.map((it) => (
        <Pressable key={it.id} style={styles.card} onPress={() => toggle(it.id)}>
          <View style={styles.surfaceRow}>
            <Text style={styles.surface}>{it.surface}</Text>
            <SpeakerButton text={it.reading} />
          </View>
          <Text style={styles.reading}>{it.reading}</Text>
          {revealed[it.id] ? (
            <Text style={styles.meaning}>{it.meaning}</Text>
          ) : (
            <Text style={styles.hint}>点击显示释义</Text>
          )}
        </Pressable>
      ))}

      {session.lessons.map((lesson) => {
        const item = session.items.find((i) => i.id === lesson.itemId);
        return (
          <View key={lesson.itemId} style={styles.card}>
            <Text style={styles.lessonTitle}>{item?.surface ?? lesson.itemId}</Text>
            <Text style={styles.explanation}>{lesson.explanation}</Text>
            {lesson.examples.map((ex, i) => (
              <View key={i} style={styles.example}>
                <View style={styles.jaRow}>
                  <Text style={styles.ja}>{ex.ja}</Text>
                  <SpeakerButton text={ex.ja} size={16} />
                </View>
                <Text style={styles.kana}>{ex.kana}</Text>
                <Text style={styles.zh}>{ex.zh}</Text>
              </View>
            ))}
          </View>
        );
      })}

      {session.grammar && (
        <View style={styles.card}>
          <Text style={styles.lessonTitle}>
            语法：{session.grammar.structure || session.grammar.explanation.slice(0, 20)}
          </Text>
          <Text style={styles.explanation}>{session.grammar.explanation}</Text>
          {session.grammar.tips ? <Text style={styles.tips}>💡 {session.grammar.tips}</Text> : null}
          {session.grammar.examples.map((ex, i) => (
            <View key={i} style={styles.example}>
              <View style={styles.jaRow}>
                <Text style={styles.ja}>{ex.ja}</Text>
                <SpeakerButton text={ex.ja} size={16} />
              </View>
              <Text style={styles.kana}>{ex.kana}</Text>
              <Text style={styles.zh}>{ex.zh}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.section}>练习</Text>
      {session.exercises.map((ex, i) => (
        <ExerciseItem key={i} exercise={ex} index={i} />
      ))}

      <Pressable style={styles.finishBtn} onPress={finish}>
        <Text style={styles.finishBtnText}>完成学习 ✓</Text>
      </Pressable>
    </ScrollView>
  );
}

function ExerciseItem({ exercise, index }: { exercise: Exercise; index: number }) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.card}>
      <Text style={styles.exPrompt}>
        {index + 1}. {exercise.prompt}
      </Text>
      {exercise.options?.map((o, i) => (
        <Text key={i} style={styles.option}>
          · {o}
        </Text>
      ))}
      <Pressable style={styles.reveal} onPress={() => setShow((s) => !s)}>
        <Text style={styles.revealText}>{show ? '隐藏答案' : '显示答案'}</Text>
      </Pressable>
      {show && (
        <View style={styles.answerBox}>
          <Text style={styles.answer}>答案：{exercise.answer}</Text>
          <Text style={styles.explanation}>{exercise.explanation}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, backgroundColor: '#fdfcfb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fdfcfb' },
  section: { fontSize: 18, fontWeight: '700', marginVertical: 12, color: '#1f2937' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#f1e5db' },
  surface: { fontSize: 24, fontWeight: '700', color: '#1f2937' },
  surfaceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reading: { fontSize: 15, color: '#78716c', marginTop: 2 },
  meaning: { fontSize: 16, color: '#374151', marginTop: 8 },
  lessonTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4, color: '#1f2937' },
  explanation: { fontSize: 15, lineHeight: 22, color: '#374151' },
  tips: { fontSize: 14, color: '#b45309', marginTop: 8 },
  example: { marginTop: 8, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: '#fed7aa' },
  ja: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  kana: { fontSize: 13, color: '#78716c' },
  zh: { fontSize: 14, color: '#374151' },
  exPrompt: { fontSize: 16, fontWeight: '600', marginBottom: 6, color: '#1f2937' },
  option: { fontSize: 15, color: '#374151', paddingVertical: 2 },
  reveal: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#ffedd5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  revealText: { color: '#c2410c', fontWeight: '600' },
  answerBox: { marginTop: 10, backgroundColor: '#fff7ed', padding: 10, borderRadius: 8 },
  answer: { fontWeight: '700', color: '#16a34a' },
  error: { fontSize: 16, color: '#dc2626', textAlign: 'center' },
  hint: { color: '#999', textAlign: 'center', marginTop: 8 },
  finishBtn: { backgroundColor: '#16a34a', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  finishBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
