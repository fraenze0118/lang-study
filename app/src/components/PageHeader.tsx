// 轻量页面标题：取代 react-native-screens 的原生 header
//
// 原生 header 会渲染成系统的标题栏（标题 + 下方一条分隔线 + 空白），
// 与 App 的暖色卡片风格不一致。这里自己做一条紧贴内容的标题，
// 并用 SafeAreaView 处理状态栏内距。
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, type } from '../lib/theme';

interface Props {
  title: string;
  /** 标题右侧的补充说明（如当前语种） */
  subtitle?: string;
}

export default function PageHeader({ title, subtitle }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.appBg },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  // 比原来的 ActionBar 标题更大更轻，靠字号而非分隔线建立层级
  title: { ...type.title2 },
  subtitle: { ...type.caption },
});
