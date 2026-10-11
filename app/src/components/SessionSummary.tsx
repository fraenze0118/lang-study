// 结算页：正确率 / 最高连击 / 获得经验 / 连续天数 / 每日目标推进 + 难度反馈
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, radius, spacing, type } from '../lib/theme';
import { usePopIn } from '../lib/anim';
import { celebrateFeedback } from '../lib/haptics';
import { Feedback } from '../lib/enums';
import { accuracy, isSessionPerfect } from '../features/progress/xp';
import AppButton from './AppButton';
import AppIcon, { IconName } from './AppIcon';
import ProgressBar from './ProgressBar';

interface Props {
  correctCount: number;
  total: number;
  maxCombo: number;
  xpEarned: number;
  /** 连续达成天数（0 = 无目标或不适用） */
  streakDays: number;
  /** 今日累计经验（含本次） */
  todayXp: number;
  dailyGoalXp: number;
  hasWrong: boolean;
  onContinue: () => void;
  onRetryWrong?: () => void;
  /** 难度反馈（可选）：复用 profile.applyDifficultyFeedback */
  onFeedback?: (feedback: Feedback) => void;
  continueLabel?: string;
}

export default function SessionSummary({
  correctCount,
  total,
  maxCombo,
  xpEarned,
  streakDays,
  todayXp,
  dailyGoalXp,
  hasWrong,
  onContinue,
  onRetryWrong,
  onFeedback,
  continueLabel = '继续',
}: Props) {
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const { style } = usePopIn();

  useEffect(() => {
    celebrateFeedback();
  }, []);

  const acc = accuracy(correctCount, total);
  const perfect = isSessionPerfect(correctCount, total);
  const goalRatio = dailyGoalXp > 0 ? todayXp / dailyGoalXp : 0;
  const goalReached = dailyGoalXp > 0 && todayXp >= dailyGoalXp;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={style}>
        <View style={styles.badgeWrap}>
          <AppIcon
            name={perfect && total > 0 ? 'perfect' : 'celebrate'}
            size={44}
            color={colors.primary}
          />
        </View>
        <Text style={styles.title}>
          {total === 0 ? '本批没有练习题' : perfect ? '全部答对！' : '本批完成！'}
        </Text>
        {total > 0 ? (
          <Text style={styles.subtitle}>
            正确率 {acc === null ? '—' : `${Math.round(acc * 100)}%`}（{correctCount}/{total}）
          </Text>
        ) : (
          <Text style={styles.subtitle}>这批内容已记入知识库，进入复习队列</Text>
        )}

        <View style={styles.statRow}>
          <Stat label="获得经验" value={`+${xpEarned}`} highlight />
          <Stat label="最高连击" value={maxCombo > 0 ? String(maxCombo) : '—'} icon="streak" />
        </View>

        {/* 每日目标 */}
        {dailyGoalXp > 0 ? (
          <View style={styles.goalBox}>
            <View style={styles.goalHead}>
              <Text style={styles.goalLabel}>今日目标</Text>
              <Text style={styles.goalValue}>
                {Math.min(todayXp, dailyGoalXp)} / {dailyGoalXp} XP
              </Text>
            </View>
            <ProgressBar
              ratio={goalRatio}
              height={12}
              color={goalReached ? colors.success : colors.primary}
            />
            <View style={styles.goalHintRow}>
              {goalReached ? (
                <AppIcon name="correct" size={14} color={colors.successText} />
              ) : null}
              <Text style={styles.goalHint}>
                {goalReached
                  ? '今日目标已达成，连续天数保住了'
                  : `再学 ${dailyGoalXp - todayXp} XP 即可达成今日目标`}
              </Text>
            </View>
          </View>
        ) : null}

        {streakDays > 0 ? (
          <View style={styles.streakBox}>
            <AppIcon name="streak" size={18} color={colors.streak} />
            <Text style={styles.streakText}>连续第 {streakDays} 天</Text>
          </View>
        ) : null}

        {/* 难度反馈：影响后续生成内容的难度 */}
        {onFeedback && !feedbackGiven ? (
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackLabel}>这批内容难度如何？</Text>
            <View style={styles.feedbackRow}>
              <AppButton
                label="太简单"
                variant="ghost"
                fullWidth={false}
                style={styles.feedbackBtn}
                onPress={() => {
                  setFeedbackGiven(true);
                  onFeedback('too_easy');
                }}
              />
              <AppButton
                label="刚好"
                variant="ghost"
                fullWidth={false}
                style={styles.feedbackBtn}
                onPress={() => {
                  setFeedbackGiven(true);
                  onFeedback('just_right');
                }}
              />
              <AppButton
                label="太难了"
                variant="ghost"
                fullWidth={false}
                style={styles.feedbackBtn}
                onPress={() => {
                  setFeedbackGiven(true);
                  onFeedback('too_hard');
                }}
              />
            </View>
          </View>
        ) : null}

        {hasWrong && onRetryWrong ? (
          <AppButton
            label="重做错题"
            variant="ghost"
            icon="review"
            onPress={onRetryWrong}
            style={styles.action}
          />
        ) : null}

        <AppButton label={continueLabel} variant="success" onPress={onContinue} style={styles.action} />
      </View>
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  highlight,
  icon,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  icon?: IconName;
}) {
  return (
    <View style={styles.statBox}>
      <View style={styles.statValueRow}>
        {icon ? <AppIcon name={icon} size={18} color={colors.streak} /> : null}
        <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, backgroundColor: colors.appBg, flexGrow: 1 },
  badgeWrap: { alignItems: 'center', marginTop: spacing.xl },
  title: { ...type.title3, textAlign: 'center', marginTop: spacing.md },
  subtitle: { ...type.body, textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xs },
  statRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...elevation.elevated,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statValue: { ...type.title1 },
  statValueHighlight: { color: colors.success },
  statLabel: { ...type.caption, marginTop: spacing.xs },
  goalBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...elevation.elevated,
  },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  goalLabel: { ...type.captionStrong },
  goalValue: { ...type.captionStrong, color: colors.primary },
  goalHintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  goalHint: { ...type.caption },
  streakBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
  },
  streakText: { ...type.headline, color: colors.primaryText },
  feedbackBox: { marginTop: spacing.xl },
  feedbackLabel: { ...type.label, textAlign: 'center', marginBottom: spacing.sm },
  feedbackRow: { flexDirection: 'row', gap: spacing.sm },
  feedbackBtn: { flex: 1 },
  action: { marginTop: spacing.lg },
});
