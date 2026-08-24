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
import { Goal, LEVEL_CODES, LevelCode } from '../../lib/enums';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import { getProfile, updateProfile } from '../../features/profile/service';
import { exportAll, importAll } from '../../features/backup/service';
import { checkJapaneseVoice, openTtsSettings } from '../../lib/tts';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'exam', label: 'JLPT 备考' },
  { value: 'daily', label: '日常交流' },
  { value: 'both', label: '两者兼顾' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const profile = getProfile(DEFAULT_USER_ID);
  const [goal, setGoal] = useState<Goal>(profile.goal);
  const [level, setLevel] = useState<LevelCode>(profile.levelCode);
  const [daily, setDaily] = useState(String(profile.sessionSize));

  const [exportVisible, setExportVisible] = useState(false);
  const [exportJson, setExportJson] = useState('');
  const [importVisible, setImportVisible] = useState(false);
  const [importJson, setImportJson] = useState('');

  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'checking' | 'ok' | 'missing'>('idle');

  const checkVoice = async () => {
    setVoiceStatus('checking');
    const r = await checkJapaneseVoice();
    setVoiceStatus(r.available ? 'ok' : 'missing');
  };

  const goTtsSettings = async () => {
    const ok = await openTtsSettings();
    if (!ok) {
      Alert.alert(
        '提示',
        '无法自动打开设置，请手动前往：系统设置 → 系统 → 语言和输入法 → 文字转语音(TTS)输出 → 下载日语语音',
      );
    }
  };

  useEffect(() => {
    checkVoice();
  }, []);

  const save = () => {
    updateProfile(DEFAULT_USER_ID, {
      goal,
      levelCode: level,
      sessionSize: Number(daily) || 8,
    });
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

      <Text style={styles.label}>当前水平（JLPT）</Text>
      <View style={styles.options}>
        {LEVEL_CODES.map((l) => (
          <Pressable
            key={l}
            style={[styles.chip, level === l && styles.chipActive]}
            onPress={() => setLevel(l)}
          >
            <Text style={level === l ? styles.chipTextActive : styles.chipText}>{l}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>每日新词数</Text>
      <TextInput
        style={styles.input}
        value={daily}
        onChangeText={setDaily}
        keyboardType="number-pad"
        placeholder="10"
      />

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
          {voiceStatus === 'ok' && '✅ 日语语音可用'}
          {voiceStatus === 'missing' && '⚠️ 未检测到日语语音'}
          {voiceStatus === 'idle' && '未检测'}
        </Text>
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
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff' },
  label: { fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#ea580c', borderColor: '#ea580c' },
  chipText: { color: '#334155' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },
  button: { backgroundColor: '#ea580c', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16, flex: 1 },
  secondaryBtn: { backgroundColor: '#64748b' },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  voiceStatus: { fontSize: 15, color: '#1f2937', flex: 1 },
  voiceBtn: { backgroundColor: '#ea580c', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20 },
  voiceBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  voiceHint: { fontSize: 13, color: '#64748b', marginTop: 8, lineHeight: 19 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modal: { flex: 1, padding: 24, backgroundColor: '#fff' },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  modalScroll: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 12 },
  jsonText: { fontSize: 12, color: '#334155', lineHeight: 18 },
  importInput: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, fontSize: 12, textAlignVertical: 'top', marginBottom: 12 },
});
