# 语音朗读（TTS）开发计划

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 状态 | 已完成 |
| 方案 | expo-speech（系统 TTS，Expo Go 直接可用） |
| 关联 | [tts.md](./tts.md) |

## 0. 前置说明

- 依赖：`expo-speech`，用 `npx expo install expo-speech` 安装（版本随 SDK 57 自动匹配）。
- 原则：本地离线、无 Key、封装复用；朗读单词用 `reading`（假名）更准，朗读例句用 `ja` 原文。
- 默认语言 `ja-JP`、语速 `0.9`。

## 1. 里程碑

| 阶段 | 交付 |
|---|---|
| T0 | 安装依赖 + `lib/tts.ts` 封装 + 通用 `SpeakerButton` 组件 |
| T1 | 集成到学习页（闪卡+例句）、条目详情页、复习页 |
| T2 | TypeScript 检查 + Metro 打包验证 |

## 2. 任务清单

- [ ] 安装 `expo-speech`
- [ ] 封装 `src/lib/tts.ts`（`speakJapanese` / `stopSpeaking`）
- [ ] 新建 `src/components/SpeakerButton.tsx`（点击朗读）
- [ ] 学习页（StudyScreen）闪卡 + 例句加朗读
- [ ] 条目详情页（ItemDetailScreen）标题 + 例句加朗读
- [ ] 复习页（ReviewScreen）翻面后加朗读
- [ ] typecheck + bundle 验证

## 3. 验收标准

1. 各页点击「🔊」能正确朗读日语单词/例句。
2. 日语语音包下载后离线可用，无服务器、无 Key。
3. 编译通过、打包正常。
