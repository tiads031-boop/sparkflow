# Phase 09 — Course 模块：课表、笔记看板、事件追踪

> **创建时间**: 2026-05-28 | **最后更新**: 2026-06-03（从 BLUEPRINT §十 提取） | **状态**: 🚧 部分实施中

---

## 一、背景与设计原则

SparkFlow 引入课程模块时，需避免与现有任务体系冲突：

1. **课程数据不入 md 协议**：周期性 ICS 事件不适合写入 markdown
2. **课程是 CalendarEvent 的子集**：CalendarEvent 表扩展 `courseId` + `isOverride` 字段
3. **任务是课程的附属**：Task 表扩展 `courseId`，一个课程可关联多个待办
4. **课程详情页是核心入口**：每门课一个详情页（CourseDetailView）
5. **调课 ≠ 换课**：调课改单个事件（`isOverride: true`），换课改元数据后批量更新非覆盖事件

---

## 二、高校记 → SparkFlow 功能映射

| 高校记模块 | SparkFlow 对应 | 复用/新建 |
|---|---|---|
| 课程表（首页双栏） | CalendarView 时间线课程块 | 复用 CalendarView，混入 course events |
| 日程 Todo | Task（已有 startTime + dueDate） | 复用 Task，增加 courseId |
| 打卡 Todo | Task subtasks / 独立 checkin | 复用 Task + notes 子任务 |
| 课程备忘（Memo Kanban） | **CourseNote 看板** | 新建模型 + 新建视图 |
| 长期任务 | 现有 Task + Dashboard 统计 | 复用，扩展进度字段 |
| 事件追踪 | CalendarEvent eventType 扩展 | 复用 CalendarEvent |
| 周回顾 | CalendarView 周视图 + 聚合面板 | 复用，扩展周视图 |
| 提醒面板 | Dashboard 今日概览 + Push 通知 | 复用 Dashboard |
| 课表编辑器 | **ScheduleEditor 组件** | 新建组件 |

---

## 三、数据模型（Prisma Schema，已完成迁移）

```prisma
model Course {
  id        String   @id @default(uuid())
  userId    String
  name      String
  teacher   String?
  room      String?
  color     String   @default("#b0a8db")
  icsUid    String?  @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  events    CalendarEvent[]
  tasks     Task[]
  notes     CourseNote[]
  @@index([userId])
}

model CourseNote {
  id        String   @id @default(uuid())
  userId    String
  courseId  String
  body      String   @db.Text
  pinned    Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  @@index([userId, courseId])
}

// Task 扩展: courseId? → Course?
// CalendarEvent 扩展: courseId? + isOverride Boolean @default(false)
```

---

## 四、实施阶段

### 子阶段 9.1 — 后端基础设施 ✅

| 任务 | 状态 | 说明 |
|---|---|---|
| Prisma Schema 迁移（Course + CourseNote + 外键） | ✅ | 2026-05-28 完成 |
| NestJS Course API（CRUD + 实例 + 笔记 + 换课） | ✅ | controller + service + module，TS 零错误 |
| ICS 导入脚本（node-ical + prisma 直写） | ✅ | `scripts/import-courses.js` + 配置文件 |
| CalendarView 课程事件渲染 | ✅ | 虚线边框 + 课程色半透明背景 + "课程" badge |
| CourseDetailView 交互原型 | ✅ | `docs/prototypes/sparkflow-course-detail-prototype.html` |

### 子阶段 9.2 — 课程详情页正式版 🚧

| 任务 | 状态 | 说明 |
|---|---|---|
| CourseDetailView 正式组件 | 🚧 | 原型已评审，待正式实现 |
| 调课/换课编辑功能 | 🚧 | 调课标记 isOverride，换课批量更新 |
| 实例列表按周排列 | 🚧 | 学期 startDate 计算周数 |

### 子阶段 9.3 — 任务关联课程 ⬜

| 任务 | 状态 | 说明 |
|---|---|---|
| Task 表 courseId 已就绪 | ✅ | Schema 已有 |
| DarkFrostedModal 课程选择器 | ⬜ | 创建/编辑表单新增下拉选择 |
| TasksView/BoardView 按课程筛选 | ⬜ | 课程名作为标签展示在 TaskCard 上 |
| Dashboard 今日课程区块 | ⬜ | 今日概览混入课程信息 |

### 子阶段 9.4 — 课程笔记看板 ⬜

| 任务 | 状态 | 说明 |
|---|---|---|
| CourseNotesView 组件 | ⬜ | 左侧课程 sidebar + 右侧 swipe board |
| 笔记卡片 CRUD | ⬜ | 创建/编辑/删除/置顶 |
| API 端点 | ⬜ | GET/POST/PATCH/DELETE /course-notes |

### 子阶段 9.5 — 课表编辑器 + 学期管理 ⬜

| 任务 | 状态 | 说明 |
|---|---|---|
| ScheduleEditor 组件 | ⬜ | 7×N 网格，点击编辑课程 |
| 时间段设置面板 | ⬜ | 增删改节次、起止时间 |
| 单双周过滤 | ⬜ | 课程排课支持 |

### 子阶段 9.6 — 事件追踪 ⬜

| 任务 | 状态 | 说明 |
|---|---|---|
| CalendarEvent.eventType 扩展 | ⬜ | 新增 exam/cert/contest/other |
| EventsView 组件 | ⬜ | 分类列表 + 倒计时 + 筛选 |
