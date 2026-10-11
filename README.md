# lang-study

一个由 AI 把控学习节奏、以体系化大纲为骨架、可随时答疑的**多语种学习 App**（个人 MVP）。
目前支持**日语**与**韩语**，可在 App 内切换或追加语种。

设计文档见 [`docs/mvp/`](./docs/mvp/)；专题文档见 [`docs/features/`](./docs/features/)。

## 技术栈

- React Native (Expo SDK 57) + TypeScript
- expo-sqlite（本地唯一数据源，schema v5）
- ts-fsrs（FSRS 间隔重复）
- zod（AI 输出校验）
- expo-speech（系统 TTS，按语种 locale）
- expo-haptics（触感反馈）
- 纯本地运行，无后端；AI 直连 LLM API（OpenAI 兼容）

## 语种扩展

语种差异集中在 `app/src/lib/languages.ts` 的注册表（等级体系、发音标注、入门单元、TTS locale、提示词规则）。
**新增一个语种只需 2 处**：注册一份 profile + 在 `app/src/syllabus/registry.ts` 加一份课程数据。
注册表完整性有单测兜底（`npm test`）。详见 [多语种设计](./docs/features/multi-language/multi-language.md)。

## 运行

1. 进入 `app/` 目录。
2. 配置 AI Key：
   ```bash
   cp .env.example .env   # 然后编辑 .env，填入你的 LLM baseUrl / apiKey / model
   ```
3. 安装依赖（首次）：
   ```bash
   npm install
   ```
4. 启动：
   ```bash
   npm start
   ```
   用手机 **Expo Go** 扫码真机运行（个人使用推荐，无需打包）。

## 已实现功能

核心闭环（v2）：

- **多语种**：日语 + 韩语，首页一键切换或追加；知识库/复习/统计/对话按语种隔离
- **对话式入口**：LLM 意图路由（学新/自定义主题/复习/答疑/难度反馈）+ 内容预览卡片确认
- **沉浸式学习**：一屏一步的步骤机（引入 → 讲解 → 语法 → 练习 → 结算），AI 生成讲解/例句/练习
- **即时判分**：选择题与填空题自动判定对错，翻译题对照参考答案自评
- **FSRS 复习**：Again/Hard/Good/Easy 四档评分，到期抽取
- **知识库**：单词库/语法库、4 维度分组（主题/等级/词性/掌握度）、搜索、列表/网格视图
- **动态画像**：启动时自选语种与起点（零基础从五十音/谚音开始）+ 难度偏移调整 + 越界升降级，**水平按语种独立**
- **AI 答疑**：带上下文提问 + 造句点评
- **语音朗读**：expo-speech 系统 TTS，locale 随语种（含 Android 语音包检测与跳转）
- **数据备份**：全表导出/导入 JSON

游戏化（学习手感）：

- **经验值**：答对 +10，连击加成，整批奖励，复习按档计入
- **每日目标**：默认 50 XP，可在设置里选 轻松/标准/挑战/不设目标
- **连续天数**：达成每日目标才计入；当天未达成不清零（**跨语种共享**）
- **连击**：答对累计、答错归零，结算展示最高连击
- **结算页**：正确率、获得经验、目标推进、连续天数、重做错题、难度反馈
- **手感**：3D 按压按钮、贯穿式进度条、入场/反馈动效、触感反馈

## 开发命令

在 `app/` 目录下：

```bash
npm start         # 启动 Expo
npm run typecheck # 两套 tsconfig（应用 + 测试脚本）
npm test          # 纯函数单测（35 个用例，含语种注册表校验）
```

> `expo-haptics` 是原生模块：在 Expo Go 里会自动降级为无触感，**要真正生效需要重新执行一次 EAS dev build**。

### 本地构建（gradle）

```bash
cd android
./gradlew.bat assembleRelease     # 产物：android/app/build/outputs/apk/release/app-release.apk
```

改过 App 图标 / 启动图后，**必须先重新生成原生资源再构建**，否则装上去还是旧图标
（图标是原生资源，不是 JS，`assembleRelease` 只会重新打包 JS）：

```bash
powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1        # 生成 assets/ 下的图标源文件
powershell -ExecutionPolicy Bypass -File scripts/generate-android-res.ps1  # 写入 android/ 的原生资源
```

或者整体重新生成原生工程（需要先停掉 Gradle 守护进程并确保没有程序占用 `android/`）：

```bash
./android/gradlew.bat --stop
node node_modules/expo/bin/cli prebuild --platform android --no-install
```

> 说明：`android/` 是 prebuild 产物且已被 gitignore。`generate-android-res.ps1` 存在的意义是
> 当 `android/` 被其他进程占用、无法整体 prebuild 时，仍能原地更新图标资源。
> 本地构建的 release 用的是 `debug.keystore` 签名（Expo 默认），**上架前必须换成正式 keystore**。

## 目录结构

```
app/
├─ App.tsx                  # 入口 + 导航
├─ scripts/                 # 图标生成 + 纯函数单测
├─ src/
│  ├─ app/                  # 页面与导航
│  │  └─ screens/           # Chat/Study/Knowledge/Review/ItemDetail/Ask/Progress/Settings/Onboarding
│  ├─ ai/                   # LLM client + 提示词（按语种参数化）
│  ├─ components/           # 通用组件（AppButton/ProgressBar/StepHeader/FeedbackBanner/LanguageSwitcher/...）
│  ├─ db/                   # SQLite schema(v5) + 迁移 + 数据访问
│  ├─ features/             # agent/study/review/ask/profile/knowledge/progress/backup
│  ├─ fsrs/                 # ts-fsrs 封装
│  ├─ syllabus/             # 多语种大纲种子（ja/ ko/）+ registry + 导入
│  └─ lib/                  # languages(语种注册表)/theme/anim/haptics/tts/enums/types
```

## 设计文档

- MVP 文档索引：[`docs/mvp/`](./docs/mvp/)
- 多语种支持：[`docs/features/multi-language/multi-language.md`](./docs/features/multi-language/multi-language.md)
- 游戏化（学习手感）：[`docs/features/gamification/gamification.md`](./docs/features/gamification/gamification.md)
- 语音朗读：[`docs/features/tts/tts.md`](./docs/features/tts/tts.md)
- 知识库可视化：[`docs/features/knowledge-visualization/knowledge-visualization.md`](./docs/features/knowledge-visualization/knowledge-visualization.md)
- 技术栈：[`docs/tech-stack.md`](./docs/tech-stack.md)

> 说明：AI Key 会内联进 bundle，仅适合个人自用；若未来公开分发，需加代理服务。

