# Phase 14 — Rhythm Experience / SparkFlow V5

> **状态**：🚧 M1 已合并；M2 已实现，待 PR/CI、迁移与真实设备验收
> **基线要求**：Phase 12 M2.2 已随 PR #5 合并且 CI 成功；实施时从最新 `master` 建立短期分支  
> **产品主线**：Capture → Plan → Flow → Focus → Review  
> **V5 Core**：M1 + M2 + M3

---

## 1. 背景与目标

SparkFlow 已具备任务、看板、日历、课程、灵感、Pomodoro、Google Calendar、Android 系统日历与 Supabase 持久化等能力。Phase 14 不继续堆叠孤立模块，而是把现有能力收束到用户每天真正执行的节奏中。

V5 首页优先回答两个问题：

1. 我现在应该做什么？
2. 接下来什么时候有空？

目标体验：

```text
记录事情 → 安排时间 → 看见一天 → 开始执行 → 回顾一天
Capture   Plan       Flow       Focus       Review
```

## 2. 范围与里程碑

| Milestone | 名称 | 核心内容 | 后端变更 | 风险 |
|---|---|---|---|---|
| M1 | UI Foundation | Design Tokens、AppShell、5 Tab、Quick Add | 无 | 低 |
| M2 | Today Rhythm | Today 首页、Rhythm Dial、空闲时间、统一安排编辑器 | Task 小量字段 | 中 |
| M3 | Timeline V2 | 月/周/时间轴、15 分钟粒度、锁定与拖拽 | 小量 | 中 |
| M4 | Smart Planner | 意图解析、确定性排程、预览/应用/撤销 | Planner 模块 | 中高 |
| M5 | Life Loop | 全屏专注、今日小票、深色模式、Android Widget | 少量/原生 | 中 |

M1～M3 完成后定义为 **V5 Core**。M4、M5 不阻塞核心版本发布。

明确不纳入首批范围：

- AI 直接修改所有日程
- 重写现有 Calendar Engine
- 删除 Board 或 Sparks 数据能力
- 一次性替换全部历史 CSS
- iOS、社交排名、复杂机器学习排程
- 云端 Widget 同步服务

## 3. 信息架构

默认一级导航调整为：

```text
今天 Today｜时间轴 Timeline｜待办 Tasks｜课程 Courses｜设置 Settings
```

兼容迁移：

| 旧入口 | V5 入口 |
|---|---|
| dashboard | today |
| calendar | timeline |
| board | tasks + boardView |
| tasks | tasks |
| sparks | sparks（二级入口，可重新固定） |

Board 保留为 Tasks 的子视图；Sparks 可从全局“+”、Today 快捷入口进入，也允许用户在设置中重新固定到底栏。旧 localStorage 导航配置必须自动迁移。

Phase 13 计划新增的 `local-codex` 不得在 Phase 14 中丢失：

- 若 Phase 13 先落地，`local-codex` 作为可选一级入口保留，可由用户固定到底栏；默认 5 Tab 指的是默认可见集合，不是封闭枚举。
- 若 Phase 14 先落地，Phase 13 必须复用 Phase 14 的导航注册表和迁移函数，不再直接扩展多处硬编码数组。
- `local-codex` 在 Vercel/PWA/Android 仍遵守 Phase 13 的 `unavailable` 边界，不因 Today 改版而探测桌面 localhost。

## 4. M1 — UI Foundation

### 4.1 Design Tokens

新增：

```text
web/src/styles/
├── tokens.css
└── themes.css
```

第一批变量：

```css
--sf-bg;
--sf-surface;
--sf-surface-elevated;
--sf-text-primary;
--sf-text-secondary;
--sf-text-tertiary;
--sf-border;
--sf-divider;
--sf-accent;
--sf-marker-purple;
--sf-marker-pink;
--sf-marker-yellow;
--sf-marker-green;
--sf-marker-blue;
--sf-marker-cyan;
--sf-radius-sm;
--sf-radius-md;
--sf-radius-lg;
--sf-radius-pill;
```

设计原则：

- 暖白或极浅灰背景，白色卡片
- 主要文字接近黑色而非纯黑
- 极弱边框、少阴影
- 彩色仅用于时间、状态、进度
- 16 / 20 / 28 三档圆角
- 新页面全部使用 Token；历史页面渐进迁移

### 4.2 AppShell

建议拆分：

```text
web/src/components/shell/
├── AppShell.tsx
├── AppHeader.tsx
├── BottomNav.tsx
├── QuickAddButton.tsx
└── QuickAddSheet.tsx
```

全局“+”提供：

- 新建任务
- 新建日程
- 记录灵感
- 开始专注
- AI 帮我安排（M4 启用）

### 4.3 M1 验收

- 旧导航配置自动迁移
- 原任务、Board、Calendar、Course、Sparks 均可进入
- Android Capacitor Build 不受影响
- 不新增数据库 migration
- Web build、lint、test 通过

### 4.4 M1 实施进度（2026-09-12）

- [x] 新增 `tokens.css` 与 `themes.css`，V5 新外壳使用语义变量，未强制迁移历史页面。
- [x] 新增可扩展 `navigationRegistry`，默认显示“今天 / 时间轴 / 待办 / 课程 / 设置”，看板与灵感保留为可选入口。
- [x] 旧 `dashboard / calendar` 配置迁移为 `today / timeline`；未知导航 id 被安全过滤，重复项去重。
- [x] Auth onboarding、Settings 导航配置与 App 主导航统一读取注册表，消除三套硬编码列表。
- [x] 拆出 `AppShell / AppHeader / BottomNav / QuickAddSheet`；新建任务、日程和灵感复用现有编辑能力，Focus/Planner 明确显示为后续开放。
- [x] Web production build 通过；17 项 Web 测试通过；新增/修改模块定向 ESLint 与 `git diff --check` 通过。
- [x] PR #6 已合并，GitHub CI run #20 成功。
- [ ] 完成真实 360px/桌面交互验收。
- [ ] Android 原生 assemble：Capacitor sync 已通过；当前执行环境无法联网下载 Gradle 8.14.3，交由 CI 或已缓存 Gradle 的环境完成。

全仓 `npm run lint` 仍被 54 个既有错误阻断，集中在旧 `CalendarView`、`DarkFrostedModal`、API client 与若干 store；M1 不扩大范围清理这些历史债务，以定向 ESLint 作为本批新增代码门禁。

## 5. M2 — Today Rhythm

新增：

```text
web/src/components/today/
├── TodayView.tsx
├── WeekStrip.tsx
├── RhythmDial.tsx
├── NextUpCard.tsx
├── FreeTimeCard.tsx
└── TodayProgress.tsx
```

Today 顶部包含日期、星期、周日期条和快速新建入口。点击日期直接切换当天，无需先进入 Calendar。

### 5.1 统一前端模型 ScheduleItem

```ts
interface ScheduleItem {
  id: string;
  sourceType: 'task' | 'course' | 'calendar' | 'google' | 'local';
  sourceId: string;
  title: string;
  start: string;
  end: string;
  durationMinutes: number;
  color: string;
  locked: boolean;
  completed: boolean;
  location?: string;
}
```

新增 `web/src/utils/scheduleProjection.ts`：

```text
Task + CalendarEvent
→ normalize
→ deduplicate
→ ScheduleItem[]
→ Today / Week / Timeline / Planner
```

课程实例、Google 日历和 Android 本地日历当前都已落入 `CalendarEvent`，因此 M2 不再直接读取 `Course[]` 生成第三份事件。来源类型从 `CalendarEvent.eventType / externalSource / courseId` 推导。

若 Task A 已被 `CalendarEvent(taskId=A)` 引用，只渲染一次。去重键优先采用关联 `taskId`；外部事件继续依赖现有 `(userId, externalSource, externalEventId)` 唯一约束，不能用标题和时间做破坏性模糊去重。

M2 暂不增加 `/day-plan` API，继续利用 Task Store、现有 `/calendar` 与 Task 的 `scheduledStart/scheduledEnd`。

### 5.2 Rhythm Dial

默认展示 06:00–24:00：

- 圆弧负责颜色、位置和持续时间
- 圆心显示当前时间与下一项
- 弧段文字只保留短标签
- 点击弧段打开 Bottom Sheet，展示时间、时长、固定状态，并提供开始专注、编辑、固定、完成操作
- 不把长标题直接塞进圆弧

### 5.3 空闲时间

新增：

```ts
computeFreeSlots(items, availabilityStart, availabilityEnd, minDuration)
```

空闲计算是确定性能力，不依赖 AI。Today 展示当前空闲窗口和后续可用时段。

算法必须：

- 先裁剪到可安排区间
- 合并重叠与相邻忙碌区间
- 排除小于 `minDuration` 的碎片
- 正确处理跨日、全天与无事件状态

### 5.4 Schedule Editor

新增：

```text
web/src/components/schedule/
├── ScheduleEditor.tsx
├── ColorPicker.tsx
├── DurationPicker.tsx
└── ReminderPicker.tsx
```

字段包含标题、日期、开始时间、时长、固定时间、提醒、颜色和备注。用户时长可为任意分钟数；智能扫描粒度仍为 15 分钟。

### 5.5 Task Schema 最小扩展

```prisma
scheduleLocked Boolean @default(false)
scheduleSource String @default("manual")
scheduleColor String?
```

`scheduleSource` 首批值：`manual / ai / imported`。`scheduleColor` 与现有由 priority 推导的 `colorType` 分离，避免改变任务卡片语义。

CalendarEvent 增加同名 `scheduleLocked Boolean @default(false)`，以支持用户锁定独立会议和手工日程；课程事件默认按来源派生为 locked，Google/local 事件默认视作外部固定事项，除非后续同步契约明确允许移动。

不增加 `showOnDial`。排程时间的兼容读取规则为：

1. `scheduledStart + scheduledEnd` 完整时直接使用；
2. 只有 `scheduledStart` 时，以 `estimatedMinutes` 推导 end；
3. 两者都缺少时才视为未安排。

所有 M2 新写入路径必须同时提交 `scheduledStart`、`scheduledEnd` 和 `estimatedMinutes`；旧数据只在 projection 中兼容推导，不在页面加载时静默回写。Schema、TasksService create 白名单、Controller body 类型、前端 ApiTask/Task、导入导出与测试必须同步更新。

### 5.6 M2 验收

- Today 可切换日期并正确合并所有日程来源
- 关联 Task 与 CalendarEvent 不重复
- Rhythm Dial 的弧段几何与跨时段显示正确
- 可创建、编辑、锁定并完成安排
- 空闲时间与真实占用一致
- 刷新后安排、颜色和锁定状态不丢失

### 5.7 M2 实施进度（2026-09-12）

- [x] 新增统一 `ScheduleItem` 与 projection，Task 和 CalendarEvent 归一后供 Today 使用。
- [x] 关联 `taskId` 的 CalendarEvent 去重；课程、Google 与 Android local 来源从 CalendarEvent 派生，不重复读取 Course 实例。
- [x] 旧任务缺少 `scheduledEnd` 时，以 `estimatedMinutes / duration` 推导；无效时间和取消任务不进入投影。
- [x] 新增 `computeFreeSlots`，支持区间裁剪、重叠合并和最小空闲时长。
- [x] Today 首页包含周日期条、06:00–24:00 Rhythm Dial、下一项、空闲时段、今日进度与日程列表。
- [x] 新增统一 Schedule Editor，支持新建和编辑任务安排；一次提交 start/end/duration、锁定、来源、颜色、提醒和备注。
- [x] Task 增加 `scheduleLocked / scheduleSource / scheduleColor`；CalendarEvent 增加 `scheduleLocked`，均通过 additive migration 交付。
- [x] Web build、21 项测试和新增模块定向 ESLint 通过；API build、6 suites / 17 tests 通过。
- [ ] PR/CI、Supabase migration 应用、Vercel Preview 和真实 360px/Android 交互验收。

云端浏览器当前策略阻止访问本地 `127.0.0.1`，因此未以不可复现的截图替代真实交互验收；临时 AuthGate 绕过已还原，未进入提交。

## 6. M3 — Timeline V2

不重写现有 Calendar Engine。逐步拆分 `CalendarView.tsx`：

```text
web/src/components/timeline/
├── TimelineView.tsx
├── MonthView.tsx
├── WeekGridView.tsx
├── DayTimelineView.tsx
├── DateNavigator.tsx
├── ViewSwitcher.tsx
└── ScheduleBlock.tsx
```

### 6.1 三种视图

**月视图**

- 日期格最多展示两项
- 其余以“+N”折叠
- 使用统一 ScheduleItem、颜色与完成状态

**周视图**

- 7 天时间格
- 支持拖动、Resize、点击/长按创建
- 桌面优先，移动端允许横向滚动

**时间轴**

- 移动端默认优先
- 顺序展示开始时间、事项、时长、固定状态和空闲间隔
- 点击事项复用 Schedule Editor / Detail Sheet

### 6.2 时间粒度

- 拖拽、创建和 Planner 候选扫描统一为 15 分钟
- 用户输入时长不强制为 15 的倍数
- 日期边界、夏令时与时区转换必须使用统一工具函数

### 6.3 Locked Schedule

Locked 来源：

- 课程
- 会议
- 用户明确锁定事项

行为：

- AI 禁止移动
- 拖拽前二次确认
- 视觉显示锁定标识

Flexible 普通任务可直接拖动，也允许 Planner 调整。

### 6.4 M3 验收

- Month / Week / Timeline 数据完全一致
- 拖动或 Resize 后所有视图同步
- 课程、会议与锁定任务不会被自动移动
- 15 分钟吸附正确，任意分钟时长不被篡改
- 现有 Google / local / course 日程与重复规则无回归

## 7. M4 — Smart Planner

核心原则：

> LLM 只负责“语言 → 意图”；确定性 Scheduler 负责“意图 → 时间”。

新增后端：

```text
api/src/planner/
├── planner.module.ts
├── planner.controller.ts
├── planner.service.ts
├── scheduler/
│   ├── free-slot.ts
│   ├── constraints.ts
│   ├── scorer.ts
│   └── schedule.ts
└── dto/
    ├── planning-intent.ts
    └── planning-preview.ts
```

### 7.1 流程

```text
用户输入
→ Intent Parser
→ PlanningIntent
→ Hard Constraints
→ Candidate Slots（15 分钟扫描）
→ Score
→ Proposal
→ 用户预览
→ Apply
```

Hard Constraints：

- Locked Schedule、课程、会议
- 睡眠与不可安排区间
- 不得重叠
- 不得超过 deadline
- 不得越过用户可安排时间

Soft Constraints：

- 偏好时段
- 截止紧迫度与优先级
- 保留已有安排
- 相似任务集中
- 减少碎片与过晚安排
- 任务间休息

### 7.2 两种模式

**帮我安排**：为未安排任务寻找空位。

**帮我顺延**：插入新固定事项后，在不移动 Locked 项目的前提下重新安排受影响任务。

### 7.3 API

```http
POST /planner/preview
POST /planner/apply
POST /planner/:planId/undo
```

Preview 只计算，绝不写数据库。Apply 必须重新校验数据版本与冲突，并通过 Prisma Transaction 一次性写入。陈旧计划必须拒绝应用。

为可靠撤销新增 `SchedulePlan`，至少保存：

- id、userId、status
- beforeState、afterState
- createdAt

历史可按 30 天清理。

### 7.4 M4 验收

- Locked 永不被移动
- 结果无重叠并遵守可用区间、deadline
- 同样输入与状态得到可复现结果
- Preview 不产生写入
- stale plan 被拒绝
- Apply 失败完整回滚
- Undo 恢复到应用前状态

## 8. M5 — Life Loop

### 8.1 Focus

复用现有 `PomodoroSession`，升级为全屏专注体验：

- 从日程弧段或事项直接开始
- 暂停、继续、结束
- 结束后显示本次专注分钟并可完成关联任务
- 不新建平行的专注数据体系

### 8.2 Daily Receipt

数据来自 Task、CalendarEvent、PomodoroSession。第一版不新增 Receipt 表。

输出包含：

- 日期
- 专注合计
- 完成事项数
- 当日日程/任务
- 用户的一句话
- 可分享 PNG

渲染链路：

```text
Receipt Data → SVG → Canvas → PNG Blob
```

### 8.3 Dark Mode

M1 建立 Token 后，M5 完成历史核心页面迁移。深色模式只替换变量，不在组件中散落颜色分支。

### 8.4 Android Widget

放在 M5 最后，不阻塞 V5：

- 2×2 今日表盘
- 2×2 今日进度
- 4×2 接下来
- 4×2 本周安排

需使用 Android AppWidget/Kotlin 原生层，不能只实现 React 页面。

## 9. Settings V5

仅重新分组，不删除现有能力：

| 分组 | 项目 |
|---|---|
| 外观与桌面 | 显示外观、桌面小组件 |
| 声音与通知 | 整点报时、事件提醒、专注提醒 |
| 日历与同步 | Google Calendar、系统日历、课程与教务、WebDAV |
| 时间与安排 | 默认可安排时间、时间粒度、AI 排程偏好、默认任务时长 |
| SparkFlow | 导航设置、默认任务分组 |
| 数据管理 | 导出、导入 |
| 账户 | 个人资料、修改密码、退出 |

## 10. 现有方案与代码兼容矩阵

| 交叉区域 | 现状 | Phase 14 约束 | 结论 |
|---|---|---|---|
| Phase 12 课程导入 | PR #5 已合并；WebDAV 已在设置页，模板按学校隔离 | 不移动或改写 `CourseWebDavBackup` 的数据语义；Settings V5 仅重排容器 | 兼容 |
| 课程时间数据 | 课程实例已存为 `CalendarEvent(courseId)` | Projection 读取 CalendarEvent，不从 Course 再生成实例 | 避免重复 |
| Google/local 日历 | 均写入 CalendarEvent，并有 externalSource/externalEventId | 保留唯一约束与同步事实源；只做展示投影 | 兼容 |
| Task 时间字段 | scheduledStart/end + estimatedMinutes 已存在，但旧编辑路径可能缺 end | 兼容推导；新路径三字段原子更新 | 需修正 |
| Task 颜色 | `colorType` 由 priority 推导 | 新增 `scheduleColor`，不复用 `color` 或覆盖 priority | 避免语义冲突 |
| 导航 | App/types/uiSlice 三处硬编码并持久化 | M1 先建立注册表与版本化迁移，保留未知/后续可选入口 | 需重构 |
| Phase 13 | 计划新增 `local-codex` 导航和 Settings 入口 | 复用 M1 注册表；本机可用性边界保持不变 | 条件兼容 |
| CalendarView | 单文件已有拖拽、resize、重复和来源去重 | 用 characterization tests 固定行为后再拆，不并行重写 | 兼容 |
| Settings | 已包含 CourseWebDavBackup、导航、数据迁移、账户 | 仅重组 section；组件和存储 key 不迁移 | 兼容 |
| 技术栈 | 当前根视图由 Zustand `activeTab` 切换，没有 React Router | Phase 14 不引入 React Router；继续状态路由，后续另立迁移方案 | 兼容 |

### 10.1 文件所有权与合并顺序

为避免 Phase 13/14 同时修改高冲突文件：

1. Phase 14 M1 独占 `App.tsx`、`types/index.ts`、`store/uiSlice.ts` 与导航设置区，完成导航注册表和迁移。
2. Phase 13 若在 M1 后实施，只向注册表登记 `local-codex`，不得恢复三处硬编码。
3. Phase 12 后续 M3 不得与 Phase 14 M2 同时修改 `api/prisma/schema.prisma`；后开始者必须基于前者最新 master。
4. `SettingsView.tsx` 的 Phase 12 数据能力与 Phase 14 视觉分组分成不同 PR；先用 characterization test 固定导入导出、WebDAV 和导航设置行为。
5. `CalendarView.tsx` 拆分前先补现有拖拽、resize、taskId 去重和课程/外部事件回归测试，再逐组件迁移。

### 10.2 数据库迁移安全

- Task 与 CalendarEvent 新字段使用 nullable 或有默认值的 additive migration，不重命名、不删除现有列。
- migration 合并前以当时最新 Supabase schema 重新生成，不手写假定的迁移序号。
- Planner 的 `SchedulePlan` 放在 M4 独立 migration，不与 M2 字段混在同一迁移。
- Apply/Undo 均按 `userId` 隔离，并复用现有 Supabase bearer-token 身份，不接受客户端传入的 userId 作为事实源。

## 10. 文件级清单

```text
web/src/
├── App.tsx
├── types/index.ts
├── styles/{tokens,themes}.css
├── components/
│   ├── shell/
│   ├── today/
│   ├── timeline/
│   ├── schedule/
│   ├── planner/
│   ├── focus/
│   └── receipt/
├── utils/
│   ├── scheduleProjection.ts
│   ├── freeSlots.ts
│   ├── timeGeometry.ts
│   └── receiptRenderer.ts
└── store/
    ├── uiSlice.ts
    ├── taskSlice.ts
    └── scheduleSlice.ts

api/
├── prisma/schema.prisma
└── src/
    ├── tasks/
    └── planner/
```

保持现有 Course 核心模型、Google Calendar 同步架构、系统 Calendar Adapter、PomodoroSession、Supabase 主数据架构与 Capacitor 打包模式。

## 11. 测试策略

Pure Logic：

- Schedule Projection 与去重
- Free Slot 与 overlap
- Time Geometry
- Locked Constraint
- Candidate Scoring / Reschedule
- Receipt Data

Backend：

- locked item never moved
- no overlapping
- deadline / availability respected
- preview has no writes
- transaction rollback
- stale plan rejected
- undo restores beforeState

每个 PR：

```bash
cd web && npm run build && npm run lint && npm test
cd api && npm run build && npm test
```

V5 Core 合并前额外执行 Android Build 与真实移动端回归。

## 12. PR 切分

| PR | 内容 | 数据库 |
|---|---|---|
| PR-A / M1 | Tokens、AppShell、Navigation、Quick Add、兼容迁移 | 无 |
| PR-B / M2 | ScheduleItem、Projection、Today、Dial、Editor、Task 字段 | 有 |
| PR-C / M3 | Calendar 拆分、Month/Week/Timeline、Lock、15 分钟 | 可能 |
| PR-D / M4 | Planner、约束引擎、Preview/Apply/Undo | 有 |
| PR-E / M5 | Focus、Receipt、主题迁移、Android Widget | 可选/原生 |

每个 PR 均从当时最新 `master` 创建，不累积超大长期分支。

## 13. 实施顺序与依赖

```text
Phase 12 M2.2（PR #5 已合并，CI 成功）
→ Phase 14 M1
→ M2
→ M3
→ V5 Core Release
→ M4 Planner
→ M5 Life Loop
```

Phase 13 与 Phase 14 的 Gateway/Planner 后端互不替代，但共享导航和 Settings 表层。两者不得并行修改 `App.tsx`、`types/index.ts`、`uiSlice.ts` 或 Settings 导航区；后一方案必须复用先落地的导航注册表并从最新 `master` 建分支。

## 14. Definition of Done

V5 Core 完成时，用户应能：

1. 打开 SparkFlow 立即看见今天
2. 发现当前与后续空闲时间
3. 创建任意时长任务并安排到具体时间
4. 在 Today、Week、Timeline 同步看到它
5. 拖动或调整时长后所有视图一致
6. 将会议或事项锁定
7. 保证系统和后续 Planner 永不误移动锁定事项

M4 完成后，用户可以先预览、再确认 SparkFlow 的安排建议，并可靠撤销。

---

## 15. 决策摘要

Phase 14 是一次体验收束，而不是功能堆叠。现有 Task、Calendar、Course、Pomodoro、Google Calendar、系统日历与 Supabase 基础保持不变；通过统一 Schedule Layer，让数据最终汇聚到：

> **今天 → 时间 → 执行 → 回顾**
