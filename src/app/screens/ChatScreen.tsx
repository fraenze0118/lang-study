import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RootStackParamList } from '../navigation';
import {
  getAgentHistory,
  getOrCreateAgentSessionId,
  greeting,
  handleMessage,
} from '../../features/agent/service';
import {
  ContentPreview,
  generateCustomPreview,
  setPendingSession,
  suggestPreview,
  takeCachedBatch,
} from '../../features/study/service';
import { insertMessage } from '../../db/chatRepo';
import { ChatMessage } from '../../lib/types';
import { DEFAULT_USER_ID } from '../../features/learn/service';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type QuickKind = 'suggest' | 'custom' | 'review' | 'ask';

type ListItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'preview'; preview: ContentPreview };

const QUICK: { label: string; kind: QuickKind }[] = [
  { label: '帮我安排学习', kind: 'suggest' },
  { label: '我想学流行词', kind: 'custom' },
  { label: '我要复习', kind: 'review' },
  { label: '问个问题', kind: 'ask' },
];

export default function ChatScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<ContentPreview | null>(null);
  const listRef = useRef<FlatList<ListItem>>(null);
  const inputRef = useRef<TextInput>(null);

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

  const data: ListItem[] = [
    ...messages.map((m) => ({ kind: 'message' as const, message: m })),
    ...(pendingPreview ? [{ kind: 'preview' as const, preview: pendingPreview }] : []),
  ];

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
      <View style={styles.topBar}>
        <Pressable style={styles.topLink} onPress={() => navigation.navigate('Knowledge')}>
          <Text style={styles.topLinkText}>📚 知识库</Text>
        </Pressable>
        <Pressable style={styles.topLink} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.topLinkText}>⚙️ 设置</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item, index) => (item.kind === 'message' ? `m-${item.message.id}` : 'preview')}
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
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.quickRow}>
        {QUICK.map((q) => (
          <Pressable key={q.label} style={styles.quickBtn} onPress={() => runQuick(q.kind)}>
            <Text style={styles.quickText}>{q.label}</Text>
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
          placeholderTextColor="#9ca3af"
          multiline
        />
        <Pressable style={[styles.sendBtn, loading && styles.sendBtnDisabled]} onPress={() => send(input)} disabled={loading}>
          <Text style={styles.sendText}>{loading ? '…' : '➤'}</Text>
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
      <Text style={styles.previewTitle}>📚 学习内容预览</Text>
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
  container: { flex: 1, backgroundColor: '#fdfcfb' },
  topBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  topLink: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3e8e0',
  },
  topLinkText: { color: '#c2410c', fontWeight: '600', fontSize: 13 },
  list: { padding: 16, flexGrow: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  avatarAi: { backgroundColor: '#ea580c' },
  avatarUser: { backgroundColor: '#64748b' },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubble: { padding: 12, borderRadius: 18, maxWidth: '78%' },
  userBubble: { backgroundColor: '#ea580c', borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: '#ffffff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#f1e5db' },
  bubbleText: { fontSize: 15, lineHeight: 22, color: '#1f2937' },
  userBubbleText: { color: '#fff' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
  quickBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 18,
  },
  quickText: { color: '#c2410c', fontWeight: '600', fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1e5db',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 42,
    maxHeight: 120,
    fontSize: 15,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  preview: {
    backgroundColor: '#fff7ed',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 14,
    marginBottom: 12,
    marginLeft: 36,
  },
  previewTitle: { fontSize: 15, fontWeight: '700', color: '#9a3412', marginBottom: 4 },
  previewReason: { fontSize: 13, color: '#7c2d12', marginBottom: 10, lineHeight: 19 },
  previewItem: { paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#fee2c2' },
  previewSurface: { fontSize: 17, fontWeight: '600', color: '#1f2937' },
  previewReading: { fontSize: 13, color: '#a8a29e', fontWeight: '400' },
  previewMeaning: { fontSize: 13, color: '#4b5563', marginBottom: 2 },
  previewGrammarBox: { marginTop: 8, padding: 8, backgroundColor: '#ffedd5', borderRadius: 8 },
  previewGrammar: { fontSize: 14, color: '#9a3412' },
  startBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
