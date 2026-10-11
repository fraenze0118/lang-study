# 数据模型详细设计（v2）

| 项 | 内容 |
|---|---|
| 文档版本 | v2.0 |
| 变更 | 新增动态画像、难度反馈、条目 source、会话 kind |
| 关联文档 | MRD-PRD.md、01-architecture.md |

## 1. 枚举定义

| 枚举 | 值 |
|---|---|
| `item_type` | `kana` / `word` / `grammar` |
| `level_code` | `N5` / `N4` / `N3` / `N2` / `N1` |
| `item_source` | `syllabus`（大纲内置）/ `ai`（AI 生成） |
| `pos` | `verb` / `noun` / `i-adj` / `na-adj` / `adverb` / `particle` / `conjunction` / `interjection` / `expression` |
| `conjugation` | `godan` / `ichidan` / `sa-hen` / `ka-hen` |
| `transitivity` | `intransitive` / `transitive` / `both` |
| `review_grade` | `Again` / `Hard` / `Good` / `Easy` |
| `mastery_state` | `new` / `learning` / `mastered` |
| `unit_kind` | `theme` / `scene` / `kana` |
| `feedback` | `too_easy` / `just_right` / `too_hard` |
| `chat_kind` | `agent`（对话入口）/ `qa`（条目答疑） |
| `study_mode` | `suggest`（AI 推荐）/ `custom`（自定义主题）/ `review` |
| `intent` | `study_suggest` / `study_custom` / `review` / `qa` / `difficulty_feedback` |

## 2. 内容表（知识库）

### 2.1 `languages`
| 字段 | 类型 | 说明 |
|---|---|---|
| id / code / name | text | 语言配置（多语言抽象） |

### 2.2 `levels`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 主键 |
| language_id | text | → languages |
| code | text | N5~N1 |
| sort_order | int | 排序 |

### 2.3 `units`（大纲种子单元）
| 字段 | 类型 | 说明 |
|---|---|---|
| id / level_id / title / kind / sort_order | - | 大纲单元 |

### 2.4 `items`（知识库核心，大纲 + AI 生成）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 主键 |
| unit_id | text | → units（AI 生成条目可为 null） |
| type | enum | kana/word/grammar |
| surface / reading / meaning | text | 书写 / 发音标注 / 中文释义 |
| accent / pos / conjugation / transitivity | - | 词性相关 |
| pattern / grammar_category | text | 语法相关 |
| **source** | enum | `syllabus` / `ai` |
| **level_code** | text | 条目难度等级（难度控制） |
| **created_at** | int | 创建时间（epoch ms） |
| sort_order | int | 排序 |

### 2.5 `item_examples`
| 字段 | 类型 | 说明 |
|---|---|---|
| id / item_id / zh | - | 基本字段 |
| ja | text | **目标语言原文**（键名为历史遗留，各语种共用） |
| **pronunciation** | text | **发音标注**：日语假名 / 韩语罗马音（v5 由 `kana` 改名） |
| source | enum | `manual` / `ai` |

## 3. 用户与画像

### 3.1 `users`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 主键（单用户 `local`） |
| native_language | text | 默认 `zh` |
| level_code | enum | ⚠️ **已废弃**：全局单一水平，真实水平见 `user_languages` |
| **difficulty_bias** | int | ⚠️ **已废弃**：同上 |
| goal | enum | exam/daily/both |
| session_size | int | 每次学习建议条目数（默认 8；**全局**，不按语种分） |
| interests | text | ⚠️ **已废弃**：旧的字母入门偏好，已迁到 `user_languages.skip_script_units` |
| **assessment_done** | int | 0/1 是否已设定起点（字段名为历史遗留；现在表示"用户已自选水平"） |
| daily_goal_xp | int | 每日目标经验（0 = 不设目标）；**全局** |

### 3.2 `user_languages`（v5 新增，按语种的用户画像）
| 字段 | 类型 | 说明 |
|---|---|---|
| user_id + language_id | text | 联合主键 |
| **level_code** | text | 该语种的水平（日语 N5..N1 / 韩语 TOPIK1..6） |
| **difficulty_bias** | int | 该语种的难度偏移 -2..+2 |
| **skip_script_units** | int | 1 = 已认得该语种字母，推荐时跳过入门单元 |
| created_at | int | 时间 |

### 3.3 `app_preferences`（v5 新增，App 级偏好）
| 字段 | 类型 | 说明 |
|---|---|---|
| key | text | 主键 |
| value | text | 目前只存 `active_language_id` |

### 3.4 `difficulty_feedback`（新增）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | int | 主键 |
| user_id | text | → users |
| item_id | text | 关联条目（可空） |
| feedback | enum | too_easy/just_right/too_hard |
| created_at | int | 时间 |

## 4. 学习状态与复习

### 4.1 `study_sessions`（新增，可选）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 主键 |
| user_id | text | → users |
| mode | enum | suggest/custom/review |
| item_count | int | 条目数 |
| created_at | int | 时间 |

### 4.2 `user_item_states`（SRS 状态）
| 字段 | 类型 | 说明 |
|---|---|---|
| user_id + item_id | - | 唯一约束 |
| mastery_state | enum | new/learning/mastered |
| fsrs_state / stability / difficulty / due / reps / lapses / last_review_at | - | FSRS 状态 |

### 4.3 `review_logs`
| 字段 | 类型 | 说明 |
|---|---|---|
| user_id / item_id / grade / elapsed_ms / reviewed_at | - | 复习记录 |

## 5. 对话表

### 5.1 `chat_sessions`
| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 主键 |
| user_id | text | → users |
| item_id | text | 关联条目（可空） |
| **kind** | enum | `agent` / `qa` |
| created_at | int | 时间 |

### 5.2 `chat_messages`
| 字段 | 类型 | 说明 |
|---|---|---|
| id / session_id / role / content / created_at | - | 消息 |

## 6. 关系总览（ER 摘要）

```
languages 1─n levels 1─n units 1─n items 1─n item_examples
items 1─n user_item_states n─1 users
users 1─n difficulty_feedback
users 1─n review_logs
users 1─n chat_sessions 1─n chat_messages
users 1─n study_sessions
```

> 注：AI 生成的条目 `unit_id` 可为 null、`source='ai'`、`level_code` 由生成时的难度决定。
