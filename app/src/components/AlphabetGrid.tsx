// 字母表网格：按单元分组展示某语种的全部字母（日语五十音 / 韩语谚音）
//
// 与知识库列表的区别：数据来自内置大纲而非学习记录，
// 因此**不受"是否已学"限制**，即使跳过了入门单元也能随时查全表。
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSyllabusItemsByType } from '../db/repo';
import { Item } from '../lib/types';
import { getActiveLanguageId } from '../features/profile/languageService';
import { getLanguageProfile } from '../lib/languages';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { tapFeedback } from '../lib/haptics';
import { speakText } from '../lib/tts';

interface Group {
  title: string;
  items: Item[];
}

export default function AlphabetGrid() {
  const [groups, setGroups] = useState<Group[]>([]);
  const profile = getLanguageProfile(getActiveLanguageId());

  useEffect(() => {
    // 按 unit_id 分组（同一语种的平假名/片假名/浊音等会是不同单元）
    const items = getSyllabusItemsByType(profile.id, profile.scriptUnitKind);
    const byUnit = new Map<string, Item[]>();
    for (const it of items) {
      const key = it.unitId ?? '_';
      const arr = byUnit.get(key);
      if (arr) arr.push(it);
      else byUnit.set(key, [it]);
    }
    setGroups([...byUnit.values()].map((its) => ({ title: '', items: its })));
  }, [profile.id, profile.scriptUnitKind]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        {profile.name}
        {profile.scriptLabel}共 {total} 个。点任意一个听发音。
      </Text>

      {groups.map((g, gi) => (
        <View key={gi} style={styles.grid}>
          {g.items.map((it) => (
            <Pressable
              key={it.id}
              style={styles.cell}
              onPress={() => {
                tapFeedback();
                speakText(it.surface, profile.ttsLocale);
              }}
            >
              <Text style={styles.glyph}>{it.surface}</Text>
              <Text style={styles.reading} numberOfLines={1}>
                {it.reading}
              </Text>
              <Text style={styles.meaning} numberOfLines={2}>
                {it.meaning}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}

      {total === 0 ? (
        <Text style={styles.empty}>
          该语种暂无内置{profile.scriptLabel}数据。补充方式见 docs/mvp/06-syllabus.md。
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxl },
  intro: { ...type.caption, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  cell: {
    width: '22.5%',
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    ...shadow.card,
  },
  glyph: { ...type.jaWord, fontSize: 28, lineHeight: 36 },
  reading: { ...type.caption, marginTop: 2 },
  meaning: { ...type.caption, fontSize: 10, textAlign: 'center', marginTop: 2, lineHeight: 13 },
  empty: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
});
