# 技术架构设计（v2）

| 项 | 内容 |
|---|---|
| 文档版本 | v2.0 |
| 变更 | 新增对话入口（Agent）、知识库、动态画像；学习改为会话制 |
| 关联文档 | MRD-PRD.md |

## 1. 总体架构（纯客户端）

```
┌───────────────────────────────────────────────┐
│   移动端 App（Expo / React Native + TypeScript）│
│                                               │
│   页面层：对话主页 / 学习页 / 知识库 / 设置       │
│            │                                  │
│   服务层：agent · study · knowledge ·          │
│           review · profile · backup           │
│            │                  │               │
│   数据层（SQLite）           AI 层（LLM 直连）    │
└───────────────────────────────────────────────┘
```

**核心原则**：
- 全部逻辑与数据本地；SQLite 是唯一数据源；仅 AI 功能需联网。
- **对话是入口**：agent 服务负责意图路由与内容提议，学习由 study 服务在专门界面执行。
- **画像动态**：profile 服务承载起点设定与难度反馈闭环。
- 内容**大纲 + AI 生成**双来源，统一进知识库、进复习。

## 2. 服务层职责

| 服务 | 职责 |
|---|---|
| `agent` | 理解用户意图、路由到 学新/复习/答疑/反馈；组装学习内容预览 |
| `study` | 学习会话：生成/选取条目、AI 讲解例句练习、落库进复习 |
| `knowledge` | 知识库查询：浏览、搜索、筛选、掌握度、条目详情 |
| `review` | FSRS 评分 + 到期内容抽取 |
| `profile` | 画像读写、自选起点设定、难度反馈调整 |
| `backup` | 数据导出/导入 |

## 3. 目录结构

```
app/src/
├─ app/                 # 页面与导航
│  └─ screens/          # Chat(对话) / Study(学习) / Knowledge(知识库) / Settings
├─ ai/                  # LLM client + 提示词 + 结构化输出 + 质量校验
├─ db/                  # SQLite schema + 各领域 repo
├─ fsrs/                # ts-fsrs 封装
├─ features/
│  ├─ agent/            # 意图路由 + 内容提议
│  ├─ study/            # 学习会话
│  ├─ knowledge/        # 知识库
│  ├─ review/           # 复习
│  ├─ profile/          # 画像 + 评估 + 难度反馈
│  └─ backup/
├─ syllabus/            # 大纲种子数据 + 导入
└─ lib/                 # 枚举、类型、常量
```

## 4. AI 集成

- **意图路由**：agent 用 LLM 把用户输入分类为 `study_suggest / study_custom / review / qa / difficulty_feedback`，并提取参数（主题、难度等）。
- **内容生成**：study 用 LLM 生成讲解/例句/练习；自定义主题时生成新条目。
- **质量校验**：生成条目的发音标注（按语种规则）、释义、等级做校验，失败重试或降级到大纲内容。
- **Provider 抽象**：OpenAI 兼容接口，可换 DeepSeek/Claude。

## 5. 动态画像机制

```
初始：用户自选起点（按语种给 5 档）→ 直接设定该语种的 level_code（零基础不跳过字母入门单元）
持续：学习中/后反馈「太简单/太难/刚好」
      → 调整 difficulty_bias（-2..+2）
      → bias 越界则 level_code 升降、bias 归零
      → AI 生成内容时接收 (level_code, difficulty_bias) 决定难度
```

> 语种说明：`level_code` 与 `difficulty_bias` **按语种独立**，存在 `user_languages`。
> `users.level_code` 是废弃的全局单一水平，仅为兼容历史数据保留。
> 语种差异（等级体系、发音标注、入门单元、TTS、易错点）集中在 `src/lib/languages.ts` 的注册表。

## 6. 关键时序

### 6.1 对话 → 学习
```
Chat 页 → AgentService.handleMessage("我想学流行词")
        → LLM 路由：study_custom, topic=流行词
        → 返回内容预览（条目列表）
        → 用户确认 → StudyService.generateSession({topic, level, bias})
        → LLM 生成条目+讲解+练习 → 质量校验
        → 学习页展示 → 学完写库 + 进 FSRS
```

### 6.2 复习
```
知识库页 → 点「复习」→ ReviewService.extractDue(limit)
        → 复习页闪卡 → grade → FSRS 更新
```

### 6.3 难度反馈
```
用户「太简单了」→ AgentService 路由 difficulty_feedback
        → ProfileService.applyFeedback('too_easy')
        → difficulty_bias +1 → 影响后续内容
```

## 7. 技术风险与对策

| 风险 | 对策 |
|---|---|
| AI 生成条目质量（发音标注/释义错） | 结构化输出 + 按语种的字段校验 + 重试/降级 |
| 重构破坏旧功能 | M0 先迁移数据层，保证旧服务可读 |
| 多语种数据串味 | 所有用户数据查询带 `language_id`；查重也按语种；切换语种时清预取缓存 |
| 新增语种成本失控 | 语种差异集中到 `LanguageProfile` 注册表；注册表校验有单测兜底 |
| 意图路由误判 | 路由输出 JSON + 置信度，低置信度追问 |
| 动态难度失控 | bias 限幅（-2..+2），越界才升降 level_code |
