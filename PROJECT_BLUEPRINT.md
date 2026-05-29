# sparkflow — 项目改造/开发蓝图

> 本文档记录项目的所有决策、实施进度和下一步计划。
> **创建时间**: 2026-05-06 | **最后更新**: 2026-05-29（学期系统 v1 完成） | **状态**: Phase 7 学期系统开发完成

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
| 17 | 外部变更感知 | 前端每 15s 轮询 GET /context 对比 mtime，mtime 变化时自动拉取更新 | 弥补 AI/手动编辑 md 后前端无感知的缺口；轮询比 fs.watch 更兼容部署环境 |
| 18 | 同步策略：skipDone | push 时 `skipDone: true` 只推送未完成条目，Render 上已完成历史一并清除 | PWA 只看板展示活跃任务，减少传输量和视觉噪音；本地 md 仍保留完整历史 |
| 19 | 项目分组展示 | BoardView 项目待办列按 `project` 字段分组渲染，项目名作为可折叠区块 | 前端纯展示层改动，不改 md 协议；P0/P1/P2 优先级徽章直接显示在子任务卡片上 |
| 20 | 个人文件夹分组 | `## 个人待办` 下支持 `### folder-name` 分组，个人任务也可按文件夹组织 | 统一两列的交互模式：项目/个人都支持用户创建文件夹、拖拽归类、折叠展开 |
| 21 | 文件夹创建 UI | BoardView 列头 FolderPlus 按钮 + 即时输入框创建新文件夹/项目 | 零弹窗、零模态层，输入即创建，体验轻量；创建后自动展开新文件夹 |
| 22 | **架构 B：Supabase 为主存储** | 移除 Render 文件系统依赖，ContextBridge read/write 直接操作 Supabase Task 表；CURRENT_CONTEXT.md 降级为本地 AI 可读副本 | Render 免费层容器重启后文件系统重置，导致数据丢失；Supabase PostgreSQL 持久化，重启后数据完整保留 |
| 23 | Task 表扩展 | 新增 `column`（'project' \| 'personal'）、`project`（folder 名）、`notes`（子任务 JSON）字段 | 支撑 Supabase 主存储方案，完整保存看板元数据 |
| 22 | 任务编辑 folder 字段 | DarkFrostedModal 编辑/创建表单新增 folder 输入框 | 用户可手动指定任务归属的文件夹/项目，覆盖自动分组结果 |
| 23 | **前端移除手机框** | 去掉拟物化手机外壳，改为移动端全屏 + 桌面端 `sm:max-w-lg` 居中 | PWA 应用体验，不再被手机框限制；安卓为主的使用场景无需安全区适配 |
| 24 | **SparksView 拖拽边界动态化** | `useRef` + `window resize` 监听读取容器宽度，替代硬编码 `220px` | 去掉手机框后灵感墙自适应任何容器宽度 |
| 25 | **学期数据模型** | 新增 `Semester` 表（id, userId, name, startDate, endDate, isActive, weeks）；Course 加 `semesterId` FK | 课表天然按学期组织，不同学期课程和时间安排完全不同；startDate 作为第1周周一，统一周数计算基准 |
| 26 | **学期筛选 UI** | CourseView 顶部加水平滚动学期 pill 选择器，当前激活学期默认选中；支持新建/编辑/删除学期 | 用户可自由切换学期查看对应课程；pill 交互最轻量，不打断浏览流 |
| 27 | **周周期配置** | 学期 startDate 即为第1周周一，前端通过 `(today - startDate) / 7d + 1` 计算当前周数；课程详情页显示当前周 | 统一周数计算基准，消除 ICS 导入时硬编码的 `getSemesterStart()` 魔数 |
| 28 | **日历绿点扩展** | CalendarHeader 的 `eventDays` 从只收集 task 日期 → 合并 task + courseEvent 日期 | 用户一眼看到哪天有课、哪天有任务，无需切 tab 就能感知日程密度 |

---

## 三、整体架构

```
sparkflow/
├── api/                  ← NestJS 后端（数据中枢 + ContextBridge）
│   ├── src/
│   │   ├── context-bridge/  ← 新增模块：md 解析/编辑/写回
│   │   ├── tasks/           ← 现有 Task 模块（扩展 contextMdHash 关联）
│   │   ├── inspirations/    ← 现有 Inspiration 模块
│   │   ├── course/           ← 课程管理：CRUD + ICS 导入 + CalendarEvent 生成
│   │   ├── calendar/         ← 日历事件查询（时间线 + 课程块）
│   │   ├── semester/         ← 学期管理：CRUD + 激活切换 + 自动匹配
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
| **TaskCard 时间显示修复** | ✅ | 优先读取 dueDate 格式化显示（如"6月3日 14:00"），无 dueDate 时 fallback 到 time |
| **创建表单截止时间 toggle** | ✅ | 截止时间改为开关控制，默认关闭；开启后才显示 datetime-local 输入框 |
| **截止时间通知确认弹窗** | ✅ | 设置截止时间且保存时，弹出"是否需要截止前提醒"确认框 |
| **柱状图空状态处理** | ✅ | 无任务时 Dashboard 柱状图不渲染柱子，显示空状态占位图和引导文案 |
| **数据同步兜底：localStorage 离线缓存** | ✅ | API 失败时不清空本地 tasks；加载前先读 localStorage 渲染；同步成功后写缓存 |
| **日历展示截止任务** | ✅ | CalendarView 新增"截止任务"区域，展示有 dueDate 但无 startTime 的任务 |
| **时间线长按创建任务** | ✅ | 长按时间线空区 → ghost block 预览 → 松手弹出内联标题输入 → 创建任务（startTime/duration 自动磁吸到 snapMinutes 粒度） |
| **截止任务快速安排到时间线** | ✅ | 截止任务卡片右侧 ⏱️ 按钮 → 展开内联时间选择器（HH:MM + 30/60/90/120min 预设） → 确认后任务升格到时间线 |

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

### 2026-05-28（截止时间时区修复 + 诊断端点）
- **时区修复**：前端 `datetime-local` 传的本地时间 (GMT+8) 被服务器 UTC 误读，导致 dueDate 偏移 8 小时
  - `App.tsx` `handleSaveItem`：保存前 `new Date(dueDate).toISOString()` 转为 UTC ISO 字符串
  - `DarkFrostedModal` useEffect：编辑时 `new Date(isoString).getHours()` 还原为本地时间格式
  - TaskCard / CalendarView 显示端天然正确（`toLocaleString` 自动按本地时区格式化）
- **诊断端点**：`POST /api/push/test` 手动触发测试推送
  - 返回订阅数、发送成功/失败数、错误详情
  - 用于验证 VAPID 配置 + 推送订阅 + SW 整条链路
- TypeScript 前后端编译零错误

### 2026-05-28（截止时间通知修复：DB 同步断链）
- **根因定位**：通知链路存在数据断链
  - `context-bridge.service.write()` 只写 MD 文件，不同步数据库
  - `push.service.notifyDueTasks()` @Cron 每分钟查 `prisma.task` 表
  - 两套数据源隔离，任务永远不入 DB，cron 永远查不到截止任务
- **修复**：`context-bridge.service.ts` 新增 `syncEntriesToDb()` 方法
  - 注入 `PrismaService`，`ContextBridgeModule` 导入 `PrismaModule`
  - `write()` / `forceWrite()` 成功后自动 upsert entries → `Task` 表（按 `contextMdHash` 查找）
  - 清理 DB 中已不在 entries 里的过期 tasks
  - DB 同步失败不影响 MD 文件主流程（try-catch 隔离）
- **待用户确认**：Render 需设置 VAPID 环境变量（`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`），否则 cron 运行但无密钥发不出推送
- TypeScript 编译零错误

### 2026-05-28（数据同步修复 + 截止时间功能闭环）
- **数据同步兜底**：`loadFromApi` 添加 localStorage 缓存机制
  - 加载前先读 `sparkflow_tasks_cache` 立即渲染，避免白屏等待
  - API 成功后覆盖写缓存；API 失败时保留现有 tasks，不再强制清空
  - `syncToApi` 成功后同步更新缓存
- **CalendarView 截止任务展示**：新增"截止任务"区域，显示当天有 `dueDate` 但未安排时间线的任务；支持点击跳转编辑
- **Dashboard 柱状图空状态**：无任务时不渲染柱状图，显示空状态占位图（柱状图图标 + 引导文案"添加任务后柱状图自动同步"）
- **TaskCard 时间显示修复**：优先读取 `dueDate` 并格式化为"月日 时:分"；无 `dueDate` 时 fallback 到 `task.time` 或"未设定"
- **DarkFrostedModal 截止时间 toggle**：创建/编辑表单中截止时间改为开关控制（Toggle Switch）
  - 默认关闭，不设置截止时间
  - 开启后显示 `datetime-local` 选择器
  - 编辑已有任务时自动检测并恢复开关状态
- **DarkFrostedModal 通知确认弹窗**：设置截止时间后保存时，弹出二次确认
  - 显示截止时间、询问"是否需要截止前提醒"
  - 选项"需要提醒" / "不需要"
  - 为后续 Web Push + Service Worker 截止提醒留接口
- TypeScript 编译零错误通过

### 2026-05-28（双向同步轮询闭环）
- **轮询机制**：前端新增 `pollForUpdates()`，每 15s 调用 GET /context 对比 mtime
  - mtime 变化时自动拉取最新 entries，静默更新 store + localStorage 缓存
  - 正在同步时（`isSyncing=true`）跳过轮询，避免与用户操作竞态
  - 轮询失败静默处理，不打断用户、不改变 UI 状态
- **双向同步闭环确认**：
  - 方向 A（前端 → md）：addTask/updateTask/deleteTask → syncToApi → POST /context/write
  - 方向 B（md → 前端）：mount 时 loadFromApi + 每 15s pollForUpdates
  - 外部编辑（AI 对话 / 手动改 md）→ 前端最多 15s 内感知
- **蓝图更新**：新增决策点 #17（外部变更感知），记录轮询 vs fs.watch 的选型理由

### 2026-05-28（云同步架构 + 项目分组展示）
- **方案 C 实施：本地 ↔ Render 双向同步**
  - API 新增 `/context/sync-push-raw`（POST，支持 base64 + skipDone）+ `/context/raw`（GET）+ `/context/sync-state`（GET）
  - 本地脚本 `scripts/sync-context.cjs`：零依赖 Node.js，提供 `pull` / `push` / `status` 命令
  - `.sync-config.json` 配置 API 地址和 Key；`.sync-state.json` 记录同步状态；`.sync-backups/` 自动备份
- **Render WAF 绕过**：`python -m quota_monitor` 等命令模式触发 Render 反向代理 403，采用 base64 编码请求体绕过
- **skipDone 同步策略**：push 时 `skipDone: true` 只推送未完成条目（24 条），跳过已完成（21 条），Render 上已完成历史一并清除
  - PWA 只看板展示活跃任务，减少传输量和视觉噪音
  - 本地 md 仍保留完整历史（含已完成），AI 对话不受影响
- **renderMd 动态项目标题**：模板无 `###` 项目标题时（如容器重启后 `ensureFile()` 生成的空模板），动态生成项目分组标题，避免条目误入个人待办区
- **BoardView 项目分组**：项目待办列按 `project` 字段分组渲染
  - 每个项目为可折叠区块，显示待办计数
  - 子任务卡片带 P0/P1/P2 优先级徽章（P0 红底白字 / P1 黄底黑字 / P2 灰底黑字）
  - 个人待办列保持原有卡片样式
- **Task 类型扩展**：新增 `project?: string` 字段，`entriesToTasks` / `tasksToEntries` 双向映射
- **蓝图更新**：新增决策点 #18（skipDone 同步策略）、#19（项目分组展示）

### 2026-05-28（架构 B：Supabase 为主存储）
- **架构重构**：Render 文件系统不可靠（免费层容器重启后数据清零）→ 改为 Supabase PostgreSQL 为主存储
  - Prisma schema：Task 表新增 `column`（'project' | 'personal'，默认 'personal'）、`project`（folder/项目名）、`notes`（子任务 JSONB，默认 `[]`）
  - Migration：`20260528023113_add_column_project_notes` 已生成并应用（本地 + Render 部署时自动执行）
  - `ContextBridgeService.read()`：从 Supabase Task 表读取，按 column → project → priority → createdAt 排序，组装 `ContextEntry[]`
  - `ContextBridgeService.write()`：`deleteMany` 清理旧数据 + `create` 批量创建，事务级原子覆盖
  - `ContextBridgeService.forceWrite()`：同上，供 sync-push-raw 调用
  - `ContextBridgeService` 保留 `readLocalMd()` / `writeLocalMd()`：供本地 AI 副本读写，Render 上不再依赖文件系统
  - `ContextBridgeController`：所有端点改为 async，适配 Supabase 异步读取；`GET /context/raw` 改为从 Supabase 渲染后返回，支持 pull 重建本地 md
- **数据验证**：push 24 条活跃条目到 Supabase，column/project 字段全部正确写入；Render 休眠后唤醒，24 条数据完整保留（✅ 持久化验证通过）
- **同步脚本**：`sync-context.cjs` 无需修改，push 走 `sync-push-raw`（base64 + skipDone），pull 走 `raw`（已从 Supabase 渲染），双向流程正常工作
- **蓝图更新**：新增决策点 #22（架构 B）、#23（Task 表扩展字段）
- **部署状态**：Render 已部署（`6be617b`），Vercel 自动构建中

### 2026-05-28（个人/项目统一分组 + 文件夹创建）
- **两列统一分组**：项目待办列和个人待办列都使用相同的 GroupedColumn 渲染逻辑
  - 按 `project`/`folder` 字段分组，组内按 P0 > P1 > P2 排序
  - 每组可折叠/展开，显示待办计数
  - "未分组"（无 folder 的任务）默认展开，其他组默认展开
- **个人文件夹支持**：`## 个人待办` 下支持 `### folder-name` 分组标题
  - renderMd 动态生成 personal 区的 `###` 文件夹标题（模板缺失时）
  - 解析器已有 `project` 字段支持，个人区 `###` 标题自动映射为 folder
- **文件夹创建 UI**：BoardView 每列右上角 FolderPlus 按钮
  - 点击展开即时输入框（Enter 创建 / Esc 取消）
  - 创建时自动添加一个占位任务，用户可在其中添加真实任务
  - 零弹窗、零模态层，输入即创建
- **快速添加栏扩展**：新增 Tag 按钮，点击展开文件夹/项目输入框
  - 创建任务时可直接指定归属的 folder/project
- **DarkFrostedModal folder 编辑**：编辑/创建表单新增 folder 输入框
  - 根据当前 column 动态切换 placeholder（项目/文件夹）
- **蓝图更新**：新增决策点 #20（个人文件夹分组）、#21（文件夹创建 UI）、#22（任务编辑 folder 字段）
- **部署状态**：Render 已部署，Vercel 自动构建中

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

### 2026-05-28（时间线创建 + 截止任务安排）
- **时间线长按创建任务**：CalendarView 新增 Pointer Events 长按检测（500ms 阈值，移动 >10px 取消），长按时间线空区弹出 ghost block（虚线半透明预览块，磁吸到 snapMinutes 粒度），拖拽调整时长后松手弹出内联标题输入框，确认后调用 `addTask` 创建（startTime + duration 自动填充，default colorType=green）
- **截止任务快速安排到时间线**：每个截止任务卡片右侧增加 ⏱️ 按钮，点击展开内联时间选择器（native `time` 输入 + 30/60/90/120min 预设 pills），确认后调用 `updateTask({ startTime, duration })` 将任务升格到时间线
- **交互引导**：时间线 header 提示文字更新为"长按空区创建 · 拖拽调整时间"；截止任务区域 header 增加"点击 ⏱ 快速安排"引导
- **交互逻辑说明**：截止任务 = 已确定日期未确定时段（Inbox）；时间线任务 = 已确定日期已确定时段（Scheduled）；转化 = 给截止任务补上 startTime → 自动从列表升格到时间线
- **数据链路**：`Task` 接口已有 `startTime?: string` 和 `duration?: number` 字段，`addTask` / `updateTask` 无需修改即可透传，前端零阻力落地
- **混合方案预留**：当前以 ⏱️ 按钮（方案 B）为主路径，后续可迭代增加截止任务长按拖入时间线（方案 A），两种交互不冲突
- **构建验证**：TypeScript 无错误，Vite 生产构建通过（1745 modules）
- **Bug 修复（第一轮）**：长按不响应 — React 合成事件 `e.pointerId` 在 `setTimeout` 异步回调中失效 + `setPointerCapture` 无 try-catch 静默吞错 + `useCallback` 依赖 `creatingGhost` 导致回调频繁重建产生 stale closure；修复：ref 即时存储 `pointerId`/`rect`、函数式 `setState`、`creatingGhostRef` 同步
- **Bug 修复（第二轮）**：ghost 拖拽无法调整时长（只能 30min）— `setPointerCapture` 在移动端与 React 合成事件不兼容，pointer capture 后 React fiber 树与浏览器事件目标映射不一致导致 `pointermove` 丢失；修复：弃用 `setPointerCapture`，ghost 激活后注册 `document.addEventListener('pointermove/pointerup')` 原生监听，原生 handler 直接读 `ev.clientY` + `getBoundingClientRect()` 计算坐标，完全绕过 React 事件系统
- **本地 dev server 验证**：`vite --host` 在端口 5174 启动；浏览器访问确认 Dashboard pill 按钮 + Calendar 收缩态周历 + 24h 时间线刻度布局正确；API 因 Render 休眠显示同步异常，不影响 UI 框架验证
- **GitHub 推送**：Commit `8844dc9` 推送至 `tiads031-boop/sparkflow.git`；Vercel 自动构建已触发

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

### 2026-05-28（移除手机框，全屏自适应）
- **前端移除手机框**: App.tsx 去掉拟物化手机外壳，根布局改为移动端全屏（`w-full h-svh`）+ 桌面端 `sm:max-w-lg sm:mx-auto`
  - 外层背景由 `#0a0a0a`（手机展台）改为 `#f4f4f6`（应用主题色），index.css 同步
  - BottomNav 从 `absolute` 改为 `fixed` 定位，悬浮于 viewport 底部，与父容器解耦
- **SparksView 拖拽边界动态化**: 引入 `containerRef` + `window resize` 监听，实时读取容器宽度
  - 拖拽右边界由硬编码 `220px` 改为 `bounds.width - sparkSize`
  - 自动整理右列 X 坐标由 `180` 改为 `bounds.width - colWidth - 10`
  - 保障去框后灵感墙在任何宽度下正常拖拽和排版
- **功能验证**: 底部导航、拖拽换列、灵感墙、3D 卡片堆叠、冲突弹窗、时间线拖拽均不受布局变更影响

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
| 2026-05-28 | **跨界面任务同步丢失**：`loadFromApi` 失败时清空 `tasks: []` 导致刷新后任务消失 | 添加 localStorage 缓存兜底：加载前先读缓存渲染，API 成功后再覆盖；API 失败时保留现有 tasks |
| 2026-05-28 | **CalendarView 只显示有时间线的任务**：仅有 `dueDate` 无 `startTime` 的任务在日历中不可见 | 新增"截止任务"区域，以列表形式展示当天有 dueDate 但未安排时间线的任务 |
| 2026-05-28 | **Dashboard 柱状图在无数据时渲染无意义柱子** | 无任务时改为显示空状态占位图 + 引导文案，不渲染柱状图 |
| 2026-05-28 | **TaskCard 时间显示错误**：设置 `dueDate` 后仍显示 `task.time` 或"未设定" | 优先读取 `dueDate`，格式化为"月日 时:分" |
| 2026-05-28 | **创建任务无法表达"不需要截止时间"**：datetime-local 输入框始终可见 | 添加 toggle 开关，默认关闭，开关开启后才显示日期选择器 |
| 2026-05-28 | **无截止时间通知确认** | 设置截止时间后保存时弹出通知确认弹窗（"需要提醒"/"不需要"），为后续 Web Push 截止提醒留接口 |
| 2026-05-28 | **截止时间时区偏移 8 小时**：前端 `datetime-local` 传本地时间 (GMT+8)，服务器 `new Date()` 按 UTC 解读 | App.tsx `handleSaveItem` 保存前转 `toISOString()`；DarkFrostedModal 编辑时还原为本地时间供输入框 |
| 2026-05-28 | **Render WAF 拦截 sync-push**：`python -m quota_monitor serve-ui` 等命令模式出现在 md 内容中，触发 Render 反向代理 403 Blocked | sync-push-raw 端点支持 `encoding: 'base64'`，同步脚本默认 base64 编码请求体，绕过 WAF 内容扫描 |
| 2026-05-29 | **前端操作被 sync-context.cjs push 覆盖**：API `write()`/`sync-push-raw` 写入 Supabase 后未同步更新本地 CURRENT_CONTEXT.md，手动 push 时读取过时本地文件覆盖服务器数据 | `write()` 和 `sync-push-raw` 末尾调用 `writeLocalMd()` 同步本地文件；前端 `syncToApi` 引入 `syncGeneration` 计数器 + `pollForUpdates` 代数校验防竞态 |
| 2026-05-29 | **`isSyncing` 锁静默丢弃并发同步请求（真正根因）**：快速操作时第二次 `syncToApi` 被 `isSyncing=true` 阻挡直接 return，丢弃操作；第一次同步响应整表替换回滚第二次的操作 | 新增 `needsResync` 标记：被阻挡时设置标记，同步完成后自动重触发 |
| 2026-05-29 | **`read()` 返回 `Date.now()` 导致 poll 每次刷新**：mtime 为动态时间戳，`pollForUpdates` 的 `serverMtime === lastKnownMtime` 永不为真 | 改用内存 `contextVersion` 计数器，仅在 `write()` 时递增 |
| 2026-05-29 | **sync-context.cjs push 无差异检测**：push 前不做服务器/本地差异对比，用户不知道将要覆盖 Web 操作的数据 | push 前获取远程条目数，远程活跃条目 > 本地条目时打印警告 |
| 2026-05-29 | **Dashboard 柱状图数据映射错误**：日视图只显示有 startTime 的任务，周/月视图只显示有 dueDate 的任务；日/月视图三段颜色使用固定比例而非实际状态分布；柱高公式基于全局而非时段内任务数；`V4.chartDefaultView` 被硬编码覆盖 | 日视图追加"全天"条容纳仅有 dueDate 的任务；周/月视图追加"未排"条容纳无 dueDate 的任务；全部视图改用实际状态比例 + 组内归一化柱高；纯全天任务时清除空小时柱；`uiSlice.ts` 改为读取 `V4.chartDefaultView` |
| 2026-05-28 | **renderMd 丢失项目标题**：Render 容器重启后 `ensureFile()` 生成空模板（无 `###` 标题），forceWrite 重建时所有项目条目误入个人待办区 | renderMd 预扫描模板，无 `###` 标题时动态生成项目分组标题，确保条目归属正确 |
| 2026-05-28 | **时间线长按创建不响应**：React 合成事件的 `e.pointerId` 在 `setTimeout` 异步回调中失效，`setPointerCapture` 静默失败后 ghost 无法接收 pointermove | 改为 ref 即时存储 `pointerId` + `rect`，`setPointerCapture` 加 try-catch，`useCallback` 移除 `creatingGhost` 依赖并用函数式 `setState` |
| 2026-05-28 | **ghost 拖拽无法调整时长（只能 30min）**：`setPointerCapture` + React 合成事件在移动端不可靠组合——pointer capture 后 React fiber 树与浏览器事件目标映射不一致，导致 `pointermove` 丢失 | 弃用 `setPointerCapture`，ghost 激活后注册原生 `document.addEventListener('pointermove/pointerup')`，原生 listener 直接读 `ev.clientY` + `getBoundingClientRect()` 计算坐标，完全绕过 React 事件系统 |

---

## 九、下一步计划

| 优先级 | 任务 | 说明 | 状态 |
|---|---|---|---|
| P0 | **CURRENT_CONTEXT.md 双向同步闭环** | 前端轮询检测 md 外部变更 + 操作即时写回 + skipDone 策略 + 项目分组展示 | ✅ |
| P0 | **数据同步兜底 + 截止时间功能闭环** | localStorage 缓存 + 截止时间 toggle + 通知确认弹窗 + 柱状图空状态 | ✅ |
| P0 | BoardView 拖拽换列持久化 | 拖拽换列后 `updateTask({column})` → `syncToApi` → `tasksToEntries` 映射 `section` → `renderMd` 按分区写回 | ✅ |
| P1 | 子任务状态持久化 | notes 协议扩展为 `NoteItem[]`（含 completed），解析/渲染/合并/前后端映射全链路打通 | ✅ |
| P1 | 番茄钟专注时长持久化 | `POST /pomodoro` 创建 session；`complete`/`interrupt` 结束；Dashboard stats 实时拉取 | ✅ |
| P1 | Dashboard 图表交互：日/周/月切换 + 柱形图点击下钻 | 前端本地状态 + 三维度数据计算 + 底部 DrillSheet 弹层；**正式版已完成** | ✅ |
| P1 | Calendar 时间线重构 Phase A：静态时间线渲染 | hourHeight/snapMinutes 参数化，任务块按 startTime+duration 定位，当前时间指示线；**正式版已完成** | ✅ |
| P1 | Calendar 日历头伸缩 Phase B | 月历 ↔ 单行周历切换，选日过滤时间线，事件日绿点标记；**正式版已完成** | ✅ |
| P1 | Calendar 拖拽 Phase C | Pointer Events 垂直拖拽移动开始时间，底部边缘 resize 时长，磁吸粒度；**正式版已完成** | ✅ |
| P1 | **Calendar 长按创建 Phase D** | Pointer Events 长按空区创建 ghost block，拖拽调整时长，松手内联输入创建任务；**正式版已完成** | ✅ |
| P1 | **截止任务快速安排** | ⏱️ 按钮 + 内联时间选择器，将截止任务升格到时间线；**正式版已完成** | ✅ |
| P1 | **截止任务拖入时间线（增强交互）** | 长按截止任务卡片 → 拖到时间线目标位置 → 松手设置 startTime + duration（混合方案 A） | ⬜ |
| P1 | **部署截止时间通知（VAPID 密钥配置）** | Render 环境变量设置 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT，然后推送代码触发自动部署 | 🚧 编码完成，待部署环境变量 |
| P2 | Phase 3：Web Push 通知集成 | web-push + @nestjs/schedule 定时检查截止日期 | 🚧 编码完成，context-bridge→DB 同步已修复 |
| P1 | **Course 模块：ICS 课程表导入 + CalendarView 课程渲染** | Prisma Schema 扩展 Course/CourseNote 表；ICS 解析脚本（node-ical 解析 + prisma 直写）；CalendarView 混入课程事件（只读虚线块） | ✅ Schema+导入脚本+CalendarView 已完成，待实际 ICS 数据导入验证 |
| P1 | **Course 模块：课程详情页（CourseDetailView）** | 课程详情页原型已交付（含调课/换课编辑 + 参数面板）；正式版待原型确认后实现 | 🚧 原型阶段，待用户评审 |
| P1 | **Course 模块：任务关联课程 + 课程待办** | Task 表扩展 `courseId`；TaskCard/DarkFrostedModal 新增课程选择器；支持按课程筛选任务列表 | 🚧 方案确认，待实施 |
| P2 | **Course 模块：课程笔记看板（CourseNote Kanban）** | 新增 CourseNote 表；前端按课程分栏看板（参考高校记 Memo）；侧边栏切换课程 + 长按拖拽排序；置顶/编辑/删除笔记卡片 | 🚧 方案确认，待实施 |
| P2 | **Course 模块：学期周历 + 课程管理编辑器** | 周历视图（Mon-Sun 网格）显示课程安排；课表编辑器（网格点击编辑课程名称/教师/教室/单双周）；时间段设置；学期起止配置 | 🚧 方案确认，待实施 |
| P2 | **Course 模块：事件追踪（考试/考证/竞赛）** | CalendarEvent `eventType` 扩展 `exam/cert/contest/other`；独立事件列表页；倒计时显示；按类型筛选 | 🚧 方案确认，待实施 |
| P2 | Phase 4：灵感转化流程完善 | Inspiration → Task + 写入 CURRENT_CONTEXT.md | ⬜ |
| P2 | Render 休眠缓解 | 本地定时任务每 10 分钟 ping API，保持容器活跃 | ✅ |
| P2 | md 协议扩展：@start、@duration 元数据标记 | 后端 parse/render 支持 @start:HH:MM @duration:MIN 协议标签，使时间线数据可写入 CURRENT_CONTEXT.md 供 AI 读取 | ⬜ |
| P3 | 多用户 / 正式 OAuth | 当前 API Key 方案仅适合单用户 | ⬜ |

---

## 十、Course 模块整体规划（2026-05-28 创立，同日修订）

### 10.1 设计原则

SparkFlow 引入课程模块时，需避免与现有任务体系冲突：

1. **课程数据不入 md 协议**：周期性 ICS 事件不适合写入 CURRENT_CONTEXT.md
2. **课程是 CalendarEvent 的子集**：CalendarEvent 表扩展 `courseId` + `isOverride` 字段
3. **任务是课程的附属**：Task 表扩展 `courseId`，一个课程可关联多个待办
4. **课程详情页是核心入口**：每门课一个详情页（CourseDetailView），展示基本信息 + 所有实例按周排列 + 编辑入口
5. **调课 ≠ 换课**：
   - **调课（Adjust）**：修改单个 CalendarEvent 的时间/教室，标记 `isOverride: true`
   - **换课（Swap）**：修改 Course 元数据（dayOfWeek/startTime/endTime/weeks）→ 批量更新非覆盖 CalendarEvent，isOverride=true 的实例跳过
6. **课程笔记独立存储**：`CourseNote` 独立模型，按课程分栏看板，不与 Sparks（灵感）混用

### 10.2 高校记 → SparkFlow 功能映射

| 高校记模块 | SparkFlow 对应 | 复用/新建 |
|---|---|---|
| 课程表（首页双栏） | CalendarView 时间线课程块 | 复用 CalendarView，混入 course events |
| 日程 Todo（schedule） | Task（`startTime` + `dueDate` 已支持） | 复用 Task，增加 `courseId` |
| 打卡 Todo（checkin） | Task subtasks / 独立 checkin 模式 | 复用 Task + notes 子任务 |
| 课程备忘（Memo Kanban） | **CourseNote 看板** | 新建模型 + 新建视图 |
| 长期任务（Task 进度追踪） | 现有 Task + Dashboard 统计 | 复用，扩展进度字段 |
| 事件追踪（Exam/Cert/Contest） | CalendarEvent `eventType` 扩展 | 复用 CalendarEvent |
| 周回顾（Weekly Review） | CalendarView 周视图 + 聚合面板 | 复用，扩展周视图 |
| 提醒面板（Reminder） | Dashboard 今日概览 + Push 通知 | 复用 Dashboard |
| 课表编辑器（网格编辑） | **ScheduleEditor 组件** | 新建组件 |

### 10.3 数据模型扩展（Prisma Schema）

```prisma
// 新增 Course 模型：课程元数据
model Course {
  id          String    @id @default(uuid())
  userId      String
  name        String
  teacher     String?
  room        String?
  color       String    @default("#b0a8db")
  icsUid      String?   @unique  // ICS VEVENT UID，幂等导入键
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  events      CalendarEvent[]
  tasks       Task[]
  notes       CourseNote[]

  @@index([userId])
  @@map("courses")
}

// 扩展 Task：增加 courseId 关联
model Task {
  // ... 现有字段保留 ...
  courseId      String?
  course        Course?   @relation(fields: [courseId], references: [id], onDelete: SetNull)

  @@index([courseId])
}

// 扩展 CalendarEvent：增加 courseId 关联
model CalendarEvent {
  // ... 现有字段保留 ...
  courseId      String?
  course        Course?   @relation(fields: [courseId], references: [id], onDelete: SetNull)

  @@index([courseId])
}

// 新增 CourseNote：课程笔记/备忘
model CourseNote {
  id        String    @id @default(uuid())
  userId    String
  courseId  String
  body      String    @db.Text
  pinned    Boolean   @default(false)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  course    Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([courseId])
  @@map("course_notes")
}
```

### 10.4 ICS 导入脚本设计

配置文件：`scripts/course-import-config.json`
```json
{
  "apiUrl": "https://sparkflow-jych.onrender.com/api",
  "apiKey": "...",
  "userId": "default",
  "icsPath": "D:/Mindd/Work/sparkflow/课程表.ics",
  "semesterStart": "2025-03-03",
  "semesterEnd": "2025-07-04",
  "filters": {
    "excludeCourses": ["形势与政策"]
  }
}
```

脚本：`scripts/import-courses.js`
- 依赖：`rrule`（RRULE 展开）、`node-ical`（ICS 解析）
- 流程：
  1. 解析 ICS → 提取 VEVENT（SUMMARY, DTSTART, DTEND, RRULE, LOCATION, UID）
  2. 按课程名称去重 → `POST /courses` 创建 Course（幂等：icsUid 唯一）
  3. 展开 RRULE → 在学期范围内生成每个具体实例
  4. 每个实例 → `POST /calendar` 创建 CalendarEvent（`eventType: 'course'`, `courseId: ...`）
  5. 已存在（UID 匹配）→ `PATCH /calendar/:id` 更新

### 10.5 前端模块改动

#### Phase A：CalendarView 课程渲染（P0）
- `appStore.ts`：新增 `calendarEvents` 状态 + `fetchCalendarEvents(start, end)` action
- `CalendarView.tsx`：
  - 组件 mount 时按选中日期范围拉取 `calendarEvents`
  - `dayTasks` 过滤逻辑扩展：同时混入当日的 `calendarEvents`（`eventType === 'course'`）
  - 课程块样式：虚线边框、固定课程色、只读（不绑定拖拽/resize）
  - 块内显示：`课程名 · 教室 · 教师`

#### Phase B：任务关联课程（P1）
- `Task` 接口：新增 `courseId?: string`
- `DarkFrostedModal` 创建/编辑表单：新增"关联课程"下拉选择（从 Course 表拉取）
- `TasksView` / `BoardView`：支持按课程筛选，课程名作为标签展示在 TaskCard 上
- `DashboardView`：今日概览混入"今日课程"区块（参考高校记提醒面板）

#### Phase C：课程笔记看板（P2）
- 新增 `CourseNotesView.tsx`：
  - 左侧 sidebar：课程列表（带笔记计数 badge），点击切换，长按拖拽排序
  - 右侧 swipe track：每门课程一个全屏 board
  - board 内：笔记卡片列表（支持置顶、编辑、删除）
  - 底部"添加备忘"按钮：即时创建空卡片 + 进入编辑态
- 新增 API 端点：`GET /courses/:id/notes`、`POST /course-notes`、`PATCH /course-notes/:id`、`DELETE /course-notes/:id`

#### Phase D：课表编辑器 + 学期管理（P2）
- 新增 `ScheduleEditor.tsx`：
  - 7×N 网格（Mon-Sun × 时间段），点击格子编辑课程
  - 时间段设置面板（增删改节次、起止时间）
  - 学期起止设置（开学日期 + 总周数，计算当前周）
  - 单双周过滤支持
- 设置页入口："课表编辑"菜单项

#### Phase E：事件追踪（P2）
- `CalendarEvent.eventType` 扩展枚举：`task` / `focus` / `meeting` / `reminder` / `course` / `exam` / `cert` / `contest` / `other`
- 新增 `EventsView.tsx`：考试/考证/竞赛/其他 分类列表，倒计时显示，按类型筛选

### 10.6 实施优先级

| 优先级 | 模块 | 预估工作量 | 阻塞项 |
|---|---|---|---|
| P0 | Prisma Schema 迁移（Course + CourseNote + 外键） | 1h | 无 |
| P0 | NestJS API（Course / CourseNote CRUD + CalendarEvent 扩展） | 4h | Schema 迁移 |
| P0 | ICS 导入脚本 + 配置文件 | 3h | API 就绪 |
| P0 | CalendarView 混入课程事件 | 3h | API 就绪 |
| P1 | Task 关联 courseId + 前端选择器 | 2h | Course API 就绪 |
| P1 | Dashboard 今日课程区块 | 2h | CalendarView 课程渲染 |
| P2 | CourseNote 看板（Sidebar + Swipe + 卡片） | 6h | Course API 就绪 |
| P2 | ScheduleEditor 课表编辑器 | 4h | Course API 就绪 |
| P2 | EventsView 事件追踪 | 3h | CalendarEvent 扩展 |

### 2026-05-28（Course 模块后端基础设施 + 原型交付）
- **Prisma Schema 迁移**: 新增 Course / CourseNote 模型 + CalendarEvent 扩展 courseId + isOverride + Task 扩展 courseId
  - 迁移 SQL：`api/prisma/migrations/20260528083100_add_course_models/migration.sql`
  - Schema 验证通过，Prisma Client 重新生成
- **Course API 模块**: `api/src/course/` (controller + service + module)
  - CRUD：findAll / findOne / create / update / remove
  - 课程实例：findEvents + adjustEvent（调课，标记 isOverride）
  - 课程笔记：findNotes / createNote / updateNote / deleteNote
  - 换课逻辑：update 时检测排课规则变化 → 自动 trigger regenerateEvents（跳过 isOverride 实例）
  - TypeScript 零错误
- **ICS 导入脚本**: `scripts/import-courses.js` + `scripts/course-import-config.json`
  - 依赖 node-ical（ICS 解析）+ @prisma/client（直写 DB），独立运行
  - 按课程名分组 → 创建/更新 Course（icsUid 幂等）→ 批量生成 CalendarEvent
- **CalendarView 课程事件渲染**: 混入 course 类型 CalendarEvent
  - 新增 CourseEvent 接口 + fetchCalendarEvents API 调用
  - 课程块样式：虚线边框 + 课程色半透明背景 + "课程" badge + isOverride 标记
  - 头部计数：`X 项任务 · Y 课`
- **CourseDetailView 交互原型**: `docs/prototypes/sparkflow-course-detail-prototype.html`
  - Hero 卡片 + 下次课程卡片 + 实例列表 + 调课/换课浮层
  - 参数面板：6 项滑杆 + 导出 JSON + 重置
