import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RootStackParamList } from '../navigation';
import { Goal } from '../../lib/enums';
import { getLanguageProfile, getLevelsSorted, listLanguages } from '../../lib/languages';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import { getProfile, setInitialLevel, updateProfile } from '../../features/profile/service';
import {
  addLanguage,
  getActiveContext,
  listMyLanguages,
  setActiveLanguageId,
  updateLanguageProfile,
} from '../../features/profile/languageService';
import { clearBatchCache } from '../../features/study/service';
import { exportAll, importAll } from '../../features/backup/service';
import { colors, radius, spacing, type } from '../../lib/theme';
import PageHeader from '../../components/PageHeader';
import AppIcon from '../../components/AppIcon';
import { checkVoiceAvailable, openTtsSettings } from '../../lib/tts';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'exam', label: '等级考试备考' },
  { value: 'daily', label: '日常交流' },
  { value: 'both', label: '两者兼顾' },
];

/** 难度偏移：-2..+2，与 applyDifficultyFeedback 的 bias 同一套 */
const BIASES: { value: number; label: string }[] = [
  { value: -2, label: '简单一点' },
  { value: -1, label: '略简单' },
  { value: 0, label: '正常' },
  { value: 1, label: '略难' },
  { value: 2, label: '难一点' },
];

/** 一次学多少 */
const SESSION_SIZES = [3, 5, 8, 12];

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const profile = getProfile(DEFAULT_USER_ID);
  const ctx = getActiveContext(DEFAULT_USER_ID);
  const [goal, setGoal] = useState<Goal>(profile.goal);
  const [level, setLevel] = useState<string>(ctx.levelCode);
  const [bias, setBias] = useState(ctx.difficultyBias);
  const [sessionSize, setSessionSize] = useState(profile.sessionSize);
  const [skipScript, setSkipScript] = useState(ctx.skipScriptUnits);
  const [languageId, setLanguageId] = useState(ctx.languageId);

  const [exportVisible, setExportVisible] = useState(false);
  const [exportJson, setExportJson] = useState('');
  const [importVisible, setImportVisible] = useState(false);
  const [importJson, setImportJson] = useState('');

  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'checking' | 'ok' | 'missing'>('idle');

  const languageProfile = getLanguageProfile(languageId);
  const levels = getLevelsSorted(languageId);
  const myLanguages = listMyLanguages(DEFAULT_USER_ID);

  const checkVoice = async () => {
    setVoiceStatus('checking');
    const r = await checkVoiceAvailable(languageProfile.ttsLocale);
    setVoiceStatus(r.available ? 'ok' : 'missing');
  };

  const goTtsSettings = async () => {
    const ok = await openTtsSettings();
    if (!ok) {
      Alert.alert(
        '提示',
        `无法自动打开设置，请手动前往：系统设置 → 系统 → 语言和输入法 → 文字转语音(TTS)输出 → 下载${languageProfile.voiceLabel}`,
      );
    }
  };

  useEffect(() => {
    checkVoice();
  }, []);

  /** 难度与学习量即时保存：这两项用户最常调，不该还要再点一次保存 */
  const applyStudyControls = (patch: {
    levelCode?: string;
    difficultyBias?: number;
    sessionSize?: number;
    skipScriptUnits?: boolean;
  }) => {
    updateProfile(DEFAULT_USER_ID, {
      goal,
      sessionSize: patch.sessionSize ?? sessionSize,
    });
    setInitialLevel(DEFAULT_USER_ID, languageId, patch.levelCode ?? level, patch.skipScriptUnits ?? skipScript);
    if (patch.difficultyBias !== undefined) {
      // setInitialLevel 会把 bias 归零，这里再写回用户选的值
      updateLanguageProfile(DEFAULT_USER_ID, languageId, { difficultyBias: patch.difficultyBias });
      setBias(patch.difficultyBias);
    }
    if (patch.levelCode) setLevel(patch.levelCode);
    if (patch.sessionSize) setSessionSize(patch.sessionSize);
    if (patch.skipScriptUnits !== undefined) setSkipScript(patch.skipScriptUnits);
  };

  /** 切换学习语种：切换后清空预取缓存，避免旧语种内容串进新语种 */
  const switchLanguage = (next: string) => {
    if (next === languageId) return;
    setActiveLanguageId(next);
    clearBatchCache();
    const nextCtx = getActiveContext(DEFAULT_USER_ID);
    setLanguageId(next);
    setLevel(nextCtx.levelCode);
    setBias(nextCtx.difficultyBias);
    setSkipScript(nextCtx.skipScriptUnits);
    setVoiceStatus('idle');
  };

  const save = () => {
    updateProfile(DEFAULT_USER_ID, { goal, sessionSize });
    navigation.goBack();
  };

  const onExport = () => {
    setExportJson(exportAll());
    setExportVisible(true);
  };

  const onImport = () => {
    try {
      importAll(importJson);
      setImportVisible(false);
      Alert.alert('导入成功', '数据已恢复，请重新进入页面查看');
    } catch (e) {
      Alert.alert('导入失败', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={styles.flex}>
      <PageHeader title="设置" subtitle={languageProfile.name} />
      <ScrollView contentContainerStyle={styles.container}>
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

      <Text style={styles.label}>学习语种</Text>
      <View style={styles.options}>
        {myLanguages.map((l) => (
          <Pressable
            key={l.languageId}
            style={[styles.chip, languageId === l.languageId && styles.chipActive]}
            onPress={() => switchLanguage(l.languageId)}
          >
            <Text style={languageId === l.languageId ? styles.chipTextActive : styles.chipText}>
              {l.profile.flag} {l.profile.name}
            </Text>
          </Pressable>
        ))}
        {listLanguages()
          .filter((p) => !myLanguages.some((l) => l.languageId === p.id))
          .map((p) => (
            <Pressable
              key={p.id}
              style={styles.chip}
              onPress={() => {
                addLanguage(DEFAULT_USER_ID, p.id);
                switchLanguage(p.id);
              }}
            >
              <Text style={styles.chipText}>＋ {p.flag} {p.name}</Text>
            </Pressable>
          ))}
      </View>

      <Text style={styles.label}>当前水平（{languageProfile.levelSystem}）</Text>
      <Text style={styles.hint}>当前语种：{languageProfile.name}。改完立即生效。</Text>
      <View style={styles.options}>
        {levels.map((l) => (
          <Pressable
            key={l.code}
            style={[styles.chip, level === l.code && styles.chipActive]}
            onPress={() => applyStudyControls({ levelCode: l.code })}
          >
            <Text style={level === l.code ? styles.chipTextActive : styles.chipText}>{l.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>难度偏好</Text>
      <Text style={styles.hint}>在当前水平上整体调难或调简单，对 AI 生成内容直接生效。</Text>
      <View style={styles.options}>
        {BIASES.map((b) => (
          <Pressable
            key={b.value}
            style={[styles.chip, bias === b.value && styles.chipActive]}
            onPress={() => applyStudyControls({ difficultyBias: b.value })}
          >
            <Text style={bias === b.value ? styles.chipTextActive : styles.chipText}>{b.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>一次学多少</Text>
      <Text style={styles.hint}>每批推荐的条目数。嫌一批太长就选少一点。</Text>
      <View style={styles.options}>
        {SESSION_SIZES.map((n) => (
          <Pressable
            key={n}
            style={[styles.chip, sessionSize === n && styles.chipActive]}
            onPress={() => applyStudyControls({ sessionSize: n })}
          >
            <Text style={sessionSize === n ? styles.chipTextActive : styles.chipText}>{n} 个</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>字母入门</Text>
      <Text style={styles.hint}>
        已认得{languageProfile.scriptLabel}时，推荐内容会跳过入门单元（{languageProfile.scriptUnitTitle}）。
      </Text>
      <View style={styles.options}>
        <Pressable
          style={[styles.chip, !skipScript && styles.chipActive]}
          onPress={() => applyStudyControls({ skipScriptUnits: false })}
        >
          <Text style={!skipScript ? styles.chipTextActive : styles.chipText}>
            从{languageProfile.scriptLabel}学起
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, skipScript && styles.chipActive]}
          onPress={() => applyStudyControls({ skipScriptUnits: true })}
        >
          <Text style={skipScript ? styles.chipTextActive : styles.chipText}>
            已{languageProfile.skipScriptLabel}
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.button} onPress={save}>
        <Text style={styles.buttonText}>保存</Text>
      </Pressable>

      <Text style={styles.label}>数据备份</Text>
      <View style={styles.row}>
        <Pressable style={[styles.button, styles.secondaryBtn]} onPress={onExport}>
          <Text style={styles.buttonText}>导出备份</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.secondaryBtn]} onPress={() => setImportVisible(true)}>
          <Text style={styles.buttonText}>导入备份</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>语音朗读</Text>
      <View style={styles.voiceRow}>
        <Text style={styles.voiceStatus}>
          {voiceStatus === 'checking' && '检测中…'}
          {voiceStatus === 'ok' && `${languageProfile.voiceLabel}可用`}
          {voiceStatus === 'missing' && `未检测到${languageProfile.voiceLabel}`}
          {voiceStatus === 'idle' && '未检测'}
        </Text>
        {voiceStatus === 'ok' ? (
          <AppIcon name="correct" size={18} color={colors.successText} />
        ) : null}
        {voiceStatus === 'missing' ? (
          <AppIcon name="warning" size={18} color={colors.warningText} />
        ) : null}
        <Pressable style={styles.voiceBtn} onPress={checkVoice}>
          <Text style={styles.voiceBtnText}>检测</Text>
        </Pressable>
      </View>
      {voiceStatus === 'missing' && (
        <>
          <Text style={styles.voiceHint}>
            请在系统设置里下载「Google 文字转语音」的日语语音包（下载后即可离线朗读）。
          </Text>
          <Pressable style={[styles.button, styles.secondaryBtn]} onPress={goTtsSettings}>
            <Text style={styles.buttonText}>去系统下载日语语音</Text>
          </Pressable>
        </>
      )}

      {/* 导出弹窗 */}
      <Modal visible={exportVisible} animationType="slide" onRequestClose={() => setExportVisible(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>备份数据（全选复制后保存）</Text>
          <ScrollView style={styles.modalScroll}>
            <Text selectable style={styles.jsonText}>{exportJson}</Text>
          </ScrollView>
          <Pressable style={styles.button} onPress={() => setExportVisible(false)}>
            <Text style={styles.buttonText}>关闭</Text>
          </Pressable>
        </View>
      </Modal>

      {/* 导入弹窗 */}
      <Modal visible={importVisible} animationType="slide" onRequestClose={() => setImportVisible(false)}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>粘贴备份 JSON 后恢复</Text>
          <TextInput
            style={styles.importInput}
            value={importJson}
            onChangeText={setImportJson}
            multiline
            placeholder="粘贴导出的 JSON…"
          />
          <Pressable style={styles.button} onPress={onImport}>
            <Text style={styles.buttonText}>恢复数据</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.secondaryBtn]} onPress={() => setImportVisible(false)}>
            <Text style={styles.buttonText}>取消</Text>
          </Pressable>
        </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.xl, paddingTop: spacing.sm, backgroundColor: colors.bg },
  label: { ...type.bodyStrong, marginTop: spacing.xl, marginBottom: spacing.sm },
  hint: { ...type.caption, lineHeight: 19, marginBottom: spacing.sm },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...type.zh,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    flex: 1,
  },
  secondaryBtn: { backgroundColor: colors.textSecondary },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  voiceStatus: { ...type.body, flex: 1 },
  voiceBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  voiceBtnText: { ...type.captionStrong, color: colors.textOnPrimary },
  voiceHint: { ...type.caption, marginTop: spacing.sm, lineHeight: 19 },
  buttonText: { ...type.body, color: colors.textOnPrimary, fontWeight: '700' },
  modal: { flex: 1, padding: spacing.xl, backgroundColor: colors.bg },
  modalTitle: { ...type.h2, marginBottom: spacing.md },
  modalScroll: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  jsonText: { ...type.caption, color: colors.text, lineHeight: 18 },
  importInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...type.caption,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
});
