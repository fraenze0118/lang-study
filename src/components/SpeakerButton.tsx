import { Pressable, StyleSheet, Text } from 'react-native';
import { speakJapanese } from '../lib/tts';

export default function SpeakerButton({ text, size = 18 }: { text: string; size?: number }) {
  if (!text) return null;
  return (
    <Pressable style={styles.btn} hitSlop={8} onPress={() => speakJapanese(text)}>
      <Text style={{ fontSize: size }}>🔊</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
});
