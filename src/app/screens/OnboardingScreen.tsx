import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RootStackParamList } from '../navigation';
import { Goal, LevelCode } from '../../lib/enums';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import { completeAssessment, updateProfile } from '../../features/profile/service';

const BUCKETS: { value: string; label: string; start: LevelCode | null }[] = [
  { value: 'beginner', label: '零基础', start: null },
  { value: 'some', label: '有点基础', start: 'N5' },
  { value: 'daily', label: '能日常交流', start: 'N3' },
  { value: 'exam', label: '在备考 JLPT', start: 'N3' },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: 'exam', label: 'JLPT 备考' },
  { value: 'daily', label: '日常交流' },
  { value: 'both', label: '两者兼顾' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  const [bucket, setBucket] = useState('some');
  const [goal, setGoal] = useState<Goal>('both');
  const [daily, setDaily] = useState('5');

  const start = () => {
    updateProfile(DEFAULT_USER_ID, { goal, sessionSize: Number(daily) || 8 });
    const b = BUCKETS.find((x) => x.value === bucket);
    if (!b || b.start === null) {
      // 零基础：直接定为 N5
      completeAssessment(DEFAULT_USER_ID, 'N5');
      navigation.replace('Chat');
    } else {
      navigation.replace('Assessment', { startLevel: b.start });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>欢迎 👋</Text>
      <Text style={styles.subtitle}>告诉我你的情况，帮你定位起点</Text>

      <Text style={styles.label}>你目前的日语水平？</Text>
      <View style={styles.options}>
        {BUCKETS.map((b) => (
          <Pressable
            key={b.value}
            style={[styles.chip, bucket === b.value && styles.chipActive]}
            onPress={() => setBucket(b.value)}
          >
            <Text style={bucket === b.value ? styles.chipTextActive : styles.chipText}>{b.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>学习目标</Text>
      <View style={styles.options}>
        {GOALS.map((g) => (
          <Pressable
            key={g.value}
            style={[styles.chip, goal === g.value && styles.chipActive]}
            onPress={() => setGoal(g.value)}
          >
            <Text style={goal === g.value ? styles.chipTextActive : styles.chipText}>{g.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>每次学习词数</Text>
      <TextInput
        style={styles.input}
        value={daily}
        onChangeText={setDaily}
        keyboardType="number-pad"
        placeholder="8"
      />

      <Pressable style={styles.button} onPress={start}>
        <Text style={styles.buttonText}>{bucket === 'beginner' ? '开始学习' : '开始水平评估'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, color: '#666', marginTop: 6, marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
  chipText: { color: '#334155' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#ea580c', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 28 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
