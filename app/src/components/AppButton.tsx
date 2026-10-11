// 多邻国式 3D 按钮：主色面 + 底部实心边，按压时下沉吃掉底边
import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BUTTON_DEPTH, colors, elevation, radius, spacing, type } from '../lib/theme';
import { tapFeedback } from '../lib/haptics';
import AppIcon, { IconName } from './AppIcon';

export type ButtonVariant = 'primary' | 'success' | 'danger' | 'ghost';

interface BaseColors {
  face: string;
  edge: string;
  text: string;
}

const VARIANTS: Record<ButtonVariant, BaseColors> = {
  primary: { face: colors.primary, edge: colors.primaryDeep, text: colors.textOnPrimary },
  success: { face: colors.success, edge: colors.successDeep, text: colors.textOnPrimary },
  danger: { face: colors.danger, edge: colors.dangerDeep, text: colors.textOnPrimary },
  ghost: { face: colors.bg, edge: colors.border, text: colors.primaryText },
};

interface Props {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** 左侧图标（语义名，见 AppIcon） */
  icon?: IconName;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  /** 供测试/无障碍识别 */
  testID?: string;
}

export default function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
  style,
  testID,
}: Props) {
  const sink = useRef(new Animated.Value(0)).current;
  const isInert = disabled || loading;
  const palette = VARIANTS[variant];

  const animate = (toValue: number) => {
    Animated.timing(sink, {
      toValue,
      duration: toValue === 1 ? 70 : 110,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (isInert) return;
    tapFeedback();
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInert, busy: loading }}
      onPress={handlePress}
      onPressIn={() => !isInert && animate(1)}
      onPressOut={() => !isInert && animate(0)}
      style={[fullWidth && styles.fullWidth, style]}
    >
      {/* 底边：按钮下沉时被压扁，视觉上“按进去” */}
      <View
        style={[
          styles.edge,
          { backgroundColor: isInert ? colors.border : palette.edge },
        ]}
      />
      <Animated.View
        style={[
          styles.face,
          { backgroundColor: isInert ? colors.trackBg : palette.face },
          {
            transform: [
              { translateY: sink.interpolate({ inputRange: [0, 1], outputRange: [0, BUTTON_DEPTH] }) },
              { scale: sink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.99] }) },
            ],
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={palette.text} />
        ) : (
          <View style={styles.labelRow}>
            {icon ? (
              <AppIcon
                name={icon}
                size={18}
                color={isInert ? colors.textDisabled : palette.text}
              />
            ) : null}
            <Text style={[styles.label, { color: isInert ? colors.textDisabled : palette.text }]}>
              {label}
            </Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: BUTTON_DEPTH,
    bottom: 0,
    borderRadius: radius.lg,
  },
  face: {
    marginBottom: BUTTON_DEPTH,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    ...elevation.elevated,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...type.bodyStrong },
});
