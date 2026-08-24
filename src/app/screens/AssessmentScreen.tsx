import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RootStackParamList } from '../navigation';
import {
  AssessmentQuestion,
  completeAssessment,
  generateAssessmentQuestion,
  shiftLevel,
} from '../../features/profile/service';
import { LevelCode } from '../../lib/enums';
import { DEFAULT_USER_ID } from '../../features/learn/service';

type Props = NativeStackScreenProps<RootStackParamList, 'Assessment'>;

const TOTAL = 8;

export default function AssessmentScreen({ route, navigation }: Props) {
  const startLevel: LevelCode = route.params.startLevel;
  const [level, setLevel] = useState<LevelCode>(startLevel);
  const [question, setQuestion] = useState<AssessmentQuestion | null>(null);
  const [index, setIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestion(startLevel);
  }, []);

  const loadQuestion = async (lv: LevelCode) => {
    setLoading(true);
    try {
      setQuestion(await generateAssessmentQuestion(lv));
    } catch (e) {
      // 出题失败时仍继续，避免卡死
    }
    setLoading(false);
  };

  const pick = (option: string) => {
    if (!question) return;
    const correct = option === question.answer;
    let newLevel = level;
    let newStreak = streak;
    if (correct) newStreak += 1;
    else newStreak -= 1;

    if (newStreak >= 2) {
      newLevel = shiftLevel(level, +1);
      newStreak = 0;
    } else if (newStreak <= -2) {
      newLevel = shiftLevel(level, -1);
      newStreak = 0;
    }

    const next = index + 1;
    if (next >= TOTAL) {
      completeAssessment(DEFAULT_USER_ID, newLevel);
      navigation.replace('Chat');
    } else {
      setLevel(newLevel);
      setStreak(newStreak);
      setIndex(next);
      loadQuestion(newLevel);
    }
  };

  if (loading || !question) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>准备题目…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {index + 1} / {TOTAL}
      </Text>
      <Text style={styles.prompt}>{question.prompt}</Text>
      <View style={styles.options}>
        {question.options.map((o, i) => (
          <Pressable key={i} style={styles.option} onPress={() => pick(o)}>
            <Text style={styles.optionText}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  progress: { textAlign: 'center', color: '#888', marginBottom: 24 },
  prompt: { fontSize: 20, fontWeight: '600', marginBottom: 24, lineHeight: 28 },
  options: { gap: 12 },
  option: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  optionText: { fontSize: 16 },
  hint: { color: '#999', marginTop: 8 },
});
