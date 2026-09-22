# SparkFlow V11 — 真实业务代码落地实施方案

> **状态**：实施中；R1/R2/R3-A 已合并，R3-B1 工作区结构与真实入口已完成本地验证
> **方案基线**：master@37ac6690bcd2581f92172c46c83adc0c0ececdcd
> **最后核对**：2026-09-22  
> **视觉来源**：用户确认的 sparkflow_ui_integrated_v11(1).html  
> **光学玻璃参考**：VII-Cae/hyalite--liquid-glass，v0.5.0，MIT  
> **关系**：本方案不推翻现有 Execution Intelligence、Planning、Course、Capture/Review/Insight 方案，而是给出“如何按 V11 视觉把真实代码收敛为可发布产品”的具体实施路径。

---

## 0. 本方案的裁决规则

后续实现发生冲突时，按以下优先级处理：

1. **视觉、页面划分、信息密度、交互层级以 V11 为准。**
2. **功能是否存在、数据是否真实、业务规则与安全边界以当前 master 代码为准。**
3. 旧文档只用于解释背景；文档写过但 master 没有真实实现的能力，不视为已完成。
4. V11 已画出但 master 没有实现的能力，不删除设计，按本方案补齐功能。
5. master 已经实现但 V11 未画出的能力，不删除功能，而是放进与 V11 相符的二级页、详情抽屉或高级设置。
6. 不为了还原视觉复制第二套事实源。Task、Course、CalendarEvent、PomodoroSession、Inspiration、StudyFolder、PlanningThread 仍是核心事实源。
7. 所有 AI 写入继续坚持 Preview → Apply → Undo 或明确确认，不允许用纯 UI 动效掩盖真实写入。
8. 不新增第六个底部导航入口。一级导航固定为：日程、待办、记录、学习、我的。

---

## 1. 当前 master 的真实业务底座

当前代码已经具备下列关键能力，实施 V11 时必须复用而不是重写：

| 领域 | 当前真实实现 | 主要代码 |
|---|---|---|
| 一级导航 | 五工作空间 | web/src/navigation.ts |
| App 外壳 | AppShell + BottomNav + FAB + QuickAdd | web/src/components/shell |
| 计划时间 | Task + Course + CalendarEvent → PlanItem | web/src/components/plan |
| 月/周/日程 | MonthPlanView / WeekPlanView / AgendaPlanView | web/src/components/plan |
| Actual Timeline | PomodoroSession + 手工补记 | ActualTimelineView + /pomodoro/timeline |
| Focus | 倒计时、正计时、暂停、恢复、完成、提前结束 | FocusSession + PomodoroService |
| Task | 状态、优先级、Folder/Project/Tag、排程、提醒、重复 | TaskSheet / Task API |
| AI Planner | PlanningThread、Research、语音、Action、Replan、课程变动 | PlannerSheet + Planning API |
| 记录 | Inspiration、多模态附件、草稿、自由墙 | SparksView + inspirations |
| 回顾 | Daily Review Batch + Reflection | inspirations/review |
| 洞察 | 周期 Insight + Insight → Task | InsightPanel + insights |
| 学习目标 | StudyFolder + Task.project 里程碑 + Scoped Planner | StudyWorkspace |
| 课程 | Semester、Course、课表、导入、调课、停课、周期修改 | CourseView / CourseImportWizard |
| 标签 | 一级/二级、颜色、归档 | TagManagementView + tags |
| 设置 | 外观、通知、Google/系统日历、数据备份、安全 | SettingsView |

当前最主要的问题不是“功能不存在”，而是：

- V11 视觉尚未进入真实 React 组件；
- Today 仍是 PlanWorkspace 的 Agenda 变体，不是 V11 的聚合首页；
- Actual Timeline 已有事实源，但对照还不是 V11 的逐条偏差体验；
- Time Analytics 尚未实现；
- Course 真实能力在新的五工作空间下存在入口不够直接的问题；
- Task 创建与编辑仍是两套 UI；
- Scene/场景是 V11 新增完整业务域；
- V11 的时间记录设置与外观密度/减少动态尚未落地；
- 液态玻璃只存在于原型，没有生产级 React 封装。

---

## 2. 最终信息架构

### 2.1 一级导航固定

    日程
    待办
    记录
    学习
    我的

BottomNav 只负责切换 Workspace，不承载所有二级功能。

### 2.2 日程 Workspace

    日程
    ├─ 今天
    │  ├─ 今日投入 / 完成 / 待进行
    │  ├─ 今日时间轨道
    │  └─ 今日日程
    ├─ 计划
    │  ├─ 周
    │  ├─ 月
    │  └─ 日程
    ├─ Actual Timeline
    └─ 时间分析

说明：

- V11 的 Today 是“日程”默认首页。
- Week/Month/Agenda 仍复用现有 PlanItem 投影。
- Actual Timeline 以实际执行为主。
- 时间分析只统计可解释的真实执行数据。
- 不在 Today 首页堆周/月分析卡。

### 2.3 待办 Workspace

    待办
    ├─ 列表
    ├─ 四象限
    ├─ Task Editor
    └─ AI Planner

说明：

- “日历 / 待办”不再做大块双按钮。
- V11 的紧凑切换器放在页面右上或二级工具栏。
- Task Editor 是创建/编辑统一组件。
- Planner 是全局能力，但从待办与 Today 都可唤起。

### 2.4 记录 Workspace

    记录
    ├─ 全部
    │  ├─ 卡片
    │  └─ 自由墙
    ├─ 场景
    │  ├─ Scene Center
    │  ├─ Scene Detail
    │  ├─ Heatmap / Trend / List / Photo
    │  └─ Scene Builder
    ├─ 每日回顾
    └─ 周期洞察

### 2.5 学习 Workspace

    学习
    ├─ 目标
    │  ├─ Goal List
    │  └─ Roadmap / Milestones / AI Planning
    └─ 课程
       ├─ Semester
       ├─ Course List
       ├─ Course Detail
       ├─ Timetable
       └─ Import / Integrations

这是对当前“课程已经归入学习，但 StudyWorkspace 没有直接入口”的修复。

### 2.6 我的 Workspace

    我的
    ├─ 外观
    ├─ 标签
    ├─ 时间记录
    ├─ 计划与任务
    ├─ 通知与提醒
    ├─ 连接与同步
    ├─ 数据与备份
    └─ 账户与安全

V11 首页保持简洁；真实设置放二级页，不把所有开关塞在首页。

---

## 3. V11 视觉系统：Graphite Aurora

### 3.1 固定色板

V11 的视觉基线直接进入生产 Design Tokens：

| Token | 值 | 用途 |
|---|---:|---|
| sf-bg | #F2F3F2 | 页面背景 |
| sf-surface | #FFFFFF | 实体卡片 |
| sf-text-primary | #202322 | 主文字 |
| sf-text-secondary | #7D827F | 次级信息 |
| sf-text-tertiary | #A4A8A5 | 弱信息 |
| sf-border | #E5E8E5 | 边框/分割 |
| sf-graphite | #222625 | 主深色 |
| sf-graphite-soft | #2B302E | 深色渐变 |
| sf-green | #D9F2A6 | 主强调 |
| sf-green-strong | #C9E992 | 强调 |
| sf-purple | #B9B0E7 | Planner/Focus |
| sf-purple-soft | #E8E4F6 | Planner 背景 |
| sf-blue | #B8D4EE | Course/固定事件 |
| sf-pink | #E8B8CB | Scene/生活 |
| sf-amber | #EED695 | Warning/辅助 |

深色模式不能简单反相；必须定义对应 dark token，并保持绿、紫、蓝的低饱和语义。

### 3.2 圆角和层级

- 一级实体卡：22–28px。
- Task Summary / Goal Hero：28px。
- Sheet 顶角：28–32px。
- Floating Nav：28px。
- Floating Action / Composer：18–22px。
- Pill：999px。
- 小型 icon control：12–18px。

阴影原则：

- 内容卡片只用低透明大范围阴影；
- 玻璃组件使用 rim + 轻阴影；
- 不给每个列表项增加重阴影；
- 不恢复旧版过重 3D 黑卡。

### 3.3 字体层级

建议生产值：

- Workspace title：26–28px / 900；
- Subpage title：20–22px / 850–900；
- Card title：13–16px / 800–900；
- Body：12–14px；
- Meta：10–11px；
- Eyebrow：9–10px，letter-spacing 0.12–0.18em。

中文继续使用 Inter + PingFang SC / system fallback。

### 3.4 玻璃和实体表面的边界

**允许液态玻璃：**

- BottomNav；
- CompactToggle / View Switch；
- Planner launch；
- Planner Preview；
- Floating Composer；
- Bottom Action Bar；
- Sheet 的浮动工具区；
- Focus 圆形控制；
- 少量悬浮 icon button。

**禁止液态玻璃：**

- 普通 Records 卡片；
- Task 列表；
- Timeline 每一行；
- Heatmap cell；
- Course 列表；
- Setting rows；
- 大量重复的 Scene cards；
- 长列表中每个元素。

这样既还原 V11，也控制 GPU surface 数量和视觉噪音。

---

## 4. Hyalite 0.5.0 的生产接入方案

### 4.1 不使用运行时 CDN

原型使用远程 script 可以接受，但生产代码不应依赖外部 CDN。

建议固定上游 0.5.0 文件：

    web/public/vendor/hyalite/hyalite.js
    web/public/vendor/hyalite/LICENSE
    web/public/vendor/hyalite/UPSTREAM.md
    web/src/types/hyalite.d.ts

UPSTREAM.md 记录：

- repository: VII-Cae/hyalite--liquid-glass
- version: 0.5.0
- upstream file sha
- MIT license
- 升级检查清单

web/index.html 在 React bundle 前加载本地 /vendor/hyalite/hyalite.js。

### 4.2 React 封装

新增：

    web/src/lib/hyalite.ts
    web/src/components/ui/GlassSurface.tsx
    web/src/components/ui/GlassProvider.tsx

GlassSurface 只暴露 SparkFlow 自己的语义，不把 Hyalite 参数散到业务组件：

    type GlassVariant =
      | "nav"
      | "surface"
      | "preview"
      | "composer"
      | "control";

组件职责：

- 输出统一 sf-glass-* class；
- CSS fallback 永远有效；
- Hyalite 只做 progressive enhancement；
- React 业务组件完全不知道 SVG filter id；
- unsupported 时视觉仍完整；
- reduceMotion 时禁用 materialize 动画；
- provider unmount 时 stop watcher。

### 4.3 推荐 Watcher 配置

以 V11 已调好的参数为初始设计基线：

    nav/surface:
      bevel 16
      thickness 26
      slope 0.78
      shape squircle
      blur 1.6
      dispersion 0.55
      shade 0.20
      rim 0.92
      edgeW 5
      sat 0.96
      edge 0.22
      smooth 1

    preview:
      bevel 22
      thickness 28
      slope 0.72
      shape squircle
      blur 1.2
      dispersion 0.42
      shade 0.17
      rim 0.82
      edgeW 6
      sat 0.98
      edge 0.18
      smooth 1

    circular control:
      bevel 14
      thickness 18
      slope 0.68
      shape circle
      blur 1.0
      dispersion 0.30
      shade 0.16
      rim 0.75
      edgeW 4
      sat 0.98
      edge 0.16
      smooth 1

生产调优时先降低 dispersion，不优先牺牲可读性。

### 4.4 CSS fallback

所有玻璃组件必须先具备普通 CSS：

    background: rgba(252,253,252,.78)
    border: 1px solid rgba(31,37,34,.08)
    backdrop-filter: var(--hyalite, blur(18px) saturate(1.08))
    -webkit-backdrop-filter: var(--hyalite, blur(18px) saturate(1.08))
    box-shadow: var(--hyalite-edge, 0 14px 36px rgba(...))

Safari / Firefox / 不支持 SVG backdrop filter 的 WebView 只走 fallback。

### 4.5 性能保护

- 同屏真实玻璃面目标控制在 8 个以内。
- 列表元素严禁逐项 attach。
- Heatmap、Week Grid、Timeline rows 不 attach。
- dynamic bubble 不自动玻璃化。
- Android WebView 在低性能设备可将 dispersion 降到 0。
- 页面离开时停止对应 watcher。
- Resize 不手写轮询，使用 Hyalite 自身 resize lifecycle。
- 真实 Android WebView 必须测滚动、键盘、旋转、safe-area。

### 4.6 CSP

Hyalite displacement map 使用 data URL。若后续启用严格 CSP，img-src 必须允许 data:。该要求写入 deploy 文档，不在没有 CSP 时虚构新策略。

---

## 5. Shell 与路由重构

### 5.1 AppShell

当前 AppShell 固定渲染 AppHeader。V11 不需要全局 SparkFlow 顶栏。

修改：

    web/src/components/shell/AppShell.tsx

- 移除 AppHeader 常驻；
- AppShell 只保留：
  - viewport 容器；
  - main scroll area；
  - FloatingActionButton；
  - BottomNav；
  - GlassProvider；
- push 状态入口迁入 Profile / Notifications；
- edgeToEdge 改为每 workspace 自己决定 horizontal gutter。

AppHeader 在所有引用迁移后删除或留一个临时兼容 wrapper。

### 5.2 BottomNav

修改：

    web/src/components/shell/BottomNav.tsx

实现 V11：

- left/right 12px；
- bottom safe-area + 10px；
- 高约 72px；
- border-radius 28px；
- 五栏固定；
- 激活图标使用浅绿胶囊；
- icon 使用统一 Lucide 线性图标；
- 整个 nav 是一个 GlassSurface，不给每个 tab 单独做玻璃；
- 文案：日程 / 待办 / 记录 / 学习 / 我的。

### 5.3 内部 Surface 不继续污染 ActiveTab

当前 ActiveTab 同时承担 workspace 和 legacy route。逐步收敛：

    WorkspaceTab = today | plan | records | study | profile

二级状态由 workspace 内部管理：

    PlanSurface = calendar | actual | analytics
    RecordSurface = all | scenes | review | insights
    StudySurface = goals | courses

LegacyActiveTab 继续在 navigation.ts 边界做兼容映射，但新代码不再新增 legacy tab。

迁移完成后：

- legacy timeline → plan + actual；
- legacy courses → study + courses；
- legacy settings → profile；
- legacy sparks → records + all。

---

## 6. Screen 01 — Today

### 6.1 新组件

新增：

    web/src/components/today/TodayWorkspace.tsx
    web/src/components/today/TodayMetrics.tsx
    web/src/components/today/TodayTimeRail.tsx
    web/src/components/today/TodayAgenda.tsx
    web/src/components/today/useTodayWorkspaceData.ts

App.tsx 的 today 不再把 PlanWorkspace 强制设为 agenda。

### 6.2 数据来源

不新增数据库：

- planned：usePlanItems(selectedDate, agenda)；
- actual：GET /pomodoro/timeline；
- active Focus：现有 store pomodoro；
- tasks：store tasks；
- AI Preview：plannerPreview。

### 6.3 指标定义

**今日投入**

仅求和 Actual Timeline 中 countsTowardActual 的 effectiveDurationSeconds。

固定 Course、普通 CalendarEvent 本身不是“用户实际投入”，不得直接计入。

**已完成**

todayRelevantTasks 定义为：

- scheduledStart 在当天；或
- dueDate 在当天；或
- completedAt 在当天。

显示 done / total。为此把 Task.completedAt 加入 web/src/types/index.ts。

**待进行**

当天未完成、end 在当前时间之后的 planned task / course / calendar item 数量；AI preview 单独作为预览，不计正式待进行。

### 6.4 时间轨道

同一条 rail 叠加：

- planned bar；
- actual bar；
- active Focus；
- AI preview ghost；
- now line。

颜色语义固定：

- Course / fixed：蓝；
- AI / Focus：紫；
- productive actual：绿；
- preview：淡紫虚线；
- now：低饱和红。

### 6.5 点击行为

- Task → TaskEditorSheet edit；
- Course → Study/Course detail；
- CalendarEvent → ScheduleEditor；
- actual manual → ActualEditorSheet；
- actual focus → Focus record detail；
- preview → PlannerSheet。

---

## 7. Screen 02 — Plan / Week

### 7.1 保留真实投影

继续使用：

    PlanWorkspace
    usePlanItems
    planProjection
    MonthPlanView
    WeekPlanView
    AgendaPlanView

不重做第二套 Calendar。

### 7.2 UI 重构

PlanWorkspace 改为：

- 页面标题“计划”；
- 右上紧凑“日历 / 待办”切换；
- 下方工具栏“周 / 月 / 日程”；
- 工具栏右侧 AI 规划入口；
- Week grid 按 V11 变紧凑；
- AI Preview 继续作为虚线 ghost block；
- 去掉当前大号 SectionCard 式工具头。

PlanHeader 拆成：

    PlanTitleBar
    PlanViewToolbar

### 7.3 Week View

继续保留现有：

- 00:00–24:00；
- 并发 lane；
- 当前时间线；
- scheduleSource；
- locked 状态；
- Course/Task/Calendar 统一展示。

只改视觉，不退回旧课表式布局。

---

## 8. Screen 03 — Actual Timeline

### 8.1 现有事实源不变

Actual = PomodoroSession。

Focus CalendarEvent 仍只用于兼容，不参与实际统计，防止重复。

### 8.2 组件拆分

把 ActualTimelineView.tsx 拆为：

    ActualTimelineWorkspace.tsx
    ActualTimelineHeader.tsx
    ActualTimelineRow.tsx
    ActualCompareTrack.tsx
    ActualTimelineGap.tsx
    ActualEditorSheet.tsx

### 8.3 V11 对照信息

每个 actual row 显示：

- 开始时间；
- 标题；
- 来源 Focus / manual；
- 有效时长；
- 标签；
- planned track；
- actual track；
- 状态：
  - 与计划一致
  - 晚 N 分钟
  - 早 N 分钟
  - 多投入 N 分钟
  - 少 N 分钟
  - 未计划
  - 推测匹配

### 8.4 Gap

相邻实际记录之间的空白大于阈值时显示：

    10:45 → 11:14 · 29m 空白
    + 添加时间块

点击直接打开 ActualEditorSheet，并预填 gap 起止。

### 8.5 手工记录编辑

当前 API 只有 create/delete。新增：

    PATCH /pomodoro/:id/manual

Body：

    {
      expectedRevision,
      title?,
      taskId?,
      startedAt,
      endedAt,
      notes?,
      tags?
    }

规则：

- 只能改 entrySource=manual；
- Focus session 不允许伪装成手工记录修改；
- 结束必须晚于开始；
- 单条不超过 24 小时；
- 不允许明显未来结束；
- task 必须属于当前用户；
- revision 冲突返回 409；
- tag 继续自动 upsert。

web/src/api/actualTimeline.ts 增加 updateManualActualTime。

---

## 9. Screen 04 — Time Analytics

### 9.1 新后端模块

新增：

    api/src/analytics/analytics.module.ts
    api/src/analytics/analytics.controller.ts
    api/src/analytics/analytics.service.ts
    api/src/analytics/execution-matching.ts
    api/src/analytics/planned-projection.ts

AppModule 注册 AnalyticsModule。

### 9.2 API 1：时间聚合

    GET /analytics/time

Query：

    start=ISO
    end=ISO
    timeZone=IANA
    bucket=day|week|month
    dimension=tag|goal|scene|source

Response：

    {
      range: { start, end, timeZone },
      totalActualSeconds,
      previousTotalActualSeconds?,
      buckets: [
        { key, start, end, actualSeconds, sessionCount }
      ],
      breakdown: [
        {
          key,
          label,
          actualSeconds,
          sessionCount,
          color?
        }
      ]
    }

只聚合真实 actual source。

### 9.3 API 2：计划 vs 实际

    GET /analytics/plan-actual

Query：

    start
    end
    timeZone
    groupBy=day|tag|goal

Response：

    {
      plannedSeconds,
      actualSeconds,
      deltaSeconds,
      matchedActualSeconds,
      unplannedActualSeconds,
      groups: [...],
      matches: [
        {
          actualId,
          plannedId?,
          relation,
          confidence,
          startDeltaMinutes?,
          durationDeltaMinutes?
        }
      ]
    }

### 9.4 API 3：Heatmap

    GET /analytics/heatmap

Query：

    start
    end
    timeZone
    filterType=all|tag|goal|scene
    filterId?

Response：

    {
      days: [
        { date: "2026-09-22", actualSeconds, count, level }
      ],
      maxActualSeconds
    }

level 由前端也可算，但返回 maxActualSeconds 方便同一范围稳定归一化。

### 9.5 前端

新增：

    web/src/api/analytics.ts
    web/src/components/analytics/TimeAnalyticsView.tsx
    web/src/components/analytics/TimeDistributionBars.tsx
    web/src/components/analytics/ExecutionHeatmap.tsx
    web/src/components/analytics/PlanActualCompare.tsx

视觉直接还原 V11：

- 日 / 周 / 月；
- graphite 大数字；
- 标签分布 bars；
- 12 周 heatmap；
- plan vs actual；
- 无数据、部分数据、加载失败必须有真实状态。

不允许用 demo 数字填充空数据。

---

## 10. Planned ↔ Actual 匹配算法

### 10.1 匹配优先级

1. **Exact Task**
   - actual.taskId 与 planned.taskId 相同。
2. **Exact Source Relation**
   - 后续 Scene / Course 明确 relation id。
3. **Strong Temporal Match**
   - 标题规范化相同；
   - 时间有显著 overlap；
   - 类型相容。
4. **Weak Inferred Match**
   - 标题相近 + 时间邻近。
5. 无合适候选 → unplanned。

### 10.2 置信等级

    exact
    strong
    inferred
    none

UI 规则：

- exact / strong 可直接展示“与原计划”；
- inferred 必须标“推测匹配”；
- AI 读取 inferred 时只能作为推断，不得写入 confirmed context；
- none 显示未计划。

### 10.3 偏差计算

    startDeltaMinutes = actual.start - planned.start
    durationDeltaMinutes = actual.effective - planned.duration

relation：

    on_time
    early
    late
    longer
    shorter
    unplanned

“与计划一致”默认容差：

- 开始偏差绝对值 <= 5 分钟；
- 时长偏差绝对值 <= 10%。

阈值必须集中常量，不散落组件。

---

## 11. Screen 05 — Task Edit Deck

### 11.1 统一创建和编辑

当前：

- create → TaskSheet；
- edit → DarkFrostedModal。

改成：

    web/src/components/tasks/TaskEditorSheet.tsx
    web/src/components/tasks/TaskSummaryCard.tsx
    web/src/components/tasks/TaskQuickUpdate.tsx
    web/src/components/tasks/TaskDetailsForm.tsx
    web/src/components/tasks/taskEditorModel.ts

Props：

    mode = create | edit
    task?
    onSave
    onDelete?
    onPlanWithAI?

TaskSheet 迁移为 wrapper 后删除。

DarkFrostedModal 不再负责 Task，只在旧 Spark/其他上下文完全迁移前保留。

### 11.2 V11 顶部

还原：

- graphite summary；
- 绿色 radial glow；
- 标题、描述；
- Folder / Project / Tag；
- 状态；
- 3 个关键时间信息。

### 11.3 必须保留的真实字段

V11 没全部画出来，但不能丢：

- title；
- description；
- status；
- priority；
- section；
- project / milestone；
- studyFolder；
- tags；
- estimatedMinutes / duration；
- scheduledStart；
- scheduledEnd；
- dueDate；
- reminderAt；
- repeatRule / repeatStartDate / repeatEndDate；
- scheduleLocked；
- scheduleSource；
- courseId；
- inspiration / insight source；
- notes。

不常用字段放“更多”，而不是删除。

### 11.4 Task API 补齐 typed create contract

当前 POST /tasks 的 controller body 没显式列出 reminder/repeat 字段。

扩展：

    reminderAt?
    repeatRule?
    repeatStartDate?
    repeatEndDate?

并给 create/update 共用 DTO validator，避免前端能填但 create silently 丢字段。

---

## 12. Screen 06 — AI Planner Preview

### 12.1 不削弱 Planner 真实能力

现有 PlanningThread、Evidence、Voice、Course Change、Replan、Goal action 全保留。

### 12.2 默认视觉只展示三层

**Layer 1 — Conversation**

- 用户 bubble；
- AI bubble；
- Flash / Pro。

**Layer 2 — Preview Card**

V11 浅绿/浅紫玻璃方案卡：

- PREVIEW；
- 方案摘要；
- slot list；
- 关键约束 chips；
- 继续调整；
- 应用 N 项。

**Layer 3 — Why**

“为什么这样排”独立轻卡。

### 12.3 Advanced Drawer

以下真实能力移入可展开区域：

- Planning Context；
- confirmed / inferred / assumed；
- Research Evidence；
- conflict；
- Replan detail；
- Course occurrence preview；
- Course template change；
- undo history。

不删，只降低默认视觉权重。

### 12.4 Preview 与日历

plannerPreview 继续通过 buildPlannerPreviewItems 进入 Week/Agenda ghost blocks。

应用成功后：

- clear preview；
- loadTasks；
- calendar changed；
- Today 和 Plan 同步刷新。

---

## 13. Screen 07 — Focus

V11 是 Running 状态，生产必须覆盖完整状态机：

    Setup
      ↓
    Running ↔ Paused
      ↓
    Completed / Interrupted

### Setup

保留真实能力：

- 关联 Task；
- 不关联任务；
- 倒计时 / 正计时；
- 25 / 45 / 60；
- 自定义时长。

视觉改成同一 Graphite Aurora 语言，不再使用大白卡堆叠。

### Running

还原 V11：

- 页面背景柔灰；
- task center；
- ring；
- restart / pause / complete；
- effective / paused / progress；
- controls 用 GlassSurface control。

### Completed

显示：

- 有效时长；
- 暂停时长；
- 关联 Task；
- 记录一下；
- 完成关联任务；
- 返回。

“InspirationCaptureSheet with focusSessionId”继续复用，不另造 FocusNote 数据表。

---

## 14. Screen 08 — Records / Review

将 SparksView 拆为 RecordsWorkspace，但保留兼容 export：

    web/src/components/records/RecordsWorkspace.tsx
    web/src/components/records/RecordCardsView.tsx
    web/src/components/records/RecordToolbar.tsx
    web/src/components/records/ReviewWorkspace.tsx
    web/src/components/records/InsightsWorkspace.tsx

SparksView 暂时 re-export RecordsWorkspace，直到 App.tsx 引用迁移。

页面划分：

- Scene switch 位于页面标题下；
- “全部”下再切 卡片 / 自由墙；
- 每日回顾、周期洞察作为明确入口；
- record card 保持实体白卡；
- Capture、Attachment、Reflection、Insight → Task 全保留。

---

## 15. Screen 09 — Study + Course

### 15.1 Study 顶部切换

新增紧凑：

    目标 | 课程

默认“目标”。

### 15.2 目标

继续复用 StudyFolder。

V11 Goal Hero：

- name；
- description；
- task progress；
- cumulative actual time；
- week actual time；
- milestone list。

Actual time 来自 Analytics 按 StudyFolderTask 关联 PomodoroSession，不拿任务完成数伪装时长。

### 15.3 课程

把现有 CourseView 正式嵌入 StudyWorkspace：

    StudyWorkspace
      goals
      courses

CourseView 内部功能全部保留：

- Semester；
- manual course；
- ICS；
- School Import Wizard；
- Course Detail；
- Course Note → Task；
- occurrence change；
- recurring template change；
- integrations。

不再依赖“从日历点课程”作为唯一明显入口。

---

## 16. Screen 10 / 16 / 17 / 18 — Profile

### 16.1 Profile 首页

按 V11：

- avatar / account；
- 标签管理；
- 时间记录；
- 外观。

下方再放：

- 计划与任务；
- 通知与提醒；
- 连接与同步；
- 数据与备份；
- 账户与安全；
- 关于与诊断。

### 16.2 标签

直接重绘 TagManagementView：

- 一级/二级；
- color；
- count；
- edit；
- archive/restore。

Scene 与 Tag 继续严格分离：

- Tag = 横向检索/统计；
- Scene = 捕捉/记录模板与分析方式。

### 16.3 外观

扩展 web/src/utils/userPreferences.ts：

    appearance: system | light | dark
    quadrantEnabled
    defaultReminderMinutes
    reduceMotion: boolean
    density: comfortable | compact

reduceMotion：

- 关闭 page float / materialize；
- 降低 card transform；
- Hyalite 仍可静态折射，但 materialize=0；
- 遵守系统 prefers-reduced-motion。

density：

- comfortable：V11 默认；
- compact：缩小 row vertical spacing、Agenda/Records padding；
- 不改变字号到不可读程度。

---

## 17. 时间记录设置

### 17.1 为什么不能只做本地开关

“Focus 自动记录”改变服务器 Actual Timeline 统计语义，应跨设备一致，因此不能只存 localStorage。

利用现有 User.settings JSON，新建经过白名单校验的 namespace。

新增：

    api/src/users/time-tracking-preferences.ts

UsersController：

    GET /users/preferences/time-tracking
    PATCH /users/preferences/time-tracking

Response：

    {
      focusActualEnabled: true,
      quickStartEnabled: true,
      manualBackfillEnabled: true,
      defaultSceneId: null,
      focusAttachmentEnabled: true,
      externalSources: {
        androidUsage: "not_connected"
      }
    }

### 17.2 Focus 开关的真实语义

新增 PomodoroSession：

    countsTowardActual Boolean @default(true)

新 session 创建时读取 focusActualEnabled。

后续：

- /pomodoro/timeline 只返回 countsTowardActual=true；
- /pomodoro/stats 只统计 countsTowardActual=true；
- Analytics 同样过滤；
- 旧数据 migration 默认 true；
- 关闭设置只影响后续 session，不静默改写历史。

### 17.3 手工补记

manualBackfillEnabled=false 时：

- UI 隐藏/禁用补记入口；
- 服务端 POST /pomodoro/manual 同时拒绝，防止只靠前端。

### 17.4 快捷开始

quickStartEnabled 控制：

- Today 时间轨道空白；
- Scene 页面；
- FAB secondary action。

它是 UI 行为，但仍放服务器设置以跨设备保持一致。

### 17.5 图片附件

focusAttachmentEnabled 控制 completed Focus 页“记录一下”的媒体入口。

附件仍写 InspirationAttachment，不给 Pomodoro 新建附件表。

---

## 18. Scene：V11 新增业务域

当前 master 没有 Scene 模型。它必须作为正式业务实现，而不是 Tag 的别名。

### 18.1 核心原则

**Scene 是 schema/template；Tag 是 classification。**

Scene 定义：

- 怎么触发；
- 需要记录哪些字段；
- 允许怎么分析；
- 默认视觉。

SceneEntry 只做来源关联和 schema metadata，不复制已有事实正文。

### 18.2 Prisma

新增 SceneTemplate：

    id
    userId
    name
    emoji
    color
    description?
    category?
    status
    sortOrder
    fieldSchema Json
    triggers String[]
    allowedViews String[]
    createdAt
    updatedAt

新增 SceneEntry：

    id
    userId
    sceneId
    sourceType
    occurredAt
    pomodoroSessionId?
    taskId?
    inspirationId?
    metadata Json
    tags String[]
    clientRequestId?
    createdAt
    updatedAt

关系：

    User -> SceneTemplate[]
    User -> SceneEntry[]
    SceneTemplate -> SceneEntry[]
    PomodoroSession -> SceneEntry?
    Inspiration -> SceneEntry?
    Task -> SceneEntry[]

约束建议：

- userId + clientRequestId unique；
- pomodoroSessionId unique；
- inspirationId unique；
- sceneId + occurredAt index；
- userId + occurredAt index。

### 18.3 不复制时间事实

**Timed Scene Entry**

如果“时间流/阅读/影音”等记录有真实时长：

- Focus → 已有 PomodoroSession；
- 手工 timed entry → 先 POST /pomodoro/manual；
- SceneEntry 只关联 pomodoroSessionId。

这样 Analytics 永远只有一份 duration truth。

**Photo / Note Entry**

先创建/关联 Inspiration，再 SceneEntry.inspirationId。

照片模式直接读取 InspirationAttachment。

### 18.4 Field Schema

允许第一版：

    duration
    rating
    number
    text
    image
    location
    people

每个字段：

    {
      id,
      key,
      label,
      type,
      required,
      unit?,
      min?,
      max?,
      options?
    }

后端白名单校验，不执行用户提供的任意 schema code。

### 18.5 Trigger

第一版：

    manual
    focus
    task_completed

预留但不在第一版承诺：

    android_usage
    system

### 18.6 View

    heatmap
    trend
    list
    photo

photo 的可见规则：

- template allowedViews 包含 photo；
- 当前查询范围至少存在一条关联 Inspiration 且有 image attachment。

否则自动隐藏照片 tab，回退 heatmap/list。

---

## 19. Scene API

新增：

    api/src/scenes/scenes.module.ts
    api/src/scenes/scenes.controller.ts
    api/src/scenes/scenes.service.ts
    api/src/scenes/scene-schema.ts
    api/src/scenes/scene-analytics.service.ts

### Template

    GET    /scenes?status=active|archived
    POST   /scenes
    GET    /scenes/:id
    PATCH  /scenes/:id
    PATCH  /scenes/:id/archive
    PATCH  /scenes/:id/restore
    POST   /scenes/reorder

POST/PATCH body：

    {
      name,
      emoji,
      color,
      description?,
      category?,
      fieldSchema,
      triggers,
      allowedViews
    }

### Entry

    GET    /scenes/:id/entries?start&end&cursor&limit
    POST   /scenes/:id/entries
    PATCH  /scenes/:id/entries/:entryId
    DELETE /scenes/:id/entries/:entryId

Create body：

    {
      sourceType,
      occurredAt,
      pomodoroSessionId?,
      taskId?,
      inspirationId?,
      metadata,
      tags,
      clientRequestId
    }

服务端验证所有关联记录属于当前 user。

### Analytics

    GET /scenes/:id/analytics

Query：

    start
    end
    timeZone
    bucket=day|week|month
    metric=duration|count|rating

Response：

    {
      totalDurationSeconds,
      totalCount,
      averageRating?,
      buckets,
      heatmap,
      hasImages
    }

---

## 20. Screen 11–15 — Scene UI

新增：

    web/src/api/scenes.ts
    web/src/components/records/scenes/SceneCenter.tsx
    web/src/components/records/scenes/SceneDetail.tsx
    web/src/components/records/scenes/SceneHeatmap.tsx
    web/src/components/records/scenes/SceneYearHeatmap.tsx
    web/src/components/records/scenes/SceneTrend.tsx
    web/src/components/records/scenes/SceneList.tsx
    web/src/components/records/scenes/ScenePhotoView.tsx
    web/src/components/records/scenes/SceneBuilderSheet.tsx
    web/src/components/records/scenes/SceneEntrySheet.tsx

### Scene Center

还原 V11：

- horizontal scene switch；
- current scene hero；
- 2-column Scene cards；
- AI generate entry；
- reorder。

### Month Heatmap

- 周/月/年/自定义；
- view mode icon；
- metric chip；
- actual data；
- 点击日期展开。

### Year Heatmap

按月分块，不加载 365 个详情对象，只取聚合 days。

### Photo

- 周日期条；
- 有图日期显示 thumbnail；
- 图文 timeline；
- 没图时不显示 photo mode。

### Builder

按 V11 五段：

1. 名称与识别；
2. 触发方式；
3. 记录字段；
4. 允许视图；
5. 图片规则。

---

## 21. AI 生成 Scene Template

V11 已定义 AI 生成模板和 Preview → Apply → Undo，因此在 Scene 基础 CRUD 稳定后接入 Planning。

### 21.1 Planning action 扩展

web/src/api/planning.ts 与后端 action schema 增加：

    create_scene
    update_scene

create_scene proposal 包含：

    name
    emoji
    color
    description
    fieldSchema
    triggers
    allowedViews

### 21.2 Planning scope

PlannerSheet scopeType 扩展：

    scene

### 21.3 Apply

PlanningService 通过 ScenesService 写入，不直接 Prisma 拼装。

### 21.4 Undo

复用现有 SchedulePlan 的通用 beforeState / afterState / planType 机制，planType 使用 scene_template。

ScenesController 增加：

    POST /scenes/plans/:planId/undo

create scene undo：

- 只在没有用户后续新增 Entry 或改动时允许硬撤销；
- 已有数据则改为 archive，并提示保留记录。

update scene undo：

- 恢复 beforeState；
- 不删除 SceneEntry。

---

## 22. Records 与 Scene 的真实关系

### 22.1 Capture

普通 Record：

    Inspiration only

Scene 图文记录：

    Inspiration
        ↓
    SceneEntry.inspirationId

Focus 后记录：

    PomodoroSession
        ↓
    Inspiration.focusSessionId
        ↓
    SceneEntry 可关联 Pomodoro 或 Inspiration

### 22.2 不做什么

不增加：

- SceneAttachment；
- SceneReflection；
- SceneInsight；
- SceneTask。

Reflection / Insight / Task 继续基于现有 Inspiration/Task 事实源。

---

## 23. Goal Progress

现有 StudyFolder 任务完成率保留。

后续按 Execution Intelligence M4 增加三类进度：

    task
    numeric
    time

建议新增 StudyFolder：

    progressType String @default("task")
    targetValue Float?
    progressUnit String?

numeric progress 如需用户手工累计，新增 GoalProgressEntry 而不是覆盖 Task：

    id
    userId
    studyFolderId
    value
    occurredAt
    source
    note?

time progress 直接来自实际 Pomodoro 聚合，不写第二份累计值。

V11 的 Goal Hero 先可显示 task progress + actual time；M4 再启用 numeric/time 主指标。

---

## 24. Planner 执行反馈

M5 时将 Analytics 结果接入 Planning Context：

可提供：

- 最近 7 / 28 天实际投入；
- 计划 vs 实际；
- 常见顺延时段；
- Focus 平均有效时长；
- 某 Goal 最近真实投入；
- 某 Tag 的时间分布。

必须标 provenance：

    confirmed
    inferred
    measured

measured 是系统测得事实；Planner 可以引用，但不能自动改写成用户偏好。

例：

“最近 7 天 22:30 后的三个学习计划有两次顺延”可以作为 measured/inferred evidence。

“你不适合晚上学习”不能作为系统事实。

---

## 25. 前端文件级修改清单

### Shell

| 文件 | 动作 |
|---|---|
| web/src/App.tsx | 拆 Workspace orchestration，Today 不再直接映射 Agenda |
| web/src/navigation.ts | 保留五 Workspace；修 legacy timeline/course deep link |
| web/src/components/shell/AppShell.tsx | 移除常驻 AppHeader；接 GlassProvider |
| web/src/components/shell/BottomNav.tsx | V11 floating liquid glass |
| web/src/components/shell/FloatingActionButton.tsx | 视觉改造，不改 quick actions |
| web/src/components/shell/QuickAddSheet.tsx | 使用 V11 glass/surface token |
| web/src/components/shell/AppHeader.tsx | 迁移完成后删除或 compatibility only |

### Foundation

| 文件 | 动作 |
|---|---|
| web/src/index.css | V11 tokens、dark tokens、density、motion、glass fallback |
| web/src/components/ui/foundation.tsx | 拆分/扩展基础组件 |
| web/src/components/ui/GlassSurface.tsx | 新增 |
| web/src/components/ui/GlassProvider.tsx | 新增 |
| web/src/lib/hyalite.ts | 新增 adapter |
| web/public/vendor/hyalite/* | pinned 0.5.0 |

### Today / Plan

| 文件 | 动作 |
|---|---|
| web/src/components/today/* | 新增 Today workspace |
| PlanWorkspace.tsx | 收敛为 calendar/tasks host |
| PlanHeader.tsx | 拆 V11 toolbar |
| WeekPlanView.tsx | 视觉重构 |
| MonthPlanView.tsx | 视觉重构 |
| AgendaPlanView.tsx | 视觉重构 |
| ActualTimelineView.tsx | 拆组件并加入逐条 compare |
| planProjection.ts | 保持单一前端投影语义 |
| usePlanItems.ts | 保留 |

### Task

| 文件 | 动作 |
|---|---|
| TaskSheet.tsx | 迁移到 TaskEditorSheet |
| DarkFrostedModal.tsx | 移除 Task 分支 |
| components/tasks/* | 新建统一编辑器 |

### Planner / Focus

| 文件 | 动作 |
|---|---|
| planner/PlannerSheet.tsx | UI 分层，不删除真实动作 |
| planner/PlanningContextEditor.tsx | 移入 advanced |
| focus/FocusSession.tsx | 还原 V11 三状态视觉 |

### Records / Scene

| 文件 | 动作 |
|---|---|
| SparksView.tsx | compatibility wrapper |
| records/RecordsWorkspace.tsx | 新增 |
| records/InspirationCaptureSheet.tsx | 重绘，不改事实源 |
| records/InspirationDetailSheet.tsx | 重绘 |
| records/InspirationWall.tsx | 保留 |
| insights/InsightPanel.tsx | 作为 Records 子页面 |
| records/scenes/* | 新增 Scene UI |
| api/scenes.ts | 新增 |

### Study / Course

| 文件 | 动作 |
|---|---|
| study/StudyWorkspace.tsx | 增加 目标/课程 |
| CourseView.tsx | V11 Graphite Aurora 重绘 |
| CourseDetailView.tsx | 重绘 |
| CourseImportWizard.tsx | 只统一视觉，流程不改 |
| CourseIntegrationsPanel.tsx | 移到课程管理二级设置 |

### Profile

| 文件 | 动作 |
|---|---|
| SettingsView.tsx | 拆成 ProfileWorkspace + settings subpages |
| tags/TagManagementView.tsx | V11 重绘 |
| utils/userPreferences.ts | reduceMotion + density |
| api/timeTrackingPreferences.ts | 新增 |

---

## 26. 后端文件级修改清单

| 文件/模块 | 动作 |
|---|---|
| api/prisma/schema.prisma | countsTowardActual、SceneTemplate、SceneEntry；后续 GoalProgress |
| api/src/app.module.ts | 注册 AnalyticsModule、ScenesModule |
| api/src/pomodoro/pomodoro.controller.ts | manual PATCH |
| api/src/pomodoro/pomodoro.service.ts | actual setting、manual update、analytics filtering |
| api/src/tasks/tasks.controller.ts | 补 typed reminder/repeat create 字段 |
| api/src/tasks/tasks.service.ts | 共用 create/update normalize |
| api/src/users/users.controller.ts | time-tracking preferences endpoints |
| api/src/users/time-tracking-preferences.ts | 新增 validator/parser |
| api/src/analytics/* | 新增 |
| api/src/scenes/* | 新增 |
| api/src/planning/* | Scene action、execution feedback |
| api/src/study/* | 后续 Goal progress |

---

## 27. Prisma migration 顺序

不要把所有变化压在一个 migration。

### Migration A — time tracking semantics

    add countsTowardActual to pomodoro_sessions

默认 true。

### Migration B — scenes

    create scene_templates
    create scene_entries
    add relations/indexes/unique constraints

### Migration C — goal progress

仅 M4 实施时增加，不提前建空字段。

每个 migration 都必须进入现有 fresh PostgreSQL CI。

---

## 28. 客户端缓存与刷新事件

现有代码使用 window event 做部分刷新。实施期保持简单，但统一事件名：

    sparkflow:tasks-changed
    sparkflow:calendar-changed
    sparkflow:actual-changed
    sparkflow:records-changed
    sparkflow:scenes-changed
    sparkflow:preferences-changed

规则：

- manual actual create/update/delete → actual-changed；
- Focus complete/interrupted → actual-changed + calendar-changed；
- planner apply → tasks-changed + calendar-changed；
- scene entry → scenes-changed；
- linked Inspiration → records-changed。

后续若迁 React Query 再统一替换，不在本次顺手引入第二个大状态框架。

---

## 29. 失败与并发

### Actual Manual

- clientRequestId 幂等；
- update expectedRevision；
- 409 提示刷新；
- delete active Focus 禁止。

### Scene

- create entry clientRequestId；
- link target 必须 user-owned；
- reorder 事务；
- archive 不删 entry；
- hard delete 只用于无数据草稿或明确危险操作。

### Planner

继续沿用 PlanningThread revision。

### Course

不改变现有 import requestId、preview、apply、undo 的语义。

---

## 30. 响应式与移动端

主要设计宽度仍按 V11 390px。

验收宽度：

- 360px；
- 390px；
- 430px；
- sm desktop container 512px。

要求：

- BottomNav 不遮挡正文；
- composer/actionbar 与 keyboard 同时出现时可用；
- safe-area top/bottom；
- Week horizontal/vertical 滚动不锁死；
- Sheet 最大高度使用 svh；
- Focus 全屏；
- 横屏至少可退出，不要求优化成 tablet dashboard。

---

## 31. Accessibility

- 所有 icon-only button 有 aria-label；
- segmented 使用 aria-pressed / role group；
- dialog 使用 aria-modal；
- 颜色不是唯一状态表达；
- 玻璃 fallback 对比度独立成立；
- reduceMotion；
- 44px 左右主触控目标；
- heatmap cell 提供 aria-label 日期 + 时长；
- Focus timer 不每秒 aria-live；
- loading/error 有可读文本。

---

## 32. 测试计划

### Web Unit

新增重点：

- executionMatching；
- Today metrics；
- Scene schema validation；
- Scene photo availability；
- density/reduceMotion；
- GlassProvider unsupported fallback；
- legacy route mapping。

### API Unit

- analytics grouping；
- exact/strong/inferred match；
- time zone day boundary；
- manual actual update revision；
- time tracking preferences；
- Scene ownership；
- Scene idempotency；
- Scene archive；
- Scene analytics；
- Planning scene action。

### Database

- prisma validate；
- fresh migrate；
- unique clientRequestId；
- cross-user relation reject；
- scene link delete behavior；
- old Pomodoro countsTowardActual=true。

### Visual/Manual

每个关键屏至少：

- light；
- dark；
- comfortable；
- compact；
- reduce motion；
- Hyalite supported；
- Hyalite unsupported fallback；
- 360px；
- Android WebView。

---

## 33. 实施阶段

### R1 — V11 Foundation + Shell

目标：先让真实 App 外壳进入 V11。

修改：

- token；
- GlassProvider；
- BottomNav；
- page-local headers；
- AppShell；
- QuickAdd；
- appearance reduceMotion/density。

**不改业务数据。**

验收：五 Workspace 可用，所有现有功能仍可到达。

### R2 — Today + Plan + Task + Actual

修改：

- TodayWorkspace；
- Plan V11 toolbar；
- unified TaskEditor；
- Actual compact rows/gaps/manual edit；
- legacy route mapping。

后端只增加 manual edit 和必要 typed Task fields。

### R3 — Planner + Focus + Records + Study/Course + Profile

目标：把现有真实业务全部统一进 V11 视觉。

不做 Scene/Analytics 的假实现。

实施拆分：

- [x] R3-A Planner：保留 PlanningThread、Evidence、语音、Replan、调课 / 课程模板与 Preview → Apply → Undo，默认收敛为 Conversation / Preview / Why，依据与高级操作按需展开；
- [x] R3-A Focus：完成 Setup → Running / Paused → Completed 状态视觉，保留自由 / 关联任务、倒计时 / 正计时、25 / 45 / 60 / 自定义、Capture 与完成任务；
- [x] R3-A 数据联动：完成或中断 Focus 后刷新 Actual；
- [x] R3-A 本地验证：Web 83 tests、API 163 tests、Web/API production build、改动文件定向 ESLint；
- [x] R3-A GitHub Actions CI #321；
- [x] R3-A squash 合并（PR #122）；
- [ ] R3-A 360px / PWA / Android WebView 视觉与交互验收；
- [x] R3-B1 Records：迁移为 RecordsWorkspace，并拆出 RecordToolbar、RecordCardsView、ReviewWorkspace、InsightsWorkspace；保留 SparksView 兼容导出；
- [x] R3-B1 Study/Course：学习工作区增加“目标 / 课程”切换，课程列表、详情、ICS 导入、学期与管理能力继续复用真实 Course 事实源；
- [x] R3-B1 Profile：建立 ProfileWorkspace 入口，并把标签管理、Actual 时间记录提升到一级卡片；
- [x] R3-B1 本地验证：Web 85 tests、Web production build、改动文件定向 ESLint；
- [x] R3-B1 GitHub Actions CI #324；
- [ ] R3-B2 Capture / Record Detail、Course Detail / Import、Tag Management 二级页视觉与移动端细节；
- [ ] R3-B 360px / PWA / Android WebView 视觉与交互验收。

### R4 — Time Analytics

实现 AnalyticsModule、heatmap、distribution、plan vs actual。

这对应现有 vNext M3。

### R5 — Scene Core

实现 SceneTemplate / SceneEntry、Builder、Center、Detail、Heatmap/List/Photo。

### R6 — Scene AI + Time Record Settings

实现：

- Planning create/update scene；
- undo；
- countsTowardActual；
- defaultScene；
- quick start / attachment preferences。

### R7 — Goal Progress

对应 M4。

### R8 — AI Execution Feedback

对应 M5。

### R9 — Android Usage

对应 M6，仍然最后做。

---

## 34. 推荐 PR 拆分

不要一个 PR 同时改 UI、Scene DB、Analytics。

建议：

1. feat/ui-v11-foundation-shell
2. feat/ui-v11-today-plan-task
3. feat/ui-v11-actual-planner-focus
4. feat/ui-v11-records-study-profile
5. feat/time-analytics
6. feat/scenes-core
7. feat/scenes-ai-time-preferences
8. feat/goal-progress
9. feat/planner-execution-feedback
10. feat/android-usage-timeline

每个 PR 都从最新 master rebase，避免重复旧分支历史。

---

## 35. V11 18 个画面最终映射

| V11 | 最终代码归属 | 是否新增业务 |
|---|---|---|
| 01 Today | TodayWorkspace | 聚合逻辑 |
| 02 Plan/Week | PlanWorkspace | 否 |
| 03 Actual Timeline | ActualTimelineWorkspace | 匹配 + manual edit |
| 04 时间分析 | TimeAnalyticsView | 是 |
| 05 Task Edit Deck | TaskEditorSheet | 统一编辑器 |
| 06 AI Planner Preview | PlannerSheet | 否，UI 重构 |
| 07 Focus | FocusSession | 否，状态视觉重构 |
| 08 Records | RecordsWorkspace | 否，结构重组 |
| 09 学习目标 | StudyWorkspace goals | Actual metric |
| 10 我的 | ProfileWorkspace | 结构重组 |
| 11 场景中心 | SceneCenter | 是 |
| 12 场景月热力 | SceneHeatmap | 是 |
| 13 场景年热力 | SceneYearHeatmap | 是 |
| 14 场景照片 | ScenePhotoView | 是，复用附件 |
| 15 Scene Builder | SceneBuilderSheet | 是 |
| 16 标签管理 | TagManagementView | 否，视觉重构 |
| 17 时间记录设置 | TimeTrackingSettings | 是，偏好语义 |
| 18 外观 | AppearanceSettings | reduceMotion/density |

---

## 36. 不允许的实现捷径

1. 不把 demo 数字写进生产 Analytics。
2. 不把 Course 时长直接当 Actual。
3. 不把 deadline 当 scheduled time。
4. 不把 Scene 做成 Tag。
5. 不给 Scene 再做附件、Reflection、Insight 第二套表。
6. 不在每个卡片上启用 Hyalite。
7. 不用远程 CDN 作为生产玻璃依赖。
8. 不为了 V11 删除 Planner 的课程变动、Evidence、Undo。
9. 不因为五栏导航隐藏 Course 管理入口。
10. 不继续维护 Task create/edit 两套逻辑。
11. 不把“AI 推测匹配”展示成事实匹配。
12. 不把 Appearance 的设备偏好和跨设备时间记录偏好混在一个 localStorage。

---

## 37. Definition of Done

V11 落地完成必须同时满足：

### Visual

- 五个一级页面与 V11 布局一致；
- Today、Week、Actual、Task、Planner、Focus、Records、Study、Profile、Scenes 视觉层级可一眼对应设计稿；
- Graphite Aurora token 统一；
- 液态玻璃只出现在确认的浮动组件；
- unsupported browser 有完整 fallback。

### Business

- master 已有能力不丢；
- Course 可从 Study 直接访问；
- Task create/edit 共用；
- Planner 全部真实 action 仍可用；
- Focus 真实 session 与 Actual 不重复；
- Records/Review/Insight 真实链路不变；
- Scene 有真实 DB/API；
- Analytics 无假数据。

### Data

- Planned 与 Actual 明确分离；
- Analytics 只用实际事实；
- Scene 不复制 Pomodoro/Inspiration 正文；
- 所有跨用户 id 被服务端拒绝；
- 新写入需要幂等的地方有 requestId。

### Release

- Web build/test；
- API build/test；
- fresh PostgreSQL migrate；
- 360px 浏览器；
- PWA；
- Android WebView；
- light/dark；
- Hyalite supported/fallback；
- 生产 migration 与 buildSha 单独验收。

---

## 38. 最终工程结论

这轮实现不是把 V11 HTML “翻译成 React”，而是：

**V11 决定产品的视觉、页面划分和默认信息层级；master 决定产品已有的真实能力和事实模型；本方案补齐两者之间缺失的工程层。**

因此最终 SparkFlow 应保持：

- 五 Workspace；
- V11 的安静 Graphite Aurora；
- 少量真实液态玻璃；
- Today 是执行首页；
- Plan 是计划；
- Actual 是真实时间账本；
- Analytics 是可解释统计；
- Records 是记录、回顾、洞察和 Scene 的容器；
- Study 同时承接目标与课程；
- Profile 承接跨设备偏好和设置；
- AI 继续通过 Preview → Apply → Undo 参与，而不是绕过用户确认。

后续代码实施以本文件作为 V11 主实施规格；Execution Intelligence 文档继续提供 M3–M6 的数据能力背景，NEXT.md 只维护实际执行顺序。
