import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RootStackParamList } from '../navigation';
import { ask, getHistory } from '../../features/ask/service';
import { ChatMessage } from '../../lib/types';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Ask'>;

export default function AskScreen({ route }: Props) {
  const { itemId, sessionId: initialSessionId } = route.params ?? {};
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (sessionId) setMessages(getHistory(sessionId));
  }, [sessionId]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setLoading(true);
    // 乐观显示用户消息（ask 内部会落库，成功后重新拉取历史）
    setMessages((m) => [
      ...m,
      { id: -1, sessionId: sessionId ?? '', role: 'user', content: text, createdAt: Date.now() },
    ]);
    try {
      const res = await ask({ sessionId, itemId, message: text });
      setSessionId(res.sessionId);
      setMessages(getHistory(res.sessionId)); // 从库重载，用户消息不再消失
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: -2,
          sessionId: sessionId ?? '',
          role: 'assistant',
          content: '出错：' + (e instanceof Error ? e.message : String(e)),
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.bubbleText, item.role === 'user' && styles.userBubbleText]}>
              {item.content}
            </Text>
          </View>
        )}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>问问我任何关于已学内容的问题吧</Text>}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="输入你的问题…"
          placeholderTextColor={colors.textSecondary}
          multiline
        />
        <Pressable
          style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
          onPress={send}
          disabled={loading}
        >
          <Text style={styles.sendText}>{loading ? '…' : '发送'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.appBg },
  list: { padding: spacing.lg, flexGrow: 1 },
  empty: { ...type.body, color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  bubble: {
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    maxWidth: '85%',
  },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.card,
  },
  bubbleText: { ...type.body, lineHeight: 22 },
  userBubbleText: { color: colors.textOnPrimary },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 40,
    maxHeight: 120,
    ...type.body,
    backgroundColor: colors.surface,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: colors.textOnPrimary, fontWeight: '700' },
});

