import { Pressable, StyleSheet } from 'react-native';
import { speakText } from '../lib/tts';
import { tapFeedback } from '../lib/haptics';
import { colors } from '../lib/theme';
import AppIcon from './AppIcon';

interface Props {
  text: string;
  /** BCP-47 语言标签，如 'ja-JP' / 'ko-KR'；由页面从当前语种 profile 传入 */
  locale: string;
  size?: number;
}

export default function SpeakerButton({ text, locale, size = 18 }: Props) {
  if (!text) return null;
  return (
    <Pressable
      style={styles.btn}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="朗读"
      onPress={() => {
        tapFeedback();
        speakText(text, locale);
      }}
    >
      <AppIcon name="speak" size={size} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
});
