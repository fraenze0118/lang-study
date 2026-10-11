# 大纲与内容规范（多语种）

| 项 | 内容 |
|---|---|
| 文档版本 | v3.0 |
| 变更 | 大纲降级为"种子"，AI 生成条目作为补充；**按语种拆分并支持多语种注册** |
| 关联文档 | MRD-PRD.md、02-data-model.md、[features/multi-language](../features/multi-language/multi-language.md) |

## 1. 定位变化

- **v1**：大纲是唯一内容来源，AI 只做讲解。
- **v2**：大纲是**种子骨架**（保证体系性与质量基线）；AI 可**自由生成新条目**（如流行词、用户指定主题），统一进知识库、进复习。
- **v3**：大纲**按语种组织**，每个语种一份课程；播种按语种幂等，新增语种不会因为"已有语种"而被跳过。

## 2. 条目来源（`item.source`）

| 来源 | 说明 |
|---|---|
| `syllabus` | 大纲内置，质量可控、可精修 |
| `ai` | AI 生成，需过质量校验（发音标注/释义/等级，规则随语种） |

## 3. 目录组织

```
src/syllabus/
├─ types.ts      # 语种无关的数据结构
├─ registry.ts   # LANGUAGE_COURSES: Record<languageId, Syllabus>
├─ ja/n5.ts      # 日语 N5 小样本
├─ ko/topik1.ts  # 韩语 TOPIK 1 小样本
├─ data.ts       # 向后兼容再导出
└─ import.ts     # ensureSyllabusSeeded：逐语种幂等播种
```

**新增语种**：加一份课程文件 + 在 `registry.ts` 登记一行；`lib/languages.ts` 里注册对应 profile。
播种会自动覆盖，无需改 `import.ts`。

## 4. 已内置的种子数据

| 语种 | 等级 | 内容 |
|---|---|---|
| 日语 | N5 | 五十音（10）+ 问候自我介绍、日常物品、数字颜色、日常动作 |
| 韩语 | TOPIK 1 | 谚音入门（16：基本辅音/元音 + 罗马音）+ 问候自我介绍、数字、日常物品、日常动作 |

- 字母入门单元的 `kind` 必须等于该语种 `LanguageProfile.scriptUnitKind`（日语 `kana` / 韩语 `hangul`），
  且其条目 `type` 与之一致 —— 该约束有单测兜底。
- 无论文/教程要求：其余等级（日语 N4~N1、韩语 TOPIK 2~6）暂无内置内容，走 AI 生成，需配 LLM Key。

## 5. AI 生成条目规范

- 必含字段：surface / reading（发音标注）/ pos / meaning / level_code / 例句。
- **必须显式写入 `language_id`**：AI 条目的 `unit_id` 为 null，无法从单元反推语种。
- `source='ai'`、`unit_id=null`、`created_at` 记录生成时间。
- 需过 04-ai-prompts 第 5 节质量校验（按语种正则）。

## 5. 大纲维护

- 大纲以结构化数据存储（JSON/TS + 导入脚本），与 v1 相同。
- 新增语言时复用同一套表结构。
