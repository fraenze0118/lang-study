# 游戏化（学习手感）功能设计

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 状态 | 已实现（Step 0–9 全部落地，`npm run typecheck` / `npm test` 通过） |
| 关联 | MRD-PRD.md 2.1「UI：温暖游戏化」、07-development-plan.md 的 M5 |
| 目标 | 让学习流程从「阅读-查阅」变成「任务-反馈-奖励」循环，解决"像电子词典"的问题 |

## 1. 背景与问题

改造前的 UI 在 7 个维度上都缺少"游戏感"，根因是**交互模型**而非配色：

| 维度 | 改造前 | 结论 |
|---|---|---|
| 信息架构 | `StudyScreen` 是一个大 `ScrollView`，词卡+讲解+语法+练习全堆在一屏 | 根本原因 |
| 即时反馈 | 练习只有「显示答案」按钮，从不判定对错 | 根本原因 |
| 结算 | 只有一个「完成学习 ✓」按钮 | 缺失 |
| 进度感 | 仅复习页有 `3 / 12` 纯文字 | 缺失 |
| 触感/动效 | 全项目 0 处 `Animated` | 缺失 |
| 长期激励 | 无 | 缺失 |
| 设计令牌 | `theme.ts` 仅 16 行且全项目 0 引用，14 个文件硬编码 194 处 hex | 缺失 |

关键发现：**练习数据早就有了**（`ExerciseSchema` 含 `answer`/`explanation`），但 UI 只把它当答案展示，没当题目来考。因此本功能的大部分工作是**把已有数据接进反馈闭环**，而不是新增内容生成能力。

## 2. 设计原则

1. **只改渲染层，不动生成与落库逻辑**。`generateSessionData` / `commitSession` / `prefetchNextBatch` 的调用方式与调用时机保持与改造前一致。
2. **不惩罚**。不做心数（hearts）。答错只丢连击、不发经验，不扣任何东西。
3. **可关闭**。每日目标可设为「不设目标」，此时不统计连续天数，UI 隐藏相关展示。
4. **派生而非存储**。经验与连续天数由事件表 + 纯函数计算，不落派生状态表，避免与事实数据不一致。

## 3. 三层游戏感

### 3.1 视觉与手感层

- **设计令牌**（`src/lib/theme.ts`）：`colors` / `spacing` / `radius` / `type` / `shadow` / `BUTTON_DEPTH`。
  约定：页面与组件禁止写裸 hex，全部从 theme 取。除 `theme.ts` 外**已无任何硬编码颜色**。
- **3D 按压按钮**（`AppButton`）：主色面 + 底部实心边（`BUTTON_DEPTH = 4`），按压时面下沉 4px 吃掉底边并轻微缩小。
  变体：`primary` / `success` / `danger` / `ghost`。
- **贯穿式进度条**（`ProgressBar` + `StepHeader`）：会话顶部显示 `已完成步数 / 总步数` 的比例。
- **会话头部接管导航栏**：`Study` 与 `Review` 路由设 `headerShown: false`，由 `StepHeader` 提供「✕ + 进度条 + 右侧徽章」。
- **动效原语**（`src/lib/anim.ts`）：`usePressScale` / `usePopIn` / `useSlideIn` / `useFillWidth` / `usePulse` / `useFlip` / `useFadeIn`，统一处理 `useNativeDriver`。

> 决策：只用 React Native 内置 `Animated`，不引入 Reanimated。项目原本没有 `babel.config.js`，Reanimated 4 需要新建 babel 配置、安装 `react-native-worklets` 并按顺序挂 plugin、重跑 prebuild；而本功能需要的 4 种基础动画用核心 `Animated` 即可完成。拖拽式词块拼句（真需要 Reanimated）不在范围内。

### 3.2 即时反馈闭环

练习从「显示答案」改为「作答 → 判定 → 反馈 → 推进」：

| 环节 | 实现 |
|---|---|
| 步骤化 | `buildSteps(session)` 把一次会话展开成 `intro → 每个条目一张卡 → grammar → 每道练习 → summary`；一屏只渲染一步 |
| 题型 UI | `choice` 可点选项（选中态高亮）、`fill` 单行输入、`translate` 多行输入 |
| 判分 | `gradeExercise(kind, user, answer)` → `GradeOutcome` |
| 反馈 | `FeedbackBanner` 底部滑入：绿=对 / 红=错，附正确答案、用户答案对比、讲解与「继续」 |
| 推进 | 只有点「继续」才 `stepIndex + 1`，用户不会错过反馈 |
| 连击 | `ComboBadge`，答对 +1、答错归零；连击跨题目持续累计 |
| 触感 | `src/lib/haptics.ts`：轻点 / 答对 / 答错 / 连击 / 庆祝，全部 try-catch 降级 |

**边界：`translate` 无法确定性判分。** AI 只给一个参考答案，中文翻译的多种正确表达无法字符串比对。因此该题型展示参考答案 + 「我写对了 / 我写错了」自评按钮，UI 明确标注是自评。自评答对同样计经验。

**`fill` 也参与自动判分**，比对前先归一化（见 §4.1）。

### 3.3 长期激励层

| 机制 | 规则 |
|---|---|
| 经验值（XP） | 答对 +10；连击 >3 后每多 1 连击追加 +2；练完一整批 +20 整批奖励；复习按四档给 1/3/5/5 |
| 每日目标 | 默认 50 XP，设置页可选 轻松 30 / 标准 50 / 挑战 100 / 不设目标 |
| 连续天数 | 当天经验 ≥ 目标即算达成；从今天（或今天未达成时的昨天）向前逐日累计 |
| 首页状态条 | 今日目标进度条 + 连续天数芯片 + 待复习数（`useFocusEffect` 每次回到首页刷新） |
| 结算页 | 正确率、最高连击、获得经验、今日目标推进、连续第 N 天、「重做错题」 |
| 难度反馈 | 结算页可点「太简单 / 刚好 / 太难」，接 `applyDifficultyFeedback`（`just_right` 此前在枚举里定义但从未被使用，本次接通） |

**连续天数不清零规则**：今天尚未达成时**不立即清零**（这一天还没过完），而是从昨天开始向前数。断档发生在昨天才归零。`goalXp = 0` 时视为无目标，`current = 0`、`todayDone = true`。

## 4. 数据与接口

### 4.1 纯函数（无 IO，可单测）

**`src/features/study/answer.ts`**
```ts
normalizeAnswer(s): string   // 全角→半角 → 去空白与常见中日英标点 → 小写
gradeChoice(user, answer): GradeOutcome
gradeFill(user, answer): GradeOutcome
gradeTranslate(user, reference): GradeOutcome   // 恒 pendingSelfCheck
gradeExercise(kind, user, answer): GradeOutcome
```
`GradeOutcome = { correct, pendingSelfCheck, normalizedUser }`。空答案判为错（避免空串等于空串误判为对）。

**`src/features/progress/xp.ts`** — `xpForAnswer` / `xpForSession` / `accuracy`（分母 0 返回 `null` 而非 `NaN`）/ `isSessionPerfect`，常量 `XP_CORRECT`、`XP_SESSION_BONUS`、`XP_COMBO_THRESHOLD`、`XP_COMBO_BONUS_STEP`、`XP_REVIEW`。

**`src/features/progress/streak.ts`** — `localDateKey`（本地时区 `YYYY-MM-DD`）/ `computeStreak` / `recentDateKeys` / `startOfRecentWindow` / `dateKeyToLocalStart`。

**`src/features/study/steps.ts`** — `buildSteps(session): StudyStep[]`、`countExerciseSteps(steps)`。
纯函数且结果稳定（同一 session 多次调用等长同序），这是进度条正确的前提。若 AI 返回了本批之外的 `itemId`，也会追加成步骤，避免已生成内容被丢弃。

### 4.2 数据访问

**`src/features/progress/repo.ts`** — `insertAnswerLog` / `getAnswerXpSince` / `getReviewXpSince` / `getEarliestActivityAt`。

**`src/features/progress/service.ts`** — `logAnswer` / `getDayTotals(userId, days)` / `getOverview(userId, streakWindowDays = 370)`。

时区换算在 JS 侧完成（SQL 里做本地日聚合很别扭）：SQL 只按时间范围过滤，再按 `localDateKey` 分桶求和。边界用本地自然日 00:00 取，避免 DST / 跨月时用 24h 近似导致首日漏算。

### 4.3 Schema（v3 → v4）

```sql
ALTER TABLE users ADD COLUMN daily_goal_xp INTEGER NOT NULL DEFAULT 50;

CREATE TABLE answer_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  session_id TEXT, item_id TEXT,
  step_kind TEXT NOT NULL,     -- 'exercise' | 'selfcheck'
  correct INTEGER NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  answered_at INTEGER NOT NULL
);
CREATE INDEX idx_answer_logs_user_time ON answer_logs(user_id, answered_at);
```

**经验的两个来源，都只写原始事件：**
- 练习作答与翻译自评 → `answer_logs`
- 复习四档评分 → 复用已有 `review_logs`（**不重复写 answer_logs**），读取时用 `XP_REVIEW` 折算

`database.ts` 的迁移补齐了 `version === 0`（全新库）与 `version === 2` 两个分支的 v4 列，且补列前用 `PRAGMA table_info` 探测，避免重复 `ALTER`。v1→v2 的 `DROP TABLE` 重建分支保持原语义不变（仅把 `answer_logs` 加入 DROP 列表）。

### 4.4 备份

`backup/service.ts` 的 `TABLES` 补齐了 `difficulty_feedback`（**此前遗漏，导致导入时永久清空难度反馈**）与 `answer_logs`。

同时修正 `importAll` 的三个隐患：
1. 导入期间 `PRAGMA foreign_keys = OFF`，结束后恢复 —— 删除/插入顺序不再受外键约束影响。
2. 清理 `sqlite_sequence` —— 否则按原 id 插回旧数据后，新插入会撞主键。
3. 按时间列排序后插入 —— 恢复后列表顺序与导出前一致（此前 `ORDER BY s.id DESC` 的页面在导入后会反转）。

## 5. 关键流程

```
对话入口（ChatScreen）
 ├─ 状态条：今日目标进度 + 连续天数 + 待复习
 ├─ 生成/取缓存 → 内容预览卡片 → 「开始学习」
 └─ 快捷入口 2×2 卡片：帮我安排 / 自定义主题 / 复习 / 问 AI

StudyScreen（步骤机）
 intro → word|lesson → grammar → exercise×N → summary
   ├─ 每次作答：gradeExercise → logAnswer(xp) → FeedbackBanner
   ├─ 答对：combo+1、correctFeedback()；答错：combo=0、wrongFeedback()、收集错题
   ├─ 到达 summary：commitSession（幂等，committedRef）+ prefetchNextBatch
   ├─ 结算页：可「重做错题」（在内存里重排错题为新步骤序列，不重新调 AI）或「再来一批」
   └─ 中途 ✕：Alert 确认，本次不计入

ReviewScreen
 StepHeader → 卡片翻面（useFlip）→ 四档评分 → logAnswer + grade → 结算
```

## 6. 边界与失败模式

| 场景 | 处理 |
|---|---|
| 没有练习题 | `buildSteps` 仍产出 `intro` + `summary`；结算页正确率显示「—」而非 `NaN` |
| `translate` 题 | 不自评不计分；只看参考答案不发经验 |
| AI 生成失败 | 保留错误态 + 「重试生成」；已作答内容不丢（`steps` 与 `stepIndex` 在 state） |
| 答错后直接退出 | 未到 summary 不提交，该批不进复习队列（与改造前一致） |
| 复习队列为空 | 插画式空态「暂无到期内容」+ 引导去学新词 |
| 跨天（23:59 学 / 00:01 结算） | `logAnswer` 用当时时间戳，本地日分桶自然拆到两天 |
| `expo-haptics` 不可用 | `haptics.ts` 全部 try-catch 静默降级 |
| 每日目标设为 0 | 视为无目标：`current = 0`、`todayDone = true`，UI 隐藏连续展示 |
| 连续天数超长 | `computeStreak` 有 3660 天上限保护；`getOverview` 默认回溯 370 天 |
| 备份导入含旧版本数据 | 缺 `daily_goal_xp` 时由列默认值 50 兜底 |

## 7. 测试

`scripts/pure-functions.test.ts`，用 Node 内置 `node:test` + `tsx`（**不引入测试框架**），`npm test` 运行，共 35 个用例（其中 10 个是语种注册表校验，见 [multi-language](../multi-language/multi-language.md)），本功能相关覆盖：

- `normalizeAnswer`：全角→半角、去标点/空白、空输入
- `gradeExercise`：choice/fill 容错与空答案、translate 恒进入自评
- `xpForAnswer` / `xpForSession` / `accuracy`：答错不加成、阈值处不加成、分母 0 返回 null
- `computeStreak`：今天已达成 / 今天未达成 / 昨天断档 / 同日多条累加 / 未设目标 / 空数据 / 跨月
- `recentDateKeys`：跨月回溯顺序
- `buildSteps`：顺序与长度稳定、无练习时的退化、本批外 itemId 不丢内容
- `readPreferences` / `writePreferences`：起点偏好往返、脏数据退化不抛错

> 采用 `tsx` 而非 `node --experimental-strip-types`：本项目源码使用无扩展名相对导入（Metro 风格），Node 原生 ESM 解析器无法处理。

## 8. 依赖变更

| 依赖 | 类型 | 说明 |
|---|---|---|
| `expo-haptics@~57.0.3` | 运行时 | 触感反馈，需 EAS dev build 重新构建才能生效；代码已做缺失降级 |

未引入 `expo-linear-gradient`（扁平色块 + 边框已足够）、未引入 Reanimated（见 §3.1 决策）。

## 9. 与多语种的关系

- **每日经验与连续天数是全局的，不按语种拆分**：换语种学习不该断签。`progress/*` 与 `answer_logs` 完全未做语种隔离。
- **按语种隔离的是**知识库、复习队列、进度统计（`languageId` 参数），见 [multi-language](../multi-language/multi-language.md)。
- 结算页的「难度反馈」写入**当前语种**的 `user_languages.difficulty_bias`。
- 学习页的发音标注标签、朗读语言、翻译题输入框提示都读当前语种 profile。

## 10. 已知取舍

1. **`translate` 自评可被刷经验**。这是无后端单机 App 的固有上限；已在 `answer_logs.step_kind` 区分记录，便于日后分析。
2. **不做心数**。多邻国的红心既是动力也是惩罚，个人学习工具里容易变成挫败源。若要做，建议做成默认关闭、可在设置打开的选项。
3. **`just_right` 反馈不改变任何状态**（只落 `difficulty_feedback` 表）。它目前是用于让用户"表态"的轻量入口，不参与 bias 计算。
4. **连续天数不做推送提醒**（本项目无后端，天然满足）。
5. **`DEFAULT_USER_ID` 仍从 `features/learn/service`（v1 遗留模块）导出**，8 个页面从这里引用。建议后续把它迁到 `src/lib/` 并删除 v1 的 `getToday`/`generatePackage`/`buildLearnPackagePrompt` 死代码。
