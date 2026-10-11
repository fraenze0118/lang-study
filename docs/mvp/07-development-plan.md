# 开发阶段设计（Development Plan v2）

| 项 | 内容 |
|---|---|
| 文档版本 | v2.0 |
| 状态 | M0–M3 已完成；M4 部分完成；M5 已完成游戏化手感改造 |
| 变更 | 重构为对话式入口 + 知识库 + 动态画像 |
| 关联文档 | 01~06 |

> 进度校准说明：本文件的复选框此前一直未勾选，与顶部"已完成"的表述不一致。现按代码实际状态勾选，并标注未完成项。

## 0. 前置说明

- 开发环境：Node ≥ 18、Expo Go、LLM API Key（同 v1）。
- 原则：**先重构数据与核心闭环，再做对话入口，最后做 UI 设计**。
- 每个里程碑可独立验收。

## 1. 里程碑总览

| 阶段 | 目标 | 核心交付 | 实际状态 |
|---|---|---|---|
| M0 | 数据模型 v2 改造 | 画像/难度反馈/条目 source/会话 kind + 迁移 | ✅ 完成（已到 schema **v5**，含多语种） |
| M1 | 对话式入口 | 意图路由 + 对话主页 UI | ✅ 完成 |
| M2 | 学习会话 | AI 推荐/自定义生成 + 沉浸学习页 + 质量校验 | ✅ 完成（一屏一步步骤机 + 另有语法模式） |
| M3 | 知识库 + 复习 | 知识库页（浏览/搜索）+ 抽取复习 | ✅ 完成 |
| M4 | 水平设定 + 动态难度 | 起点设定 + 反馈闭环 | ✅ 完成（用户自选起点，按语种独立） |
| M5 | UI 设计系统 | 温暖游戏化主题 + 打磨 | ✅ 完成（设计令牌 + 游戏化手感；完整成就体系仍属 Out of scope） |
| M6 | **多语种支持** | 语种注册表 + 韩语内容 + 数据隔离 | ✅ 完成，见 [features/multi-language](../features/multi-language/multi-language.md) |

## 2. M0 — 数据模型 v2

- [x] 迁移：users 加 `difficulty_bias / assessment_done / session_size`（v4 加 `daily_goal_xp`，v5 加多语种表）
- [x] items 加 `source / level_code / created_at`（unit_id 允许 null；**v5 加 `language_id`**）
- [x] 新表 `difficulty_feedback`、`study_sessions`（v4 加 `answer_logs`；v5 加 `user_languages`、`app_preferences`）
- [x] chat_sessions 加 `kind`（**v5 加 `language_id`**）
- [x] 更新 types/enums/repo 与既有服务兼容

**验收**：新表可建、旧数据可读、类型检查通过。（`npm run typecheck` 通过）

## 3. M1 — 对话式入口（Agent）

- [x] LLM 意图路由（intent + 参数 + 置信度）
- [x] `AgentService.handleMessage` 路由到 学新/复习/答疑/反馈
- [x] 对话主页 UI：气泡流 + 预览卡片 + 快捷入口（"帮我安排/复习/问 AI"）
- [x] 状态提示：水平 + 待复习数

**验收**：输入"我想学流行词"能路由到 study_custom 并返回内容预览。

> 注意：路由返回的 `confidence` 目前**未被使用**（低置信度不会追问），是尚未落地的设计意图。

## 4. M2 — 学习会话

- [x] `StudyService.generateSession`：AI 推荐（选大纲未学）/ 自定义（AI 生成新条目）
- [x] 生成条目质量校验（kana/释义/等级）
- [x] 沉浸学习页：闪卡 → 讲解 → 练习（已改造为一屏一步的步骤机）
- [x] `completeSession`：落库（AI 条目写入 items，source='ai'）+ 进 FSRS

**验收**：学完一批后，知识库可见、复习队列有该批条目。

## 5. M3 — 知识库 + 复习

- [x] 知识库页：单词库/语法库 tab、搜索、掌握度/等级筛选
- [x] 条目详情（+ 问 AI）
- [x] `ReviewService.extractDue` + 复习页（四档评分）
- [x] 知识库页"开始复习"入口

**验收**：能浏览/搜索已学内容，复习能抽取到期条目并评分。

## 6. M4 — 水平设定 + 动态难度

- [x] 首次水平设定：**用户自选起点**（每语种 5 档，来自 `LanguageProfile.startingPoints`）
      —— 已废弃逐题自适应测评（原计划的 10~15 题不做了）
- [x] 零基础路径：该语种最低等级且**不跳过字母入门单元**（日语五十音 / 韩语谚音）
- [x] 有基础路径：起点按所选等级，且在 `user_languages.skip_script_units` 记偏好，推荐时跳过入门单元
- [x] 学习中/后反馈入口（太简单/刚好/太难）——结算页三档已接通
- [x] `ProfileService.applyDifficultyFeedback`：bias 调整 + 越界升降级（**按语种**）
- [x] 反馈影响后续内容难度

**验收**：自选起点即时生效；反馈"太简单"后，后续内容明显变难。

> 注意：只有日语 N5 与韩语 TOPIK 1 有内置大纲，其余等级走 AI 生成路径，需要配置 LLM Key。

## 7. M5 — UI 设计系统

- [x] 主题：暖色调 + 圆角卡片 + 统一间距/字号（`src/lib/theme.ts` 设计令牌，全部页面零硬编码颜色）
- [x] 通用组件：气泡、卡片、按钮、进度、徽章（`AppButton` / `ProgressBar` / `StepHeader` / `FeedbackBanner` / `ComboBadge` / `StreakChip` / `SessionSummary`）
- [x] 关键页面视觉重绘（对话/学习/知识库/复习）
- [x] 轻量激励（连击/完成动效/经验值/每日目标/连续天数）
- [x] 数据备份入口保留
- [ ] 完整成就体系（PRD 列为 Out of scope，暂不做）

**验收**：整体视觉统一、有明显设计感。详见 [`docs/features/gamification/gamification.md`](../../features/gamification/gamification.md)。

## 8. 编码与工程规范

- TypeScript 严格模式；页面只调服务层，不直碰 DB。
- AI 输出一律 Zod 校验 + 失败重试/降级。
- 密钥存 `.env`，不提交仓库。

## 9. 测试策略

- 服务层单测：意图路由参数、难度反馈规则、FSRS 排程、生成条目校验。
- 页面手动验收（按各里程碑验收标准）。

> 现状：已落地纯函数单测 `app/scripts/pure-functions.test.ts`（21 个用例，覆盖判分/经验/连续天数/步骤构建），`npm test` 运行。意图路由与 FSRS 排程仍缺单测。

## 10. 总体验收清单

- [x] 对话 → 定内容 → 沉浸学习 → 知识库 → 复习 闭环成立
- [x] 自选起点 + 动态难度生效
- [x] 能学 AI 生成内容并正确落库进复习
- [x] UI 有设计感，非毛坯

## 11. 风险与依赖

| 风险 | 对策 |
|---|---|
| AI 生成条目质量 | 校验 + 重试 + 降级大纲 |
| 意图路由误判 | 置信度 + 追问（置信度尚未落地） |
| 难度失控 | bias 限幅 + 越界才升降级 |
| 重构破坏旧功能 | M0 先迁移数据层，保证旧服务可读 |

