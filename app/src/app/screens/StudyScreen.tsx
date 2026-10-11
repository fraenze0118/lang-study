// 沉浸式学习页（游戏化：一屏一步 + 即时判分 + 连击 + 结算）
//
// 多语种：朗读语言/发音标注名称/语法提示词都来自当前语种的 profile；
// 生成与落库逻辑本身仍由 study 服务按活跃语种完成。
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RootStackParamList } from '../navigation';
import {
  commitSession,
  consumePendingSession,
  generateSessionData,
  prefetchNextBatch,
  StudySessionData,
} from '../../features/study/service';
import { buildSteps, StudyStep } from '../../features/study/steps';
import { gradeExercise, GradeOutcome } from '../../features/study/answer';
import { getOverview, logAnswer, ProgressOverview } from '../../features/progress/service';
import { accuracy, xpForAnswer, xpForSession } from '../../features/progress/xp';
import { getActiveContext } from '../../features/profile/languageService';
import { applyDifficultyFeedback, getProfile } from '../../features/profile/service';
import { DEFAULT_USER_ID } from '../../lib/constants';
import { Exercise } from '../../lib/types';
import { Feedback as FeedbackValue } from '../../lib/enums';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';
import { correctFeedback, tapFeedback, wrongFeedback } from '../../lib/haptics';
import AppButton from '../../components/AppButton';
import ComboBadge from '../../components/ComboBadge';
import FeedbackBanner, { FeedbackState } from '../../components/FeedbackBanner';
import SessionSummary from '../../components/SessionSummary';
import SpeakerButton from '../../components/SpeakerButton';
import StepHeader from '../../components/StepHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'Study'>;

export default function StudyScreen({ route, navigation }: Props) {
  const { preview } = route.params;
  const [session, setSession] = useState<StudySessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const committedRef = useRef(false);

  // 当前语种上下文（进入页面时固定：学习中途不切换语种）
  const ctx = useMemo(() => getActiveContext(DEFAULT_USER_ID), []);
  const ttsLocale = ctx.profile.ttsLocale;

  // —— 游戏化状态 ——
  const [stepIndex, setStepIndex] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [answerXp, setAnswerXp] = useState(0);
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<GradeOutcome | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [wrongExercises, setWrongExercises] = useState<Exercise[]>([]);
  const [retryQueue, setRetryQueue] = useState<Exercise[] | null>(null);
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [dailyGoalXp, setDailyGoalXp] = useState(50);

  // 生成学习内容（逻辑不变）
  useEffect(() => {
    let active = true;
    const pre = consumePendingSession();
    if (pre) {
      setSession(pre);
    } else {
      generateSessionData({ mode: preview.mode, preview })
        .then((s) => {
          if (active) setSession(s);
        })
        .catch((e) => {
          if (active) setError(e instanceof Error ? e.message : String(e));
        });
    }
    return () => {
      active = false;
    };
  }, [preview]);

  // 离开页面时兜底提交（committedRef 保证幂等）
  useEffect(() => {
    return () => {
      if (session && !committedRef.current) {
        try {
          commitSession(session, DEFAULT_USER_ID);
        } catch {
          // 忽略
        }
      }
    };
  }, [session]);

  const refreshOverview = useCallback(() => {
    try {
      setOverview(getOverview(DEFAULT_USER_ID));
      setDailyGoalXp(getProfile(DEFAULT_USER_ID).dailyGoalXp);
    } catch {
      // 概览失败不影响学习流程
    }
  }, []);

  useEffect(() => {
    refreshOverview();
  }, [refreshOverview]);

  const steps: StudyStep[] = useMemo(() => (session ? buildSteps(session) : []), [session]);
  const step = steps[stepIndex];
  const totalExercises = useMemo(
    () => (retryQueue ? retryQueue.length : steps.filter((s) => s.kind === 'exercise').length),
    [retryQueue, steps],
  );

  /** 提交本批（幂等） */
  const markCommitted = useCallback(() => {
    if (!session || committedRef.current) return;
    committedRef.current = true;
    try {
      commitSession(session, DEFAULT_USER_ID);
      void prefetchNextBatch(DEFAULT_USER_ID);
    } catch {
      // 忽略
    }
  }, [session]);

  const goNext = useCallback(() => {
    setSelected(null);
    setInput('');
    setOutcome(null);
    setFeedback(null);
    setStepIndex((i) => i + 1);
  }, []);

  /** 记录一次作答结果并弹出反馈条 */
  const settleAnswer = useCallback(
    (exercise: Exercise, isCorrect: boolean, normalizedUser?: string) => {
      const comboAfter = isCorrect ? combo + 1 : 0;
      const xp = xpForAnswer(isCorrect, comboAfter);

      setCombo(comboAfter);
      if (comboAfter > maxCombo) setMaxCombo(comboAfter);
      setAnsweredCount((n) => n + 1);
      if (isCorrect) setCorrectCount((n) => n + 1);
      setAnswerXp((v) => v + xp);
      setWrongExercises((list) => (isCorrect ? list : [...list, exercise]));

      try {
        logAnswer(DEFAULT_USER_ID, {
          sessionId: session?.sessionId ?? null,
          itemId: null,
          stepKind: 'exercise',
          correct: isCorrect,
          xp,
        });
      } catch {
        // 记账失败不影响学习
      }

      if (isCorrect) correctFeedback();
      else wrongFeedback();

      setFeedback({
        correct: isCorrect,
        title: isCorrect
          ? comboAfter >= 3
            ? `答对了！连击 ${comboAfter} 🔥`
            : '答对了！'
          : '答错了',
        detail: isCorrect
          ? xp > 10
            ? `+${xp} XP（含连击加成）`
            : `+${xp} XP`
          : `正确答案：${exercise.answer}${
              normalizedUser ? `　你的答案：${normalizedUser}` : ''
            }`,
        explanation: exercise.explanation,
      });
    },
    [combo, maxCombo, session],
  );

  /** 判分 + 记账 + 反馈 */
  const submitAnswer = useCallback(
    (exercise: Exercise, userAnswer: string) => {
      const result = gradeExercise(exercise.type, userAnswer, exercise.answer);

      // translate：先给参考答案，等用户自评
      if (result.pendingSelfCheck) {
        setOutcome(result);
        setFeedback({
          correct: false,
          title: '对照一下参考答案',
          detail: `参考答案：${exercise.answer}`,
          explanation: exercise.explanation,
          selfCheck: true,
          onSelfCheck: (isCorrect) => settleAnswer(exercise, isCorrect),
        });
        return;
      }

      setOutcome(result);
      settleAnswer(exercise, result.correct, result.normalizedUser);
    },
    [settleAnswer],
  );

  const finish = useCallback(() => {
    markCommitted();
    refreshOverview();
    navigation.goBack();
  }, [markCommitted, navigation, refreshOverview]);

  const confirmExit = useCallback(() => {
    if (committedRef.current || !session) {
      navigation.goBack();
      return;
    }
    Alert.alert('要退出本次学习吗？', '本次进度不会计入，这批内容也不会进入复习队列。', [
      { text: '继续学习', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }, [navigation, session]);

  const startRetryWrong = useCallback(() => {
    if (wrongExercises.length === 0) return;
    setRetryQueue(wrongExercises);
    setWrongExercises([]);
    setStepIndex(0);
    setCombo(0);
    setMaxCombo(0);
    setCorrectCount(0);
    setAnsweredCount(0);
    setAnswerXp(0);
    setSelected(null);
    setInput('');
    setOutcome(null);
    setFeedback(null);
  }, [wrongExercises]);

  const onDifficultyFeedback = useCallback((fb: FeedbackValue) => {
    try {
      applyDifficultyFeedback(DEFAULT_USER_ID, fb);
    } catch {
      // 忽略
    }
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>😕</Text>
        <Text style={styles.error}>{error}</Text>
        <AppButton label="返回" onPress={() => navigation.goBack()} style={styles.errorBtn} />
      </View>
    );
  }

  if (!session || !step) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.hint}>正在准备学习内容…</Text>
      </View>
    );
  }

  const totalSteps = Math.max(1, steps.length - 1);
  const ratio = Math.min(1, stepIndex / totalSteps);

  // —— 结算步 ——
  if (step.kind === 'summary') {
    const total = retryQueue ? retryQueue.length : totalExercises;
    const earned = xpForSession(answerXp, answeredCount);
    const todayXp = (overview?.xpToday ?? 0) + earned;
    return (
      <View style={styles.flex}>
        <StepHeader ratio={1} onClose={confirmExit} progressColor={colors.success} />
        <SessionSummary
          correctCount={correctCount}
          total={total}
          maxCombo={maxCombo}
          xpEarned={earned}
          streakDays={overview?.streak.current ?? 0}
          todayXp={todayXp}
          dailyGoalXp={dailyGoalXp}
          hasWrong={wrongExercises.length > 0}
          onRetryWrong={wrongExercises.length > 0 ? startRetryWrong : undefined}
          onFeedback={onDifficultyFeedback}
          onContinue={finish}
          continueLabel="再来一批"
        />
      </View>
    );
  }

  const isExercise = step.kind === 'exercise';
  const exercise: Exercise | null = isExercise
    ? retryQueue
      ? retryQueue[step.index]
      : step.exercise
    : null;
  const exerciseIndex = step.kind === 'exercise' ? step.index : 0;

  const canSubmit = exercise
    ? exercise.type === 'choice'
      ? selected !== null
      : input.trim().length > 0
    : true;

  const handleCheck = () => {
    if (!exercise) return;
    const answer = exercise.type === 'choice' ? (selected ?? '') : input;
    submitAnswer(exercise, answer);
  };

  const primaryLabel =
    step.kind === 'intro'
      ? '开始学习'
      : step.kind === 'grammar'
        ? '开始练习'
        : step.kind === 'word' || step.kind === 'lesson'
          ? '下一个'
          : '检查';

  const onPrimary = isExercise ? handleCheck : goNext;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StepHeader ratio={ratio} onClose={confirmExit} right={<ComboBadge combo={combo} />} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step.kind === 'intro' && <IntroStep session={session} label={ctx.profile.readingLabel} />}

        {step.kind === 'word' && (
          <WordStep
            surface={step.item.surface}
            reading={step.item.reading}
            meaning={step.item.meaning}
            ttsLocale={ttsLocale}
            revealed={!!revealed[step.item.id]}
            onToggle={() => setRevealed((r) => ({ ...r, [step.item.id]: !r[step.item.id] }))}
          />
        )}

        {step.kind === 'lesson' && (
          <LessonStep
            surface={step.item?.surface ?? step.lesson.itemId}
            reading={step.item?.reading}
            meaning={step.item?.meaning}
            explanation={step.lesson.explanation}
            examples={step.lesson.examples}
            ttsLocale={ttsLocale}
            readingLabel={ctx.profile.readingLabel}
          />
        )}

        {step.kind === 'grammar' && (
          <GrammarStep
            structure={step.grammar.structure}
            explanation={step.grammar.explanation}
            tips={step.grammar.tips}
            examples={step.grammar.examples}
            ttsLocale={ttsLocale}
            readingLabel={ctx.profile.readingLabel}
          />
        )}

        {exercise && (
          <ExerciseStep
            exercise={exercise}
            index={exerciseIndex}
            total={totalExercises}
            selected={selected}
            onSelect={(o) => {
              tapFeedback();
              setSelected(o);
            }}
            input={input}
            onChangeInput={setInput}
            locked={feedback !== null}
            graded={outcome !== null}
            gradedCorrect={outcome?.correct ?? false}
            languageName={ctx.profile.name}
          />
        )}
      </ScrollView>

      <View style={styles.footer}>
        {feedback ? (
          <FeedbackBanner state={feedback} onContinue={goNext} />
        ) : (
          <View style={styles.footerInner}>
            <AppButton
              label={primaryLabel}
              onPress={onPrimary}
              disabled={!canSubmit}
              variant={step.kind === 'grammar' ? 'success' : 'primary'}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// —— 各步骤渲染 ——

function IntroStep({ session, label }: { session: StudySessionData; label: string }) {
  return (
    <View style={styles.introBox}>
      <Text style={styles.introEmoji}>📚</Text>
      <Text style={styles.introTitle}>本批 {session.items.length} 个条目</Text>
      <Text style={styles.introSub}>
        {session.exercises.length} 道练习
        {session.grammar ? ' · 含语法点' : ''}
      </Text>
      <View style={styles.introList}>
        {session.items.slice(0, 8).map((it) => (
          <Text key={it.id} style={styles.introItem}>
            {it.surface}
            <Text style={styles.introReading}>　{it.reading}</Text>
          </Text>
        ))}
      </View>
      <Text style={styles.introHint}>一屏一步，答对还有连击加成（{label}随语种变化）</Text>
    </View>
  );
}

function WordStep({
  surface,
  reading,
  meaning,
  revealed,
  onToggle,
  ttsLocale,
}: {
  surface: string;
  reading: string;
  meaning: string;
  revealed: boolean;
  onToggle: () => void;
  ttsLocale: string;
}) {
  return (
    <View style={styles.stepBox}>
      <Text style={styles.stepKind}>新词</Text>
      <View style={styles.wordRow}>
        <Text style={styles.word}>{surface}</Text>
        <SpeakerButton text={reading} locale={ttsLocale} size={22} />
      </View>
      <Text style={styles.kana}>{reading}</Text>
      {revealed ? (
        <Text style={styles.meaning}>{meaning}</Text>
      ) : (
        <Pressable style={styles.revealBtn} onPress={onToggle}>
          <Text style={styles.revealText}>显示释义</Text>
        </Pressable>
      )}
    </View>
  );
}

type Example = { ja: string; pronunciation: string; zh: string };

function LessonStep({
  surface,
  reading,
  meaning,
  explanation,
  examples,
  ttsLocale,
  readingLabel,
}: {
  surface: string;
  reading?: string;
  meaning?: string;
  explanation: string;
  examples: Example[];
  ttsLocale: string;
  readingLabel: string;
}) {
  return (
    <View style={styles.stepBox}>
      <Text style={styles.stepKind}>讲解</Text>
      <View style={styles.wordRow}>
        <Text style={styles.wordSmall}>{surface}</Text>
        {reading ? <SpeakerButton text={reading} locale={ttsLocale} size={20} /> : null}
      </View>
      {reading ? <Text style={styles.kana}>{reading}</Text> : null}
      {meaning ? <Text style={styles.meaning}>{meaning}</Text> : null}
      <Text style={styles.explanation}>{explanation}</Text>
      {examples.map((ex, i) => (
        <View key={i} style={styles.example}>
          <View style={styles.jaRow}>
            <Text style={styles.ja}>{ex.ja}</Text>
            <SpeakerButton text={ex.ja} locale={ttsLocale} size={16} />
          </View>
          <Text style={styles.kana}>
            {readingLabel}：{ex.pronunciation}
          </Text>
          <Text style={styles.zh}>{ex.zh}</Text>
        </View>
      ))}
    </View>
  );
}

function GrammarStep({
  structure,
  explanation,
  tips,
  examples,
  ttsLocale,
  readingLabel,
}: {
  structure: string;
  explanation: string;
  tips: string;
  examples: Example[];
  ttsLocale: string;
  readingLabel: string;
}) {
  return (
    <View style={styles.stepBox}>
      <Text style={styles.stepKind}>语法</Text>
      <Text style={styles.wordSmall}>{structure || '语法点'}</Text>
      <Text style={styles.explanation}>{explanation}</Text>
      {tips ? <Text style={styles.tips}>💡 {tips}</Text> : null}
      {examples.map((ex, i) => (
        <View key={i} style={styles.example}>
          <View style={styles.jaRow}>
            <Text style={styles.ja}>{ex.ja}</Text>
            <SpeakerButton text={ex.ja} locale={ttsLocale} size={16} />
          </View>
          <Text style={styles.kana}>
            {readingLabel}：{ex.pronunciation}
          </Text>
          <Text style={styles.zh}>{ex.zh}</Text>
        </View>
      ))}
    </View>
  );
}

function ExerciseStep({
  exercise,
  index,
  total,
  selected,
  onSelect,
  input,
  onChangeInput,
  locked,
  graded,
  gradedCorrect,
  languageName,
}: {
  exercise: Exercise;
  index: number;
  total: number;
  selected: string | null;
  onSelect: (option: string) => void;
  input: string;
  onChangeInput: (text: string) => void;
  locked: boolean;
  graded: boolean;
  gradedCorrect: boolean;
  languageName: string;
}) {
  const selfCheck = exercise.type === 'translate';
  const stateBorder = graded ? (gradedCorrect ? colors.success : colors.danger) : undefined;

  return (
    <View style={styles.stepBox}>
      <Text style={styles.stepKind}>
        练习 {index + 1} / {total}
      </Text>
      <Text style={styles.prompt}>{exercise.prompt}</Text>

      {exercise.type === 'choice' && exercise.options?.length ? (
        <View style={styles.options}>
          {exercise.options.map((o, i) => {
            const active = selected === o;
            const isAnswer = graded && o === exercise.answer;
            const isWrongPick = graded && active && !gradedCorrect;
            const borderColor = isAnswer
              ? colors.success
              : isWrongPick
                ? colors.danger
                : active
                  ? colors.primary
                  : colors.border;
            const bg = isAnswer
              ? colors.successSoft
              : isWrongPick
                ? colors.dangerSoft
                : active
                  ? colors.primarySoft
                  : colors.bg;
            return (
              <Pressable
                key={i}
                disabled={locked}
                style={[styles.option, { borderColor, backgroundColor: bg }]}
                onPress={() => onSelect(o)}
              >
                <Text style={[styles.optionText, (isAnswer || isWrongPick) && styles.optionTextStrong]}>
                  {o}
                </Text>
                {isAnswer ? <Text style={styles.markCorrect}>✓</Text> : null}
                {isWrongPick ? <Text style={styles.markWrong}>✕</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <>
          <TextInput
            style={[
              styles.input,
              selfCheck && styles.inputMultiline,
              stateBorder ? { borderColor: stateBorder } : null,
            ]}
            value={input}
            onChangeText={onChangeInput}
            editable={!locked}
            multiline={selfCheck}
            placeholder={selfCheck ? `用${languageName}写出这个句子…` : '填写答案…'}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {selfCheck ? (
            <Text style={styles.selfCheckHint}>这是一道翻译题，提交后对照参考答案自评</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.appBg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.appBg,
  },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  footer: { backgroundColor: colors.bg },
  footerInner: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },

  stepBox: { flex: 1, justifyContent: 'center' },
  stepKind: { ...type.label, marginBottom: spacing.md, letterSpacing: 1 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  word: { ...type.jaWord },
  wordSmall: { ...type.ja },
  kana: { ...type.kana, marginTop: spacing.xs },
  meaning: { ...type.zh, marginTop: spacing.md },
  explanation: { ...type.body, marginTop: spacing.md },
  tips: { ...type.body, color: colors.amber, marginTop: spacing.sm },
  example: {
    marginTop: spacing.md,
    paddingLeft: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryBorder,
  },
  jaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ja: { ...type.jaSmall },
  zh: { ...type.body, color: colors.textSecondary },

  introBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  introEmoji: { fontSize: 48 },
  introTitle: { ...type.h1, marginTop: spacing.md },
  introSub: { ...type.body, color: colors.textSecondary, marginTop: spacing.xs },
  introList: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadow.card,
  },
  introItem: { ...type.jaSmall, paddingVertical: 3 },
  introReading: { ...type.kana, fontWeight: '400' },
  introHint: { ...type.caption, marginTop: spacing.lg, textAlign: 'center' },

  prompt: { ...type.h2, lineHeight: 28 },
  options: { marginTop: spacing.lg, gap: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  optionText: { ...type.zh, flex: 1 },
  optionTextStrong: { fontWeight: '700' },
  markCorrect: { color: colors.successText, fontWeight: '700', fontSize: 16, marginLeft: spacing.sm },
  markWrong: { color: colors.dangerText, fontWeight: '700', fontSize: 16, marginLeft: spacing.sm },
  input: {
    marginTop: spacing.lg,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
    ...type.zh,
    fontSize: 18,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  selfCheckHint: { ...type.caption, marginTop: spacing.sm },

  revealBtn: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  revealText: { ...type.body, color: colors.primaryText, fontWeight: '600' },

  hint: { ...type.body, color: colors.textSecondary, marginTop: spacing.md },
  errorIcon: { fontSize: 40, marginBottom: spacing.md },
  error: { ...type.body, color: colors.dangerText, textAlign: 'center' },
  errorBtn: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
