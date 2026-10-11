import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation';
import {
  getAgentHistory,
  getOrCreateAgentSessionId,
  greeting,
  handleMessage,
} from '../../features/agent/service';
import {
  ContentPreview,
  clearBatchCache,
  generateCustomPreview,
  setPendingSession,
  suggestPreview,
  takeCachedBatch,
} from '../../features/study/service';
import { getOverview, ProgressOverview } from '../../features/progress/service';
import { insertMessage } from '../../db/chatRepo';
import { ChatMessage } from '../../lib/types';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import { colors, elevation, radius, spacing, type } from '../../lib/theme';
import { tapFeedback } from '../../lib/haptics';
import AppButton from '../../components/AppButton';
import AppIcon, { IconName } from '../../components/AppIcon';
import ProgressBar from '../../components/ProgressBar';
import StreakChip from '../../components/StreakChip';
import LanguageSwitcher from '../../components/LanguageSwitcher';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type QuickKind = 'suggest' | 'custom' | 'review' | 'ask';

type ListItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'preview'; preview: ContentPreview };

const QUICK: {
  label: string;
  sub: string;
  icon: IconName;
  kind: QuickKind;
  accent: string;
}[] = [
  { label: '帮我安排', sub: '按水平推荐', icon: 'lesson', kind: 'suggest', accent: colors.primary },
  { label: '自定义主题', sub: '如流行词', icon: 'celebrate', kind: 'custom', accent: colors.warning },
  { label: '复习', sub: '到期内容', icon: 'review', kind: 'review', accent: colors.success },
  { label: '问 AI', sub: '随时答疑', icon: 'chat', kind: 'ask', accent: colors.info },
];

export default function ChatScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<ContentPreview | null>(null);
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const listRef = useRef<FlatList<ListItem>>(null);
  const inputRef = useRef<TextInput>(null);
  /** 已渲染条目数，用于区分"新消息"与"首次布局" */
  const lastCountRef = useRef(0);

  useEffect(() => {
    const sid = getOrCreateAgentSessionId(DEFAULT_USER_ID);
    const history = getAgentHistory();
    if (history.length === 0) {
      const m = insertMessage(sid, 'assistant', greeting(DEFAULT_USER_ID));
      setMessages([m]);
    } else {
      setMessages(history);
    }
  }, []);

  // 每次回到首页刷新状态条（学完/复习完回来能看到目标推进）
  useFocusEffect(
    useCallback(() => {
      try {
        setOverview(getOverview(DEFAULT_USER_ID));
      } catch {
        // 概览失败不影响对话
      }
    }, []),
  );

  const reloadOverview = () => {
    try {
      setOverview(getOverview(DEFAULT_USER_ID));
    } catch {
      // 忽略
    }
  };

  const data: ListItem[] = [
    ...messages.map((m) => ({ kind: 'message' as const, message: m })),
    ...(pendingPreview ? [{ kind: 'preview' as const, preview: pendingPreview }] : []),
  ];

  /**
   * 切换语种后重新载入：清掉预取缓存与待用批次，重建该语种的对话会话。
   * 不做这一步会把上一语种的内容/对话带进新语种。
   */
  const reloadForLanguage = () => {
    clearBatchCache();
    setPendingPreview(null);
    const sid = getOrCreateAgentSessionId(DEFAULT_USER_ID);
    const history = getAgentHistory();
    if (history.length === 0) {
      setMessages([insertMessage(sid, 'assistant', greeting(DEFAULT_USER_ID))]);
    } else {
      setMessages(history);
    }
  };

  const appendUser = (sid: string, text: string) => {
    insertMessage(sid, 'user', text);
    setMessages((m) => [...m, { id: -1, sessionId: sid, role: 'user', content: text, createdAt: Date.now() }]);
  };

  const appendAssistant = (sid: string, text: string) => {
    const msg = insertMessage(sid, 'assistant', text);
    setMessages((m) => [...m.filter((x) => x.id !== -1), msg]);
  };

  // 快捷按钮：直接执行，不经过 LLM 意图路由（更快）
  const runQuick = async (kind: QuickKind) => {
    if (kind === 'review') {
      navigation.navigate('Review');
      return;
    }
    if (kind === 'ask') {
      inputRef.current?.focus();
      return;
    }
    if (loading) return;

    setLoading(true);
    setPendingPreview(null);
    const sid = getOrCreateAgentSessionId(DEFAULT_USER_ID);
    const label = kind === 'suggest' ? '帮我安排学习' : '我想学流行词';
    appendUser(sid, label);

    try {
      if (kind === 'suggest') {
        const cached = takeCachedBatch();
        if (cached) {
          setPendingSession(cached.session);
          appendAssistant(sid, '好的，下一批已经准备好了，直接开始吧：');
          setPendingPreview(cached.preview);
          return;
        }
        const preview = await suggestPreview(DEFAULT_USER_ID);
        appendAssistant(sid, '好的，我按你的水平推荐了下面这些：');
        setPendingPreview(preview);
      } else {
        const preview = await generateCustomPreview('流行词', DEFAULT_USER_ID);
        appendAssistant(sid, '好的，为你找了这些流行词：');
        setPendingPreview(preview);
      }
    } catch (e) {
      appendAssistant(sid, '出错：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  // 自由输入：走 LLM 意图路由
  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    setInput('');
    setLoading(true);
    setPendingPreview(null);

    const sid = getOrCreateAgentSessionId(DEFAULT_USER_ID);
    appendUser(sid, t);

    try {
      const reply = await handleMessage(t, DEFAULT_USER_ID);
      appendAssistant(sid, reply.text);
      if (reply.action?.type === 'study') {
        setPendingPreview(reply.action.preview);
      } else if (reply.action?.type === 'review') {
        navigation.navigate('Review');
      }
    } catch (e) {
      appendAssistant(sid, '出错：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        {/* 顶栏：语种 + 今日目标（主信息）
            刻意不用标题栏：页面名与下面的语种/进度语义重复，去掉更干净。 */}
        <View style={styles.header}>
          <LanguageSwitcher onChanged={() => reloadForLanguage()} />
          <View style={styles.spacer} />
          <Pressable
            style={styles.iconBtn}
            accessibilityLabel="设置"
            onPress={() => navigation.navigate('Settings')}
          >
            <AppIcon name="settings" size={20} />
          </Pressable>
        </View>

        {/* 今日目标一行表达：数字 + 细进度条 + 连续天数，避免两块信息各飘一端 */}
        <View style={styles.goalRow}>
          <Text style={styles.goalLabel}>今日目标</Text>
          <View style={styles.goalBarWrap}>
            <ProgressBar
              ratio={
                (overview?.streak.goalXp ?? 0) > 0
                  ? (overview?.xpToday ?? 0) / (overview?.streak.goalXp ?? 1)
                  : 0
              }
              height={6}
              color={overview?.streak.todayDone ? colors.success : colors.primary}
            />
          </View>
          <Text style={styles.goalValue}>
            {(overview?.streak.goalXp ?? 0) > 0
              ? `${Math.min(overview?.xpToday ?? 0, overview?.streak.goalXp ?? 0)}/${overview?.streak.goalXp}`
              : '未设'}
          </Text>
          {(overview?.streak.current ?? 0) > 0 ? (
            <StreakChip
              days={overview?.streak.current ?? 0}
              todayDone={overview?.streak.todayDone ?? false}
            />
          ) : null}
        </View>

        {/* 二级入口：低饱和、等宽，不与主信息争注意力 */}
        <View style={styles.navRow}>
          <Pressable style={styles.navBtn} onPress={() => navigation.navigate('Review')}>
            <AppIcon name="review" size={15} />
            <Text style={styles.navLabel}>复习</Text>
            {(overview?.dueCount ?? 0) > 0 ? (
              <Text style={styles.navBadge}>{overview?.dueCount}</Text>
            ) : null}
          </Pressable>
          <Pressable style={styles.navBtn} onPress={() => navigation.navigate('Knowledge')}>
            <AppIcon name="knowledge" size={15} />
            <Text style={styles.navLabel}>知识库</Text>
          </Pressable>
          <Pressable style={styles.navBtn} onPress={() => navigation.navigate('Progress')}>
            <AppIcon name="progress" size={15} />
            <Text style={styles.navLabel}>记录</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => (item.kind === 'message' ? `m-${item.message.id}` : 'preview')}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          if (item.kind === 'preview') {
            return (
              <PreviewCard
                preview={item.preview}
                onStart={() => navigation.navigate('Study', { preview: item.preview })}
              />
            );
          }
          const m = item.message;
          const isUser = m.role === 'user';
          return (
            <View style={[styles.msgRow, isUser ? styles.rowUser : styles.rowAi]}>
              {!isUser && <Avatar label="AI" />}
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>{m.content}</Text>
              </View>
              {isUser && <Avatar label="我" />}
            </View>
          );
        }}
        // 只在条数增长时滚到底（新消息）。
        // 原来监听 onContentSizeChange：一进页面就把首条问候顶出屏幕，只剩半截。
        onContentSizeChange={() => {
          if (data.length > lastCountRef.current) {
            listRef.current?.scrollToEnd({ animated: true });
          }
          lastCountRef.current = data.length;
        }}
      />

      {/* 快捷入口卡片（2×2）：每张用不同强调色，区分"学新内容"与"复习/答疑" */}
      <View style={styles.quickGrid}>
        {QUICK.map((q) => (
          <Pressable key={q.label} style={styles.quickCard} onPress={() => runQuick(q.kind)}>
            <View style={[styles.quickIconWrap, { backgroundColor: `${q.accent}14` }]}>
              <AppIcon name={q.icon} size={18} color={q.accent} />
            </View>
            <Text style={styles.quickLabel}>{q.label}</Text>
            <Text style={styles.quickSub}>{q.sub}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="说你想学什么…"
          placeholderTextColor={colors.textTertiary}
          multiline
        />
        <Pressable
          style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
          onPress={() => send(input)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <AppIcon name="send" size={22} color={colors.textOnPrimary} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Avatar({ label }: { label: string }) {
  const isAi = label === 'AI';
  return (
    <View style={[styles.avatar, isAi ? styles.avatarAi : styles.avatarUser]}>
      <Text style={styles.avatarText}>{label}</Text>
    </View>
  );
}

function PreviewCard({ preview, onStart }: { preview: ContentPreview; onStart: () => void }) {
  return (
    <View style={styles.preview}>
      <Text style={styles.previewTitle}>学习内容预览</Text>
      <Text style={styles.previewReason}>{preview.reason}</Text>
      {preview.items.map((it, i) => (
        <View key={i} style={styles.previewItem}>
          <Text style={styles.previewSurface}>
            {it.surface} <Text style={styles.previewReading}>{it.reading}</Text>
          </Text>
          <Text style={styles.previewMeaning}>{it.meaning}</Text>
        </View>
      ))}
      {preview.grammar && (
        <View style={styles.previewGrammarBox}>
          <Text style={styles.previewGrammar}>
            语法：{preview.grammar.surface}（{preview.grammar.pattern}）
          </Text>
        </View>
      )}
      <Pressable style={styles.startBtn} onPress={onStart}>
        <Text style={styles.startBtnText}>开始学习</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  safeTop: { backgroundColor: colors.bg },

  // —— 顶栏 ——
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  spacer: { flex: 1 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },


  // —— 今日目标：一行表达，进度条只做点缀 ——
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  goalLabel: { ...type.caption },
  goalBarWrap: { flex: 1, maxWidth: 140 },
  goalValue: { ...type.label, color: colors.primaryText },

  // —— 二级入口：等宽、低饱和 ——
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },

  navLabel: { ...type.caption, color: colors.text },
  navBadge: {
    ...type.caption,
    fontSize: 11,
    color: colors.textOnPrimary,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    overflow: 'hidden',
    marginLeft: 2,
  },

  list: { padding: spacing.lg, paddingTop: spacing.md, flexGrow: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.md },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
  },
  // 头像降饱和：原来两个都是高饱和橙/蓝，和气泡一起把整屏颜色搅乱
  avatarAi: { backgroundColor: colors.primarySoft },
  avatarUser: { backgroundColor: colors.surfaceSunken },
  // 有意偏离字阶：头像只有 1~2 个字符，caption(12) 塞不下 28px 圆内
  avatarText: { ...type.caption, fontWeight: '700', color: colors.textSecondary, fontSize: 10 },
  bubble: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, maxWidth: '76%' },
  // 用户气泡用浅暖底 + 深字，不再整块高饱和橙：一屏里橙色只留主按钮
  userBubble: { backgroundColor: colors.primarySoft, borderRadius: radius.xl },
  // AI 气泡用白底 + 轻投影分层，而不是描边
  aiBubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...elevation.elevated,
  },
  bubbleText: { ...type.body },
  userBubbleText: { color: colors.primaryText },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  quickCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    ...elevation.elevated,
  },
  quickIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickLabel: { ...type.body, fontWeight: '700', marginTop: spacing.sm },
  quickSub: { ...type.caption },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 42,
    maxHeight: 120,
    ...type.body,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '700' },

  preview: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    marginLeft: 36,
    ...elevation.floating,
  },
  previewTitle: { ...type.headline },
  previewReason: {
    ...type.caption,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  previewItem: {
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  previewSurface: { ...type.headline },
  previewReading: { ...type.caption, fontWeight: '400' },
  previewMeaning: { ...type.caption, color: colors.textSecondary, marginBottom: 2 },
  previewGrammarBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.sm,
  },
  previewGrammar: { ...type.subhead, color: colors.text },
  startBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  startBtnText: { ...type.bodyStrong, color: colors.textOnPrimary, fontWeight: '700' },
});
