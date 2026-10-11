// 触感反馈封装（expo-haptics）
// 所有调用都做容错降级：模块缺失 / 设备不支持 / 静音模式下静默 no-op，绝不影响业务。
import * as Haptics from 'expo-haptics';

const hasHaptics = (): boolean => typeof Haptics?.impactAsync === 'function';

/** 轻点：按钮、选项、翻面 */
export function tapFeedback(): void {
  if (!hasHaptics()) return;
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // 忽略
  }
}

/** 答对 */
export function correctFeedback(): void {
  if (typeof Haptics?.notificationAsync !== 'function') return;
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // 忽略
  }
}

/** 答错 */
export function wrongFeedback(): void {
  if (typeof Haptics?.notificationAsync !== 'function') return;
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // 忽略
  }
}

/** 连击 / 重要节点：稍重一点 */
export function comboFeedback(): void {
  if (!hasHaptics()) return;
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // 忽略
  }
}

/** 结算庆祝 */
export function celebrateFeedback(): void {
  if (typeof Haptics?.notificationAsync !== 'function') return;
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // 忽略
  }
}
