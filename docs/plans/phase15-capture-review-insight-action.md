# Phase 15 — Capture → Review → Insight → Action

## 当前实施状态（2026-09-18）

- **M1：✅ 已实现并完成生产核心链路** — PR #38，Capture → Review → Task。
- **M2：🚧 代码/API/数据库已上线并进入真实 Provider 验收** — PR #39；生产环境已有 Qwen 调用证据，PR #43 进一步关闭默认 thinking、启用 JSON mode，并补齐 Provider 重试/超时与安全错误日志。
- **M3：🚧 代码完成，最新 Android 已到 `5835e322`，Web/API 待显式对齐最新 master** — PR #40 完成 Insight → Task；腾讯云已验证的生产 API 基线仍为 `1e5f8356`、19 migrations up to date；PR #43 后续稳定性修复尚需按发布门禁显式部署并复验。
- Web 发布策略改为 **GitHub CI 后显式 Production**，不再为每个 Git commit 自动创建 Vercel deployment。
- M4 不提前启动，先完成 `master@5835e322` 的 Web/API 发布、真实 Qwen 洞察质量/失败恢复，以及 Android 真机闭环。

---

> **状态**：⬜ 方案已确认，未实施  
> **最后更新**：2026-09-17  
> **最初设计基线**：`master@27f64066`  
> **当前实现基线**：`master@5835e322`
> **定位**：把 SparkFlow 现有的记录、Today、待办、Planner、Timeline、Focus 串成一个从想法到行动的闭环，而不是新增一套独立笔记 App。

---

## 1. 目标与产品定义

Phase 15 的核心流程：

```text
随手记录
  ↓
每天回顾
  ↓
补充新的理解
  ↓
AI 从多张卡片中发现主题 / 变化 / 行动机会
  ↓
生成可解释的 Insight
  ↓
用户确认后转为 Task
  ↓
Planner 排程
  ↓
Timeline / Focus 执行
  ↓
完成，并可回溯“为什么做这件事”
```

产品目标不是“做一个更复杂的灵感墙”，而是形成 SparkFlow 的新核心体验：

> **Capture → Think → Understand → Act**

成功标准：一条临时想法进入 SparkFlow 后，可以在后续几天被重新看到、形成新的理解、与其他记录产生联系，并最终在用户确认后变成可执行任务。

---

## 2. 当前代码事实

### 2.1 已有能力

当前项目已经具备这条链路的大部分底座：

- 导航已有 `sparks / 灵感`，但默认隐藏。
- 全局 Quick Add 已有“记录灵感 / 新建任务 / 开始专注 / AI 帮我安排”。
- Prisma 已有 `Inspiration`，包含正文、标签、AI 摘要、AI 洞察、状态等字段。
- `Task` 已有 `inspirationId`，可以记录任务来源。
- 后端已有 `/inspirations` 列表、详情、创建、状态修改接口。
- Planner 已有 Preview → Apply → Undo；Timeline、Today、Focus 已能接后续执行流程。

### 2.2 当前断点

现有前端 `Spark` 与后端 `Inspiration` 是两套事实源：

- `SparksView` 是可拖拽自由排版卡片墙。
- `dataSlice` 中 Sparks 仍是纯前端状态。
- `initialSparks` 是 fallback / 示例卡片，不是正式持久化数据。
- 前端尚未把 `Inspiration` 作为“记录”的统一数据源。
- 现有后端 `Inspiration.sourceUrl` 必填，不适合纯手动随手记。
- 没有独立“回顾批注”历史，也没有多卡片 Insight 关系。

因此 Phase 15 的第一步不是堆 AI，而是先把 **记录事实源统一到服务端 Inspiration**。

---

## 3. 已确认产品决策

1. 一级导航把“灵感”升级为 **“记录”**；内部提供“卡片 / 回顾 / 洞察”。
2. 原自由拖拽灵感墙保留，但降为记录的可选“自由墙”视图，不再作为主视图。
3. 回顾时产生的新想法独立保存为 Reflection，不覆盖原记录正文。
4. AI 只生成洞察与行动建议；**不得自动创建 Task、不得自动修改原始记录**。
5. 第一版不引入向量数据库、知识图谱或独立 RAG 基础设施。
6. 每个 AI Insight 必须能展开看到来源卡片，保证可解释。
7. M1 先打通 **Capture → Review → Task**；AI Insight 放在 M2。
8. 视觉采用 **SparkFlow 主框架 + 记录区域纸张模式**，不整体复制参考软件。
9. 现有 Planner 的“先预览、后写入、可撤销”原则继续作为 AI 行动的统一交互原则。
10. 不新增 hash、contract freeze、baseline 或额外 gate；正常依赖 Git、数据库约束、事务、类型、测试和发布验收即可。

---

## 4. 信息架构

### 4.1 一级导航

建议默认导航逐步收敛为：

```text
今天
时间轴
待办
课程
记录
设置
```

`看板` 继续作为可配置导航项。

导航 registry 仍使用现有可显隐、可排序机制，不新增第二套导航系统。

### 4.2 记录模块二级结构

```text
记录
├── 卡片
│   ├── 时间流（默认）
│   └── 自由墙（保留旧 SparksView 的视觉能力）
├── 回顾
└── 洞察
```

第一阶段 M1 只开放“卡片 / 回顾”；“洞察”可显示占位说明或直接隐藏到 M2。

---

## 5. Capture：随手记

### 5.1 入口

任何页面点击全局 `+`：

```text
新建任务
新建日程
随手记
开始专注
AI 帮我安排
```

“记录灵感”改名为“随手记”。

### 5.2 Quick Capture 交互

手机端优先使用底部 Sheet，首次创建只要求正文：

```text
┌──────────────────────┐
│ 记下现在想到的东西       │
│                      │
│ 写点什么……             │
│                      │
│ # 标签      关联项目     │
│                      │
│          保存          │
└──────────────────────┘
```

要求：

- 打开后直接聚焦正文。
- 正文是唯一必填项。
- 标签、项目、来源均可稍后补充。
- 保存后立即关闭，不强迫进入详情页。
- 目标是 5 秒内完成一条手动记录。

### 5.3 记录来源

第一阶段支持：

- `manual`：手动输入。
- `web`：网页 / URL 收藏。

后续再评估：

- `voice`
- `image`

M1 不做实时语音转写、OCR 或图片理解。

---

## 6. Record Card：记录卡片

默认采用时间流，不旋转卡片：

```text
09 月 17 日 · 14:32

AI 日程规划不应该直接修改已有计划，
应该先把方案展示给用户。

#产品设计  #AI

来自 · 手动记录
```

卡片详情展示：

```text
原始记录
────────────
正文
标签 / 来源 / 创建时间

回顾记录
────────────
09 / 18  “可能所有自动化都应该有 Preview。”
09 / 21  “可撤销可能比自动化程度更重要。”

关联洞察
────────────
→ 可逆自动化
→ 用户控制权
```

规则：

- 原始内容允许用户主动编辑。
- 回顾新增内容永远写入 Reflection 历史，不覆写原文。
- 删除原记录时必须对 Reflection / Insight 关联采用明确的数据库删除或断开关系策略。

---

## 7. Review：每日回顾

### 7.1 Today 入口

不新增独立一级导航入口。Today 中插入回顾卡：

```text
昨天留下了 4 个想法

有些东西隔一天再看，
会变得更清楚。

[ 开始回顾 ]
```

没有待回顾记录时不显示，避免制造空模块。

### 7.2 回顾界面

采用单卡沉浸阅读：

```text
← 回顾                         2 / 5

          ┌──────────────┐
          │ 09月16日 21:18 │
          │              │
          │ 课程导入不应该 │
          │ 静默覆盖旧课程 │
          │              │
          │ #SparkFlow    │
          └──────────────┘

          写下此时的想法……

     稍后再看    已消化    转待办
```

支持：

- 左右滑动上一张 / 下一张。
- 写批注。
- 稍后再看。
- 已消化。
- 直接转待办。

### 7.3 M1 回顾调度

保持简单可解释：

| 用户动作 | 下次候选时间 |
|---|---:|
| 新记录 | 次日 |
| 写了 Reflection | 3 天后 |
| 稍后再看 | 次日 |
| 已消化 | 14 天后才可重新进入候选 |

每日默认取 3–5 张，按 `nextReviewAt` + 创建时间排序。

用户完成默认批次后，可主动“再回顾 5 张”。

不做复杂记忆曲线或 SM-2 算法。

---

## 8. Insight：AI 把卡片串成洞察

M2 才启用。

### 8.1 第一版只做三类 Insight

#### A. Theme / 主题聚合

发现多条记录在讨论同一个原则、问题或方向。

#### B. Evolution / 观点变化

对比同一主题在不同时间的记录，指出用户观点如何变化。

#### C. Action / 行动机会

当多条记录已经指向一个可执行改进时，生成行动候选。

### 8.2 可解释要求

每个 Insight 必须显示：

```text
来自 5 张卡片
```

点击可展开来源记录。

AI 输出本身不是事实源；用户可以：

- 接受并保留。
- 归档。
- 删除。
- 从来源重新判断。

### 8.3 洞察卡片示例

```text
洞察

可逆自动化

你最近在 5 条记录中都提到了类似原则：
AI 可以主动提出方案，但改变已有数据之前，
应该允许确认，并尽量提供撤销能力。

来自 5 张卡片

可能的下一步
□ 整理 SparkFlow 自动化设计原则
□ 检查课程导入是否支持 Undo
□ 检查 AI Planner 的撤销入口

[ 加入待办 ]
```

---

## 9. Action：洞察转行动

### 9.1 用户确认后创建任务

AI 的 ActionSuggestion 只能是候选，不直接写 Task。

点击“加入待办”后出现确认 Sheet：

```text
创建待办

标题
整理 SparkFlow 自动化设计原则

预计时长
45 分钟

截止日期
本周五

优先级
中

来源
洞察「可逆自动化」

[ 创建任务 ]
```

### 9.2 创建完成后的链路

```text
Task 创建
   ↓
可选：AI 帮我安排
   ↓
Planner Preview
   ↓
用户确认 Apply
   ↓
Timeline
   ↓
Focus
   ↓
Done
```

### 9.3 双向回链

Task 详情显示：

```text
来源
💡 洞察 · 可逆自动化
来自 5 条记录
```

Insight 详情显示：

```text
产生的行动
✓ 整理自动化设计原则
○ 检查课程导入 Undo
```

最终必须能回答：

> “我为什么会做这个任务？”

---

## 10. 数据模型

### 10.1 继续以 Inspiration 为统一记录事实源

不新建 `SparkCard` 主表。

现有前端 `Spark` 仅作为旧 UI 模型逐步退出主链路。

### 10.2 Inspiration 调整

建议新增 / 调整：

```prisma
model Inspiration {
  id             String   @id @default(uuid())
  userId         String

  sourceUrl      String?
  sourceType     String   @default("manual")
  title          String?
  description    String?
  contentText    String?  @db.Text
  coverImage     String?
  author         String?
  publishedAt    DateTime?

  aiSummary      String?  @db.Text
  aiInsights     Json     @default("[]") // 兼容旧字段，M2 后逐步不作为 Insight 主事实源
  tags           String[]
  status         String   @default("active")

  reviewState    String   @default("pending")
  nextReviewAt   DateTime?
  lastReviewedAt DateTime?
  reviewCount    Int      @default(0)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

关键调整：

- `sourceUrl` 改为 nullable。
- `sourceType` 默认 `manual`。
- 加入轻量回顾状态，不单独建立复杂 review workflow 表。
- 旧 `aiInsights` 暂保留兼容；M2 新 Insight 才成为正式多卡片洞察事实源。

### 10.3 Reflection

```prisma
model InspirationReflection {
  id            String   @id @default(uuid())
  userId        String
  inspirationId String
  body          String   @db.Text
  createdAt     DateTime @default(now())

  user        User        @relation(...)
  inspiration Inspiration @relation(...)

  @@index([userId, createdAt])
  @@index([inspirationId, createdAt])
}
```

原因：

- 同一记录会有多次回顾。
- 需要保留时间顺序。
- AI 后续可比较观点变化。
- JSON 数组不适合作为独立历史记录事实源。

### 10.4 Insight

```prisma
model Insight {
  id        String   @id @default(uuid())
  userId    String
  title     String
  body      String   @db.Text
  type      String   // theme / evolution / action
  status    String   @default("active")
  aiModel   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

来源关系用 N:N 连接表：

```prisma
model InsightInspiration {
  insightId     String
  inspirationId String

  @@id([insightId, inspirationId])
  @@index([inspirationId])
}
```

不用 `sourceIds JSON` 作为正式关系。

### 10.5 Task 来源

保留现有：

```text
Task.inspirationId
```

新增：

```text
Task.insightId
```

规则：

- 单条记录直接转任务：设置 `inspirationId`。
- 从 AI 洞察转任务：设置 `insightId`。
- 不要求两者同时存在。

---

## 11. API 设计

### 11.1 Inspiration

```text
GET    /inspirations
GET    /inspirations/:id
POST   /inspirations
PATCH  /inspirations/:id
DELETE /inspirations/:id
```

支持查询：

```text
?q=
&tag=
&status=
&sourceType=
```

### 11.2 Review

```text
GET  /inspirations/review?limit=5
POST /inspirations/:id/reflections
POST /inspirations/:id/review
```

`POST /review` 请求示例：

```json
{
  "action": "reviewed"
}
```

或：

```json
{
  "action": "snooze"
}
```

服务端统一计算 `nextReviewAt`，避免 Web / Android 出现不同规则。

### 11.3 Insight

M2：

```text
GET    /insights
GET    /insights/:id
POST   /insights/generate
PATCH  /insights/:id/status
DELETE /insights/:id
```

### 11.4 转 Task

继续复用现有 Task Create API，不增加“一键 AI 全自动链路”。

前端先展示确认表单，再向现有 Task API 写入 `inspirationId` 或 `insightId`。

---

## 12. AI 服务设计

### 12.1 第一版不引入向量库

输入范围控制在近期记录，例如：

```text
最近 7–30 天
+ active 状态
+ 可选标签 / 项目粗筛
```

由服务端构造上下文后调用 LLM。

### 12.2 Provider 抽象

不要把 Insight Service 和某一家模型 SDK 绑定。

建议：

```ts
interface AIProvider {
  generateInsights(input: InsightGenerationInput): Promise<InsightGenerationResult>;
  generateActions(input: InsightActionInput): Promise<ActionSuggestion[]>;
}
```

可以接 OpenAI-compatible Provider，具体供应商通过环境配置选择。

### 12.3 结构化输出

模型返回：

```json
{
  "insights": [
    {
      "title": "可逆自动化",
      "type": "theme",
      "body": "...",
      "sourceIds": ["..."],
      "actions": ["..."]
    }
  ]
}
```

服务端必须校验：

- `sourceIds` 全部属于当前用户。
- `sourceIds` 必须来自本次提供给模型的候选集合。
- `type` 只能是允许值。
- 空洞或无来源结果不落库。

这里使用普通输入校验、用户隔离和数据库约束即可，不额外增加 contract freeze / hash gate。

### 12.4 M2 只手动触发

按钮：

```text
发现近期洞察
```

等真实使用确认质量后，再考虑每日自动分析。

---

## 13. 搜索

M1 至少提供关键词搜索：

- `title`
- `contentText`
- `tags`

Reflection 搜索可在 M1.1 或 M2 加入。

第一阶段不做语义搜索。

---

## 14. 离线与失败恢复

随手记属于高频、短输入，不能因为网络瞬断丢内容。

M1 Web/PWA/Android 统一实现轻量 pending queue：

```text
用户点击保存
  ↓
请求 API
  ├─ 成功 → 正常完成
  └─ 网络失败 → 本地 pending item
                   ↓
                UI 标记“待同步”
                   ↓
                下次恢复前台 / 网络恢复时重试
```

约束：

- 只用于“创建手动记录”这一条链路。
- 不扩展成通用离线数据库。
- 每个 pending item 使用客户端生成 UUID 作为记录 id / create request 标识，服务端创建接口接受该 id 或独立幂等 requestId，防止恢复重试产生重复。
- 真实失败场景是“用户已输入并点击保存但移动网络瞬断”，因此这项保护有必要。

---

## 15. 旧 Sparks 迁移策略

当前 `initialSparks` 是 fallback / 示例数据，不作为用户资产自动导入。

M1 实施时：

1. `SparksView` 不再从 `initialSparks` 作为正式记录源。
2. 现有示例卡片迁到开发演示 / 空状态样例，生产账户不自动写入数据库。
3. 如果未来发现历史版本曾把真实 Spark 持久化到 localStorage，再单独提供一次显式“导入旧灵感”流程；没有证据前不做猜测式迁移。
4. 自由墙布局信息（pos / rot / size / color）如果需要保留，可作为纯前端视图偏好或后续独立布局字段，不污染 Inspiration 核心正文模型。

---

## 16. 前端模块建议

```text
web/src/components/records/
├── RecordsView.tsx
├── RecordCard.tsx
├── RecordDetail.tsx
├── CaptureSheet.tsx
└── FreeBoardView.tsx

web/src/components/review/
├── ReviewView.tsx
├── ReviewCard.tsx
└── ReflectionInput.tsx

web/src/components/insights/
├── InsightList.tsx
├── InsightCard.tsx
├── InsightDetail.tsx
└── InsightActionSheet.tsx
```

API：

```text
web/src/api/inspirations.ts
web/src/api/insights.ts
```

Store 不再把完整 Inspiration 列表长期作为纯前端事实源；以 API 数据为事实源，Zustand 仅管理当前 UI 状态、缓存和 pending create。

---

## 17. 视觉规范

参考方向：纸张、暖白、砖红、中文阅读感，但不整体复制参考 App。

### 17.1 记录区域

建议：

- 背景：暖白 / 米白 Token。
- 卡片：白纸感、轻边框、极轻阴影。
- 强调色：砖红，仅用于标签、回顾状态、主要按钮和 Insight 标记。
- 普通时间流卡片不随机旋转。
- 自由墙才使用轻微散落和卡片旋转。
- 回顾页减少导航干扰，突出单张卡片与 Reflection 输入。

### 17.2 SparkFlow 其它区域

Today / Timeline / 课程 / 四象限 / Planner 保持当前高信息密度与现有 Design Token 体系。

“纸张模式”是记录模块的内容视觉，不是全局换皮。

---

## 18. 移动端交互要求

M1 必须移动端优先验收：

- 360px 宽度。
- Android safe-area。
- 软键盘打开时 Capture Sheet 不被遮挡。
- Android 返回键先关闭 Sheet / Detail，再退出页面。
- 保存按钮始终可达。
- 触摸滑动回顾卡不与页面垂直滚动冲突。
- 离线保存状态清晰，不用 alert 阻塞。

---

## 19. 实施里程碑

### M1 — Capture + Review + Task（P1）

目标：即使没有 AI，这套流程也已经能每天使用。

范围：

- [x] `Inspiration.sourceUrl` nullable + review 字段 migration。
- [x] 新增 `InspirationReflection`。
- [x] Inspiration 完整 CRUD。
- [x] 前端 Records 时间流。
- [x] Quick Add “随手记”。
- [ ] 详情、标签、关键词搜索（主链路已可用，搜索仍是后续体验增强）。
- [x] Today 回顾入口。
- [x] Review 单卡流程。
- [x] Reflection。
- [x] snooze / reviewed 调度。
- [x] 单条记录 → Task。
- [ ] Capture 网络失败 pending queue（后续增强，不阻塞已上线 M1）。
- [x] 旧 `SparksView` 降为 FreeBoardView，不再作为数据事实源。

M1 验收：

```text
记录一句话
→ 服务端持久化
→ 次日 Today 出现回顾入口
→ 回顾后新增 Reflection
→ 选择“转待办”
→ Task 成功创建且保留来源
```

### M2 — Insight（P1）

范围：

- [x] `Insight` + `InsightInspiration`。
- [x] AIProvider 抽象。
- [x] 手动“发现近期洞察”。
- [x] Theme / Evolution / Action 三类 Insight。
- [x] 来源卡片展开。
- [x] 归档 / 删除洞察。
- [x] 基础 AI 输出质量测试与错误降级。

M2 验收：AI 生成的每个洞察都能追溯到真实来源，错误来源 id 不可落库。生产验收另外要求记录成功率/延迟，并验证 429/5xx/超时能够按 PR #43 的有界重试和可恢复错误策略处理。

### M3 — Insight → Action（P1）

范围：

- [x] `Task.insightId`。
- [x] Insight ActionSuggestion UI。
- [x] 用户确认 Sheet。
- [x] Insight → Task。
- [x] Task 来源回链。
- [x] Insight 显示已产生行动。
- [ ] 创建后直接打开 Planner（Task 已进入共享 Store，可进入 Planner；直接跳转体验待补）。

M3 验收：从多张记录形成 Insight，再由用户确认生成 Task，任务可进入 Planner / Timeline / Focus。当前实现代码已完成，生产收口以 `5835e322` Web/API 对齐 + `android-5835e3223748` 真机链路为准。

### PR #43 — Qwen / 请求稳定性补丁（✅ 已合并）

- Qwen/DashScope 关闭默认 thinking，并启用 JSON object 输出，降低受约束洞察生成的延迟与格式漂移。
- Provider 请求上限 60s；429/500/502/503/504 首次失败允许一次短重试。
- 普通 Web API 请求默认 15s 超时；Insight 生成单独使用 75s。
- 408 在前端显示明确超时信息；Provider 失败只记录安全错误摘要，不输出密钥或用户正文。
- Android Release `android-5835e3223748` 已生成；Web/API Production 仍需显式发布最新 master 后复验。

### M4 — 主动助手（P2）

在 M1–M3 有真实使用数据后再决定：

- 自动洞察生成。
- 智能回顾排序。
- Weekly Insight。
- “什么被反复记录但一直没有行动”。
- 长期主题趋势。
- 语义搜索 / embeddings 是否值得引入。

M4 不作为 Phase 15 第一轮上线条件。

---

## 20. 测试与验收

### 20.1 API / 数据

至少覆盖：

- 用户只能读取自己的 Inspiration / Reflection / Insight。
- `sourceUrl=null` 可以正常创建 manual 记录。
- Reflection 必须关联当前用户自己的 Inspiration。
- Review 更新正确计算 `nextReviewAt`。
- 同一 pending create 重试不产生重复记录。
- 删除 Inspiration 时关系处理符合设计。
- Insight sourceIds 不允许越权或引用候选范围外记录。
- Task 从 Inspiration / Insight 创建时来源关系正确。

### 20.2 Web / Android

至少覆盖：

- 360px Capture。
- 软键盘。
- safe-area。
- Android 返回键。
- 切后台恢复。
- 网络失败保存 → 待同步 → 恢复同步。
- Review 滑动。
- Today 入口数量正确。
- 创建 Task 后 Tasks / Today / Timeline 数据一致。

### 20.3 核心业务验收脚本

真实账户执行：

1. 星期一记录：“AI 排程应该允许撤销。”
2. 次日 Today 出现回顾。
3. 添加 Reflection：“课程导入也应该采用这种逻辑。”
4. M2 生成 Insight：“可逆自动化”。
5. 展开来源，确认原卡片可见。
6. 选择建议：“整理 SparkFlow 自动化设计原则”。
7. 用户确认创建 Task。
8. 打开 Planner 生成 Preview。
9. Apply 后进入 Timeline。
10. 使用 Focus 执行并完成。
11. Task 详情仍能回溯 Insight，Insight 仍能看到来源卡片。

这一整条链路通过，Phase 15 核心闭环才算成立。

---

## 21. 非目标

第一轮明确不做：

- 复杂知识图谱。
- Roam / Obsidian 式双向链接编辑器。
- Markdown Wiki。
- 向量数据库。
- 独立 RAG 知识库。
- AI 自动创建任务。
- AI 自动修改原记录。
- 复杂闪卡记忆算法。
- OCR。
- 实时语音转写。
- 图片知识识别。
- 新建第二套任务 / 日历 / Planner 运行时。

---

## 22. 预计代码影响

M1 主要涉及：

```text
api/prisma/schema.prisma
api/prisma/migrations/*
api/src/inspirations/*
api/src/tasks/*
web/src/api/inspirations.ts
web/src/store/dataSlice.ts
web/src/types/index.ts
web/src/navigation.ts
web/src/App.tsx
web/src/components/SparksView.tsx
web/src/components/today/TodayView.tsx
web/src/components/shell/QuickAddSheet.tsx
web/src/components/records/*
web/src/components/review/*
```

M2/M3 再增加：

```text
api/src/insights/*
api/src/ai/* (或等价 provider 层)
web/src/api/insights.ts
web/src/components/insights/*
```

---

## 23. 实施顺序

Phase 15 不抢占当前课程导入等 P0 数据安全问题。

启动建议：

```text
当前 P0 修复 / 真实导入闭环
        ↓
Phase 15 M1：Capture + Review + Task
        ↓
真实使用一段时间，确认回顾行为
        ↓
Phase 15 M2：Insight
        ↓
Phase 15 M3：Insight → Action
        ↓
根据真实使用决定 M4
```

M1 与 Timeline / Course 的代码耦合较低，因此当前 P0 闭环结束后可以独立短分支推进。

---

## 24. 发布原则

- 使用现有短期分支 → PR → CI → Preview / 真机验收 → 合并流程。
- 数据库 migration 保持 additive，已有字段不做破坏式删除。
- 不为了本功能增加新的通用 gate / baseline / contract freeze。
- 只有数据库迁移、生产发布、AI 真实写入关系等不可逆 / 跨系统边界保留必要验收。
- 文档中的“完成”只在代码合并并通过对应真实验收后更新。

---

## 25. 结论

Phase 15 的价值不是再增加一个“笔记功能”，而是把 SparkFlow 已存在的几个孤立能力组合成一条新的主体验：

```text
记录 → 回顾 → 洞察 → 行动 → 排程 → 专注 → 完成
```

其中最优先的是 M1：先让 **记录 → 回顾 → 转待办** 成为稳定、低摩擦、可长期使用的真实链路；AI 只有在这个基础上才能产生持续价值。
