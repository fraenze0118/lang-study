// 复用动画原语：只用 React Native 内置 Animated（项目无 Reanimated/Worklets）
// 统一在这里处理 useNativeDriver，避免各页面写错。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * 按压下沉：返回 scale 值（0.97）与 Pressable 的 onPressIn/onPressOut。
 * 配合 AppButton 的 translateY 使用，形成多邻国式“可按下去”的手感。
 */
export function usePressScale(pressedScale = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (toValue: number, duration: number) => {
      Animated.timing(scale, {
        toValue,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [scale],
  );

  const onPressIn = useCallback(() => animateTo(pressedScale, 80), [animateTo, pressedScale]);
  const onPressOut = useCallback(() => animateTo(1, 120), [animateTo]);

  return { scale, onPressIn, onPressOut };
}

/**
 * 入场弹出（0 → 1）：透明度 + 轻微放大。
 * 用于卡片、结算页、答题反馈的出现。
 */
export function usePopIn(delay = 0, duration = 220) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [delay, duration, progress]);

  const style = useMemo(
    () => ({
      opacity: progress,
      transform: [
        {
          scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
        },
      ],
    }),
    [progress],
  );

  return { progress, style };
}

/**
 * 滑入：from='up' 表示从下方滑上来（底部横幅）。
 * 返回 style 与 play(show: boolean) 用于往返控制。
 */
export function useSlideIn(from: 'up' | 'down' = 'up', distance = 24, duration = 200) {
  const progress = useRef(new Animated.Value(0)).current;

  const play = useCallback(
    (show: boolean) => {
      Animated.timing(progress, {
        toValue: show ? 1 : 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [duration, progress],
  );

  const style = useMemo(
    () => ({
      opacity: progress,
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [from === 'up' ? distance : -distance, 0],
          }),
        },
      ],
    }),
    [distance, from, progress],
  );

  return { progress, style, play };
}

/**
 * 进度条填充宽度：width 动画不支持 native driver，必须 useNativeDriver:false。
 * 返回可直接放到 Animated.View 上的 width 插值样式。
 */
export function useFillWidth(ratio: number, trackWidth = 0, duration = 320) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const value = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    Animated.timing(value, {
      toValue: clamped,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, duration, value]);

  const width = useMemo(
    () => value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
    [value],
  );

  return { value, width, trackWidth };
}

/** 连击徽章脉冲：combo 变化时轻轻跳一下 */
export function usePulse(trigger: number) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (trigger <= 0) return;
    const anim = Animated.sequence([
      Animated.timing(pulse, { toValue: 1.18, duration: 110, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [trigger, pulse]);

  return pulse;
}

/** 复制卡片翻面用的 0→1 进度（scaleX / opacity 组合） */
export function useFlip(revealed: boolean, duration = 180) {
  const progress = useRef(new Animated.Value(revealed ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: revealed ? 1 : 0,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [revealed, duration, progress]);

  return progress;
}

/** 简单的布尔显示/隐藏动画包装（用于错误态淡入） */
export function useFadeIn(visible: boolean, duration = 200) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start();
  }, [visible, duration, opacity]);

  return opacity;
}

/** 供组件内联使用的状态值（例如按钮 loading 时的呼吸效果） */
export function useLoopScale(min = 0.96, max = 1, duration = 600) {
  const value = useRef(new Animated.Value(min)).current;
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: max, duration, useNativeDriver: true }),
        Animated.timing(value, { toValue: min, duration, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [duration, max, min, running, value]);

  return { value, start: () => setRunning(true), stop: () => setRunning(false) };
}
