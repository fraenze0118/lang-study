// 复习页（游戏化：进度条 + 翻面动画 + 四档评分 + 结算）
//
// 多语种：队列按当前语种抽取（getQueue 内部已按 languageId 过滤）；朗读语言随语种。
// 经验与连续天数是全局的（换语种学习不应断签）。
import { useCallback, useEffect, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { DueReviewSummary } from '../../db/userRepo';
import { DEFAULT_USER_ID } from '../../features/learn/service';
import { getQueue, grade } from '../../features/review/service';
import { getOverview, logAnswer, ProgressOverview } from '../../features/progress/service';
import { XP_REVIEW, xpForSession } from '../../features/progress/xp';
import { getActiveContext } from '../../features/profile/languageService';
import { ReviewGrade } from '../../lib/enums';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';
import { comboFeedback, tapFeedback } from '../../lib/haptics';
import { useFlip } from '../../lib/anim';
import AppButton from '../../components/AppButton';
import SessionSummary from '../../components/SessionSummary';
import SpeakerButton from '../../components/SpeakerButton';
import StepHeader from '../../components/StepHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

const GRADES: { grade: ReviewGrade; label: string; column: string; color: string }[] = [
  { grade: 'Again', label: '忘了', column: 'Again', color: colors.danger },
  { grade: 'Hard', label: '吃力', column: 'Hard', color: colors.amber },
  { grade: 'Good', label: '记得', column: 'Good', color: colors.success },
  { grade: 'Easy', label: '轻松', column: 'Easy', color: colors.info },
];

export default function ReviewScreen({ navigation }: Props) {
  const [queue, setQueue] = useState<DueReviewSummary[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [ttsLocale, setTtsLocale] = useState('ja-JP');

  // 本次复习统计
  const [reviewedCount, setReviewedCount] = useState(0);
  const [recalledCount, setRecalledCount] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  useEffect(() => {
    setQueue(getQueue(DEFAULT_USER_ID));
    try {
      setOverview(getOverview(DEFAULT_USER_ID));
      setTtsLocale(getActiveContext(DEFAULT_USER_ID).profile.ttsLocale);
    } catch {
      // 忽略
    }
  }, []);

  const current = queue[index];
  const queueExhausted = index >= queue.length;

  const rate = useCallback(
    (g: ReviewGrade) => {
      if (!current) return;
      const xp = XP_REVIEW[g];
      const recalled = g !== 'Again';

      try {
        grade(current.stateId, g, 0);
      } catch {
        // 评分失败不阻断流程
      }
      try {
        logAnswer(DEFAULT_USER_ID, {
          sessionId: 'review',
          itemId: current.itemId,
          stepKind: 'selfcheck',
          correct: recalled,
          xp,
        });
      } catch {
        // 记账失败不影响复习
      }

      if (recalled) comboFeedback();
      else tapFeedback();

      setReviewedCount((n) => n + 1);
      if (recalled) setRecalledCount((n) => n + 1);
      setXpEarned((v) => v + xp);
      setRevealed(false);
      setIndex((i) => i + 1);
    },
    [current],
  );

  const close = useCallback(() => {
    if (reviewedCount > 0 && index < queue.length) {
      Alert.alert('要结束本次复习吗？', '已评分的部分已经记入复习计划。', [
        { text: '继续复习', style: 'cancel' },
        { text: '结束', style: 'destructive', onPress: () => setIndex(queue.length) },
      ]);
      return;
    }
    navigation.goBack();
  }, [index, navigation, queue.length, reviewedCount]);

  if (queueExhausted) {
    // 一开始就没有到期内容 → 空态；复习过 → 结算页
    if (reviewedCount === 0) {
      return (
        <View style={styles.flex}>
          <StepHeader ratio={1} onClose={() => navigation.goBack()} />
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>暂无到期内容</Text>
            <Text style={styles.emptySub}>先去学一批新内容，之后它们会自动进入复习队列。</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.flex}>
        <StepHeader ratio={1} onClose={() => navigation.goBack()} progressColor={colors.success} />
        <SessionSummary
          correctCount={recalledCount}
          total={reviewedCount}
          maxCombo={0}
          xpEarned={xpForSession(xpEarned, 0)} // 复习不叠加整批奖励
          streakDays={overview?.streak.current ?? 0}
          todayXp={(overview?.xpToday ?? 0) + xpEarned}
          dailyGoalXp={overview?.streak.goalXp ?? 0}
          hasWrong={false}
          onContinue={() => navigation.goBack()}
          continueLabel="完成"
        />
      </View>
    );
  }

  const ratio = queue.length > 0 ? index / queue.length : 0;

  return (
    <View style={styles.flex}>
      <StepHeader
        ratio={ratio}
        onClose={close}
        right={
          <Text style={styles.counter}>
            {index + 1} / {queue.length}
          </Text>
        }
      />
      <ReviewCard
        surface={current.surface}
        reading={current.reading}
        meaning={current.meaning}
        revealed={revealed}
        ttsLocale={ttsLocale}
        onReveal={() => {
          tapFeedback();
          setRevealed(true);
        }}
      />
      <View style={styles.footer}>
        {revealed ? (
          <View style={styles.gradeRow}>
            {GRADES.map((g) => (
              <Pressable
                key={g.grade}
                style={[styles.gradeBtn, { backgroundColor: g.color }]}
                onPress={() => rate(g.grade)}
              >
                <Text style={styles.gradeColumn}>{g.column}</Text>
                <Text style={styles.gradeLabel}>{g.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.footerInner}>
            <AppButton label="查看答案" onPress={() => setRevealed(true)} />
          </View>
        )}
      </View>
    </View>
  );
}

function ReviewCard({
  surface,
  reading,
  meaning,
  revealed,
  ttsLocale,
  onReveal,
}: {
  surface: string;
  reading: string;
  meaning: string;
  revealed: boolean;
  ttsLocale: string;
  onReveal: () => void;
}) {
  const flip = useFlip(revealed);
  const scaleX = flip.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
  const opacity = flip.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });

  return (
    <View style={styles.cardWrap}>
      <Pressable style={styles.card} onPress={revealed ? undefined : onReveal}>
        <Text style={styles.surface}>{surface}</Text>
        <Animated.View style={[styles.answerBox, { opacity, transform: [{ scaleX }] }]}>
          {revealed ? (
            <>
              <Text style={styles.reading}>{reading}</Text>
              <Text style={styles.meaning}>{meaning}</Text>
              <SpeakerButton text={reading} locale={ttsLocale} size={24} />
            </>
          ) : (
            <Text style={styles.hint}>想一想，再点下方按钮看答案</Text>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.appBg },
  counter: { ...type.label },
  cardWrap: { flex: 1, padding: spacing.lg },
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    ...shadow.card,
  },
  surface: { ...type.jaWord, fontSize: 44 },
  answerBox: { alignItems: 'center', marginTop: spacing.lg },
  reading: { ...type.ja, color: colors.textSecondary },
  meaning: { ...type.zh, marginTop: spacing.sm, fontSize: 18 },
  hint: { ...type.caption, marginTop: spacing.lg },

  footer: { backgroundColor: colors.bg },
  footerInner: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  gradeRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  gradeBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  gradeColumn: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 13 },
  gradeLabel: { color: colors.textOnPrimary, fontSize: 12, marginTop: 2, opacity: 0.9 },

  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { ...type.h1, marginTop: spacing.md },
  emptySub: {
    ...type.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
