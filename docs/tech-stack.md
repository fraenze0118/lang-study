# 技术栈说明

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 关联 | [mvp/01-architecture.md](./mvp/01-architecture.md)、[mvp/MRD-PRD.md](./mvp/MRD-PRD.md) |
| 适用范围 | `app/` 客户端工程 |

## 1. 一句话概览

**Expo (React Native) + TypeScript 的纯客户端应用**：数据全部落在设备本地（SQLite），只有 AI 能力通过 HTTPS 直连 LLM 接口。**没有后端、没有自建服务器。**

| 维度 | 选择 |
|---|---|
| 平台 | Android / iOS（一套代码） |
| 语言 | TypeScript（strict） |
| 运行时 | Expo SDK 57 / React Native 0.86 / React 19 |
| 数据 | expo-sqlite（本地唯一数据源） |
| AI | OpenAI 兼容接口直连 + Zod 结构化校验 |
| 构建 | 本地 Gradle 打包（Windows）/ EAS 云端打包 |

## 2. 依赖清单（实际版本）

### 2.1 运行时与框架

| 包 | 版本 | 用途 |
|---|---|---|
| `expo` | ~57.0.15 | Expo SDK / 工具链 |
| `react` | 19.2.3 | UI 运行时 |
| `react-native` | 0.86.2 | 跨平台原生渲染 |
| `expo-status-bar` | ~57.0.1 | 状态栏样式 |
| `expo-splash-screen` | ~57.0.9 | 启动屏（config plugin） |

### 2.2 数据与业务

| 包 | 版本 | 用途 |
|---|---|---|
| `expo-sqlite` | ~57.0.1 | 本地 SQLite（知识库/进度/会话） |
| `ts-fsrs` | ^5.4.1 | FSRS 间隔重复算法 |
| `zod` | ^4.4.3 | AI 输出结构校验、运行时数据校验 |

### 2.3 导航与 UI

| 包 | 版本 | 用途 |
|---|---|---|
| `@react-navigation/native` | ^7.3.17 | 导航容器 |
| `@react-navigation/native-stack` | ^7.18.9 | 原生栈导航 |
| `react-native-screens` | ~4.26.0 | 原生屏幕优化（导航依赖） |
| `react-native-safe-area-context` | ~5.7.0 | 安全区域 |

### 2.4 语音与交互反馈

| 包 | 版本 | 用途 |
|---|---|---|
| `expo-speech` | ~57.0.1 | 单词/例句朗读（系统 TTS，**locale 按语种**：ja-JP / ko-KR） |
| `expo-intent-launcher` | ~57.0.1 | 跳转系统 TTS 设置（引导下载对应语种语音包） |
| `expo-haptics` | ~57.0.3 | 触感反馈（答对/答错/连击） |

### 2.5 开发与构建工具（devDependencies）

| 包 | 版本 | 用途 |
|---|---|---|
| `typescript` | ~6.0.3 | 类型检查（strict） |
| `@types/react` | ~19.2.2 | React 类型 |
| `tsx` | ^4.23.15 | 跑纯函数自测（Node 内置 test runner） |
| `eas-cli` | ^22.3.0 | 云端打包 |
| `pngjs` | ^7.0.0 | 生成 App 图标 |

> **注意**：`zustand` 已安装但当前**未被使用**（全局状态未引入，页面状态用 React `useState` + 服务层）。属于待清理项，见第 8 节。

## 3. 关键选型理由

| 选择 | 理由 |
|---|---|
| **Expo 而非 bare RN** | Expo Go 扫码即可预览、config plugin 自动处理原生配置，个人项目开发效率最高 |
| **纯本地、无后端** | 免去租服务器/内网穿透/部署；知识库、复习、语音全部离线可用 |
| **AI 由客户端直连 LLM** | 无需自建代理；Key 存本地 `.env`，仅个人自用（公开分发需另加代理） |
| **expo-sqlite 而非 AsyncStorage** | 需要关系查询（按单元取词、到期复习、分组统计），SQLite 更合适 |
| **ts-fsrs 而非自写 SRS** | FSRS 是现代间隔重复算法，成熟库避免算法实现错误 |
| **zod 校验 AI 输出** | LLM 返回不稳定，结构化 schema + 校验 + 重试是保证数据质量的关键 |
| **expo-speech（系统 TTS）** | 开源(MIT)、免费、离线、Expo Go 可用；对比方案见 [features/tts/tts.md](./features/tts/tts.md) |
| **RN 内置 Animated 而非 Reanimated** | 避免引入 Reanimated/Worklets 的构建复杂度；动画需求（按压、弹入、脉冲）内置 API 足够 |
| **无测试框架，用 Node 内置 test runner** | 零依赖跑纯函数回归测试（`tsx --test`） |

## 4. 架构分层

```
页面层（src/app）
   │  只负责渲染与交互，不直接碰数据库
服务层（src/features）
   │  agent / study / knowledge / review / profile / progress / ask / backup
   ├─────────────┬──────────────┐
数据层（src/db）   AI 层（src/ai）   算法/工具（src/fsrs、src/lib）
SQLite 读写       LLM 直连+校验     FSRS、TTS、动画、触感
```

- **数据层**：`schema.ts`（DDL）+ `database.ts`（打开与迁移）+ 各 domain repo。
  - 迁移用 `PRAGMA user_version` 管理；当前 schema 版本 **v5**（v5 = 多语种）。
- **AI 层**：`client.ts`（`chatJson` 结构化 / `chatText` 纯文本）、`prompts.ts`（提示词与 Schema，**均按语种参数化**）。
- **服务层**：每个 feature 一个 `service.ts`，纯 TypeScript 函数，页面调用。
- **语种层**：`lib/languages.ts` 是语种差异的单一事实来源（等级体系、发音标注、入门单元、TTS、提示词规则）；`features/profile/languageService.ts` 提供 `getActiveContext()`。

## 5. 目录结构

```
app/
├─ App.tsx                     # 入口 + 导航注册
├─ index.ts                    # registerRootComponent
├─ app.json / eas.json         # Expo 配置 / EAS 构建配置
├─ assets/                     # 图标、启动屏
├─ scripts/                    # 图标生成、本地构建脚本、纯函数自测
└─ src/
   ├─ app/                     # 导航表 + screens/
   │  ├─ navigation.ts         # 路由参数类型
   │  └─ screens/              # Chat/Study/Knowledge/Review/ItemDetail/Ask/Progress/Settings/Onboarding
   ├─ components/              # 通用 UI（AppButton、ProgressBar、StreakChip、LanguageSwitcher…）
   ├─ features/                # 领域服务层
   │  ├─ agent/                # 对话入口：意图路由
   │  ├─ study/                # 学习会话：生成/落库/预取、答题判定、步骤机
   │  ├─ knowledge/            # 知识库查询 + 分组（按语种）
   │  ├─ review/               # FSRS 复习（按语种抽队列）
   │  ├─ progress/             # 成长体系（XP/连击/打卡，全局）
   │  ├─ profile/              # 全局偏好 + 按语种画像 + 语种注册表访问
   │  ├─ ask/                  # 条目答疑
   │  ├─ learn/                # 仅保留 DEFAULT_USER_ID 再导出（v1 遗留）
   │  └─ backup/               # 数据导出/导入
   ├─ ai/                      # LLM client + prompts（按语种参数化）
   ├─ db/                      # schema / database / repo / userRepo / chatRepo
   ├─ fsrs/                    # ts-fsrs 封装
   ├─ lib/                     # languages / enums / types / theme / tts / anim / haptics / constants
   └─ syllabus/                # 多语种大纲种子（ja/ ko/）+ registry + 导入
```

## 6. AI 集成方式

- **协议**：OpenAI 兼容 `POST {baseUrl}/chat/completions`，用 `fetch` 直连，**不引入 SDK**。
- **两种调用**：
  - `chatJson(messages, schema)`：带 `response_format: { type: 'json_object' }`，用 Zod 校验，失败重试 1 次（用于意图路由、内容生成）。
  - `chatText(messages)`：纯文本（用于答疑，**不加 JSON 约束**）。
- **配置**：`EXPO_PUBLIC_LLM_BASE_URL` / `EXPO_PUBLIC_LLM_API_KEY` / `EXPO_PUBLIC_LLM_MODEL`，写在 `app/.env`（已 gitignore），构建时内联。
- **质量兜底**：生成条目校验（发音标注按语种正则）、去重（写法+读音+**语种**）、失败降级到大纲内容。

## 7. 构建与运行

| 方式 | 命令 | 说明 |
|---|---|---|
| 开发预览 | `npm start` + Expo Go 扫码 | 改代码实时生效，最快 |
| **本地打包 APK** | `cd android && .\gradlew.bat assembleRelease` | **推荐**，免排队；产物在 `android/app/build/outputs/apk/release/` |
| 生成原生工程 | `npx expo prebuild -p android` | 仅 app.json 原生配置变化时需要 |
| 云端打包 | `npx eas build -p android --profile preview` | 免费档有排队；需 EXPO_TOKEN |
| 图标生成 | `node scripts/generate-icon.js` | 依赖 `pngjs` |

- `eas.json`：`preview` 产出 APK（内部安装），`production` 产出 AAB（上架），`appVersionSource: local`（版本号由 `app.json` 控制，**打包不会自动升版本**）。
- Android 包名 / iOS Bundle ID：`com.langstudy.app`；Expo 项目 `owner: fraenze18`。

## 8. 质量保障与已知取舍

**已有**
- `npm run typecheck`：`tsc --noEmit`（src 严格模式）+ `tsc -p tsconfig.test.json`（含测试与脚本）。
- `npm test`：Node 内置 test runner + `tsx`，覆盖纯函数（答案判定、XP、打卡、步骤、偏好读写）。

**取舍与技术债**
| 项 | 说明 |
|---|---|
| 无 ESLint/Prettier | 未引入 Lint 工具链，靠 TS 严格模式兜底 |
| `zustand` 未使用 | 已安装但无引用，可移除或后续用于全局状态 |
| 无 Reanimated | 动画使用 RN 内置 `Animated`，复杂手势/共享元素动画受限 |
| AI Key 内联进包 | 仅适合个人自用；公开分发需加代理服务 |
| 客户端直连 LLM | 无重试队列/离线缓存，弱网体验依赖模型响应 |
| 版本号不自动递增 | Android `versionCode` 需手动升（上架前必做） |

## 9. 环境要求

| 项 | 要求 |
|---|---|
| Node.js | ≥ 18（当前验证于 v22） |
| JDK（本地打包） | **17**（RN 要求；JDK 24 不被 Gradle 支持） |
| Android SDK | platform-tools + build-tools + platform；NDK 首次构建自动下载 |
| 环境变量 | `JAVA_HOME`、`ANDROID_HOME`（可用 `scripts/setup-local-build.ps1` 配置） |
| 设备 / 模拟器 | Expo Go（预览）或任意 Android 手机（安装 APK） |
| LLM | 任意 OpenAI 兼容服务（DeepSeek / OpenAI 等），需自备 Key |
