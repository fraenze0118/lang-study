import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RootStackParamList } from '../navigation';
import { ask, getHistory } from '../../features/ask/service';
import { ChatMessage } from '../../lib/types';

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
    const tempUser: ChatMessage = {
      id: -1,
      sessionId: sessionId ?? '',
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };
    setMessages((m) => [...m, tempUser]);
    try {
      const res = await ask({ sessionId, itemId, message: text });
      setSessionId(res.sessionId);
      setMessages((m) => [...m.filter((x) => x.id !== -1), res.message]);
    } catch (e) {
      setMessages((m) => [
        ...m.filter((x) => x.id !== -1),
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
            <Text style={styles.bubbleText}>{item.content}</Text>
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
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={send} disabled={loading}>
          <Text style={styles.sendText}>{loading ? '…' : '发送'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  list: { padding: 16, flexGrow: 1 },
  empty: { color: '#999', textAlign: 'center', marginTop: 40 },
  bubble: { padding: 12, borderRadius: 12, marginBottom: 8, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#ea580c' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#f1f5f9' },
  bubbleText: { fontSize: 15, lineHeight: 22, color: '#111' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' },
  input: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, minHeight: 40, maxHeight: 120, fontSize: 15 },
  sendBtn: { backgroundColor: '#ea580c', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, marginLeft: 8 },
  sendText: { color: '#fff', fontWeight: '700' },
});
