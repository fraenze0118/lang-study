# 知识库可视化分类 开发计划

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0 |
| 状态 | 已完成（M0–M5 全部实现） |
| 关联 | [knowledge-visualization.md](./knowledge-visualization.md)（功能设计） |

## 0. 前置（评审结论）

- **4 个分类维度全做**：主题 / 等级 / 词性 / 掌握度。
- **可视化一步到位**：统计概览 + 掌握度分布条 + 分组折叠列表 + 词条网格。
- **颜色**：灰=新学、橙=学习中、绿=已掌握。
- **AI 生成词也要满足这套结构** → `items` 表新增 `category` 字段（大纲词=单元标题，AI 词=生成时主题）。
- **语法库 tab 暂不做**。

## 1. 里程碑

| 阶段 | 交付 |
|---|---|
| M0 | 数据层：`items.category` + 迁移（v3）+ AI 生成写 category + 查询补字段 |
| M1 | 分组逻辑 `groupItems`（4 维度，纯函数） |
| M2 | 统计概览组件（数字卡片 + 掌握度分布条） |
| M3 | 维度切换 chips + 分组折叠列表 |
| M4 | 词条网格视图 + 列表/网格切换 |
| M5 | 集成知识库页 + 验证（typecheck + bundle） |

## 2. 任务清单

### M0 数据层
- [x] `schema.ts`：`items` 加 `category TEXT`；`SCHEMA_VERSION` → 3
- [x] 迁移：v2→v3 用 `ALTER TABLE` + 回填（大纲词回填单元标题）；< v2 直接重建
- [x] 大纲导入：导入时写 `category = 单元标题`
- [x] AI 生成（`generateSessionData`）：新条目写 `category = 预览 topic ?? 'AI 推荐'`；语法条目 = `'语法'`
- [x] `getKnowledgeItems` 查询补 `category`、`pos` 字段

### M1 分组逻辑
- [x] `groupItems(items, dimension)` 纯函数：`mastery / level / theme / pos` 四维
- [x] 兜底：未知值归入 `未分类 / 未分级 / 其他`

### M2 统计概览
- [x] `StatsOverview`：已学 / 已掌握 / 待复习 数字卡片
- [x] 掌握度分布条（灰/橙/绿三段，按比例）

### M3 分组列表
- [x] `DimensionTabs`：4 个维度切换 chips
- [x] `GroupedList`（SectionList）：组头 = 名称 + 数量 + 小进度，可折叠
- [x] 词条行加掌握度颜色圆点

### M4 词条网格
- [x] `WordGrid`：彩色词条胶囊（边框/背景色 = 掌握度），点击进详情
- [x] 列表 / 网格 切换按钮

### M5 集成与验证
- [x] 用上述组件重构 `KnowledgeScreen` 主体（保留搜索 + 复习入口 + 语法库 tab 原样）
- [x] typecheck + Metro bundle 验证

## 3. 验收标准

1. 4 个维度切换后分组正确；AI 生成的词也能进入主题分组（按生成时的 topic 归类）。
2. 顶部统计 + 掌握度分布条数据正确。
3. 分组折叠列表、词条网格两种视图均可正常使用。
4. 现有能力不退化：搜索、点击进详情、开始复习、语法库 tab。

## 4. 风险与对策

| 风险 | 对策 |
|---|---|
| 迁移 ALTER 失败 | 兜底走「重建表」路径（测试数据可弃） |
| AI 词无 topic | 归入 `AI 推荐` 分组 |
| 网格词多时滚动性能 | 复用 FlatList/SectionList 虚拟化；必要时限制渲染数量 |
