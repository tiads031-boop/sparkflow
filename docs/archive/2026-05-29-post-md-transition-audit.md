# SparkFlow 后转型期架构审计

> 2026-05-29 · 参与：hanako / yun / zero

## 概述

本次审计确认了以下基线：

1. **Task 模型需显式划分 Protocol 层与 DB 层字段**，在 Prisma schema 中以注释标注。这是所有后续改造的前提。
2. **context-bridge write() 从 deleteMany + 逐个 create 改为 upsert by contextMdHash**，只覆盖 Protocol 字段，保留 DB 专属字段和关联。
3. **`column` 字段重命名为 `section`**，统一 md 协议、Prisma schema、前端 store 三层的命名。
4. **抽出统一 api/ 工具模块**，消除 CalendarView 中重复的 HTTP boilerplate。
5. **项目根因**：从 "md 单一数据源" 到 "Supabase 主存储" 的架构转型在代码中尚未完成对齐，Task 模型、write 策略、数据流归属仍带着转型前的惯性。
6. **当前阶段判断**：功能完备度远超大部分个人工具，组件和 store 的膨胀属于正常生长，需要在数据模型层面重新对齐底层假设，而非推翻重来。

## 发现的问题

### 1. context-bridge write() 导致关联数据丢失

- **位置**：`api/src/context-bridge/context-bridge.service.ts` 的 `write()` 方法
- **现象**：每次写入执行 `deleteMany` 该用户所有 Task → 逐个 `create` 新 entries。Task 表关联的 inspirationId、courseId、pomodoroSessions、calendarEvents 等外键关系在删建后全部丢失。
- **根因**：write 方法的设计隐含了 "md 条目 = Task 全部数据" 的假设，但 Task 表已承载了大量 md 协议之外的 DB 专属数据和关联。
- **影响**：任何通过 md 同步覆盖的操作都会静默清空番茄钟统计、灵感转化记录、课程绑定。这是数据完整性级别的缺陷，而非性能问题。

### 2. HTTP 工具层重复

- **位置**：`web/src/components/CalendarView.tsx` 的 `fetchCalendarEvents` 函数
- **现象**：CalendarView 重新声明了 `API_BASE`、`API_KEY`、`DEFAULT_USER_ID`，与 appStore 中的 `apiRequest` 完全独立。同一个 HTTP boilerplate 有两份副本。
- **根因**：项目没有统一的 api/ 工具模块，每个需要独立请求的 feature 都可能复制这套三件套。
- **影响**：API 地址、认证方式变更时需要多处修改；新增 feature 时容易长出第三份副本。

### 3. Task 模型字段缺乏协议归属标记

- **位置**：`api/prisma/schema.prisma` 的 Task model
- **现象**：Task 表字段混合了 md 协议层（contextMdHash, title, description, status, priority, section, project, notes, dueDate）和 DB 专属层（inspirationId, courseId, pomodoroSessions, aiFeasibility, scheduledStart, scheduledEnd, tags），但没有显式标注分类。
- **根因**：项目经历了从 "md 单一数据源" 到 "Supabase 主存储" 的架构转向（蓝图决策 #22），Task 模型设计还保留着 "md 就是数据库" 的惯性。
- **影响**：每次涉及 Task 的读写操作都需要隐式判断 "这个字段要不要同步到 md"，没有明确的参照。新增字段时缺乏归属指引。

### 4. 组件体积失控

- **位置**：`web/src/components/CalendarView.tsx`（1137 行）、`web/src/components/DarkFrostedModal.tsx`（895 行）
- **现象**：CalendarView 包含日历头、月历网格、时间线渲染、拖拽 resize、长按创建 ghost、课程事件混入、截止任务列表。DarkFrostedModal 包含表单、3D 卡片动画、番茄钟、子任务管理。
- **根因**：功能迭代速度快于架构整理，未及时抽取子组件。
- **影响**：每个功能修改都需在巨石文件中定位代码，拖慢开发速度。

### 5. store 职责过载

- **位置**：`web/src/store/appStore.ts`（672 行）
- **现象**：api 调用、task CRUD、pomodoro 状态、push 订阅、同步逻辑全部在一个文件。
- **根因**：Zustand 初始采用单 store 设计，随功能增长未拆分。
- **影响**：store 文件修改频繁，多人协作或长时间迭代后容易产生合并冲突和逻辑耦合。

### 6. Dashboard 视觉参数无注释

- **位置**：`web/src/components/DashboardView.tsx` 的 `computeBars` 函数
- **现象**：week 模式的 `ratios = [0.6, 0.8, 0.4, 1.0, 0.7, 0.5, 0.3]`、day 模式的 `0.3 + hourTasks.length * 0.25`、month 模式的 `base = 18 + total * 2` 等系数无注释说明。
- **根因**：视觉调参后未记录系数的业务含义（或确认为纯视觉参数未标注）。
- **影响**：后续调参或他人接手时无法判断这些数字是业务逻辑还是审美选择。

### 7. 组件目录平铺

- **位置**：`web/src/components/`
- **现象**：所有 8 个组件文件平铺在 components/ 下一层，无子目录结构。
- **影响**：后续添加更多视图组件时目录会快速膨胀，缺乏组织。

## 改进方案

按推荐实施顺序排列。

| Phase | 改进项 | 优先级 | 依赖 | 说明 |
|-------|--------|--------|------|------|
| 1 | Prisma schema 标注字段分类 + `column`→`section` 重命名 | P0 | 无 | Protocol / DB-only 两层注释；前端 ~10 处引用同步替换 |
| 2 | context-bridge write() → upsert by contextMdHash | P0 | Phase 1 | 新增 upsert，已有覆盖 Protocol 字段；forceWrite 保留供特殊场景 |
| 3 | 抽出统一 api/ 工具模块 | P1 | 无 | 替换 CalendarView 的 fetchCalendarEvents；后续所有请求统一入口 |
| 4 | store 按 domain 拆 slice | P1 | 无 | taskSlice / pomodoroSlice / pushSlice / syncSlice，Zustand slice 模式 |
| 5 | Dashboard computeBars 魔法数字抽配置或加注释 | P2 | 无 | 如确认纯视觉参数则移入 v4config；如有业务含义则加注释 |
| 6 | CalendarView 拆子组件 | P2 | Phase 4 | CalendarHeader / TimelineView / DeadlineTasksStrip |
| 7 | DarkFrostedModal 拆子组件 | P2 | Phase 4 | SubTaskList / PomodoroTimer (独立 hook) |

Phase 1 和 2 合并为一次提交（标注字段归属 + 按归属写 upsert），拆开反而多一道迁移。

Phase 3 和 4 是防止继续熵增，不修不会丢数据但会增加后续维护成本。

Phase 5-7 纯改善开发体验，可在功能迭代间隙逐步完成。

## 设计决策

### 决策 1：Prisma schema 注释作为字段归属的单一真相源

- **方案**：在 `api/prisma/schema.prisma` 的 Task model 中，以 `// === Protocol fields (sync to md) ===` 和 `// === DB-only fields (never touch md) ===` 注释显式划分两层字段。
- **理由**：Prisma schema 是数据库的 source of truth，前端 TS 类型和 API 响应都是它的投影。在源头标注一次，所有下游都能依据此判断。不需要额外文档或配置。
- **基线声明**：此后任何涉及 Task 的读写操作，必须依据字段归属注释决定操作范围。新增字段时必须明确归属并同步更新注释。

### 决策 2：context-bridge 不再执行全量删建

- **方案**：write() 改为 `upsert by contextMdHash`——不存在的 entry 新增，存在的只更新 Protocol 字段，不碰 DB 专属字段和关联。
- **理由**：Task 表已承载课程绑定、番茄钟统计、灵感关联等 DB 专属数据，全量删建会导致这些数据静默丢失。upsert 策略保留 DB 层数据完整性，同时保持 md 协议字段的同步能力。
- **基线声明**：Protocol 字段可由 md 同步覆盖；DB 专属字段和关联永不因 md 操作而变更。

### 决策 3：`column` → `section` 三层命名统一

- **方案**：Prisma schema 字段 `column` 重命名为 `section`；前端 store 和组件中所有引用同步替换。Supabase 端执行列重命名。
- **理由**：当前三层命名不一致——md 协议用 `section`、Prisma 用 `column`、前端用 `column`。统一为 `section`（md 协议的 `## 项目待办` / `## 个人待办` 分区概念）后，三层命名完全对齐，grep 不会遗漏。
- **基线声明**：数据层字段名优先对齐协议层语义，而非视图层布局概念。避免视图层命名泄露到数据层。

### 决策 4：v4config 保持构建时静态 import

- **方案**：不改为运行时 `fetch()`。维持 Vite 静态 `import` JSON 的当前做法。
- **理由**：对个人工具而言，参数随代码一起提交并由 Git 追溯，比"随时改随时生效"更有价值。参数变更应当是可审计、可回滚的。
- **基线声明**：视觉参数属于代码库资产，和业务代码一起受版本控制。

## 遗留项

- **组件目录重组**：待组件拆分（Phase 6-7）完成后一并处理，避免两次移动文件。
- **测试覆盖**：当前代码库无系统测试，但本次讨论聚焦架构对齐，测试策略留待后续专项讨论。

