// TTS 封装（expo-speech，系统语音，离线）
// 语种无关：locale 由调用方从 LanguageProfile.ttsLocale 传入。
import * as Speech from 'expo-speech';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

const DEFAULT_RATE = 0.9; // 略慢，利于学习

export function speakText(text: string, locale: string, rate = DEFAULT_RATE): void {
  if (!text) return;
  Speech.stop(); // 先停掉上一次，再播新的
  Speech.speak(text, { language: locale, rate });
}

export function stopSpeaking(): void {
  Speech.stop();
}

export interface VoiceCheckResult {
  checked: boolean;
  available: boolean;
  platform: 'ios' | 'android';
  locale: string;
}

/**
 * 检测指定语种的语音是否可用：iOS 内置（视为可用）；Android 查已安装语音包。
 * @param locale BCP-47 语言标签，如 'ja-JP' / 'ko-KR'
 */
export async function checkVoiceAvailable(locale: string): Promise<VoiceCheckResult> {
  if (Platform.OS === 'ios') {
    return { checked: true, available: true, platform: 'ios', locale };
  }
  // 取语言主标签（'ko-KR' → 'ko'）做前缀匹配
  const prefix = locale.split('-')[0].toLowerCase();
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const available = voices.some((v) => (v.language ?? '').toLowerCase().startsWith(prefix));
    return { checked: true, available, platform: 'android', locale };
  } catch {
    return { checked: false, available: false, platform: 'android', locale };
  }
}

// 打开系统 TTS 设置（Android 下载语音包），失败回退到通用设置
export async function openTtsSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    await IntentLauncher.startActivityAsync('com.android.settings.TTS_SETTINGS');
    return true;
  } catch {
    try {
      await IntentLauncher.startActivityAsync('android.settings.SETTINGS');
      return true;
    } catch {
      return false;
    }
  }
}
