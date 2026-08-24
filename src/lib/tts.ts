// TTS 封装（expo-speech，系统语音，离线）
import * as Speech from 'expo-speech';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

const JAPANESE = 'ja-JP';
const DEFAULT_RATE = 0.9; // 略慢，利于学习

export function speakJapanese(text: string, rate = DEFAULT_RATE): void {
  if (!text) return;
  Speech.stop(); // 先停掉上一次，再播新的
  Speech.speak(text, { language: JAPANESE, rate });
}

export function stopSpeaking(): void {
  Speech.stop();
}

export interface VoiceCheckResult {
  checked: boolean;
  available: boolean;
  platform: 'ios' | 'android';
}

// 检测日语语音是否可用：iOS 内置（视为可用）；Android 查已安装语音包
export async function checkJapaneseVoice(): Promise<VoiceCheckResult> {
  if (Platform.OS === 'ios') {
    return { checked: true, available: true, platform: 'ios' };
  }
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const available = voices.some((v) => (v.language ?? '').toLowerCase().startsWith('ja'));
    return { checked: true, available, platform: 'android' };
  } catch {
    return { checked: false, available: false, platform: 'android' };
  }
}

// 打开系统 TTS 设置（Android 下载日语语音包），失败回退到通用设置
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
