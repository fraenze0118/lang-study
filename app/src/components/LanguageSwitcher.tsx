// 语种切换器：显示当前语种，点击弹出选择器（可切换到已有语种或新增一门）
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, radius, spacing, type } from '../lib/theme';
import { tapFeedback } from '../lib/haptics';
import AppIcon from './AppIcon';
import { getLanguageProfile, listLanguages } from '../lib/languages';
import { DEFAULT_USER_ID } from '../lib/constants';
import {
  addLanguage,
  getActiveLanguageId,
  listMyLanguages,
  setActiveLanguageId,
} from '../features/profile/languageService';

interface Props {
  /** 切换成功后回调，页面据此刷新数据 */
  onChanged?: (languageId: string) => void;
}

export default function LanguageSwitcher({ onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [languageId, setLanguageId] = useState(getActiveLanguageId());
  const profile = getLanguageProfile(languageId);

  const mine = listMyLanguages(DEFAULT_USER_ID);
  const others = listLanguages().filter((p) => !mine.some((m) => m.languageId === p.id));

  const pick = (next: string) => {
    tapFeedback();
    setActiveLanguageId(next); // 切换活跃语种（持久化到 app_preferences）
    setLanguageId(next);
    setOpen(false);
    onChanged?.(next);
  };

  return (
    <>
      <Pressable style={styles.chip} onPress={() => setOpen(true)} accessibilityLabel="切换学习语种">
        <Text style={styles.flag}>{profile.flag}</Text>
        <Text style={styles.chipText}>{profile.name}</Text>
        <AppIcon name="caretDown" size={12} color={colors.primaryText} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>学习语种</Text>
            <Text style={styles.sheetHint}>切换后，知识库与复习队列会只看该语种。</Text>

            <ScrollView style={styles.list}>
              {mine.map((m) => {
                const active = m.languageId === languageId;
                return (
                  <Pressable
                    key={m.languageId}
                    style={[styles.row, active && styles.rowActive]}
                    onPress={() => pick(m.languageId)}
                  >
                    <Text style={styles.rowFlag}>{m.profile.flag}</Text>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle}>{m.profile.name}</Text>
                      <Text style={styles.rowSub}>
                        {m.profile.nativeName} · {m.profile.levelSystem} {m.levelCode}
                      </Text>
                    </View>
                    {active ? <AppIcon name="check" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}

              {others.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>再加一门</Text>
                  {others.map((p) => (
                    <Pressable
                      key={p.id}
                      style={styles.row}
                      onPress={() => {
                        addLanguage(DEFAULT_USER_ID, p.id);
                        pick(p.id);
                      }}
                    >
                      <Text style={styles.rowFlag}>{p.flag}</Text>
                      <View style={styles.rowMain}>
                        <Text style={styles.rowTitle}>{p.name}</Text>
                        <Text style={styles.rowSub}>
                          {p.nativeName} · 从 {p.levels[0]?.label ?? ''} 开始
                        </Text>
                      </View>
                      <Text style={styles.plus}>＋</Text>
                    </Pressable>
                  ))}
                </>
              ) : null}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  flag: { ...type.subhead },
  chipText: { ...type.captionStrong, color: colors.primaryText },

  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '75%',
    ...elevation.overlay,
  },
  sheetTitle: { ...type.headline },
  sheetHint: { ...type.caption, marginTop: spacing.xs, marginBottom: spacing.md },
  list: { marginTop: spacing.xs },
  sectionLabel: { ...type.label, marginTop: spacing.lg, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  rowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rowFlag: { ...type.title3 },
  rowMain: { flex: 1 },
  rowTitle: { ...type.body, fontWeight: '700' },
  rowSub: { ...type.caption },
  plus: { fontSize: 18, color: colors.primary, fontWeight: '700' },
});
