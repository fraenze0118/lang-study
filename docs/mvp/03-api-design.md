# 本地服务层与 AI 集成接口设计（v2）

| 项 | 内容 |
|---|---|
| 文档版本 | v2.0 |
| 变更 | 服务层重构为 agent/study/knowledge/review/profile |
| 关联文档 | 01-architecture.md、02-data-model.md、04-ai-prompts.md |

## 1. 说明

MVP 无后端，全部为客户端内 TypeScript 服务层 + LLM 直连。页面只调用服务层。

## 2. 服务层接口（TypeScript）

### 2.1 AgentService（对话入口）
```ts
type Intent = 'study_suggest' | 'study_custom' | 'review' | 'qa' | 'difficulty_feedback';

interface AgentAction =
  | { type: 'study_suggest' }
  | { type: 'study_custom'; topic: string }
  | { type: 'review' }
  | { type: 'qa'; question: string }
  | { type: 'feedback'; feedback: Feedback };

interface AgentReply {
  intent: Intent;
  text: string;          // AI 回复文本
  action?: AgentAction;  // 需要跳转/执行的动作
}

handleMessage(message: string): Promise<AgentReply>
suggestStudy(): Promise<ContentPreview>       // AI 推荐一批
previewCustomStudy(topic: string): Promise<ContentPreview>
```

### 2.2 StudyService（学习会话）
```ts
interface StudySession {
  sessionId: string;
  mode: StudyMode;
  items: ItemSummary[];        // 本批条目
  lessons: Lesson[];           // 讲解+例句
  grammar: GrammarLesson | null;
  exercises: Exercise[];
}

generateSession(input: { mode: StudyMode; topic?: string }): Promise<StudySession>
completeSession(sessionId: string): Promise<void>   // 标记学完，落库进复习
```

### 2.3 KnowledgeService（知识库）
```ts
listItems(filter: { type?: ItemType; mastery?: MasteryState; level?: LevelCode }): LearnedItem[]
search(query: string): LearnedItem[]
getItemDetail(itemId: string): ItemDetail
getStats(): ProgressStats
```

### 2.4 ReviewService（复习）
```ts
extractDue(limit?: number): DueReviewSummary[]   // 抽取到期内容
grade(stateId: number, g: ReviewGrade): GradeResult
```

### 2.5 ProfileService（画像 + 起点 + 难度）
```ts
getProfile(): User
updateProfile(patch): User
setInitialLevel(level: LevelCode): User   // 用户自选起点（同时把 difficulty_bias 归零）
applyFeedback(feedback: Feedback): User   // 太简单/太难 → 调 difficulty_bias，越界升降级
```

### 2.6 BackupService（备份）
```ts
exportAll(): string
importAll(json: string): void
```

## 3. 关键类型

```ts
type ContentPreview = { items: ItemSummary[]; reason: string };  // 预览清单 + AI 推荐理由
type ItemDetail = Item & { examples: ItemExample[]; mastery: MasteryState };
type Feedback = 'too_easy' | 'just_right' | 'too_hard';
```

## 4. LLM 外部 API 集成（OpenAI 兼容）

```
POST {baseUrl}/chat/completions
{ model, messages, response_format: { type: "json_object" } }
```
- 结构化输出 Schema 见 `04-ai-prompts.md`。
- `baseUrl / model / apiKey` 存本地 `.env`，不提交仓库。

## 5. 错误处理

| 场景 | 处理 |
|---|---|
| AI 输出解析失败 | 重试 1 次 → 降级到大纲内容 |
| 生成条目 kana 缺失 | 重试/丢弃该条 |
| 意图路由低置信度 | 追问澄清 |

## 6. 与 v1 接口的对应

| v1 接口 | v2 服务 |
|---|---|
| `LearnService.getToday` | 移除（无今日计划），由 Agent + Study 取代 |
| `LearnService.generatePackage` | `StudyService.generateSession` |
| `ReviewService.getQueue/grade` | 保留，`extractDue` 取代 getQueue |
| `AskService.ask` | Agent（qa 意图）+ 答疑 |
| `ProfileService` | 扩展：评估 + 难度反馈 |
