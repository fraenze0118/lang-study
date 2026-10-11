import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RootStackParamList } from '../navigation';
import { getExamplesByItem, getItem } from '../../db/repo';
import { checkSentence, startSession } from '../../features/ask/service';
import { getActiveLanguageId } from '../../features/profile/languageService';
import { getLanguageProfile } from '../../lib/languages';
import { colors, radius, spacing, type } from '../../lib/theme';
import AppButton from '../../components/AppButton';
import SpeakerButton from '../../components/SpeakerButton';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export default function ItemDetailScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const item = getItem(itemId);
  // 朗读语言跟随当前学习语种
  const ttsLocale = getLanguageProfile(getActiveLanguageId()).ttsLocale;
  const examples = getExamplesByItem(itemId);
  const [sentence, setSentence] = useState('');
  const [checking, setChecking] = useState(false);

  if (!item) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>未找到条目</Text>
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
    } catch {
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
        <SpeakerButton text={item.reading} locale={ttsLocale} size={24} />
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
            <SpeakerButton text={ex.ja} locale={ttsLocale} size={16} />
          </View>
          <Text style={styles.kana}>{ex.pronunciation}</Text>
          <Text style={styles.zh}>{ex.zh}</Text>
        </View>
      ))}

      <AppButton
        label="问 AI"
        icon="chat"
        onPress={() => navigation.navigate('Ask', { itemId })}
        style={styles.action}
      />

      <Text style={styles.subTitle}>造句给 AI 点评</Text>
      <TextInput
        style={styles.sentenceInput}
        value={sentence}
        onChangeText={setSentence}
        placeholder="用这个单词/语法造个句子…"
        placeholderTextColor={colors.textSecondary}
        multiline
      />
      <AppButton
        label={checking ? '点评中…' : '点评'}
        variant="success"
        loading={checking}
        disabled={sentence.trim().length === 0}
        onPress={onCheckSentence}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  surface: { ...type.title1 },
  surfaceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  jaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reading: { ...type.ja, color: colors.textSecondary, marginTop: spacing.xs },
  meaning: { ...type.headline, marginTop: spacing.sm },
  meta: { ...type.caption, marginTop: spacing.xs },
  subTitle: { ...type.bodyStrong, marginTop: spacing.xl, marginBottom: spacing.sm },
  example: {
    paddingLeft: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryBorder,
    marginBottom: spacing.sm,
  },
  ja: { ...type.jaSmall },
  kana: { ...type.caption },
  zh: { ...type.body, color: colors.textSecondary },
  action: { marginTop: spacing.xl },
  sentenceInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 60,
    ...type.body,
    marginBottom: spacing.sm,
  },
});

