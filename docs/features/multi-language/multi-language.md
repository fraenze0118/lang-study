# 多语种支持（日语 + 韩语）功能设计

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 状态 | 已实现（`npm run typecheck` 双套零错误、`npm test` 35 个用例通过） |
| 关联 | MRD-PRD.md（多语言已从 Out 移入 In）、01-architecture.md、02-data-model.md、06-syllabus.md |
| 目标 | 从「只能学日语」改为「可切换语种」，并以韩语验证架构可扩展 |

## 1. 背景与问题

数据库其实**早就是多语言结构**（`languages` / `levels` 表，`items` 经 `unit_id → levels` 间接归属语种），但代码层完全没有利用它。改造前有 5 类日语硬编码：

| 类别 | 原位置 |
|---|---|
| 语种 ID 写死 | `getLevelByCode('ja', …)` |
| 等级体系写死 JLPT | `LEVEL_CODES = ['N5'..'N1']`、`userRepo` 默认 `'N5'`、`group.ts` 排序表 |
| 提示词写死日语/假名 | `systemPrompt` 的「日语教师」「（JLPT）」「附假名」「助词/自他动词/敬语」 |
| TTS 写死 `ja-JP` | `speakJapanese` / `checkJapaneseVoice` |
| 界面文案写死 | 「五十音」「JLPT 备考」「假名/汉字/释义」「用日语写出这个句子…」 |

同时暴露出 4 个**现存缺陷**，多语种会放大它们：

1. **播种卡死**：`ensureSyllabusSeeded()` 首行 `if (countLanguages() > 0) return;` —— 日语一旦播种，韩语永不写入。
2. **查询不按语种过滤**：`getKnowledgeItems` / `getDueReviews` / `getLearnedItems` / `getProgressStats` 只按 `user_id`，加韩语后两个语种的词会混在同一知识库与复习队列。
3. **查重不带语种**：`getItemBySurfaceReading(surface, reading)` 无 `languageId`，韩语「학생」与日语「学生」可能互斥。
4. **水平字段不可复用**：`users.level_code` / `difficulty_bias` 各只有一份，无法表达"日语 N5 + 韩语 TOPIK 2"；且 `items.level_code` 直接取自它，AI 生成条目会继承另一语种的水平。

## 2. 设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 语种关系 | **同一时间只学一个语种，数据完全隔离** | 知识库/复习/统计/对话按语种隔离；改动小、体验干净 |
| 发音标注字段 | `item_examples.kana` **重命名为 `pronunciation`** | 语义中性：日语存假名、韩语存罗马音、俄语将来存拉丁转写 |
| 等级体系 | **每语种自带**，不再共用 `LEVEL_CODES` | 日语 JLPT、韩语 TOPIK、俄语可留 CEFR；`LevelCode` 放宽为 `string` |
| 每日经验/连续天数 | **保持全局，不按语种拆分** | 换语种学习不该断签；也是改动最小、最不易出错的边界 |
| 活跃语种存储 | 独立 KV 表 `app_preferences` | 不塞进 `users`，避免以后每加一个偏好就改 schema |
| 字母入门偏好 | `interests.skipKanaUnits` → `user_languages.skip_script_units` | 按语种独立（"认得假名"不代表"认得谚文"） |

## 3. 核心：语种注册表

新增 `src/lib/languages.ts` 作为**单一事实来源**。每个语种声明自己的：名称/母语名/emoji、教师称呼、发音标注名称与规则、入门单元类型与标题、等级体系与等级表、TTS locale、易错点提示词、以及生成条目的质量校验正则。

```ts
export interface LanguageProfile {
  id; code; name; nativeName; flag;
  teacherLabel;            // '日语' → 拼进提示词
  readingLabel;            // '假名' / '罗马音'
  readingRule;             // 拼进提示词
  scriptUnitKind;          // 'kana' / 'hangul'
  scriptUnitTitle; scriptLabel; skipScriptLabel;
  levelSystem;             // 'JLPT' / 'TOPIK'
  levels: { code; label; order }[];
  ttsLocale;               // 'ja-JP' / 'ko-KR'
  voiceLabel;
  teacherRules: string[];  // 该语种易错点（取代写死的助词/自他动词/敬语）
  answerHint;
  validation: { readingMustMatch?: RegExp; readingMustNotMatch?: RegExp };
  startingPoints: { level; label; desc; skipScript }[];
}
```

配套访问器：`getLanguageProfile`（未知 id **回退默认**而不抛错，因为它多在渲染路径上）、`listLanguages`、`getLevelsSorted`、`getLevelOrder`、`getDefaultLevelCode`、`shiftLevelCode`。

**新增一个语种只需 2 处**：registered profile + `syllabus/registry.ts` 加一份课程。不需要改 prompts / TTS / UI 文案 / 查重逻辑。

## 4. 数据模型（v4 → v5）

```sql
-- 语种归属：AI 生成条目 unit_id 为 NULL，无法反推，必须显式存储
ALTER TABLE items ADD COLUMN language_id TEXT REFERENCES languages(id);
CREATE INDEX idx_items_language ON items(language_id, type);
ALTER TABLE chat_sessions ADD COLUMN language_id TEXT REFERENCES languages(id);

-- 发音标注改名
ALTER TABLE item_examples RENAME COLUMN kana TO pronunciation;

-- 按语种的用户画像
CREATE TABLE user_languages (
  user_id TEXT NOT NULL REFERENCES users(id),
  language_id TEXT NOT NULL REFERENCES languages(id),
  level_code TEXT NOT NULL,
  difficulty_bias INTEGER NOT NULL DEFAULT 0,
  skip_script_units INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, language_id)
);

-- App 级偏好
CREATE TABLE app_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

**迁移要点**（`database.ts` 的 `migrateToV5`，全部幂等）：

- 所有更早版本（1/2/3/4）最终都汇入 `migrateToV5`，避免漏分支。
- `ADD COLUMN` / `RENAME COLUMN` 不幂等，一律先用 `PRAGMA table_info` 探测。
- **必须先插入 `languages` 占位行再回填 `items.language_id`**：`language_id` 是外键，若在 `languages` 为空时回填，开启外键检查的库会直接失败。
- 回填策略：先按 `unit → level` 反推，再对历史 AI 条目兜底为 `'ja'`。
- 旧用户现有水平迁移为 `user_languages` 的**日语**行，并把 `interests.skipKanaUnits` 解析进 `skip_script_units`（脏数据按 0）。
- `users.level_code` / `difficulty_bias` / `interests` **保留不删**（SQLite `DROP COLUMN` 有限制，且保留便于回滚），但在 `types.ts` 标注 `@deprecated`，新代码一律不读写。

## 5. 按语种上下文

`src/features/profile/languageService.ts` 是页面与服务层的统一入口：

```ts
getActiveLanguageId(): string           // 读 app_preferences，缺失/未知回退默认
setActiveLanguageId(id): void
getActiveContext(userId?): ActiveContext
// => { languageId, profile, levelCode, difficultyBias, sessionSize, skipScriptUnits }
ensureUserLanguage(userId, languageId, levelCode?)
updateLanguageProfile(userId, languageId, patch)
listMyLanguages(userId); addLanguage(userId, languageId)
```

**签名增参 `languageId` 的数据层函数**：`getItemBySurfaceReading`、`getKnowledgeItems`、`getDueReviews`、`getLearnedItems`、`getProgressStats`、`getRecentLearnedItems`。

**边界：每日经验与连续天数全局共享**（`progress/*` 与 `answer_logs` 完全未改），按语种隔离的是知识库/复习/统计。

## 6. 内容与播种

```
src/syllabus/
├─ types.ts          # 语种无关的数据结构
├─ registry.ts       # LANGUAGE_COURSES: Record<languageId, Syllabus>
├─ ja/n5.ts          # 日语 N5 小样本（原 data.ts 平移）
├─ ko/topik1.ts      # 韩语 TOPIK 1 小样本
├─ data.ts           # 向后兼容再导出（N5_SYLLABUS 保留）
└─ import.ts         # ensureSyllabusSeeded：按语种幂等
```

**关键修复**：播种改为遍历 `LANGUAGE_PROFILES`，对每个语种用 `hasLanguageRow(id)` 判断后播种。因此**已安装的 App 升级后会自动补种韩语**，日语不重复。

**韩语种子（约 50 条）**：谚音入门 16（ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅎ + ㅏㅓㅗㅜㅡㅣ，含罗马音）、问候与自我介绍、数字（固有/汉字数词）、日常物品、日常动作，含 `은/는`、`이/가`、`을/를`、`~입니다`、`~아/어요` 语法点。罗马音按国立国语院标记法。

## 7. 界面

| 位置 | 改动 |
|---|---|
| `OnboardingScreen` | **先选语言**，再显示该语种的起点档位；「五十音」/「谚文」文案自动切换，等级标签自动变 TOPIK |
| `ChatScreen` | 顶部状态条左侧 `LanguageSwitcher`（`🗾 日语 ▾`），可切换或「＋ 再加一门」；切换时 `clearBatchCache()` 并重建该语种对话会话 |
| `SettingsScreen` | 语种切换与新增、当前水平（按语种）、**难度偏好**、**一次学多少**、字母入门开关、按语种的语音检测 |
| `KnowledgeScreen` / `ProgressScreen` | 按活跃语种过滤；进度页标题带语种名 |
| `StudyScreen` / `ReviewScreen` / `ItemDetailScreen` | 朗读 locale、发音标注标签、练习输入框提示都读 profile |
| `LanguageSwitcher`（新增组件） | 切换 UI；列出已学语种与可添加语种 |

## 8. 边界与失败模式

| 场景 | 处理 |
|---|---|
| 活跃语种指向未播种/未知语种 | `getLanguageProfile` 回退默认；`getActiveContext` 自动补一行默认水平的画像 |
| 语种只注册 profile、无内置大纲 | `suggestPreview` 走 AI 生成；未配 LLM Key 时报可重试错误 |
| 两语种有同形词 | 查重带 `languageId`，不再互斥 |
| 切换语种时正在学习 | 切换器只出现在首页/设置，学习与复习页无入口 |
| 切换后残留旧语种内容 | `clearBatchCache()` 清掉预取与待用批次；对话会话 id 带语种后缀 |
| 旧库 `interests.skipKanaUnits` | 迁移时解析进 `skip_script_units`（仅日语行），脏数据按 0 |
| 罗马音大小写/空格 | 统一小写；`normalizeAnswer` 已去空格与大小写，判分不受影响 |

## 9. 测试

注册表校验并入 `scripts/pure-functions.test.ts`，新增 10 个用例（总 35）。这样**以后加语种配错会立刻暴露**：

- 必填字段非空、`id === code`
- 等级代码唯一、`order` 从 1 连续
- `ttsLocale` 形如 `xx-XX`
- `startingPoints` 引用的等级必须存在
- `getLanguageProfile` 未知 id 回退默认
- `getLevelsSorted` / `getDefaultLevelCode` / `shiftLevelCode`（含边界与未知等级）
- 每个注册语种的课程等级必须已在 profile 声明
- 入门单元 `kind` 必须等于 profile 的 `scriptUnitKind`，且其条目类型一致
- 课程条目字段完整（word 必须有 `reading`/`pos`；例句三字段齐全）
- **`validation` 正则确实能拦下错误标注**：含汉字的假名被拦、含谚文的罗马音被拦

## 10. 已知取舍

1. **韩语内容由我起草，准确性需复核**（谚音罗马音、助词用法、敬语阶称）。修正只影响 `ko/topik1.ts` 一个文件。
2. **N4/N3/N2 与 TOPIK 2~6 无内置大纲**：目前只种了日语 N5 与韩语 TOPIK 1，其余等级走 AI 生成，需配 LLM Key。
3. **`users.level_code` 等旧列保留**未删，属技术债；迁移已把它们的内容搬进 `user_languages`。
4. **`item_examples.ja` 键名保留**（存目标语言原文）：改名会动 AI 契约，且 `ja` 这个名字已在提示词/schema/服务层广泛使用，收益不抵风险。
5. **`ITEM_TYPES` / `UNIT_KINDS` 用 `'kana'` 表示日语入门单元**，韩语用 `'hangul'`；两者都是枚举成员，新增语种需加对应成员。
