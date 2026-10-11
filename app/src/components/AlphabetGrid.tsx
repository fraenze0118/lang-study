// 字母表网格：按单元分组展示某语种的全部字母/音节
//
// 设计要点（韩语尤其重要）：
// 谚文是**拼合文字**，ㄱ/ㅏ 这类只是"部件"，必须组合成 가/한 才是真正的韩语字形。
// 所以这里会同时呈现「部件」与「拼合后的音节」两类单元，并按单元标题分段，
// 否则初学者只会看到一堆像偏旁部首的符号。
//
// 数据来自内置大纲而非学习记录，因此**不受"是否已学"限制**，跳过入门单元也能查全表。
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getSyllabusItemsByType } from '../db/repo';
import { ScriptItemRow } from '../lib/types';
import { getActiveLanguageId } from '../features/profile/languageService';
import { getLanguageProfile } from '../lib/languages';
import { colors, elevation, radius, spacing, type } from '../lib/theme';
import { tapFeedback } from '../lib/haptics';
import { speakText } from '../lib/tts';
import AppIcon from './AppIcon';

interface Group {
  title: string;
  items: ScriptItemRow[];
  /** 单字格宽度比例：字符越长（韩语音节、多字词）占位越宽 */
  cellWidth: `${number}%`;
}

export default function AlphabetGrid() {
  const [groups, setGroups] = useState<Group[]>([]);
  const profile = getLanguageProfile(getActiveLanguageId());

  useEffect(() => {
    const items = getSyllabusItemsByType(profile.id, profile.scriptUnitKind);

    // 按 unitId 归组，保留查询给定的单元顺序
    const order: string[] = [];
    const byUnit = new Map<string, ScriptItemRow[]>();
    for (const it of items) {
      const key = it.unitId ?? '_';
      if (!byUnit.has(key)) {
        byUnit.set(key, []);
        order.push(key);
      }
      byUnit.get(key)!.push(it);
    }

    setGroups(
      order.map((key) => {
        const its = byUnit.get(key)!;
        // 内容越长，每行放得越少：避免韩语「감사합니다」被压成两行
        const longest = its.reduce((n, it) => Math.max(n, it.surface.length), 1);
        const cols = longest >= 4 ? 2 : longest >= 2 ? 3 : 4;
        const gap = 8;
        const width = ((100 - gap * (cols - 1) / 4) / cols).toFixed(2);
        return {
          title: its[0]?.unitTitle ?? '',
          items: its,
          cellWidth: `${width}%` as `${number}%`,
        };
      }),
    );
  }, [profile.id, profile.scriptUnitKind]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        {profile.name}
        {profile.scriptLabel}共 {total} 个。点任意一个听发音。
      </Text>

      {groups.map((g, gi) => (
        <View key={gi} style={styles.section}>
          {g.title ? <Text style={styles.sectionTitle}>{g.title}</Text> : null}
          <View style={styles.grid}>
            {g.items.map((it) => (
              <Pressable
                key={it.id}
                style={[styles.cell, { width: g.cellWidth }]}
                onPress={() => {
                  tapFeedback();
                  speakText(it.surface, profile.ttsLocale);
                }}
              >
                <Text
                  style={styles.glyph}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {it.surface}
                </Text>
                <Text style={styles.reading} numberOfLines={1}>
                  {it.reading}
                </Text>
                {it.meaning ? (
                  <Text style={styles.meaning} numberOfLines={2}>
                    {it.meaning}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {total === 0 ? (
        <View style={styles.emptyBox}>
          <AppIcon name="empty" size={36} color={colors.textDisabled} />
          <Text style={styles.empty}>
            该语种暂无内置{profile.scriptLabel}数据。
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxl },
  intro: { ...type.subhead, marginBottom: spacing.md },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...type.captionStrong, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    ...elevation.elevated,
  },
  glyph: { ...type.title1, textAlign: 'center' },
  reading: { ...type.caption, marginTop: 2 },
  meaning: { ...type.caption, fontSize: 10, textAlign: 'center', marginTop: 2, lineHeight: 13 },
  emptyBox: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  empty: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
});
