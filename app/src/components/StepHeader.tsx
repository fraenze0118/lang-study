// 学习/复习会话自定义头部：取代默认导航标题栏（去掉“词典感”的关键一步）
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, type } from '../lib/theme';
import { tapFeedback } from '../lib/haptics';
import ProgressBar from './ProgressBar';

interface Props {
  /** 0~1 */
  ratio: number;
  onClose: () => void;
  /** 右侧内容，例如「待复习 12」或连击徽章 */
  right?: React.ReactNode;
  /** 进度条填充色 */
  progressColor?: string;
}

export default function StepHeader({ ratio, onClose, right, progressColor }: Props) {
  // 学习/复习页 headerShown:false，必须自己避开状态栏，
  // 否则进度条会顶到状态栏下面（表现为一条被切掉半截的色条）
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="退出本次学习"
          hitSlop={10}
          style={styles.closeBtn}
          onPress={() => {
            tapFeedback();
            onClose();
          }}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      <ProgressBar ratio={ratio} height={12} color={progressColor ?? colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.bg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    minHeight: 32,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 20, color: colors.textSecondary, fontWeight: '600' },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
