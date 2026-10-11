// 答题结果反馈条：从底部滑入，绿=对 / 红=错，带讲解与「继续」
import { useEffect } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSlideIn } from '../lib/anim';
import { colors, radius, spacing, type } from '../lib/theme';
import AppButton from './AppButton';

export interface FeedbackState {
  correct: boolean;
  /** 主标题，如「答对了！」 */
  title: string;
  /** 正确答案 / 用户答案对比 */
  detail?: string;
  /** 讲解 */
  explanation?: string;
  /** 翻译题自评态：显示自评按钮而非「继续」 */
  selfCheck?: boolean;
  onSelfCheck?: (correct: boolean) => void;
}

interface Props {
  state: FeedbackState | null;
  onContinue: () => void;
  continueLabel?: string;
}

export default function FeedbackBanner({ state, onContinue, continueLabel = '继续' }: Props) {
  const visible = state !== null;
  const { style, play } = useSlideIn('up', 28);

  useEffect(() => {
    play(visible);
  }, [play, visible]);

  if (!state) return null;

  const palette = state.correct
    ? { bg: colors.successSoft, text: colors.successText, icon: '✓' }
    : { bg: colors.dangerSoft, text: colors.dangerText, icon: '✕' };

  return (
    <Animated.View style={[styles.wrap, { backgroundColor: palette.bg }, style]}>
      <View style={styles.titleRow}>
        <View style={[styles.iconCircle, { backgroundColor: palette.text }]}>
          <Text style={styles.iconText}>{palette.icon}</Text>
        </View>
        <Text style={[styles.title, { color: palette.text }]}>{state.title}</Text>
      </View>

      {state.detail ? <Text style={styles.detail}>{state.detail}</Text> : null}
      {state.explanation ? <Text style={styles.explanation}>{state.explanation}</Text> : null}

      {state.selfCheck ? (
        <View style={styles.selfCheckRow}>
          <AppButton
            label="我写错了"
            variant="ghost"
            fullWidth={false}
            style={styles.selfCheckBtn}
            onPress={() => state.onSelfCheck?.(false)}
          />
          <AppButton
            label="我写对了"
            variant="success"
            fullWidth={false}
            style={styles.selfCheckBtn}
            onPress={() => state.onSelfCheck?.(true)}
          />
        </View>
      ) : (
        <AppButton
          label={continueLabel}
          variant={state.correct ? 'success' : 'danger'}
          onPress={onContinue}
          style={styles.continueBtn}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 15 },
  title: { ...type.h2 },
  detail: { ...type.body, marginTop: spacing.sm, fontWeight: '600' },
  explanation: { ...type.body, marginTop: spacing.xs, color: colors.textSecondary },
  continueBtn: { marginTop: spacing.lg },
  selfCheckRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  selfCheckBtn: { flex: 1 },
});
