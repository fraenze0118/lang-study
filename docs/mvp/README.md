# lang-study 设计文档索引（v3）

多语种（日语 + 韩语）学习 App（个人 MVP）——**对话式发起、按需学习、随时复习**。文档按以下顺序阅读：

| 文档 | 内容 |
|---|---|
| [MRD-PRD.md](./MRD-PRD.md) | 市场需求 + 产品需求（v2 定位、功能、范围） |
| [01-architecture.md](./01-architecture.md) | 技术架构（Agent/Study/Knowledge/Review/Profile + 多语种注册表） |
| [02-data-model.md](./02-data-model.md) | 数据模型（按语种画像、动态难度、条目 source） |
| [03-api-design.md](./03-api-design.md) | 本地服务层接口设计 |
| [04-ai-prompts.md](./04-ai-prompts.md) | AI 提示词（意图路由/内容生成/校验，均按语种参数化） |
| [05-ux-flows.md](./05-ux-flows.md) | 交互流程（选语种/对话入口/学习/知识库/复习） |
| [06-syllabus.md](./06-syllabus.md) | 大纲与内容规范（按语种种子 + AI 生成） |
| [07-development-plan.md](./07-development-plan.md) | 开发计划 v2（M0–M5） |

专题设计：

| 文档 | 内容 |
|---|---|
| [features/multi-language](../features/multi-language/multi-language.md) | 多语种支持（注册表、schema v5、数据隔离） |
| [features/gamification](../features/gamification/gamification.md) | 游戏化（经验/连击/每日目标/连续天数） |
| [features/tts](../features/tts/tts.md) | 语音朗读（按语种的系统 TTS） |
| [features/knowledge-visualization](../features/knowledge-visualization/knowledge-visualization.md) | 知识库可视化分类 |

## 核心决策速览（v3）

- **交互模型**：对话式入口，用户主导 + AI 引导
- **学习界面**：对话做决策，学习用沉浸式专门界面（一屏一步）
- **语种**：日语 + 韩语，同一时间只学一个；知识库/复习/统计按语种隔离，经验与连续天数全局共享
- **水平**：动态画像（启动时自选起点 + 学习中反馈持续调整），**按语种独立**
- **内容**：大纲 + AI 自由生成，都进知识库
- **复习**：知识库页面下触发（FSRS）
- **UI**：温暖游戏化
- **技术**：React Native (Expo) + TypeScript，纯本地 + LLM 直连
