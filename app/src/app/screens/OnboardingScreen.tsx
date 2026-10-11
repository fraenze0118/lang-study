import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation';
import { Goal } from '../../lib/enums';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import { getLanguageProfile, listLanguages } from '../../lib/languages';
import { addLanguage, setActiveLanguageId } from '../../features/profile/languageService';
import { setInitialLevel, updateProfile } from '../../features/profile/service';
import { clearBatchCache } from '../../features/study/service';
import { colors, radius, spacing, type } from '../../lib/theme';
import { tapFeedback } from '../../lib/haptics';
import AppButton from '../../components/AppButton';
import AppIcon from '../../components/AppIcon';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'exam', label: '等级考试备考' },
  { value: 'daily', label: '日常交流' },
  { value: 'both', label: '两者兼顾' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  const languages = listLanguages();
  const [languageId, setLanguageId] = useState(languages[0]?.id ?? 'ja');
  const [picked, setPicked] = useState(0);
  const [goal, setGoal] = useState<Goal>('both');
  const [size, setSize] = useState('5');

  const profile = getLanguageProfile(languageId);
  const points = profile.startingPoints;

  /** 换语种时把起点选择重置到该语种的第一档，避免沿用上一语种的索引 */
  const chooseLanguage = (id: string) => {
    tapFeedback();
    setLanguageId(id);
    setPicked(0);
  };

  const start = () => {
    const chosen = points[picked] ?? points[0];
    updateProfile(DEFAULT_USER_ID, { goal, sessionSize: Number(size) || 8 });
    // 先登记该语种，再切为活跃语种并设定水平
    addLanguage(DEFAULT_USER_ID, languageId);
    setActiveLanguageId(languageId);
    clearBatchCache(); // 首次进入不该复用任何缓存
    setInitialLevel(DEFAULT_USER_ID, languageId, chosen.level, chosen.skipScript);
    navigation.replace('Chat');
  };

  return (
    // headerShown:false，自己避开状态栏
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logoWrap}>
          <AppIcon name="globe" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>欢迎来到 lang-study</Text>
        <Text style={styles.subtitle}>
          先选你想学的语言。之后随时能在「设置」里切换或再加一门。
        </Text>

      <Text style={styles.label}>我想学</Text>
      <View style={styles.options}>
        {languages.map((l) => (
          <Pressable
            key={l.id}
            style={[styles.langChip, languageId === l.id && styles.chipActive]}
            onPress={() => chooseLanguage(l.id)}
          >
            <Text style={styles.langFlag}>{l.flag}</Text>
            <Text style={languageId === l.id ? styles.chipTextActive : styles.chipText}>
              {l.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>你现在的{profile.name}大概是什么程度？</Text>
      <Text style={styles.hint}>不用做题，你自己判断就行；之后觉得难或简单随时跟我说。</Text>
      <View style={styles.cards}>
        {points.map((p, i) => {
          const active = picked === i;
          return (
            <Pressable
              key={`${p.level}-${i}`}
              style={[styles.card, active && styles.cardActive]}
              onPress={() => {
                tapFeedback();
                setPicked(i);
              }}
            >
              <View style={styles.cardHead}>
                <Text style={[styles.cardLabel, active && styles.cardLabelActive]}>{p.label}</Text>
                <View style={[styles.badge, active && styles.badgeActive]}>
                  <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                    {p.level}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDesc}>{p.desc}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>学习目标</Text>
      <View style={styles.options}>
        {GOALS.map((g) => (
          <Pressable
            key={g.value}
            style={[styles.chip, goal === g.value && styles.chipActive]}
            onPress={() => {
              tapFeedback();
              setGoal(g.value);
            }}
          >
            <Text style={goal === g.value ? styles.chipTextActive : styles.chipText}>{g.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>每次学习词数</Text>
      <TextInput
        style={styles.input}
        value={size}
        onChangeText={setSize}
        keyboardType="number-pad"
        placeholder="8"
        placeholderTextColor={colors.textSecondary}
      />

      <AppButton label="开始学习" onPress={start} style={styles.action} />
        <Text style={styles.hintCenter}>起点之后也能在「设置」里随时改。</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingBottom: spacing.xxl, backgroundColor: colors.bg },
  logoWrap: { alignItems: 'center', marginTop: spacing.lg },
  title: { ...type.title2, textAlign: 'center', marginTop: spacing.md },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  label: { ...type.bodyStrong, marginTop: spacing.xl, marginBottom: spacing.sm },
  hint: { ...type.caption, lineHeight: 19, marginBottom: spacing.sm },
  hintCenter: { ...type.caption, textAlign: 'center', marginTop: spacing.md },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  langFlag: { ...type.title3 },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...type.body, color: colors.text },
  chipTextActive: { ...type.body, color: colors.textOnPrimary, fontWeight: '700' },
  cards: { gap: spacing.sm },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardLabel: { ...type.bodyStrong, flex: 1 },
  cardLabelActive: { color: colors.primaryText },
  cardDesc: { ...type.caption, marginTop: spacing.xs, lineHeight: 18 },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.trackBg,
  },
  badgeActive: { backgroundColor: colors.primary },
  badgeText: { ...type.captionStrong },
  badgeTextActive: { color: colors.textOnPrimary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...type.zh,
  },
  action: { marginTop: spacing.xxl },
});
