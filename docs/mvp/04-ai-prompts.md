# AI 提示词与结构化输出设计（v2）

| 项 | 内容 |
|---|---|
| 文档版本 | v2.0 |
| 变更 | 新增意图路由、主题内容生成、水平评估出题 |
| 关联文档 | 01-architecture.md、03-api-design.md |

## 1. 总体原则

1. **用户主导，AI 引导**：AI 理解意图、提议内容，但不强制推送。
2. **大纲 + AI 生成双来源**：学大纲条目时只做讲解；自定义主题时 AI 生成新条目（含发音标注/释义/等级），都进知识库。
3. **动态难度**：所有生成接收 `(level_code, difficulty_bias)`，据此控制词汇/语法难度。
4. **结构化输出 + 质量校验**：发音标注必填、等级不超纲、字段完整，失败重试/降级。
5. **语种参数化**：所有提示词接收当前语种的 `LanguageProfile`，教师称呼、等级体系、发音标注名称与规则、易错点都由 profile 提供（见 [features/multi-language](../features/multi-language/multi-language.md)）。

## 2. 系统提示词（System Prompt）

```
你是一名专业、耐心的{teacherLabel}教师，面向中文母语学习者。
学习者当前预估等级：{levelCode}（{levelSystem}），难度偏移：{difficultyBias}（正=更难，负=更简单）。
遵守：
1. 只讲系统给定条目；自定义主题时可生成新条目，但必须给全字段（书写/{readingLabel}/词性/中文释义/等级）。
2. {readingRule}，并同时给出中文翻译（zh）。
3. 难度按 (levelCode, difficultyBias) 控制，不超纲。
4. 讲解用中文，简洁准确；输出为合法 JSON，符合给定 schema。
5..n. {teacherRules}（该语种的易错点，按数组逐条展开）
```

各语种的差异值：

| 占位符 | 日语 | 韩语 |
|---|---|---|
| `teacherLabel` | 日语 | 韩语 |
| `readingLabel` | 假名 | 罗马音 |
| `readingRule` | 日语例句必须附假名（kana） | 韩语例句必须附罗马音（罗马字转写） |
| `levelSystem` | JLPT | TOPIK |
| `teacherRules` | 助词（は/が）、自他动词、敬语 | 敬语阶称（합니다/해요/반말）、助词（은/는、이/가、을/를）、动词活用（아/어요） |

## 3. 各场景 Prompt + Schema

### 3.1 意图路由（agent）
**输入**：用户消息 + 画像摘要 + 待复习数。
**任务**：分类意图并提取参数。

**输出 Schema**：
```json
{
  "intent": "study_suggest | study_custom | review | qa | difficulty_feedback",
  "topic": "string|null",        // study_custom 时填
  "question": "string|null",     // qa 时填
  "feedback": "too_easy|too_hard|null",  // difficulty_feedback 时填
  "confidence": 0.9,
  "reply": "string"              // 给用户的简短回复
}
```

### 3.2 内容预览（suggest / custom）
**输入**：意图 + 主题 + 画像 + 知识库已学摘要。
**任务**：提议一批 5~8 个条目（词 + 1 语法）。

**输出 Schema**：
```json
{
  "items": [
    { "surface": "推し", "reading": "おし", "pos": "noun",
      "meaning": "（流行语）本命/最爱", "level": "N3", "isNew": true }
  ],
  "grammar": { "surface": "～みたい", "pattern": "N + みたい", "meaning": "像…一样" } | null,
  "reason": "string"
}
```
> 自定义主题时 `isNew=true`（AI 生成）；AI 推荐时优先选大纲未学条目。

### 3.3 学习会话生成（study）
**输入**：预览确定的条目 + 画像。
**任务**：为每个条目生成讲解与例句，为语法生成结构拆解，生成练习。

**输出 Schema**：
```json
{
  "lessons": [{ "itemId", "explanation", "examples": [{ "ja", "pronunciation", "zh" }] }],
  "grammar": { "itemId", "explanation", "structure", "tips", "examples": [...] } | null,
  "exercises": [{ "type": "choice|fill|translate", "prompt", "options", "answer", "explanation" }]
}
```

> `ja` 存**目标语言原文**，`pronunciation` 存**发音标注**（日语假名 / 韩语罗马音）。
> 两处键名都是历史遗留：`ja` 为兼容既有契约保留；`pronunciation` 由 `kana` 改名而来（schema v5）。

### 3.4 水平评估出题（已废弃）
初始水平改由**用户自选**（见 05-ux-flows.md 第 1 节），不再向 LLM 出评估题。
原 `AssessmentQuestionSchema` / `buildAssessmentPrompt` 已从 `src/ai/prompts.ts` 移除。

### 3.5 答疑（qa）
- 带上下文（条目 + 水平 + 已学摘要）回答，Markdown 输出，{readingRule}。

### 3.6 造句点评
- 输出 isCorrect / corrections / improved / encouragement。

## 4. 难度反馈规则（非 LLM，规则化）

```
feedback = too_easy → difficulty_bias += 1
feedback = too_hard → difficulty_bias -= 1
difficulty_bias > +2 → level_code 升一级, bias = 0
difficulty_bias < -2 → level_code 降一级, bias = 0
```

- `difficulty_bias` 与 `level_code` **按语种独立**，写在 `user_languages`（见 02-data-model.md）。
- 升降级用 `shiftLevelCode(languageId, …)`，按该语种的等级表平移并在边界夹取。
- `just_right` 只落 `difficulty_feedback` 表，不改变任何状态。

## 5. 生成条目质量校验

| 约束 | 校验 |
|---|---|
| 发音标注符合该语种 | 非空 + 按 `LanguageProfile.validation` 正则判定（日语：不含汉字；韩语：不含谚文） |
| 释义非空 | 规则校验 |
| level 取该语种等级之一 | 规则校验 |
| 例句附 pronunciation/zh | 规则校验（Zod schema） |
| 同语种不重复 | 查重按「surface + reading + language_id」 |

## 6. 降级与重试

1. 解析失败 → 重试 1 次。
2. 仍失败 → 降级到「大纲未学条目」。
3. AI 生成条目校验不过 → 丢弃该条，保留通过项。
