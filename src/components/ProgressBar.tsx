// 进度条：学习/复习顶部的贯穿式进度，以及统计用迷你条
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useFillWidth } from '../lib/anim';
import { colors, radius } from '../lib/theme';

interface Props {
  /** 0~1，越界会被裁剪 */
  ratio: number;
  height?: number;
  /** 填充色，默认主色 */
  color?: string;
  /** 是否在挂载时从当前值动画到目标（默认 true） */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function ProgressBar({
  ratio,
  height = 10,
  color = colors.primary,
  style,
}: Props) {
  const { width } = useFillWidth(ratio);

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }, style]}>
      <Animated.View
        style={[
          styles.fill,
          { width, height, borderRadius: height / 2, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.trackBg,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  fill: { height: '100%' },
});
