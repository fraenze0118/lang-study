# 语音朗读（TTS）功能设计

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 状态 | 待评审 |
| 关联 | MRD-PRD.md、01-architecture.md |
| 原则 | 开源免费、本地优先（无服务器 / 无 API Key / 离线可用） |

## 1. 背景与目标

语言学习中「听」和「读」一样重要。本功能让用户点击即可听到**单词**与**例句**的标准日语发音，辅助记忆与纠音。

目标：
- 读单词（优先用假名 `reading` 朗读，发音更准）
- 读例句（用 `ja` 字段）
- 点击即读、可停止、可重复
- 与现有「纯本地、无后端、仅 AI 联网」的架构一致

## 2. 功能需求

| # | 需求 | 说明 |
|---|---|---|
| 1 | 读单词 | 点「🔊」朗读该词 |
| 2 | 读例句 | 朗读例句的 `ja` 原文 |
| 3 | 播放控制 | 再次点击停止；支持重复播放 |
| 4 | 触发点 | 学习页闪卡、条目详情页、知识库、复习卡 |
| 5 | 语速 | 默认稍慢（利于学习），可调 |

> 跟读评测（ASR）不在本功能范围，后续单独评估。

## 3. 方案调研（开源免费）

| 方案 | 库开源 | 引擎/模型开源 | 免费 | 离线 | Expo Go | 音质 | 集成成本 |
|---|---|---|---|---|---|---|---|
| **expo-speech（系统 TTS）** | ✅ MIT | ❌（系统引擎） | ✅ | ✅ | ✅ | 中 | 低 |
| **sherpa-onnx + VITS 日语模型** | ✅ Apache-2.0 | ✅ | ✅ | ✅ | ❌ 需 dev build | 高 | 高 |
| **react-native-tts-kit** | ✅ | ✅ | ✅ | ✅ | ❌ 需 dev build | 高 | 中 |

- [expo-speech 官方文档](https://docs.expo.dev/versions/v57.0.0/sdk/speech/)
- [sherpa-onnx（开源语音框架）](https://github.com/k2-fsa/sherpa-onnx)
- [react-native-tts-kit（端侧神经 TTS，31 语言）](https://github.com/ahk-d/react-native-tts-kit)

### 3.1 expo-speech
- Expo SDK 内置模块，`npx expo install expo-speech` 即可用，**Expo Go 直接运行**。
- 调用系统 TTS：iOS 用 `AVSpeechSynthesizer`（内置日语语音如 Kyoko），Android 用 Google TTS（需在系统设置里下载日语语音包）。
- 优点：零配置、离线、无 Key。缺点：引擎非开源（免费），音质为系统语音（非神经级）。

### 3.2 sherpa-onnx + VITS 日语模型
- 完全开源的端侧推理框架（Apache-2.0），支持 VITS 等神经 TTS 模型，可在手机 CPU 上跑。
- 优点：**端到端全开源**、离线、神经音质好。缺点：需原生模块（**不能走 Expo Go**，需 EAS dev build / prebuild），模型文件约几十 MB 需随包分发，集成成本高。

### 3.3 react-native-tts-kit
- 面向 React Native 的端侧神经 TTS 原生模块，31 种语言、无 API Key。
- 优点：集成比 sherpa-onnx 简单、神经音质。缺点：同样**需 dev build**（非 Expo Go）。

## 4. 推荐方案（分阶段）

| 阶段 | 方案 | 理由 |
|---|---|---|
| **MVP（当前）** | expo-speech | Expo Go 直接可用、零成本、离线，满足「读单词/例句」 |
| **进阶（可选）** | sherpa-onnx + VITS 日语模型 | 若追求「完全开源 + 更高音质」，转 dev build 引入 |

> 关于「开源」的边界说明：expo-speech **库本身 MIT 开源**，但它调用的系统 TTS 引擎（Google/Apple）**非开源（免费）**；sherpa-onnx + 开源模型才是端到端全开源。若「开源」是硬性要求，请选 sherpa-onnx 路线。

## 5. 技术设计（MVP · expo-speech）

### 5.1 依赖
```bash
npx expo install expo-speech
```

### 5.2 封装 `src/lib/tts.ts`
```ts
import * as Speech from 'expo-speech';

const JA = 'ja-JP';

export function speakJapanese(text: string, rate = 0.9): void {
  Speech.stop();                       // 先停掉上一次
  Speech.speak(text, { language: JA, rate });
}

export function stopSpeaking(): void {
  Speech.stop();
}

export function isSpeaking(): boolean {
  return Speech.isSpeakingAsync ? true : false; // 详见官方 API
}
```

### 5.3 React Hook `src/lib/useTts.ts`
- 封装「点击播放 / 再点停止」的交互状态。
- 朗读单词时传 `item.reading ?? item.surface`（假名发音更准）；朗读例句传 `example.ja`。

### 5.4 触发点 UI
| 位置 | 交互 |
|---|---|
| 学习页闪卡（StudyScreen） | 卡片上加「🔊」按钮 |
| 条目详情页（ItemDetailScreen） | 标题旁「🔊」按钮 |
| 复习卡（ReviewScreen） | 翻面后显示「🔊」按钮 |
| 知识库列表（KnowledgeScreen） | 可选：行内「🔊」 |

### 5.5 语速与语言
- 默认语言 `ja-JP`，默认语速 `0.9`（略慢）。
- 后续可在设置页加「语速」调节。

## 6. 数据 / 缓存

- 无额外数据存储；日语语音由系统提供。
- Android 首次使用可能需要联网下载 Google TTS 日语语音包，下载后即离线。

## 7. 任务清单

- [ ] 安装 `expo-speech`
- [ ] 封装 `src/lib/tts.ts` + `src/lib/useTts.ts`
- [ ] 学习页闪卡加朗读按钮
- [ ] 条目详情页加朗读按钮
- [ ] 复习卡加朗读按钮
- [ ] （可选）设置页加语速调节

## 8. 验收标准

1. 点「朗读」能正确发出日语单词/例句读音。
2. 下载语音包后完全离线可用，无服务器、无 API Key。
3. 再点一次可停止，重复点击可重播。

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| Android 部分设备缺日语语音 | 引导用户在系统设置下载 Google TTS 日语包 |
| 系统 TTS 音质非神经级 | 进阶用 sherpa-onnx 替换 |
| 长例句朗读一次性读完 | 可分句/分段朗读（进阶） |
