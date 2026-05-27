# sparkflow — 项目改造/开发蓝图

> 本文档记录项目的所有决策、实施进度和下一步计划。
> **创建时间**: 2026-05-06 | **最后更新**: 2026-05-28 | **状态**: Phase 6 V4 正式版编码中，Dashboard 图表交互 + Calendar 时间线已完成

---

## 一、项目定位

sparkflow 原本是一个灵感记录与任务管理应用，`sparkflow-api`（NestJS + Prisma）和 `sparkflow-web`（React + Vite）骨架已初始化，业务代码尚未编写。

新增定位：**CURRENT_CONTEXT 可视化管理面板**，将 `D:\Mindd\Work\CURRENT_CONTEXT.md` 变为手机端可看、可编辑、可推送提醒的 PWA 看板。AI 与用户平等读写同一 md 文件，sparkflow 作为"增强层"提供可视化、提醒和灵感转化。

---

## 二、决策点总览（已确认）

| # | 决策项 | 确认方案 | 理由 |
|---|---|---|---|
| 1 | 文件协议层 | CURRENT_CONTEXT.md 保持纯文本，不改格式、不塞隐式注释 | md 是 AI 和用户共享的"协议层"，任何一方可独立读写 |
| 2 | md 解析方式 | 正则有限状态机（逐行扫描），不上 AST | 结构简单、依赖零、出错时容易定位 |
| 3 | 条目唯一标识 | 标题标准化后 SHA256 前 8 位（`contextMdHash`） | 不污染 md 文本，数据库关联轻量 |
| 4 | 同步模式 | 前端操作后自动 syncToApi | 避免 md 与数据库分叉，保持单一数据源 |
| 5 | 冲突处理 | mtime 检测 + mkdir 原子锁 + 自动合并 | 覆盖 AI 和用户同时修改的竞态场景 |
| 6 | 增强数据存储 | 数据库 Task 表加 `contextMdHash` 字段，不新建表 | Task 模型已经很完整，只需一个关联字段 |
| 7 | ContextBridge 位置 | sparkflow-api 中的 NestJS 模块 | Node.js 可直接 fs 读写本地文件，前端无法访问 |
| 11 | 认证方案 | API Key Header（X-API-Key）全局 Guard | MVP 阶段单用户工具，无需完整 JWT/OAuth；未配置 API_KEY 时自动跳过（本地开发便利） |
| 12 | CORS 配置 | 环境变量 `CORS_ORIGIN` 驱动，逗号分隔多域名 | 部署后无需改代码即可适配新前端域名 |
| 8 | 推送方案 | Web Push API + @nestjs/schedule 定时检查 | 无需第三方推送服务，PWA 原生支持 |
| 9 | 灵感转化 | Inspiration → Task + 可选写入 CURRENT_CONTEXT.md | 保留 sparkflow 原有灵感功能，桥接到看板 |
| 10 | 部署 | API: Render (Docker + PostgreSQL)，前端: Vercel 静态托管 | 低成本、零运维；Render 免费层支持 Dockerfile 和持久化磁盘 |
| 13 | md 协议扩展 | `@key:value` 元数据标记嵌入 description，支持扩展状态和 dueDate | 不破坏 md 可读性，AI 和人类都能理解 |
| 14 | 状态体系 | md 存 `todo/in-progress/in-review/done/cancelled`，前端映射为 `To do/In progress/In review/Done/Cancelled` | 协议层保持简洁，表现层丰富 |
| 15 | 子任务协议 | notes（备注块）用 `> [x] text` / `> [ ] text` 承载 completed 状态；普通 `> text` 默认 `completed: false` | 不破坏 md 可读性，checkbox 语义自解释；所有备注行统一升格为子任务 |
| 16 | 时间线数据扩展 | `@start:HH:MM` + `@duration:MIN` 元数据标记，不进 DB 纯协议层 | 向后兼容，支持 Calendar 时间线精确渲染时段 |

---

## 三、整体架构

```
sparkflow/
├── api/                  ← NestJS 后端（数据中枢 + ContextBridge）
│   ├── src/
│   │   ├── context-bridge/  ← 新增模块：md 解析/编辑/写回
│   │   ├── tasks/           ← 现有 Task 模块（扩展 contextMdHash 关联）
│   │   ├── inspirations/    ← 现有 Inspiration 模块
│   │   ├── push/            ← 新增模块：Web Push 订阅与推送
│   │   └── schedule/        ← 新增：定时检查截止日期
│   ├── prisma/
│   │   └── schema.prisma    ← Task 加 contextMdHash；PushSubscription 新表
│   └── package.json
├── web/                  ← React PWA 前端（看板 + 编辑）
│   ├── src/
│   │   ├── components/
│   │   │   ├── BoardView/    ← 看板视图：项目待办 / 个人待办 两列
│   │   │   ├── TaskCard/     ← 卡片：标题/优先级/状态/截止日期
│   │   │   ├── TaskEditor/   ← 内联编辑：标题/优先级/描述/截止日期
│   │   │   ├── ConflictDiff/ ← 冲突 diff 视图
│   │   │   └── InspirationPanel/ ← 灵感列表面板 + 转化入口
│   │   ├── hooks/            ← useBoard, useTasks, usePush
│   │   ├── stores/           ← Zustand stores
│   │   └── service-worker/   ← Web Push handling
│   ├── public/
│   │   └── manifest.json     ← PWA manifest
│   └── package.json
└── PROJECT_BLUEPRINT.md  ← 本文档
```

### 数据流

```
CURRENT_CONTEXT.md  ←──fs──→  sparkflow-api/context-bridge
       │                            │
       │ 纯文本协议                   │ REST API (JSON)
       │                            │
     AI (对话读写)              sparkflow-web (PWA)
                                    │
                              PostgreSQL (增强数据)
```

写路径（用户在 PWA 修改）：
```
PWA → POST /api/context/write (mtime + 变更) 
    → API stat md → mtime 一致？ 
    → 是：加锁 → 重写 md → 写 DB → 解锁 → 200 
    → 否：返回 409 + current md + diff → PWA 展示冲突界面
```

---

## 四、实施进度

### Phase 1: ContextBridge 模块（md 解析与读写）

| 任务 | 状态 | 说明 |
|---|---|---|
| md 解析器（逐行扫描 + 状态机） | ✅ | 17 项单元测试全部通过 |
| md 写回器（从 Entry[] 重建 md） | ✅ | 支持往返一致性（parse → render → parse） |
| mtime 冲突检测 + 文件锁 | ✅ | mkdir 原子锁，3000ms 超时 |
| Task.contextMdHash 字段迁移 | ✅ | Prisma migration 已执行 |
| PushSubscription 数据表 | ✅ | 为 Phase 3 推送预留 |
| 单元测试 | ✅ | 解析/写回/合并 17/17 通过 |

### Phase 2: PWA 看板 UI + 前后端联通

| 任务 | 状态 | 说明 |
|---|---|---|
| 可交互原型（调参） | ✅ | 基于 UI修改.txt 的移动端优先设计，TokenFlow 风格 |
| 原型评审 + 导出 JSON | ✅ | 完整页面布局，5 标签页 + 2 个模态层 |
| 正式版 BoardView + TaskCard | ✅ | 两列看板（项目待办 / 个人待办），支持拖拽切换列 |
| 正式版 TaskEditor（内联编辑） | ✅ | DarkFrostedModal 支持创建/编辑任务与灵感 |
| ConflictDiff 冲突视图 | ✅ | SyncConflictModal：diff 展示 + 逐条/批量裁决 |
| PWA manifest + Service Worker | ✅ | manifest.json + 移动端 meta 标签 |
| DashboardView 仪表盘 | ✅ | 统计药丸 + 周度堆叠柱状图 + 今日待办列表 |
| TasksView 任务列表 | ✅ | 状态筛选 + TaskCard 彩色卡片列表 |
| CalendarView 日历 | ✅ | 小日历组件 + 今日事件列表 |
| SparksView 灵感墙 | ✅ | 自由拖拽 + 自动整理 + 散落排版 |
| DarkFrostedModal 专注模式 | ✅ | 3D 卡片堆叠 + 滑动飞出 + 番茄钟 + 子任务管理 |
| 前端 store 接入真实 API | ✅ | Zustand store 添加 loadFromApi / syncToApi，Task <-> ContextEntry 双向映射 |
| ApiKeyGuard 全局认证 | ✅ | `X-API-Key` header 校验，未配置时自动跳过 |
| CORS 环境变量驱动 | ✅ | `CORS_ORIGIN` 支持逗号分隔多域名 |
| ContextBridge 自动创建默认模板 | ✅ | md 文件不存在时自动生成骨架，避免首次部署崩溃 |
| Dockerfile + Render 配置 | ✅ | 多阶段构建，含 Prisma generate 和 migrate deploy |
| vercel.json SPA 回退 | ✅ | 所有路由回退到 index.html，支持 PWA 路由 |

### Phase 3: 推送提醒

| 任务 | 状态 | 说明 |
|---|---|---|
| PushSubscription 数据表 | ✅ | Prisma 模型已存在，client 已重新生成 |
| Web Push API 集成（web-push） | ✅ | PushService：subscribe / unsubscribe / sendNotification |
| @nestjs/schedule 定时任务 | ✅ | 每分钟 cron 扫描 dueDate 未来 30 分钟内的任务 |
| PWA 端订阅/取消订阅 UI | ✅ | Header 铃铛按钮，绿色=已订阅，灰色=未订阅 |
| Service Worker (push 事件 + notificationclick) | ✅ | `public/sw.js`，通知点击打开 PWA |
| 前端 store push 方法 | ✅ | subscribeToPush / unsubscribeFromPush / checkPushStatus |

### Phase 4: 灵感转化

| 任务 | 状态 | 说明 |
|---|---|---|
| InspirationPanel 组件 | ⬜ | 展示用户灵感列表 |
| 转化流程：灵感 → Task + 写入 md | ⬜ | 用户确认后自动生成待办条目 |
| 关联回显：Task 上展示来源 Inspiration | ⬜ | 可选 |

### Phase 5: 部署

| 任务 | 状态 | 说明 |
|---|---|---|
| sparkflow-api 部署 Render | ✅ | `sparkflow-jych.onrender.com`，Docker + Supabase pooler |
| sparkflow-web 部署 Vercel | ✅ | `sparkflow031.vercel.app`，静态 PWA |
| 端到端测试（手机真机） | ✅ | 红米 K70 PWA 安装 → 看板加载 → 任务创建 → 同步持久化 |

### Phase 6: 功能迭代（当前）

| 任务 | 状态 | 说明 |
|---|---|---|
| md 协议扩展：支持多状态和 dueDate | ✅ | `@status:in-progress @due:2026-05-30` 元数据标记 |
| 任务创建编辑器：状态/优先级/截止日期/列选择 | ✅ | DarkFrostedModal 创建模式扩展 |
| Dashboard 柱状图动态化 | ✅ | 基于任务分布计算高度，非硬编码 |
| CalendarView 绑定真实任务 | ✅ | 从 store 读取，显示有 dueDate 的任务 |
| 子任务状态持久化 | ✅ | notes 协议扩展为 `NoteItem[]`（含 completed），前后端映射双向传递 |
| 番茄钟专注时长持久化 | ✅ | `POST /pomodoro` 创建 session；`complete`/`interrupt` 结束；Dashboard stats 实时拉取 |
| **V4 交互原型：Dashboard + Calendar 细化** | ✅ | 原型已交付，含日/周/月切换、柱形图下钻、日历头伸缩、时间线拖拽、参数面板（6 项滑杆 + 导出 JSON） |
| **V4 原型修正：任务列表/灵感墙还原 V3** | ✅ | 任务列表恢复状态筛选 pill + TaskCard 彩色大卡片 + 空状态虚线卡片；灵感墙恢复散落绝对定位 + 整理/灵感按钮 |
| **V4 正式版：Dashboard 日/周/月切换 + 柱状图下钻** | ✅ | 基于 chartView store 状态切换视图，柱状图按 hour/周几/日期段动态计算，点击柱子弹出 DrillSheet 底部弹层显示当期任务列表 |
| **V4 正式版：Calendar 时间线重构 Phase A** | ✅ | 24h 时间线刻度 + 任务块按 startTime/duration 定位 + 当前时间指示线（紫色渐变 + 圆点） |
| **V4 正式版：Calendar 日历头伸缩 Phase B** | ✅ | 展开=月历网格 / 收缩=单行周历，事件日绿点标记，prev/next 导航（月/周） |
| **V4 正式版：Calendar 拖拽 Phase C** | ✅ | Pointer Events 拖拽移动 startTime + 底部 resize 调整 duration，磁吸到 snapMinutes 粒度，拖拽后自动 updateTask 持久化 |
| **决策确认：@start + @duration 协议扩展** | ✅ | 时间线数据模型向后兼容扩展，不进 DB 纯协议层携带 |

---

## 五、同步机制设计（2026-05-06 确认）

### 文件锁：mkdir 原子锁
- 锁路径: `{mdDir}/.CURRENT_CONTEXT.lock/`
- 原理: `fs.mkdirSync` 在文件系统层面是原子操作，目录已存在则抛错
- 超时: 3000ms，每 50ms 重试一次
- 零依赖，纯 Node.js 内置 API

### mtime 冲突检测
- 写入前 `fs.statSync(md).mtimeMs` 比较客户端传入的 `lastKnownMtime`
- mtime 一致: 加锁 → 写回 → 解锁 → 200
- mtime 不一致: 不加锁，返回 409 + `merged` + `conflicts[]`

### 409 冲突响应结构
```json
{
  "conflict": true,
  "merged": [...],
  "conflicts": [
    { "hash": "a1b2c3d4", "userVersion": {...}, "serverVersion": {...}, "fields": ["status"] }
  ],
  "serverMtime": 1683000000000
}
```

### 自动合并规则（按 contextMdHash 做条目级 diff）
| 差异类型 | 处理 |
|---|---|
| 改了不同条目 | 自动合并，不打断用户 |
| 改了同一条目 | 高亮标记冲突，用户逐条裁决 |
| 用户/AI 各自新增条目 | 保留 |
| AI 删除的条目（用户也改了它） | 标记提醒，用户确认 |

### 客户端本地缓存
- PWA 用 `localStorage` 暂存编辑中的数据
- 409 返回后用户可恢复本地缓存版本
- 修改主动权始终在用户手中

---

## 五、技术选型详情

### sparkflow-api（后端）
- **框架**: NestJS 11 + TypeScript 5.7
- **ORM**: Prisma 7.8 + PostgreSQL
- **关键新增库**:
  - `web-push` — Web Push 协议实现
  - `@nestjs/schedule` — 定时任务调度
  - Node.js 内置 `fs` / `crypto` — md 文件读写 / hash 计算

### sparkflow-web（前端）
- **框架**: React 19 + TypeScript 6.0 + Vite 8
- **样式**: Tailwind CSS 4 + PostCSS
- **状态管理**: Zustand 5
- **UI 图标**: lucide-react 1.14
- **日历**: @fullcalendar/react 6.1（现有，可复用于截止日期选择）
- **关键新增库**:
  - 无额外依赖 — 看板组件手写，保持轻量

### 基础设施
- **部署**: Railway/Render（API）+ Vercel（前端）
- **数据库**: PostgreSQL（Railway 内置或 Supabase）
- **文件共享**: CURRENT_CONTEXT.md 存放在 sparkflow-api 运行环境中（通过环境变量 `CONTEXT_MD_PATH` 指向绝对路径）

---

## 六、开发规范

### 原型调参（Phase 2 强制）
1. 先出可交互 HTML 原型（完整页面布局）
2. 关键视觉参数通过滑杆可调
3. 调参完成后导出 JSON 快照
4. 正式版读取 JSON 应用参数
5. 参照 api-quota-monitor 原型的规范（sidebarW、cardGap、ringSize 等参数绑定）

### 代码同步
- 每次方案变更或功能完成后，**必须同步更新本文档**（更新日志 + 实施进度）
- 新增决策写入「决策点总览」
- 发现问题写入「已知问题」

---

## 七、更新日志

### 2026-05-28（V4 正式版：Dashboard + Calendar）
- **Dashboard 图表交互升级**：日/周/月三维度切换（pill 按钮），柱状图按 hour/周几/日期段动态计算分布
- **Dashboard 柱状图下钻**：点击柱子弹出 `DrillSheet` 底部弹层，显示该时段真实任务列表（基于 dueDate/startTime 过滤）
- **Calendar 时间线重构**：基于 V4 params JSON 配置的 24h 时间线（0:00-24:00，`hourHeight: 60px`），按 `startTime` + `duration` 精确定位任务块
- **Calendar 当前时间指示线**：紫色渐变 + 圆点，仅在选中今天时显示，每分钟刷新
- **Calendar 日历头伸缩**：展开=月历网格（7×5/6），收缩=单行周历；事件日绿点标记；prev/next 支持月/周导航
- **Calendar 拖拽交互**：Pointer Events 实现，任务块主体拖拽移动 `startTime`，底部 resize 手柄调整 `duration`，磁吸到 `snapMinutes`（30min）粒度
- **Task 类型扩展**：新增 `startTime?: string`（"HH:MM"）和 `duration?: number`（分钟）字段
- **Store 扩展**：新增 `chartView`、`selectedDate`、`calendarHeaderExpanded` 状态及对应 setter
- **V4 config 模块**：`web/src/v4config.ts` 从 `sparkflow-v4-dashboard-calendar-params.json` 读取所有参数，组件直接引用 `V4.hourHeight` 等常量
- **CSS 增强**：`.animate-slide-up`（底部弹层）、`.task-block.dragging`（拖拽阴影）、`.task-block:hover`（悬浮效果）
- **App.tsx 适配**：`CalendarView` 传入 `onTaskClick` 回调，双击任务块打开 `DarkFrostedModal`
- **构建验证**：TypeScript 无错误，Vite 生产构建通过（1745 modules）

### 2026-05-27（部署完成 + 功能迭代）
- **部署上线**：Render 后端 `sparkflow-jych.onrender.com` + Vercel 前端 `sparkflow031.vercel.app`
- **部署踩坑全修复**：Prisma 7 配置、dotenv 缺失、Dockerfile COPY、NestJS dist 路径、class-validator、Supabase IPv6 pooler、Vercel Hobby commit 作者限制、ApiKeyGuard OPTIONS 拦截，共 9 项
- **md 协议扩展**：`@status:in-progress @due:2026-05-30` 元数据标记嵌入 description，支持 5 种状态 + 截止日期
- **任务创建编辑器**：DarkFrostedModal 创建模式新增状态选择（5 种）、优先级选择（P0/P1/P2）、列选择（项目/个人）、截止日期 date picker
- **Dashboard 柱状图动态化**：基于任务分布计算 7 天柱状图高度，替代硬编码
- **CalendarView 真实数据**：从 store 读取有 dueDate 的任务，替代硬编码 demoEvents
- **状态映射完整**：`entriesToTasks` / `tasksToEntries` 支持 `todo/in-progress/in-review/done/cancelled` 双向映射
- **演示数据清理**：移除 `initialTasks`，API 失败时显示空状态而非假数据
- **后端 parse.ts**：新增 `extractMetaTags` 辅助函数，从 description 末尾提取 `@key:value` 元数据
- **后端 render.ts**：`entryToMdLine` 写回时自动附加 `@status:xxx @due:yyyy-mm-dd`

### 2026-05-27（Phase 3 Web Push 通知编码完成）
- **后端 PushModule 创建**：`push.service.ts`（subscribe / unsubscribe / notifyDueTasks / getVapidPublicKey）+ `push.controller.ts`（3 端点）+ `push.module.ts`
- **依赖安装**：`web-push` + `@types/web-push` + `@nestjs/schedule`
- **VAPID 密钥生成**：写入 `.env`，`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
- **定时扫描**：`@Cron('*/1 * * * *')` 每分钟检测 dueDate 在未来 30 分钟内的未完成任务，推送给所有订阅用户
- **订阅失效自动清理**：推送返回 410/404 时自动删除 PushSubscription 记录
- **前端 Service Worker**：`public/sw.js` 处理 push 事件（显示通知）+ notificationclick（打开 PWA）+ 基础离线缓存
- **前端 store**：`subscribeToPush`（请求权限 → 获取公钥 → pushManager.subscribe → POST 后端）、`unsubscribeFromPush`、`checkPushStatus`
- **前端 UI**：Header 铃铛按钮，`pushSupported` 检测浏览器支持，绿色/灰色切换订阅状态
- **SW 注册**：`main.tsx` 中自动注册 `/sw.js`
- **待部署**：本地编译通过（api + web），需更新 Render 环境变量（VAPID 三变量）+ 重新部署验证

### 2026-05-27（番茄钟持久化 + Dashboard 专注统计）
- **后端 PomodoroModule 补全**：
  - `pomodoro.controller.ts` 新增 `POST /pomodoro/:id/interrupt` 端点
  - `pomodoro.service.ts` 新增 `interrupt(id)` 方法，标记 session 为 `interrupted`
  - `main.ts` 启动时自动 `upsert` 默认用户（`DEFAULT_USER_ID` 或 `'default'`），解决单用户 MVP 无外键记录导致的创建失败
- **前端 store 接入后端 API**：
  - `startPomodoro`：调用 `POST /pomodoro` 创建 session，保存返回的 `id` 为 `activeSessionId`
  - `completePomodoro`：调用 `POST /:id/complete`，随后 `loadPomodoroStats()` 刷新统计
  - `stopPomodoro`：调用 `POST /:id/interrupt`，清理前端状态
  - `loadPomodoroStats`：从 `GET /pomodoro/stats?userId=default` 拉取 `todayCount` + `totalMinutes`
- **DashboardView 专注统计卡片**：新增"今日番茄"和"专注分钟"双指标卡片，数据从后端实时拉取
- **DarkFrostedModal 专注卡片改造**：
  - 移除本地 `timerRef` 和独立 `useEffect`，倒计时由 App.tsx 全局 `tick()` 驱动
  - Play/Pause/Stop/Complete 按钮全部接入 store 方法
  - 未运行时可点击 Play 创建 session；运行中可 Pause/Resume；点击 Check 完成并刷新 stats

### 2026-05-27（子任务协议扩展 + DarkFrostedModal 子任务编辑）
- **子任务 md 协议扩展**：`ContextEntry.notes` 从 `string[]` 升级为 `NoteItem[]`（`{ text: string; completed: boolean }`）
  - `parse.ts` 解析 `> [x] text` / `> [ ] text` / `> text` 三种格式，19 项单元测试全部通过
  - `render.ts` 写回时自动附加 `[x]` / `[ ]` 标记，保持往返一致性
  - `merge.ts` 适配对象数组比较，冲突检测正常
- **前端子任务状态双向传递**：`entriesToTasks` / `tasksToEntries` 完整传递 completed，刷新后子任务勾选状态不丢失
- **DarkFrostedModal 子任务卡片增强**：
  - 勾选切换：本地乐观更新 + 即时同步（调用 `toggleSubtask`）
  - 添加子任务：输入框 + Enter/Plus 按钮，即时插入本地列表
  - 删除子任务：hover 显示 Trash 图标，即时移除
  - 保存机制：编辑卡片和子任务卡片底部均显示保存按钮，`handleSave` 传回完整 `subtasks` 列表
  - 卡片文案："在此添加、勾选或删除子任务，点击保存提交"

### 2026-05-27（3D 卡片编辑模式 + 元数据解析修复）
- **DarkFrostedModal 恢复 3D 卡片堆叠**：点击已有任务进入 3D 卡片模式，左右滑动切换
  - **卡片 1（编辑）**：可修改状态、优先级、分类、截止日期，底部有删除按钮（点两次确认）
  - **卡片 2（专注）**：25 分钟番茄钟，Play/Pause/Reset
  - **卡片 3（子任务）**：查看子任务列表（completed 状态前端展示）
  - **滑动交互**：卡片空白区域左右滑动切换，卡片内按钮/输入框不触发滑动（`isInteractive` 检测）
- **新建任务保持独立表单**：点 `+` 按钮仍为简单表单，不进入 3D 卡片
- **元数据解析修复**：`extractMetaTags` 从完整 content 提取（而非仅 description），修复了无 `—` 分隔符时元数据丢失的问题
- **App.tsx 适配**：`handleSaveItem` 支持 `id` 参数，有 id 时调用 `updateTask` 而非 `addTask`

### 2026-05-27（Redmi K70 设备适配）
- **调参 JSON 更新**：`sparkflow-v3-params.json` 从原 419px 基准等比缩放至红米K70标准 viewport（393×852，3200×1440 物理分辨率）
  - `phoneWidth`: 419px → 393px, `phoneHeight`: 850px → 852px
  - `cardGap`: 8px → 7px, `boardColGap`: 13px → 12px
  - `sparkMinSize`: 120 → 112, `sparkMaxSize`: 190 → 176
  - `cardRadius`: 保持 16px（圆角不随宽度线性缩放）
  - 缩放比: 333/359 ≈ 0.928（基于 phone 内框可用宽度）
  - 新增 `deviceTarget`, `viewportCSS`, `physicalResolution`, `scaleRatio` 元数据
- **原型 CSS 默认值同步**：`:root` 变量和 `resetParams()` 改为 K70 基准（`--phone-w: 393px`, `--phone-h: 852px`, `--spark-min-size: 140`, `--spark-max-size: 175`, `--board-col-gap: 11px`, `--card-gap: 14px`）

### 2026-05-27（V3 完整交互原型）
- **可交互 HTML 原型 V3**：基于 UI修改.txt 的 3 项修改点 + 蓝图功能，生成完整原型
  - `docs/prototypes/sparkflow-v3-full-prototype.html`，移动端优先，全页面布局
  - 5 标签页：仪表盘 / 任务列表 / 看板（项目待办+个人待办）/ 日历 / 灵感墙
  - DarkFrostedModal 专注模式：3D 卡片堆叠 + 指针滑动飞出 + 日程/番茄钟/子任务 3 张卡片
  - SyncConflictModal：mtime 冲突 diff 视图 + 逐条裁决（保留我的/采用服务器/自动合并）
  - SparksView 灵感墙：散落排版 + 自由拖拽 + 自动瀑布流整理
  - BoardView 看板：HTML5 Drag & Drop 跨列拖拽 + 快速添加输入框 + 子任务进度条
  - 调参面板：11 项滑杆（卡片圆角/间距/手机尺寸/灵感尺寸/看板间距/4 项色值）+ 重置 + 导出 JSON
  - 导出 JSON 按钮：生成 `sparkflow-v3-params.json`，含全部 CSS 变量快照，正式版可直接读取
  - Toast 反馈系统、同步状态模拟（3.5s 后触发冲突提示）

### 2026-05-27（方案 A MVP 部署准备完成）
- **前后端联通**: 前端 store 接入真实 API
  - Zustand 添加 `loadFromApi()`、`syncToApi()`、`entries` 协议层状态
  - `ContextEntry[]` <-> `Task[]` 双向映射（含 priority/colorType/section/column 转换）
  - 409 冲突捕获 + `conflicts[]` 喂给 `SyncConflictModal`
  - Header 徽章动态显示：同步中 / 已同步 / 同步异常
  - App.tsx mount 时自动拉取数据
- **最小认证**: `ApiKeyGuard` 全局生效，`X-API-Key` header 校验；未配置 `API_KEY` 时自动跳过（本地开发零摩擦）
- **CORS 环境变量化**: `CORS_ORIGIN` 支持逗号分隔多域名，生产/开发无缝切换
- **ContextBridge 鲁棒性**: `ensureFile()` 自动创建默认 md 模板，避免首次部署文件缺失崩溃
- **部署配置**: `api/Dockerfile`（多阶段构建 + Prisma migrate deploy）、`web/vercel.json`（SPA 回退 + 缓存策略）
- **部署手册**: `docs/DEPLOY.md` 含 Supabase/Render/Vercel 完整步骤、环境变量对照表、故障排查

### 2026-05-07
- **Phase 2 UI 完成**: PWA 看板 UI 全部组件已实现
  - 手机框架式主布局 + 5 标签页底部导航（仪表盘/任务/看板/日历/灵感）
  - BoardView：两列看板（项目待办/个人待办），支持拖拽换列 + 快速添加
  - TaskCard：彩色卡片（深灰/绿/紫），显示标题/状态/优先级/子任务进度
  - DarkFrostedModal：深色沉浸式弹窗，3D 卡片堆叠 + 滑动飞出交互，内建番茄钟
  - SyncConflictModal：版本冲突逐条裁决 + 批量采用
  - SparksView：灵感卡片自由拖拽 + 自动瀑布流整理
  - PWA manifest.json + Apple meta 标签已就位
  - Zustand store 统一数据模型（Task/Spark/Board/Pomodoro）
  - 构建通过（Vite 8 + TypeScript 6.0）

### 2026-05-27（V4 交互原型：Dashboard + Calendar 细化）
- **V4 可交互原型交付**: `docs/prototypes/sparkflow-v4-dashboard-calendar-prototype.html`
  - Dashboard：日/周/月三态柱状图切换（本地状态），点击柱子弹出底部任务明细弹层
  - Calendar：顶部日历头伸缩（展开=月历网格 / 收缩=单行周历），时间线主体（7:00-23:00），任务块按 startTime+duration 定位，当前时间指示线
  - 拖拽交互：任务块主体拖拽移动开始时间（磁吸到 snapMinutes 粒度），底部 resize 手柄调整时长
  - 参数面板：6 项滑杆（hourHeight / timelineStart / timelineEnd / snapMinutes / taskBlockRadius）+ 日历头默认展开开关 + 图表默认视图选择 + 导出 JSON + 重置
  - 双击任务块打开 DarkFrostedModal 风格编辑弹窗（模拟正式版交互）
  - 任务列表：保留 V3 正式版设计（状态筛选 pill、彩色 TaskCard、空状态虚线卡片、右上角计数）
  - 灵感墙：保留 V3 正式版设计（散落绝对定位卡片、Zap 图标、三点菜单、整理/灵感按钮）
  - 完整 5 标签页导航，保持现有 #cae393 / #b0a8db / #242424 配色和 rounded-[2rem] 卡片体系
- **原型验证**: Dashboard 周视图柱状图正常，Calendar 月历展开/收缩正常，时间线刻度与任务块定位正确，任务列表/灵感墙 V3 设计已还原

### 2026-05-06
- **项目蓝图创建**: 确立 sparkflow 新定位（CURRENT_CONTEXT 可视化管理面板）
- **方案细致化**: 确认 10 项关键决策，覆盖解析规范、同步机制、数据模型、推送、灵感转化、部署
- **Phase 1 完成**: ContextBridge 模块（解析器 + 写回器 + 锁 + 合并 + 控制器），17 项单测全通过
- **Prisma 扩展**: Task 加 contextMdHash + PushSubscription 表，migration 已执行
- **Phase 2 原型完成**: stage2-board-prototype.html，移动端优先，3 页面（看板/灵感/设置），13 项可调参数
- **状态**: Phase 1 ✅，Phase 2 原型阶段

---

## 八、已知问题与修复记录

| 时间 | 问题 | 修复 |
|---|---|---|
| 2026-05-27 | **部署踩坑 1**：Prisma 7 `datasource.url` 不再支持 schema 文件 | URL 移至 `prisma.config.ts`，`process.env["DATABASE_URL"]` 读取 |
| 2026-05-27 | **部署踩坑 2**：`dotenv` 包未安装，`prisma.config.ts` 导入失败 | 移除 `dotenv/config` 导入，依赖 Node.js 原生 `process.env` |
| 2026-05-27 | **部署踩坑 3**：Dockerfile 生产阶段缺少 `prisma.config.ts` | `COPY prisma.config.ts ./` 加入 Dockerfile |
| 2026-05-27 | **部署踩坑 4**：`prisma` 包在 devDependencies，生产镜像被过滤 | 移至 `dependencies` |
| 2026-05-27 | **部署踩坑 5**：NestJS 构建产物在 `dist/src/` 下，非 `dist/` | Dockerfile CMD 改为 `node dist/src/main` |
| 2026-05-27 | **部署踩坑 6**：`class-validator`/`class-transformer` 缺失 | 安装到 `dependencies` |
| 2026-05-27 | **部署踩坑 7**：Supabase IPv6-only，Render IPv4-only | 改用 Supabase shared pooler (5432 端口) |
| 2026-05-27 | **部署踩坑 8**：Vercel Hobby commit 作者限制 | Git 配置 `user.email` 改为 Vercel 账号邮箱 |
| 2026-05-27 | **部署踩坑 9**：`ApiKeyGuard` 拦截 CORS OPTIONS 预检 | Guard 中 `request.method === 'OPTIONS'` 直接放行 |
| 2026-05-27 | `context-bridge.controller.ts` 类型导入导致 `TS1272` | 接口类型改用 `import type` 导入 |
| 2026-05-27 | `CalendarView.tsx` 存在未使用导入导致构建失败 | 移除未使用导入 |
| 2026-05-27 | `Task` 接口缺少 `description` 字段，映射时 TS 报错 | 接口添加 `description?: string` |
| 2026-05-27 | 首次部署时 `CURRENT_CONTEXT.md` 不存在导致 API 500 | `ensureFile()` 改为自动创建默认模板 |
| 2026-05-27 | 状态映射不完整，只支持 `Done` ↔ `done` | 扩展为 5 种状态双向映射 |
| 2026-05-27 | `dueDate` 未在 md 协议中定义，无法保存 | description 末尾嵌入 `@due:YYYY-MM-DD` 元数据标记 |
| 2026-05-27 | 演示任务（initialTasks）在 API 失败时仍显示 | 移除 `initialTasks`，API 失败时显示空状态 |
| 2026-05-27 | Dashboard 周度柱状图为硬编码数据 | 基于任务分布动态计算各柱高度 |
| 2026-05-27 | 元数据标记 `@status:xxx` 显示在任务标题中 | `extractMetaTags` 改为从完整 content 提取，而非仅 description |
| 2026-05-27 | `In progress` 状态刷新后变回 `To do` | 修复 `parseEntryLine`：元数据提取移至 title/description 分割之前 |
| 2026-05-27 | DarkFrostedModal view 模式无法编辑任务 | 恢复 3D 卡片堆叠，卡片 1 内嵌完整编辑表单 |
| 2026-05-27 | 删除按钮直接删除无确认 | 编辑卡片底部删除按钮改为"点两次确认"机制 |

---

## 九、下一步计划

| 优先级 | 任务 | 说明 | 状态 |
|---|---|---|---|
| P0 | 部署上线（Render + Vercel） | 前后端已部署，域名已确认 | ✅ |
| P0 | BoardView 拖拽换列持久化 | 拖拽换列后 `updateTask({column})` → `syncToApi` → `tasksToEntries` 映射 `section` → `renderMd` 按分区写回 | ✅ |
| P1 | 子任务状态持久化 | notes 协议扩展为 `NoteItem[]`（含 completed），解析/渲染/合并/前后端映射全链路打通 | ✅ |
| P1 | 番茄钟专注时长持久化 | `POST /pomodoro` 创建 session；`complete`/`interrupt` 结束；Dashboard stats 实时拉取 | ✅ |
| P1 | Dashboard 图表交互：日/周/月切换 + 柱形图点击下钻 | 前端本地状态 + 三维度数据计算 + 底部 DrillSheet 弹层；**正式版已完成** | ✅ |
| P1 | Calendar 时间线重构 Phase A：静态时间线渲染 | hourHeight/snapMinutes 参数化，任务块按 startTime+duration 定位，当前时间指示线；**正式版已完成** | ✅ |
| P1 | Calendar 日历头伸缩 Phase B | 月历 ↔ 单行周历切换，选日过滤时间线，事件日绿点标记；**正式版已完成** | ✅ |
| P1 | Calendar 拖拽 Phase C | Pointer Events 垂直拖拽移动开始时间，底部边缘 resize 时长，磁吸粒度；**正式版已完成** | ✅ |
| P2 | Phase 3：Web Push 通知集成 | web-push + @nestjs/schedule 定时检查截止日期 | 🚧 编码完成，待部署 |
| P2 | Phase 4：灵感转化流程完善 | Inspiration → Task + 写入 CURRENT_CONTEXT.md | ⬜ |
| P2 | Render 休眠缓解 | 免费层 15 分钟休眠，首次请求 30s+ 延迟 | ⬜ |
| P2 | md 协议扩展：@start、@duration 元数据标记 | 后端 parse/render 支持 @start:HH:MM @duration:MIN 协议标签，前端 entriesToTasks/tasksToEntries 双向映射 | ⬜ |
| P3 | 多用户 / 正式 OAuth | 当前 API Key 方案仅适合单用户 | ⬜ |
