# SparkFlow VNext — 时间账本、智能分类与统一 UI 系统

> **状态**：✅ 方案确认，待分阶段实施  
> **最后更新**：2026-09-22  
> **当前代码事实**：`master@56a555490a09a1290a1b09c2139dc796a09651fb`  
> **定位**：在不重复建设 Task / Course / Calendar / Focus / Inspiration / StudyFolder 事实源的前提下，把 SparkFlow 从“AI + Todo + Calendar + Focus”继续收口为“计划 → 执行 → 理解 → 调整”的个人执行系统，并同步统一整套 UI。

---

## 1. 背景

SparkFlow 当前已经具备比较完整的主链路：

```text
今天
  ↓
待办 / 课程 / 日历
  ↓
AI 规划与调整
  ↓
Schedule / Week / Agenda
  ↓
Focus
  ↓
完成 / 记录
```

记录链路也已经形成：

```text
随手记
  ↓
每日回顾
  ↓
Insight
  ↓
转为 Task
  ↓
Planner / Timeline / Focus
```

学习工作区已经转为独立 AI 学习目标：

```text
长期学习目标
  ↓
AI 访谈 / Research
  ↓
阶段 / 里程碑
  ↓
共享 Task
  ↓
Schedule / Focus
  ↓
执行反馈
  ↓
增量调整
```

近期 PR #114 / #115 又补齐了几个关键断点：

- AI 生成任务支持真实 `scheduledStart / scheduledEnd`；
- 连续长期计划可以创建或复用 StudyFolder，孤立事项不强制建文件夹；
- 周视图调整为 00:00–24:00、半小时辅助线与当前时间线；
- Focus 支持倒计时 / 正计时；
- Planner 对已确认事实减少重复追问，并只问一个最高影响问题；
- 课程支持明确的永久删除动作。

因此下一阶段不适合继续横向增加孤立功能，而应该解决三个更高层问题：

1. **SparkFlow 目前知道“计划了什么”，但对“实际上做了什么”理解还不够完整。**
2. **Folder / Project / Tag 的组织语义尚未彻底分开，标签数据已经存在但管理与 UI 没有补齐。**
3. **功能快速迭代后部分页面视觉语言不一致，需要建立统一 UI 系统，而不是继续一页一种风格。**

---

## 2. 产品目标

本阶段目标不是复制某一个时间记录或任务 App，而是把已有能力串成统一闭环：

```text
用户意图
  ↓
AI 理解与分类
  ↓
Folder / Project / Tag
  ↓
计划时间 Planned Time
  ↓
实际执行 Actual Time
  ↓
Timeline / 分析 / 进度
  ↓
AI 读取真实执行反馈
  ↓
调整下一阶段计划
```

最终 SparkFlow 应能回答：

- 我准备做什么？
- 我把它安排在什么时候？
- 我实际上做了什么？
- 时间真正花到哪里？
- 哪些长期目标推进了多少？
- 哪类计划经常无法按预期完成？
- 下一轮计划应该怎样调整？

---

## 3. 一级信息架构

一级导航继续固定为：

```text
今天 | 计划 | 记录 | 学习 | 我的
```

不再增加新的底部一级入口。

### 3.1 今天

只回答：

> “今天 / 现在最需要做什么？”

保持克制，不重新堆满统计面板。

### 3.2 计划

升级为统一执行工作区：

```text
计划
├── 日历
│   ├── 月
│   ├── 周
│   └── 日程
├── 待办
│   ├── 列表
│   └── 四象限
├── Timeline
│   └── 实际时间流水
└── 分析
    ├── 时间热力图
    ├── 分类时间
    ├── 计划 vs 实际
    └── 目标投入
```

### 3.3 记录

保持：

```text
卡片 / 自由墙
回顾
洞察
```

继续以服务端 Inspiration 为唯一记录事实源。

### 3.4 学习

保持独立学习目标，不重新绑定 Course：

```text
学习目标
  ↓
阶段 / 里程碑
  ↓
共享 Task
  ↓
Schedule / Focus
```

### 3.5 我的

承接：

- 账户；
- 外观；
- 通知；
- 日历 / 外部连接；
- 标签管理；
- 自动时间记录；
- 数据导出 / 备份；
- 安全与关于。

---

# 4. 数据语义：Folder / Project / Tag 必须分开

当前 Task 已有：

- `section`
- `project`
- `tags`
- StudyFolder 关系

后续不再把这些概念混用。

## 4.1 Folder / StudyFolder

表示：

> 长期、连续、有明确目标或上下文的一组任务。

例如：

- 六级听力训练
- 论文写作
- SparkFlow VNext

AI 只有在事项具有持续性、目标性和明显共同上下文时才考虑创建 Folder。

## 4.2 Project / Milestone

表示：

> Folder 内部的阶段 / 里程碑 / 工作包。

例如：

```text
Folder：六级听力训练

Project：
- 长对话
- 新闻听力
- 真题强化
```

当前继续复用 Task.project，不新增第二套 Milestone 事实源。

## 4.3 Tag

表示：

> 横向分类、搜索与统计维度。

例如：

```text
#学习
#英语
#六级
#听力
```

Tag 不等于 Folder。

一个任务可以属于：

```text
Folder = 六级听力训练
Project = 长对话强化
Tags = #英语 #六级 #听力
```

而一个孤立事项：

```text
明天去拿快递
```

只需要：

```text
Tags = #生活
```

不应自动创建“快递管理”文件夹。

---

# 5. AI 分类规则

Planner / AI 创建或更新任务时遵循以下顺序：

```text
1. 是否可复用已有 Tag？
   ↓ 是
   复用已有 Tag

2. 是否为孤立 / 短期事项？
   ↓ 是
   只打 Tag，不创建 Folder

3. 是否为连续、长期、有明确目标的事项？
   ↓ 是
   创建或复用 Folder

4. Folder 内是否存在明显阶段？
   ↓ 是
   使用 Project / Milestone
```

默认避免：

- 同义标签重复；
- 为每个临时事项创建文件夹；
- Folder / Tag 同名但语义不清；
- 因分类目的创建大量 StudyFolder。

---

# 6. UI 总体设计语言

本阶段统一设计方向命名为：

## Graphite Aurora

关键词：

- 大方；
- 克制；
- 高信息可读性；
- 深色石墨层级；
- 柔和浅绿 / 淡紫 / 柔黄作为强调；
- 3D 仅作为少数核心交互的记忆点；
- 不做全局霓虹、过度玻璃拟态或强透视。

## 6.1 使用 3D 的场景

允许：

- 任务卡片左右切换；
- 学习目标卡；
- 回顾卡片；
- AI 方案预览。

不用于：

- 设置；
- 普通表单；
- 日历；
- 数据分析；
- 高频列表。

## 6.2 统一组件

逐步收敛到以下共享组件：

```text
PageHeader
SectionCard
SegmentControl
InfoRow
TagChip
FolderChip
StatusChip
BottomActionBar
Sheet
DangerAction
EmptyState
MetricCard
ChartCard
```

所有新增页面优先复用，不继续复制一套局部按钮和表单。

---

# 7. Task Edit Deck — 任务编辑页重构

当前 3D 卡片保留，但整页其余 UI 重做。

## 7.1 页面结构

```text
←              编辑任务                ···
               Day 1 / 30

          [ 后层任务卡 ]
       [ 当前主编辑卡 ]
     [ 前层任务卡 ]

任务编辑
六级听力训练 · 长对话阶段

Day 1：六级22年12月第1套 长对话1
精听、听写、跟读综合练习 · 约 60 分钟

状态
[待处理] [进行中] [已完成]

优先级
[P0] [P1] [P2]

归属
六级听力训练
长对话强化
#六级 #听力 #英语

────────────────

截止时间        09/22 23:00
开始时间        09/22 19:30
提醒            提前 30 分钟
预计时长        60 分钟

────────────────

备注
附件
来源

────────────────

[ 删除 ]                  [ 保存更改 ]
```

## 7.2 3D 卡片规则

保留：

- 左右滑动切换；
- 当前主卡 + 前后卡；
- 轻微透视；
- 堆叠空间感。

调整：

- 主卡保持接近正面，不做过大旋转；
- 背景卡缩小约 6%–10%；
- 背景卡降低亮度、对比度和透明度；
- 阴影柔化；
- 卡片圆角统一到约 28–32px；
- 避免过厚玻璃感。

## 7.3 信息层级

卡片内容分为：

1. 标题 / 描述；
2. 状态 / 优先级；
3. Folder / Project / Tags；
4. 时间设置；
5. 备注 / 附件 / 来源。

日期、提醒、时长从“大输入框”改为统一 InfoRow。

## 7.4 底部操作

删除常驻为次级危险动作。

保存为主操作：

```text
[ 删除 ]                  [ 保存更改 ]
```

当前常驻的大段“编辑 / 左右滑动切换卡片”说明移除，仅第一次使用时做一次轻提示。

---

# 8. Phase A — UI Foundation + Tag System

## 8.1 目标

先补齐已有 tags 能力，并用 Task Edit Deck 作为新 UI 的第一个完整落地样板。

## 8.2 标签管理

入口：

```text
我的 → 标签管理
```

能力：

- 新建；
- 重命名；
- 设置颜色；
- 排序；
- 父 / 子标签；
- 归档；
- 搜索；
- 查看使用数量。

第一版不需要做复杂知识图谱。

## 8.3 Task 标签

TaskSheet / Task Edit Deck 增加：

- 添加标签；
- 搜索已有标签；
- 创建新标签；
- 最多显示若干常用 / 最近标签。

## 8.4 Inspiration 标签

记录创建 / 编辑继续使用同一套 TagChip。

## 8.5 AI 标签

AI 创建任务时优先使用已有标签，不随意制造近义词。

## 8.6 数据策略

Task 与 Inspiration 已有 `tags String[]`，第一阶段先复用现有字段。

只有当“父子标签 / 颜色 / 排序 / 归档”需要服务端跨端同步时，再增加最小的 TagDefinition 元数据模型；不要为了显示颜色提前重建 Task/Tag 多对多关系。

---

# 9. Phase B — Timeline 2.0：计划与实际分离

## 9.1 核心原则

SparkFlow 明确区分：

### Planned Time

来自：

- Task.scheduledStart / scheduledEnd；
- Course；
- CalendarEvent；
- Planner Preview / Apply 后的排程。

回答：

> “我准备什么时候做什么？”

### Actual Time

来自：

- Focus Session；
- 手工补记；
- 后续 Android App Usage。

回答：

> “我实际上把时间花到哪里？”

## 9.2 Agenda 与 Timeline 分工

### Agenda

只展示真实排进日程的安排。

未排期任务继续留在待办，不因为 dueDate 自动冒充日程。

### Timeline

展示实际发生的时间流水：

```text
10:02
六级听力 Focus
43 分钟
#学习 #英语 #听力

11:14
阅读
28 分钟
#学习 #阅读

14:05
SparkFlow 开发
1 小时 12 分
#工作 #SparkFlow
```

## 9.3 Focus 复用

Focus 已经拥有：

- startedAt；
- endedAt；
- effectiveDurationSeconds；
- pausedDurationSeconds；
- taskId；
- CalendarEvent 投影。

Timeline 2.0 第一版应优先直接读取 Focus 实际数据，不再复制一套“专注记录”。

---

# 10. Phase C — 时间分析中心

入口：

```text
计划 → 分析
```

不塞回 Today。

## 10.1 时间热力图

支持查看：

- 总执行时间；
- 学习；
- 工作；
- 单个 Tag；
- 单个 Folder / 学习目标。

## 10.2 分类时间

推荐树状层级：

```text
学习        12h 43m
├─ 六级      6h 18m
│  └─ 听力   4h 52m
├─ 法学      3h 11m
└─ 阅读      3h 14m

工作         8h 21m
娱乐         3h 05m
```

## 10.3 计划 vs 实际

例如：

```text
六级听力

计划  420 min
实际  337 min

周一  计划 60 / 实际 58
周三  计划 60 / 实际 19
```

不要简单把 dueDate 当 Planned Time。

只有真正的 scheduledStart / scheduledEnd 才参与“计划时长”。

## 10.4 时间模式

在有足够数据后生成描述性统计：

- 哪些时间段实际完成率更高；
- 哪些计划常被延后；
- 哪个 Folder 计划与实际偏差最大；
- 哪些 Tag 占用时间明显上升。

这些结果可以进入 Planner 的执行反馈上下文，但 AI 仍不得直接修改真实日程。

---

# 11. Phase D — Goal Progress：长期目标量化进度

当前 StudyFolder 主要以 Task 完成数量计算进度。

下一步支持三种主进度模式。

## 11.1 Task Progress

例如：

```text
18 / 30 个任务
```

## 11.2 Numeric Progress

例如：

```text
阅读 21 / 48 本
刷题 640 / 1000 题
论文 8200 / 15000 字
```

## 11.3 Time Progress

例如：

```text
本周六级听力
210 / 300 分钟
```

## 11.4 开启条件

普通 Task 默认不强制设置进度。

只有长期、有明确终点或衡量方式的目标才启用。

AI 创建长期计划时可以问：

> 你希望主要按任务完成率、数量还是投入时间衡量？

信息足够时也可以给出建议，但由用户确认。

---

# 12. Phase E — AI Behavior Feedback

当 Actual Timeline 和 Analytics 成熟后，Planner 开始读取真实执行反馈。

例如：

```text
过去 7 天：
- 19:00–21:00 的学习安排完成率最高
- 22:30 后安排的学习任务完成率明显下降
- 六级听力计划时间 420 分钟，实际完成 337 分钟
```

Planner 可以据此建议：

> 下一周把听力训练从 22:00 提前到 19:30。

但仍保持：

```text
AI 理解 / 建议
  ↓
确定性 Scheduler
  ↓
Preview
  ↓
用户确认
  ↓
Apply
```

不得直接绕过现有 Preview → Apply → Undo。

---

# 13. Phase F — Android 自动时间记录

这是最后一个阶段，不在标签和 Timeline 尚未成熟时提前实施。

入口：

```text
我的
→ 时间记录
→ 自动记录应用
```

## 13.1 使用场景

```text
微信读书
自动记录：开启
归类：#学习 / #阅读

抖音
自动记录：开启
归类：#娱乐

DeepTutor
自动记录：开启
归类：#学习
```

## 13.2 Android 数据来源

第一版使用 Android Usage Access / UsageEvents。

不使用无障碍服务读取屏幕内容。

采集最小字段：

- packageName；
- appName；
- start；
- end；
- duration；
- category / tag mapping。

不采集：

- 页面文本；
- 输入内容；
- 聊天内容；
- 通知正文；
- 屏幕截图。

## 13.3 新事实源的必要性

App Usage 不应写进 CalendarEvent：

- CalendarEvent = 计划 / 日历事实；
- AppUsageSession = 系统观察到的实际使用行为。

也不适合写进 Inspiration，因为 Inspiration 没有连续时间区间语义。

因此只有在 Phase F 真正实施时，才新增最小 AppUsageSession 模型。

---

# 14. Today 保持克制

Today 继续只回答：

> “现在最值得做什么？”

不要重新加入：

- 热力图；
- 饼图；
- 大量统计；
- 标签管理；
- 模板中心；
- 时间报告全集。

最多增加一条轻量 Execution Summary，而且有真实数据时才显示：

```text
今日投入
2h 16m

完成
3 / 5

[ 查看今日回顾 ]
```

详细分析进入“计划 → 分析”。

---

# 15. 前端实施建议

## 15.1 新共享 UI

建议新增或提取：

```text
web/src/components/ui/
├── PageHeader.tsx
├── SectionCard.tsx
├── SegmentControl.tsx
├── InfoRow.tsx
├── TagChip.tsx
├── FolderChip.tsx
├── StatusChip.tsx
├── BottomActionBar.tsx
├── MetricCard.tsx
└── ChartCard.tsx
```

## 15.2 Task 编辑

建议将旧详情表单逐步拆成：

```text
web/src/components/tasks/
├── TaskEditDeck.tsx
├── TaskEditCard.tsx
├── TaskMetadataSection.tsx
├── TaskScheduleSection.tsx
├── TaskRelationsSection.tsx
└── TaskEditActions.tsx
```

3D Deck 只处理卡片切换与视觉，不承载业务写入。

## 15.3 Tags

建议：

```text
web/src/components/tags/
├── TagManager.tsx
├── TagPicker.tsx
├── TagEditorSheet.tsx
└── TagTree.tsx
```

## 15.4 Timeline / Analytics

建议：

```text
web/src/components/plan/
├── ActualTimelineView.tsx
├── PlanAnalyticsView.tsx
├── PlanVsActualCard.tsx
├── TimeHeatmap.tsx
└── TimeDistributionTree.tsx
```

继续复用现有 Plan projection，不创建第二套 Schedule。

---

# 16. 服务端实施建议

## Phase A

第一轮优先不动现有 Task.tags / Inspiration.tags。

若需要跨端同步 Tag 元数据，可以新增最小：

```text
TagDefinition
- id
- userId
- name
- parentId?
- color
- sortOrder
- archivedAt?
```

Task / Inspiration 仍可暂时保留字符串 tags，不急于引入复杂 join table。

## Phase B / C

优先从现有：

- Task；
- CalendarEvent；
- PomodoroSession；
- StudyFolder；
- StudyFolderTask；

进行聚合。

如果查询性能或统计接口出现真实需求，再增加专用 aggregation API。

## Phase D

进度元数据优先挂到 StudyFolder 或用户确认的长期目标容器，不给所有 Task 强制扩字段。

## Phase F

只有 Android 自动记录正式启动时，新增 AppUsageSession。

---

# 17. 实施顺序

## 第一批：P0 — UI Foundation + Tags

1. Task Edit Deck；
2. 公共 UI 组件；
3. 标签管理；
4. Task / Inspiration 标签编辑；
5. AI 优先复用已有 Tag；
6. Folder / Project / Tag 文案与语义统一。

### 完成标准

- Task 编辑页与整套 SparkFlow 新 UI 语言一致；
- 3D Deck 可保留但不影响表单可读性；
- 标签可以跨任务 / 记录使用；
- AI 不再为普通短期事项创建不必要的 Folder。

---

## 第二批：P0/P1 — Timeline 2.0

1. Planned / Actual 语义拆分；
2. Plan 新增 Timeline；
3. Focus Session 进入 Actual Timeline；
4. 支持手工补记；
5. Agenda 继续只展示真正已排期事项。

### 完成标准

- 一个任务可以同时看到“原计划时间”和“实际专注时间”；
- 未排期 Todo 不出现在 Calendar/Agenda；
- Actual Timeline 不伪装成 CalendarEvent。

---

## 第三批：P1 — Time Analytics

1. 热力图；
2. 标签时间分布；
3. Folder / Goal 投入；
4. Planned vs Actual；
5. 日 / 周 / 月筛选。

### 完成标准

用户能回答：

> 最近一周我的时间实际花在哪里？

而不是只看到“完成了几个任务”。

---

## 第四批：P1 — Goal Progress

1. Task / Numeric / Time 三种主指标；
2. StudyFolder 目标摘要；
3. 手工更新数量；
4. Task 完成联动；
5. Focus 时间联动。

---

## 第五批：P1 — AI Behavior Feedback

让 Planner 使用：

- 实际投入；
- 时间偏差；
- 历史完成情况；
- 常见高效时段；

做下一轮计划建议。

---

## 第六批：P2 — Android App Usage

在标签 / Timeline / Analytics 都稳定后再实现。

---

# 18. 验收重点

## UI

- 360px 窄屏无页面级横向溢出；
- BottomActionBar 不被导航遮挡；
- 深 / 浅主题都可读；
- 3D Deck 不造成正文模糊或输入困难；
- 所有主要按钮保留文字，不只靠图标。

## Tags

- 同一标签在 Task / Inspiration / Analytics 中含义一致；
- AI 优先复用已有标签；
- 删除 / 归档标签不破坏历史 Task 内容。

## Timeline

- Focus 时间与服务端真实 startedAt / endedAt 一致；
- Planned / Actual 不混算；
- 未排期任务不进入 Calendar。

## Analytics

- 统计来自真实时间区间，不把 dueDate 当执行时长；
- 删除 Focus 记录后统计同步变化；
- 多来源统计可追溯。

## Progress

- 单位明确；
- 目标值可修改；
- AI 不自动篡改用户已确认的目标指标。

## Android Usage

- 必须显式开启 Usage Access；
- 默认关闭；
- 不读取内容；
- 用户可关闭单个 App 的记录。

---

# 19. 不在本阶段做的事情

- 不建立向量数据库或知识图谱来管理标签；
- 不给每个普通 Task 增加复杂进度模型；
- 不用 AccessibilityService 读取第三方 App 页面内容；
- 不把 App Usage 写入 CalendarEvent；
- 不新增独立 Habit 事实源，现阶段继续复用 repeatRule；
- 不为了新 UI 删除已有安全措施；
- 不为了视觉重构重写 Planner / Course / Focus 的事实源。

---

# 20. 文档治理与历史方案处理

本方案成为下一阶段产品与 UI 主方案。

以下文档已经明显被后续实现或当前方案替代，应迁入 `docs/archive/`，不再继续承担执行优先级：

- `phase09-course-module.md`
- `phase10-pending-features.md`
- `p0-phase12-execution.md`
- `course-schedule-enhancements.md`
- `gantt-quadrant-view-design.md`
- `vnext-information-architecture-plan-workspace.md`

仍保留在 `docs/plans/` 的文档：

- `NEXT.md`：唯一近期执行队列；
- `phase12-course-import-experience.md`：仍有真实 Web / Android / HTTP 验收；
- `phase13-local-codex-bridge.md`：尚未实施；
- `phase14-rhythm-experience.md`：仅保留仍未被本方案替代的剩余范围；
- `phase15-capture-review-insight-action.md`：仍有 PWA / Android / 多模态验收；
- `vnext-ai-orchestration-study-course-capture.md`：保留已实现架构和剩余真实设备验收事实。

归档文档只用于历史追溯，不再从其中恢复旧优先级。

---

# 21. 最终产品定义

这一阶段完成后，SparkFlow 不再只是：

> AI + Todo + Calendar + Focus

而应逐渐成为：

> **一个知道你想做什么、计划什么时候做、实际上做了什么、时间花在哪里、长期目标推进多少，并能根据这些事实帮助你调整下一阶段计划的个人执行系统。**

3D Task Card 保留为 SparkFlow 的特色交互之一，但整套产品的主气质应是：

> **清晰、稳、克制、有秩序，有少量有记忆点的空间感。**
