# SparkFlow 后转型期架构改进方案

> 2026-05-29 · 基于 [post-md-transition-audit.md](./2026-05-29-post-md-transition-audit.md) 审计发现
> 参与：hanako (总体方案 + 前端架构改造) / yun (后端 P0 审计) / zero (前端 P1 审计)
> 状态：方案完成，store 拆分已落地，待执行 P0/P1/P2 代码修改

---

## 一、改进全景图

```
                    ┌──────────────────────────────────────┐
                    │         P0: 数据完整性修复            │
                    │  Schema标注 + column→section + upsert │
                    │         (2h, 高风险, 必须做)          │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────┴───────────────────────┐
                    │         P1: 架构熵增控制              │
                    │   api/工具模块 + store domain拆分     │
                    │         (4h, 中风险, 强烈建议)         │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────┴───────────────────────┐
                    │         P2: 开发体验改善              │
                    │  Dashboard魔法数字 + 组件拆分 + 目录重组│
                    │         (6h, 低风险, 渐进完成)         │
                    └──────────────────────────────────────┘
```

三层的递进关系：P0 不修会丢数据，P1 不修会持续熵增，P2 不修会拖慢迭代速度。

---

## 二、P0：数据完整性修复

### 2.1 Task 模型字段归属标注 (0.5h)

**当前状态**：`api/prisma/schema.prisma` 的 Task 模型中，Protocol 字段和 DB 专属字段混排，无分类提示。

**改进方案**：在 Task model 中以注释分隔两区。

```prisma
model Task {
  // ════════════════════════════════════════════════════
  // Protocol fields (sync to md, upsert 覆盖)
  // ════════════════════════════════════════════════════
  id              String    @id @default(uuid())
  userId          String
  title           String
  description     String?
  status          String    @default("todo")
  priority        String    @default("medium")
  section         String?   @default("personal")  // 'project' | 'personal'
  project         String?
  notes           Json?     @default("[]")
  dueDate         DateTime?
  contextMdHash   String?

  // ════════════════════════════════════════════════════
  // DB-only fields (never touched by md sync)
  // ════════════════════════════════════════════════════
  inspirationId   String?   @unique
  estimatedMinutes Int?
  scheduledStart  DateTime?
  scheduledEnd    DateTime?
  tags            String[]
  aiFeasibility   Json?
  courseId        String?
  createdAt       DateTime  @default(now())
  completedAt     DateTime?
  updatedAt       DateTime  @updatedAt

  // relations...
}
```

**影响范围**：
- `api/src/context-bridge/context-bridge.service.ts`：read/write/forceWrite 都已按 Protocol/DB 分层处理，仅需同步字段名
- `web/src/store/appStore.ts`：`entriesToTasks`/`tasksToEntries` 映射函数中的 `column`→`section`
- 前端所有组件的 `task.column` 引用

### 2.2 `column` → `section` 三层命名统一 (0.5h)

**当前状态**：

| 层级 | 字段名 | 语义 |
|------|--------|------|
| md 协议 | `section` | `## 项目待办` / `## 个人待办` |
| Prisma | `column` | 同上 |
| 前端 TS | `column` | 同上 |

**改进方案**：统一为 `section`。

**具体步骤**：

1. **Prisma schema**：`column` → `section`，生成 migration
2. **Supabase**：执行 migration（`ALTER TABLE tasks RENAME COLUMN "column" TO "section"`）
3. **后端 context-bridge.service.ts**：
   - `read()`：orderBy `{ section: 'asc' }` + 映射 `section: t.section`
   - `write()`/`forceWrite()`：create data 中 `column: entry.section` → `section: entry.section`
4. **后端 tasks service**：如有直接引用 `column`，同步替换
5. **前端 store appStore.ts**：
   - Task 接口：`column?: 'project' | 'personal'` → `section?: 'project' | 'personal'`
   - `entriesToTasks`：`column: e.section`
   - `tasksToEntries`：`section: t.column || 'personal'` → `section: t.section || 'personal'`
6. **前端组件**：grep `task.column` 全量替换为 `task.section`

**前端受影响文件预估**：
- `BoardView.tsx`：列分组逻辑
- `DarkFrostedModal.tsx`：创建/编辑表单的列选择器
- `DashboardView.tsx`：分栏统计
- `TasksView.tsx`：筛选逻辑
- `CalendarView.tsx`：可能有引用

### 2.3 context-bridge write() → upsert 策略 (1h)

**当前问题**：每次 write 执行 `deleteMany` + 逐个 `create`，Task 表关联的 `pomodoroSessions`、`calendarEvents`、`inspirationId`、`courseId` 全部丢失。

**改进方案**：

```typescript
async write(req: ContextWriteRequest): Promise<ContextWriteResponse | ContextConflictResponse> {
  // Supabase 写入无冲突检测（事务天然原子）
  
  for (const entry of req.entries) {
    const hash = entry.hash || hashTitle(entry.title);
    
    await this.prisma.task.upsert({
      where: { contextMdHash_userId: { contextMdHash: hash, userId: this.defaultUserId } },
      create: {
        userId: this.defaultUserId,
        contextMdHash: hash,
        // Protocol 字段
        title: entry.title,
        description: entry.description,
        status: entry.status,
        priority: entry.priority,
        section: entry.section,
        project: entry.project || null,
        notes: entry.notes as any,
        dueDate: entry.dueDate ? new Date(entry.dueDate) : null,
        tags: [],
      },
      update: {
        // 只更新 Protocol 字段，不碰 DB 专属字段
        title: entry.title,
        description: entry.description,
        status: entry.status,
        priority: entry.priority,
        section: entry.section,
        project: entry.project || null,
        notes: entry.notes as any,
        dueDate: entry.dueDate ? new Date(entry.dueDate) : null,
      },
    });
  }

  // 清理：删除 DB 中已存在但 entries 中不包含的 tasks
  // 注意：只删除没有 DB 专属关联的条目
  const receivedHashes = req.entries.map(e => e.hash || hashTitle(e.title));
  await this.prisma.task.deleteMany({
    where: {
      userId: this.defaultUserId,
      contextMdHash: { notIn: receivedHashes },
      // 安全网：不删除有关联数据的条目
      pomodoroSessions: { none: {} },
      calendarEvents: { none: {} },
      inspirationId: null,
      courseId: null,
    },
  });

  const doc = await this.read();
  return { success: true, entries: doc.entries, mtime: doc.mtime };
}
```

**关键变更**：
1. `deleteMany` 全量清空 → `upsert` 逐条更新 Protocol 字段
2. 新增安全清理：只删除无 DB 关联的条目
3. `forceWrite` 同步改为同一策略

**需要新增的 Prisma 复合唯一索引**：

```prisma
model Task {
  // ...
  @@unique([contextMdHash, userId])  // 新增：upsert 需要
  // ...
}
```

**风险评估**：
- 中风险：涉及数据写入策略的核心变更，需要充分测试
- 缓解：在 Render 部署前先在本地 Supabase 测试环境验证
- 回滚：保留旧 `forceWrite` 方法作为紧急回退

---

## 三、P1：架构熵增控制

### 3.1 抽出统一 api/ 工具模块 (1.5h)

**当前问题**：`CalendarView.tsx`（L18-32）重复声明了 `API_BASE`、`API_KEY`、`DEFAULT_USER_ID` 和 `fetchCalendarEvents`，与 `appStore.ts` 中的 `apiRequest` 完全独立。

**改进方案**：新建 `web/src/api/client.ts`：

```typescript
// web/src/api/client.ts
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '') as string;
const API_KEY = (import.meta.env.VITE_API_KEY || '') as string;
export const DEFAULT_USER_ID = (import.meta.env.VITE_DEFAULT_USER_ID || 'default') as string;

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

export async function apiRequest(path: string, options?: RequestOptions): Promise<Response> {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (API_KEY) headers['X-API-Key'] = API_KEY;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res;
}
```

**迁移步骤**：

1. 新建 `web/src/api/client.ts`
2. `appStore.ts`：删除 L78-81（`API_BASE`/`API_KEY`/`DEFAULT_USER_ID`/`apiRequest`），改为 `import { apiRequest, DEFAULT_USER_ID } from '../api/client'`
3. `CalendarView.tsx`：删除 L18-33（重复的 API 常量 + `fetchCalendarEvents`），改为 `import { apiRequest, DEFAULT_USER_ID } from '../api/client'`
4. 新增 `web/src/api/calendar.ts`（可选，按 domain 拆分）：
   ```typescript
   import { apiRequest, DEFAULT_USER_ID } from './client';
   export function fetchCalendarEvents(start: string, end: string) { ... }
   export function importIcs(file: File) { ... }
   ```

**收益**：
- API 地址/认证方式变更时只需改一处
- 新 feature（如 CourseNote 看板）直接 import，零 boilerplate

### 3.2 store 按 domain 拆 slice (2.5h)

**当前问题**：`web/src/store/appStore.ts`（672 行）单文件承载了 task CRUD、pomodoro、push、sync 全部逻辑。

**改进方案**：Zustand slice 模式拆分。

```typescript
// web/src/store/index.ts — 组合入口
import { create } from 'zustand';
import { createTaskSlice, TaskSlice } from './taskSlice';
import { createPomodoroSlice, PomodoroSlice } from './pomodoroSlice';
import { createPushSlice, PushSlice } from './pushSlice';
import { createSyncSlice, SyncSlice } from './syncSlice';
import { createUISlice, UISlice } from './uiSlice';

export type AppState = TaskSlice & PomodoroSlice & PushSlice & SyncSlice & UISlice;

export const useAppStore = create<AppState>()((...args) => ({
  ...createTaskSlice(...args),
  ...createPomodoroSlice(...args),
  ...createPushSlice(...args),
  ...createSyncSlice(...args),
  ...createUISlice(...args),
}));
```

**各 slice 职责边界**：

| Slice | 负责 | 文件大小预估 |
|-------|------|-------------|
| `taskSlice` | Task CRUD + entriesToTasks/tasksToEntries + addTask/updateTask/deleteTask/toggleSubtask | ~200 行 |
| `pomodoroSlice` | 番茄钟状态 + start/pause/resume/stop/complete/loadStats | ~120 行 |
| `pushSlice` | pushEnabled/pushSupported + subscribe/unsubscribe/checkStatus | ~80 行 |
| `syncSlice` | loadFromApi/syncToApi/pollForUpdates + conflicts + localStorage 缓存 | ~150 行 |
| `uiSlice` | activeTab/chartView/selectedDate/calendarHeaderExpanded | ~50 行 |

**共享类型**：`Task`、`Spark`、`ContextEntry` 等接口抽到 `web/src/types/index.ts`。

**迁移策略**：
1. **不改变任何外部调用者**：`useAppStore` 的 API 签名完全不变
2. 第一步：建目录结构 + 复制代码
3. 第二步：逐 slice 验证功能：task 增删改 → pomodoro 计时 → push 订阅 → 同步
4. 第三步：删除旧 `appStore.ts`

---

## 四、P2：开发体验改善

### 4.1 Dashboard computeBars 魔法数字治理 (0.5h)

**当前问题**：

```typescript
// week 模式的无注释系数
const ratios = [0.6, 0.8, 0.4, 1.0, 0.7, 0.5, 0.3];
// day 模式的堆叠系数
0.3 + hourTasks.length * 0.25
// month 模式的基数
base = 18 + total * 2
```

**改进方案**：

```typescript
/**
 * Dashboard 柱状图视觉参数
 * 
 * week.ratios: 各日柱子的高度系数，模拟一周内任务分布不匀的视觉节奏
 *   Mon=0.6 Tue=0.8 Wed=0.4 Thu=1.0 Fri=0.7 Sat=0.5 Sun=0.3
 * day.stackFactor: 每小时任务数对柱高的影响斜率
 * day.baseOffset: 柱高基准偏移（确保空时段有最小可见高度）
 * month.heightBase: 月视图基础高度
 * month.heightPerTask: 每增加一个任务的增量高度
 */
const VISUAL = {
  week: { ratios: [0.6, 0.8, 0.4, 1.0, 0.7, 0.5, 0.3] },
  day: { stackFactor: 0.25, baseOffset: 0.3 },
  month: { heightBase: 18, heightPerTask: 2 },
} as const;
```

确认这些确实是纯视觉参数后，移入 `v4config.ts`。

### 4.2 CalendarView 拆子组件 (2h)

**当前状态**：1137 行，包含日历头、月历网格、时间线、拖拽 resize、长按创建 ghost、课程混入、截止任务列表。

**拆分方案**：

```
components/
├── calendar/
│   ├── CalendarHeader.tsx    (~120 行) 月历网格 / 单行周历切换
│   ├── TimelineView.tsx      (~400 行) 24h 时间线刻度 + 任务块 + 拖拽 + ghost
│   ├── DeadlineTasksStrip.tsx (~80 行)  截止任务列表 + 快速安排
│   └── CourseEventBlock.tsx  (~50 行)   课程事件渲染块
```

**拆分原则**：
1. `CalendarView.tsx` 保留为 coordinator：状态管理 + 子组件编排
2. 子组件通过 props 接收数据，不直接读 store
3. 回调通过 props 传递，保持在 CalendarView 中定义

### 4.3 DarkFrostedModal 拆子组件 (1.5h)

**当前状态**：895 行，包含表单、3D 卡片动画、番茄钟、子任务管理。

**拆分方案**：

```
components/
├── modal/
│   ├── TaskForm.tsx         (~200 行) 标题/描述/状态/优先级/截止时间 表单
│   ├── SubtaskList.tsx      (~100 行) 子任务列表渲染 + toggle
│   └── PomodoroTimer.tsx    (~150 行) 番茄钟倒计时 + 控制按钮
```

`DarkFrostedModal.tsx` 保留为 coordinator：动画逻辑 + 3D 卡片堆叠 + 子组件编排。

### 4.4 组件目录重组 (0.5h)

**当前状态**：8 个组件文件平铺在 `web/src/components/`。

**目标结构**：

```
components/
├── board/
│   └── BoardView.tsx
├── calendar/
│   ├── CalendarView.tsx
│   ├── CalendarHeader.tsx
│   ├── TimelineView.tsx
│   ├── DeadlineTasksStrip.tsx
│   └── CourseEventBlock.tsx
├── dashboard/
│   └── DashboardView.tsx
├── modal/
│   ├── DarkFrostedModal.tsx
│   ├── TaskForm.tsx
│   ├── SubtaskList.tsx
│   └── PomodoroTimer.tsx
├── sparks/
│   └── SparksView.tsx
├── tasks/
│   ├── TasksView.tsx
│   └── TaskCard.tsx
└── sync/
    └── SyncConflictModal.tsx
```

入口文件集中 re-export，避免外部 import 路径过深：

```typescript
// web/src/components/index.ts
export { BoardView } from './board/BoardView';
export { CalendarView } from './calendar/CalendarView';
export { DarkFrostedModal } from './modal/DarkFrostedModal';
// ...
```

---

## 五、实施排期

### 子代理分工

三个子代理可并行启动（除 Phase 1 需先完成 Schema 标注后 Phase 2 才能接续）：

```
子代理 A: yun (后端审计修复)
├── P0-1: Prisma Schema 标注字段分类 + column→section 迁移
├── P0-2: context-bridge write() → upsert by contextMdHash
└── 产物: migration.sql + 修改后的 context-bridge.service.ts

子代理 B: zero (前端基础设施)
├── P1-1: 新建 web/src/api/client.ts 统一 HTTP 工具
├── P1-2: CalendarView.tsx 替换 fetchCalendarEvents
├── P1-3: appStore.ts 替换 apiRequest 引用
├── P2-1: Dashboard computeBars 魔法数字注释 + v4config 迁移
└── 产物: 新建 api/client.ts + 修改 CalendarView/DashboardView/appStore

子代理 C: hanako 本人 (架构审查 + 整合)
├── P0-3: 前端 column→section 全局替换（与子代理 A 的后端改动对齐）
├── P1-4: store 按 domain 拆 slice（最重量级改动）
├── P2-2: CalendarView 拆子组件
├── P2-3: DarkFrostedModal 拆子组件
├── P2-4: 组件目录重组
└── 产物: store slices + 子组件文件 + 目录结构
```

### 推荐执行顺序

```
Day 1 (今晚):
  ├── 子代理 A + B + C 并行启动
  ├── A 完成 Schema 标注 + column→section migration
  ├── B 完成 api/client.ts + CalendarView 替换
  └── C 完成 column→section 前端替换 + store slice 框架

Day 2:
  ├── A 完成 context-bridge upsert 改造 → C 联调验证
  ├── B 完成 Dashboard 魔法数字治理
  └── C 完成组件拆分 + 目录重组

Day 3:
  └── 端到端测试 + 部署验证
```

---

## 六、风险矩阵

| 改动 | 风险等级 | 最大风险 | 缓解策略 |
|------|---------|---------|---------|
| Prisma column→section | 中 | 前端引用遗漏导致运行时 undefined | 全局 grep + TypeScript 编译检查 |
| context-bridge upsert | 高 | 数据丢失（旧逻辑已清空关联） | 先在 Supabase 测试环境跑 migrate；保留 forceWrite 为回退路径 |
| store split | 低 | 对外 API 兼容 | Zustand slice 模式不改变调用方签名 |
| 组件拆分 | 低 | 导入路径断裂 | barrel export + Vite 构建检查 |
| api/client.ts | 低 | CalendarView 功能退化 | 保持函数签名不变 |

---

## 七、验收标准

1. **P0 验收**：
   - Schema 中有明确的 `Protocol fields` / `DB-only fields` 注释分隔
   - `column` 在 Schema、后端、前端三处统一为 `section`
   - write() 使用 upsert，DB 专属字段（pomodoroSessions/calendarEvents）在写操作后不丢失
   - 创建任务 → 开始番茄钟 → 同步 → 番茄钟记录仍存在

2. **P1 验收**：
   - `CalendarView.tsx` 不再声明 `API_BASE`/`API_KEY`/`DEFAULT_USER_ID`
   - store 文件按 domain 拆分，`useAppStore` 外部 API 签名不变
   - 所有现有功能：task CRUD、pomodoro、push 订阅、同步 不变

3. **P2 验收**：
   - Dashboard `computeBars` 中所有魔法数字有注释说明或移入 v4config
   - CalendarView 拆分为 4 个子组件，原功能不变
   - DarkFrostedModal 拆分为 3 个子组件，3D 动画和表单交互不变
   - 组件目录按 domain 组织，barrel export 对外路径不变

---

## 八、附录 A：后端审计详细发现 (yun)

### A.1 字段归属完整分类

#### Protocol 字段（md 双向同步，upsert 时覆盖）— 9 个

| 字段 | 类型 | 归属理由 |
|------|------|---------|
| `contextMdHash` | `String?` | md 条目唯一标识，协议层与 DB 层的桥接键 |
| `title` | `String` | md 条目标题，parse.ts 解析、render.ts 重建的必经字段 |
| `description` | `String?` | md 条目 `—` 之后的内容 |
| `status` | `String` | md checkbox + `@status:` 元标记 |
| `priority` | `String` | 从 `P0：`/`P1：`/`🔴` 解析 |
| `section` | `String?` | md `## 项目待办` / `## 个人待办` 分区（原名 `column`） |
| `project` | `String?` | md `### project-name` 项目组 |
| `notes` | `Json?` | md `> 备注行` 子任务列表 |
| `dueDate` | `DateTime?` | md `@due:2026-01-15` 元标记 |

#### DB 专属字段 — 10 个

| 字段 | 类型 | 归属理由 |
|------|------|---------|
| `id` | `String (uuid)` | 数据库主键，md 无此概念 |
| `userId` | `String` | 多用户隔离 |
| `inspirationId` | `String?` | 灵感来源绑定 |
| `estimatedMinutes` | `Int?` | 番茄钟预估，UI 功能 |
| `scheduledStart` | `DateTime?` | 日历排期 |
| `scheduledEnd` | `DateTime?` | 日历排期 |
| `tags` | `String[]` | 标签系统 |
| `aiFeasibility` | `Json?` | AI 分析产物 |
| `courseId` | `String?` | 课程绑定 |
| `createdAt/completedAt/updatedAt` | `DateTime` | 审计时间戳 |

#### 受影响的关联对象

| 关联 | 丢失机制 | 影响 |
|------|---------|------|
| `pomodoroSessions` | `onDelete: SetNull` | 番茄钟历史失去归属 |
| `calendarEvents` | `onDelete: SetNull` | 日历事件失去关联 |
| `inspiration` | 默认 Restrict（删 Task 可能报错） | 灵感来源状态丢失 |
| `course` | `onDelete: SetNull` | 课程相关任务列表清空 |

### A.2 column→section 影响清单（27 处引用）

#### 后端 (api/src)：4 处

| # | 文件 | 行号 | 当前 | 替换 |
|---|------|------|------|------|
| 1 | `context-bridge.service.ts` | 37 | `{ column: 'asc' }` | `{ section: 'asc' }` |
| 2 | `context-bridge.service.ts` | 53 | `t.column as 'project' \| 'personal'` | `t.section` |
| 3 | `context-bridge.service.ts` | 89 | `column: entry.section` | `section: entry.section` |
| 4 | `context-bridge.service.ts` | 117 | `column: entry.section` (forceWrite) | `section: entry.section` |

#### 前端 store：3 处

| # | 文件 | 行号 | 当前 | 替换 |
|---|------|------|------|------|
| 5 | `store/appStore.ts` | 23 | `column?: 'project' \| 'personal'` | `section?: ...` |
| 6 | `store/appStore.ts` | 142 | `column: e.section` | `section: e.section` |
| 7 | `store/appStore.ts` | 173 | `section: t.column \|\| 'personal'` | `section: t.section \|\| 'personal'` |

#### 前端组件：20 处

| 文件 | 引用数 | 关键位置 |
|------|--------|---------|
| `DarkFrostedModal.tsx` | 10 | L24 SaveParams 类型, L54 state, L109 init, L133 doSave, L284/L659 列选择器 |
| `BoardView.tsx` | 6 | L53 handleDrop 参数, L73 addTask, L191 colTasks 过滤 |
| `App.tsx` | 3 | L205 解构参数, L226/L241 调用 addTask/updateTask |
| `CalendarView.tsx` | 1 | L648 快速创建 `column: 'personal'` |

**BoardView 中不改的部分**：`columns = ['project', 'personal']`（网格列）、`columnMeta`（UI 元数据）、`dragOverCol`（交互状态）均为 UI 布局变量，与数据字段语义独立。

### A.3 context-bridge upsert 改造要点

1. **必须新增唯一约束**：`@@unique([contextMdHash, userId])`，否则 upsert 的 `where` 无法定位单条记录
2. **上线前需检查重复**：`SELECT contextMdHash, userId, COUNT(*) FROM tasks WHERE contextMdHash IS NOT NULL GROUP BY contextMdHash, userId HAVING COUNT(*) > 1`
3. **清理策略（安全网）**：upsert 后仅删除无 DB 关联的孤立条目
   ```typescript
   await this.prisma.task.deleteMany({
     where: {
       userId: this.defaultUserId,
       contextMdHash: { notIn: receivedHashes },
       pomodoroSessions: { none: {} },
       calendarEvents: { none: {} },
       inspirationId: null,
       courseId: null,
     },
   });
   ```
4. **contextMdHash 为 null 的条目**：不参与 upsert 也不被清理（手动创建的纯 DB 条目），保护不丢

---

## 九、附录 B：前端基础设施审计详细发现 (zero)

### B.1 HTTP 重复清单

| 位置 | 重复内容 | 函数 |
|------|---------|------|
| `appStore.ts` L78-95 | API_BASE + API_KEY + DEFAULT_USER_ID | `apiRequest` |
| `CalendarView.tsx` L18-33 | 同上（完整复制） | `fetchCalendarEvents` |
| `CalendarView.tsx` L717-745 | 同上（ICS 导入用） | 内联 fetch |

**差异分析**：
- `appStore.ts` 的 `apiRequest`：自动 JSON Content-Type，403/Blocked 时 base64 fallback
- `CalendarView.tsx` 的 `fetchCalendarEvents`：手动构建 URL + headers，无 base64 fallback，`!res.ok` 返回空数组
- 两套错误处理策略不一致

### B.2 api/client.ts 改进设计

Zero 提出的增强设计（已实现的 `web/src/api/client.ts` 为基础版，以下为增强选项）：

```typescript
// 增强点 1：自动 JSON 解析
if (contentType?.includes('application/json')) return await res.json();

// 增强点 2：FormData 智能检测
if (!(fetchOptions.body instanceof FormData)) {
  headers['Content-Type'] = 'application/json';
}

// 增强点 3：便捷方法
export const api = {
  get: <T>(path, opts?) => apiRequest<T>(path, { method: 'GET', ...opts }),
  post: <T>(path, body?, opts?) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body), ...opts }),
  put: <T>(path, body?, opts?) => ...,
  delete: <T>(path, opts?) => ...,
};
```

### B.3 Dashboard 魔法数字完整清单（40+ 处）

#### 业务逻辑（2 处）

| 数字 | 位置 | 含义 |
|------|------|------|
| `h += 2` (day) | L42 | 时间段分组步长（每 2 小时一组） |
| `d += 3` (month) | L100 | 月视图分组步长（每 3 天一组） |

#### 视觉参数（38+ 处）

分布在三个视图（day/week/month），每视图有：
- 基础高度参数：`baseHeightEmpty`, `baseHeightBase`, `baseHeightMax`, `totalScale`
- 分段占比：`segmentRatios` (h1/h2/h3)
- 分段边界：`segmentMinHeights`, `segmentMaxHeights`
- week 独有：`dayWeights = [0.6, 0.8, 0.4, 1.0, 0.7, 0.5, 0.3]`（业务含义待确认）

#### v4config 扩展建议

```typescript
export const V4 = {
  // ... 现有字段 ...
  chart: {
    day: { groupStep: 2, baseHeightEmpty: 10, baseHeightBase: 20, ... },
    week: { dayWeights: [0.6, 0.8, ...], baseHeightMax: 60, ... },
    month: { groupStep: 3, baseHeightEmpty: 10, baseHeightBase: 18, ... },
  },
};
```

---

## 十、当前执行状态

| 阶段 | 内容 | 状态 | 负责人 |
|------|------|------|--------|
| P0-1 | Prisma Schema 字段归属标注 | 📋 方案就绪，待执行 | yun 已出详细方案 |
| P0-2 | column→section 三层重命名 | 📋 27 处引用已定位，待执行 | yun 已出详细清单 |
| P0-3 | context-bridge upsert | 📋 方案就绪，含安全网设计 | yun 已出伪代码 |
| P1-1 | api/client.ts 统一 HTTP 模块 | ✅ 已创建基础版 | hanako |
| P1-2 | CalendarView 替换 fetchCalendarEvents | 📋 待执行 | zero 已出迁移步骤 |
| P1-3 | store 按 domain 拆 slice | ✅ 6 个 slice + index + barrel | hanako |
| P2-1 | Dashboard 魔法数字 → v4config | 📋 40+ 处数字已分类，待执行 | zero 已出方案 |
| P2-2 | CalendarView 拆子组件 | 📋 待执行 | hanako |
| P2-3 | DarkFrostedModal 拆子组件 | 📋 待执行 | hanako |
| P2-4 | 组件目录重组 | 📋 待执行 | hanako |

### yun 报告中额外发现的关键 bug

当前 `write()` 的 `deleteMany({ where: { userId } })` 会**无差别删除用户所有 Task**，包括 `contextMdHash` 为 null 的纯 DB 条目（UI 创建的临时任务）。应改为 `{ userId, contextMdHash: { not: null } }`。这是一条独立于 upsert 改造的修复项，即使不改 upsert 也应该先修。
