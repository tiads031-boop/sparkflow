# SparkFlow VNext — Execution Intelligence & UI System

> **状态**：🚧 M1 已合并；M2 Timeline 2.0 代码已实现，待 PR、数据库与 360px/PWA/Android 验收
> **仓库基线**：`master@c856b4f24b650e6555d11dceb5606b51936421f5`
> **最后核对**：2026-09-22  
> **定位**：在现有“今天 / 计划 / 记录 / 学习 / 我的”五工作空间和 AI Planner、Focus、Course、Inspiration 能力之上，把 SparkFlow 从“能规划”升级为“能理解计划、执行、时间去向与目标进度，并据此持续调整”的个人执行系统。

---

## 1. 为什么启动这一轮

SparkFlow 已经具备较完整的功能底座：

- 五工作空间信息架构；
- Task / Course / CalendarEvent 统一时间投影；
- AI PlanningThread、语音输入、Web Research、Preview → Apply → Undo；
- 学习目标与阶段任务；
- 单次调课、周期课程变动与课程删除；
- Focus 倒计时 / 正计时、暂停恢复、完成后多模态记录；
- Inspiration → Review → Insight → Task；
- 任务标签字段、记录标签字段、StudyFolder / Project 等已有分类数据。

当前主要问题不再是“功能缺少”，而是四个断点：

1. **计划与实际执行仍然没有完整区分。**  
   现有日程能回答“计划什么时候做”，Focus 能记录一部分真实投入，但还没有一个统一的 Actual Timeline。

2. **标签字段存在，但缺少正式的标签管理与统计语义。**  
   Task / Inspiration 已有 `tags`，但缺少标签管理、层级、颜色、复用策略与时间统计。

3. **学习目标进度主要依赖任务完成率。**  
   还不能自然表达“48 本书 / 1000 道题 / 300 分钟 / 15000 字”等真实长期目标。

4. **部分历史页面视觉语言不一致。**  
   任务编辑 3D 卡片有辨识度，但表单、底部操作、字体与当前 SparkFlow UI 不统一；不同模块之间也存在组件重复。

本轮不新增新的一级导航，不重做已经完成的 Planner / Focus / Course / Record 主链路，而是围绕“执行数据层 + 统一 UI 系统”做纵向整合。

---

## 2. 产品目标

### 2.1 核心闭环

```text
用户目标 / 任务 / 课程 / 临时想法
              ↓
      AI 归类与上下文理解
              ↓
           计划时间
              ↓
           实际执行
              ↓
         Actual Timeline
              ↓
 标签 / 目标 / 项目 / 时间统计
              ↓
       进度、偏差与洞察
              ↓
 AI 根据真实执行结果增量调整计划
```

### 2.2 这一轮完成后 SparkFlow 应能回答

- 我今天计划做什么？
- 我实际上做了什么？
- 哪些任务只是“截止”，哪些真的排进了日程？
- 最近一周时间主要花在哪？
- 某个学习目标投入了多少真实时间？
- 目标推进到哪里？
- 哪些时间段我经常高估自己？
- AI 为什么建议把下一阶段计划改到这个时间？
- 某条任务属于哪个长期目标、阶段、标签，来源是什么？

---

## 3. 信息架构保持稳定

一级导航固定为：

```text
今天 / 计划 / 记录 / 学习 / 我的
```

### 3.1 今天

职责：回答“现在和今天最需要做什么”。

保留：

- 今日真实安排；
- 当前/下一个事项；
- 必要的 Focus / 执行状态；
- 轻量执行摘要（有数据时才出现）。

不重新塞入：

- 大型图表；
- 标签统计；
- 周/月分析；
- 模板管理；
- 独立日志面板。

### 3.2 计划

```text
计划
├─ 日历
│  ├─ 月
│  ├─ 周
│  └─ 日程
├─ 待办
│  ├─ 列表
│  └─ 四象限
├─ Timeline
│  └─ 实际时间流水
└─ 分析
   ├─ 时间热力图
   ├─ 标签/分类统计
   ├─ 计划 vs 实际
   └─ 目标投入
```

### 3.3 记录

继续使用现有 Inspiration 事实源：

```text
记录
├─ 卡片
├─ 自由墙
├─ 回顾
└─ 洞察
```

### 3.4 学习

继续以 StudyFolder 作为长期学习目标容器：

```text
学习目标
├─ AI 规划
├─ 阶段 / 里程碑
├─ 任务
├─ 量化进度
└─ 实际投入 / 执行反馈
```

### 3.5 我的

新增两个正式入口：

```text
我的
├─ 标签管理
└─ 时间记录
   └─ Android 自动记录应用
```

其余账户、外观、通知、连接、数据、安全设置保持现有结构。

---

## 4. 分类模型：Folder / Project / Tag 必须分开

### 4.1 Folder / StudyFolder

用于长期、持续、有明确目标的计划。

示例：

- 六级听力训练
- 法考主观题
- SparkFlow VNext

### 4.2 Project / Milestone

用于长期目标内部阶段。

示例：

```text
六级听力训练
├─ 长对话强化
├─ 新闻听力
└─ 真题冲刺
```

当前 Task.project 可继续作为阶段/项目字段使用，不为这一轮另建第二套 Project 事实源。

### 4.3 Tag

用于横向分类、检索和统计。

示例：

```text
#学习 #英语 #六级 #听力
#工作 #SparkFlow
#生活 #阅读
```

原则：

- 一个孤立短期任务通常只需要标签；
- 有持续目标才创建 Folder；
- Folder 内存在阶段时才使用 Project；
- AI 优先复用已有标签，不为每一条任务创建新分类。

---

## 5. UI 总体设计语言：Graphite Aurora

### 5.1 视觉关键词

- 大方；
- 克制；
- 成熟；
- 深色石墨质感；
- 柔和浅绿 / 淡紫点缀；
- 信息层级优先；
- 少量空间感，不做全局“炫技”。

### 5.2 3D 的使用范围

保留 3D 作为 SparkFlow 的特色交互，但只用于真正有“卡片层级/切换”意义的场景：

适合：

- 任务编辑卡片；
- 学习目标卡片；
- 回顾卡片；
- AI 方案预览。

不用于：

- 设置；
- 普通表单；
- 日历；
- 分析图表；
- 简单确认弹层。

### 5.3 基础组件规范

下一轮逐步收敛到共享组件：

```text
PageHeader
SectionCard
SegmentControl
InfoRow
TagChip
FolderChip
StatusChip
MetricCard
BottomActionBar
Sheet
DangerAction
EmptyState
```

不要求一次性重构所有旧页面；新页面和本轮触达页面优先使用新组件。

---

## 6. Task Edit Deck：任务编辑页重构

### 6.1 保留内容

保留现有 3D 多卡片结构：

- 左右滑动切换任务；
- 当前卡片居中；
- 前后卡片有轻微透视和层级；
- 卡片切换带水平位移 + 轻缩放。

### 6.2 重做内容

去掉：

- 常驻“左右滑动切换卡片”的大段说明；
- 过重的倾斜、阴影和黑色层叠；
- 大量互不统一的输入框；
- 右下角孤立的悬浮保存/删除组合。

### 6.3 新页面结构

```text
←                编辑任务                ···
                 Day 1 / 30

        [ 后一张弱化卡片 ]
      [ 当前主卡片 ]
    [ 前一张弱化卡片 ]

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
#六级 #英语 #听力

────────────────
截止时间       09/22 23:00
开始时间       09/22 19:30
提醒           提前30分钟
预计时长       60分钟
────────────────

备注
附件
来源

[ 删除 ]                  [ 保存更改 ]
```

### 6.4 卡片视觉

- 主卡片接近正面，不做夸张倾斜；
- 后卡缩小约 6%–10%，降低不透明度；
- 圆角建议 28–32px；
- 主卡使用石墨灰而不是纯黑；
- 阴影低透明、大范围；
- 选中状态只做非常轻的边缘亮度变化。

### 6.5 表单规则

- 状态、优先级：统一 Segmented Pills；
- 日期、提醒、时长：统一 InfoRow，点击后打开 picker/sheet；
- Folder / Project / Tag：统一 Chip + Selector；
- 危险操作集中在底部或“更多”，不与主表单抢视觉焦点。

---

## 7. Phase A — UI Foundation + Tags

### 7.1 目标

先把分类和 UI 基础补齐，为 Timeline、分析和 AI 分类提供稳定维度。

### 7.2 功能

1. 标签管理页面；
2. TaskSheet / Task Edit Deck 支持标签；
3. Inspiration 创建/编辑支持标签；
4. AI Planner 输出标签建议并优先复用已有标签；
5. Folder / Project / Tag 在 UI 中使用不同视觉语义；
6. Task 编辑页重做为新 UI 样板。

### 7.3 标签层级

第一版支持：

- 一级标签；
- 二级标签；
- 名称；
- 颜色；
- 排序；
- 归档。

不在第一版加入：

- 任意深度树；
- 自动标签合并；
- 复杂知识图谱。

### 7.4 数据策略

现有 `Task.tags` / `Inspiration.tags` 继续作为实体标签快照。

如果需要稳定的颜色、父子关系和重命名传播，再新增最小 Tag 元数据表；只有在“字符串数组无法表达层级、颜色与全局重命名”这一明确场景下引入，不复制 Task/Inspiration 正文。

---

## 8. Phase B — Timeline 2.0：计划与实际分离

### 8.1 两类时间

#### Planned Time

来源：

- Task.scheduledStart / scheduledEnd；
- Course；
- CalendarEvent；
- AI Planner Preview（仅预览态）。

回答：**原本计划什么时候做什么。**

#### Actual Time

来源：

- PomodoroSession / Focus；
- 用户手工补记；
- 后续 Android AppUsageSession。

回答：**实际把时间花在哪里。**

### 8.2 Timeline UI

```text
今天 · 09月22日

08:00
──── 民法课程
09:40

10:02
──── 六级听力 Focus
     43 分钟
     #学习 #英语 #听力

11:14
──── 阅读
     28 分钟
     #学习 #阅读

14:05
──── SparkFlow 开发
     1小时12分钟
     #工作 #SparkFlow
```

### 8.3 规则

- Agenda 只显示真实排入日程的项目；
- 未排期待办继续留在待办；
- Timeline 以 Actual 为主，可切换显示计划对照；
- Focus 不再只作为一个“日历投影”，统计时使用 PomodoroSession 真实有效时长；
- Course / 固定事件可作为背景上下文，但不能伪装成用户主动执行时长。

---

## 9. Phase C — Time Analytics

入口：`计划 → 分析`。

### 9.1 时间热力图

支持：

- 总实际投入；
- 某标签；
- 某长期目标；
- 学习 / 工作 / 生活等分类。

### 9.2 分类树 / 时间分布

示例：

```text
本周实际投入

学习        12h 43m
├ 六级       6h 18m
│ └ 听力     4h 52m
├ 法学       3h 11m
└ 阅读       3h 14m

工作         8h 21m
娱乐         3h 05m
```

### 9.3 计划 vs 实际

示例：

```text
六级听力
计划   7h
实际   5h37m
偏差  -1h23m
```

按日、周、目标查看偏差。

### 9.4 执行模式

第一版只做可解释的统计，不直接让 AI 下结论：

- 哪些时间段计划完成率高；
- 哪些时段频繁顺延；
- 平均 Focus 时长；
- 计划时长与真实投入差异；
- 哪些标签占用时间最多。

这些结果作为后续 Planner 上下文。

---

## 10. Phase D — Goal Progress

### 10.1 进度类型

#### A. Task Progress

```text
18 / 30 个任务
```

#### B. Numeric Progress

```text
21 / 48 本
650 / 1000 题
8200 / 15000 字
```

#### C. Time Progress

```text
210 / 300 分钟
```

### 10.2 目标页面

```text
六级听力训练

████████░░ 72%

任务进度
18 / 25

听力投入
1430 / 2000 分钟

真题
6 / 10 套

本周实际投入
4h 52m
```

### 10.3 规则

- 普通任务默认没有进度条；
- 长期目标按需启用量化指标；
- AI 建立目标时可以询问一次最关键的衡量方式；
- 目标指标可以由用户手动修改；
- Focus 时长可以自动推动 Time Progress；
- Numeric Progress 第一版由用户手动增减，后续再决定是否由特定任务完成自动推动。

---

## 11. Phase E — AI Classification & Behavior Feedback

### 11.1 自动分类

AI 对新任务 / 长期计划做三层判断：

```text
已有标签可复用？
↓
优先复用

是否只是孤立短期事项？
↓
只打标签

是否持续、有目标、有多个任务？
↓
创建/复用 Folder

Folder 内是否有明显阶段？
↓
使用 Project / Milestone
```

示例：

```text
“Day 9：六级长对话精听”

Folder = 六级听力训练
Project = 长对话强化
Tags = #英语 #六级 #听力
```

```text
“明天下午拿快递”

Tags = #生活
不创建 Folder
```

### 11.2 执行反馈进入 Planner

Planner Context 后续可读取：

- 过去 7 / 14 / 30 天真实投入；
- 任务完成率；
- 计划 vs 实际偏差；
- 常见延后时段；
- 某目标平均 Focus 时长；
- 某标签最近投入趋势。

AI 可以据此解释建议，例如：

> 最近 7 天 22:30 后的学习安排多次顺延；本次建议把听力训练前移到 19:30。是否按这个方向生成重排预览？

仍保持：

```text
AI 解释 / 提议
↓
确定性 Scheduler
↓
Preview
↓
Apply
↓
Undo
```

---

## 12. Phase F — Android App Usage Tracking

### 12.1 为什么放最后

App 使用记录必须依赖：

- Tag 已稳定；
- Actual Timeline 已存在；
- Analytics 能消费实际时长。

否则只会先产生一批无法解释的数据。

### 12.2 第一版能力

```text
我的
→ 时间记录
→ 自动记录应用
```

示例：

```text
微信读书
自动记录    ●
归类        学习 / 阅读

抖音
自动记录    ●
归类        娱乐

DeepTutor
自动记录    ●
归类        学习
```

### 12.3 Android 实现边界

优先使用系统 Usage Access：

- UsageStatsManager / UsageEvents；
- 查询已发生的前台 App 使用区间；
- 不要求 App 长期运行高频计时器。

第一版只保存：

```text
packageName
appName
start
end
duration
tag/category
```

不读取：

- 页面内容；
- 输入文字；
- 聊天内容；
- 通知内容；
- 屏幕截图。

### 12.4 数据模型

这里允许新增独立 `AppUsageSession`，因为：

- CalendarEvent 表示计划；
- PomodoroSession 表示主动 Focus；
- Inspiration 表示记录内容；
- AppUsageSession 表示系统观察到的实际 App 前台使用区间。

将 AppUsageSession 塞入上述任一事实源都会混淆语义。

---

## 13. Today 的边界

Today 保持极简。

有数据时可增加一张轻量执行摘要：

```text
今日投入
2h 16m

完成
3 / 5

[查看今日回顾]
```

没有真实执行数据时不显示。

Today 不承担完整统计和历史分析。

---

## 14. 数据与架构原则

### 14.1 继续复用的事实源

- Task；
- Course；
- CalendarEvent；
- PomodoroSession；
- Inspiration；
- Insight；
- StudyFolder；
- PlanningThread / SchedulePlan。

### 14.2 新增实体的约束

只有当前事实源无法正确表达新语义时才新增实体。

本轮可能需要：

- Tag 元数据：仅当需要层级 / 颜色 / 重命名传播时；
- GoalMetric：用于长期目标的数值/时间指标；
- AppUsageSession：Android 系统实际使用区间。

不新增：

- 第二套 Task；
- 第二套 Calendar；
- 第二套 Study Schedule；
- 第二套 Inspiration；
- 第二套 AI Conversation。

---

## 15. UI 与数据状态口径

页面必须区分：

- loading；
- success empty；
- success with data；
- stale/partial data；
- failed。

图表不能把“没有数据”渲染成 0 并误导用户。

计划/实际对照中：

- “未执行记录”不等于“用户什么也没做”；
- Android Usage 未开启时必须标明数据范围；
- Focus 仅代表主动记录到的专注；
- 分析页需要说明当前统计使用了哪些数据源。

---

## 16. 实施顺序

### M1 — UI Foundation + Tags

目标：

- Task Edit Deck；
- 共享表单组件；
- 标签管理；
- Task / Inspiration 标签编辑；
- AI 分类支持 Folder / Project / Tag。

完成标准：

- 任务编辑风格与当前 SparkFlow 统一；
- 3D 卡片保留但弱化；
- 标签可创建、编辑、选择；
- AI 不为孤立事项滥建 Folder。

### M2 — Timeline 2.0

目标：

- Planned / Actual 明确分离；
- Focus 成为 Actual Timeline 的第一批真实数据；
- 手工实际时间补记。

完成标准：

- Agenda 不再混入未排期待办；
- Timeline 可以按真实开始时间排序；
- Focus 有效时长与日历展示一致；
- 同一 Focus 不重复统计。

### M3 — Time Analytics

目标：

- 热力图；
- 标签时间分布；
- 计划 vs 实际；
- 目标投入。

完成标准：

- 同一统计口径在日/周/月切换下结果一致；
- 能追溯统计数据源；
- 空数据、部分数据与错误状态不混淆。

### M4 — Goal Progress

目标：

- Task / Numeric / Time 三类进度；
- 学习目标主指标；
- Focus 驱动时间型指标。

完成标准：

- 指标可编辑；
- 不给普通任务强加进度；
- 删除/取消任务不会错误增加进度。

### M5 — AI Behavior Feedback

目标：

- Planner 读取实际执行摘要；
- 对偏差给出可解释的调整建议；
- 仍通过 Scheduler Preview → Apply → Undo。

完成标准：

- AI 不把统计相关性当成用户事实；
- 调整建议注明依据；
- 已确认规划上下文不重复询问。

### M6 — Android App Usage Tracking

目标：

- Usage Access 授权；
- App → Tag 映射；
- UsageEvents → AppUsageSession；
- Timeline / Analytics 消费。

完成标准：

- 默认关闭；
- 权限撤销后停止新增；
- 不采集页面内容；
- 同一 UsageEvent 批次不重复写入；
- 统计页清楚标注自动记录数据范围。

---

## 17. 不在本轮做的事情

- 任意深度知识图谱；
- 向量数据库 / RAG 基础设施；
- 全局复杂自动化规则引擎；
- AccessibilityService 屏幕内容监控；
- Web/PWA 伪装系统 App 使用统计；
- 为每一种统计新建独立数据库；
- 重新引入独立 Course → Study 耦合；
- 重做已经完成的 AI Planner、Focus、Record 主链路。

---

## 18. 与旧方案的关系

本方案吸收并继续执行以下已完成方案的有效决策：

- VNext 信息架构的五工作空间；
- VNext M4–M8 的 AI 调度、学习目标、课程变动、多模态记录；
- Phase 14 的计划/执行闭环思想；
- Phase 15 的 Capture → Review → Insight → Action；
- Gantt / Quadrant 中“复杂视图不新增一级导航”的原则。

旧方案中已经完成的实现不再作为“待开发事项”重复进入 NEXT。

历史文档保留用于解释实现来源；真正的近期执行顺序只看：

1. `docs/plans/NEXT.md`
2. 本文
3. 尚未完成的生产/真机验收文档

---

## 19. 近期第一批开发任务

建议第一个开发 PR 只处理 M1 的可独立交付部分：

1. 建立共享 Tag 元数据（若采用元数据表）或先完成前端管理模型；
2. 新增标签管理页；
3. TaskSheet / Task Edit Deck 加标签选择；
4. Inspiration Capture / Detail 加标签；
5. 重构任务编辑页视觉；
6. Planner 输出的 Folder / Project / Tag 分类结果在确认前可见；
7. 补 Web build/test 与真实移动宽度回归。

M1 稳定后再进入 Timeline 2.0，不把 Android Usage Tracking 提前塞进第一批。

### 19.1 M1 实施记录（2026-09-22）

- 新增用户级 Tag 元数据与 migration，支持一级/二级、颜色、排序、归档；Task/Inspiration 的 `tags` 数组继续作为实体快照；
- 新增“我的 → 标签管理”，任务创建/编辑、记录 Capture/Detail 统一使用 TagSelector；
- Task 编辑明确区分 StudyFolder（长期目标）、Task.project（阶段）和 Tag（横向分类）；
- Planner 上下文读取现有标签，草案展示标签，并在确认应用时复用/补齐 Tag 元数据；孤立事项仍默认不创建 Folder；
- Task Edit Deck 保留卡片切换，但降低旋转、缩放、阴影和后卡不透明度；
- PR [#118](https://github.com/tiads031-boop/sparkflow/pull/118) 已通过 CI run #310 并 squash 合并为 `master@c856b4f`；API job 已通过 fresh PostgreSQL migration、build、tests 与真实数据库导入验证，Web build/tests 也已通过；
- 本地 Prisma validate、API/Web build、API 157 tests、Web 73 tests 均通过；此前远端 `PlannerSheet.tsx` 内容异常已由 `c4f0350` 恢复；
- 真实 360px/PWA/Android 视觉验收与 Tag migration 生产应用仍待完成；经确认 M2 代码并行推进，正式发布仍需同时完成这些收口项。

### 19.2 M2 实施记录（2026-09-22）

- 新增 Timeline 视图，以 `PomodoroSession` 直接作为 Actual Time 事实源；Month/Week/Agenda 排除 Focus 的兼容 CalendarEvent 投影，避免同一 Focus 重复展示和统计；
- Actual Timeline 按真实开始时间排序，显示有效时长、暂停时长、来源、标签与关联任务，并支持“仅实际 / 计划对照”；
- 新增手工实际时间补记，复用 PomodoroSession，通过 `entrySource=manual` 区分来源，并支持任务、标签、备注和幂等 request id；
- 提前结束的 Focus 会结算真实有效时长；统计统一纳入有有效投入的 completed/interrupted session，暂停时间不计入投入；
- 新增 `title / entrySource / tags` migration 和 `(userId, status, startedAt)` 索引；
- 本地 Prisma validate、API/Web build、API 159 tests、Web 73 tests 和新增前端专项 ESLint 通过；自动浏览器 daemon 仍无法启动，fresh PostgreSQL CI、真实 API 与移动端验收留到 PR/部署阶段。
