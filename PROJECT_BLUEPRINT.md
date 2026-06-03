# sparkflow — 项目开发蓝图

> **角色**：项目决策记录 + 架构总览 + 问题日志。具体功能方案见 [docs/plans/](docs/plans/)。
> **创建时间**: 2026-05-06 | **最后更新**: 2026-06-04 | **当前 Phase**: Phase 9～10

---

## 一、决策点总览（已确认）

| # | 决策项 | 确认方案 | 理由 |
|---|---|---|---|
| 1 | 文件协议层 | CURRENT_CONTEXT.md 纯文本，不改格式 | md 是 AI 和用户共享的"协议层" |
| 2 | md 解析方式 | 正则有限状态机（逐行扫描） | 结构简单、依赖零、易定位 |
| 3 | 条目唯一标识 | 标题 SHA256 前 8 位（contextMdHash） | 不污染 md 文本，数据库关联轻量 |
| 4 | 同步模式 | 前端操作后自动 syncToApi | 避免 md 与数据库分叉 |
| 5 | 冲突处理 | mtime 检测 + mkdir 原子锁 + 自动合并 | 覆盖 AI 和用户同时修改的竞态 |
| 6 | 增强数据存储 | Task 表加 contextMdHash | Task 模型已完整，只需一个关联字段 |
| 7 | ContextBridge 位置 | sparkflow-api NestJS 模块 | Node.js 可直接 fs 读写本地文件 |
| 8 | 推送方案 | Web Push API + @nestjs/schedule | 无需第三方推送，PWA 原生支持 |
| 9 | 灵感转化 | Inspiration → Task + 可选写入 md | 保留灵感功能，桥接到看板 |
| 10 | 部署 | API: Render (Docker)，前端: Vercel 静态托管 | 低成本、零运维 |
| 11 | 认证方案 | X-API-Key Header 全局 Guard | MVP 单用户，无需完整 OAuth |
| 12 | CORS 配置 | CORS_ORIGIN 环境变量，逗号分隔多域名 | 部署后零代码适配新域名 |
| 13 | md 协议扩展 | @key:value 元数据标记嵌入 description | 不破坏 md 可读性 |
| 14 | 状态体系 | md 存 todo/in-progress/in-review/done/cancelled | 协议层简洁，表现层丰富 |
| 15 | 子任务协议 | notes 用 `> [x]` / `> [ ]` 承载 completed 状态 | checkbox 语义自解释 |
| 16 | 时间线数据扩展 | @start:HH:MM + @duration:MIN 元数据标记 | 向后兼容，不进 DB 纯协议层 |
| 17 | 外部变更感知 | 前端 15s 轮询 GET /context 对比 mtime | 弥补 AI 手动编辑后前端无感知 |
| 18 | 同步策略：skipDone | push 时只推送未完成任务 | 减少传输量，PWA 只看板展示活跃任务 |
| 19 | 项目分组展示 | BoardView 按 project 字段分组，可折叠区块 | 前端纯展示层，不改 md 协议 |
| 20 | 个人文件夹分组 | 个人待办支持 ### folder-name 分组 | 统一两列交互模式 |
| 21 | 文件夹创建 UI | BoardView 列头 FolderPlus + 即时输入框 | 零弹窗、零模态层 |
| 22 | **架构 B：Supabase 为主存储** | 移除 Render 文件系统依赖，ContextBridge 直操 Supabase | Render 重启文件系统重置，Supabase 持久化 |
| 23 | Task 表扩展 | 新增 column、project、notes 字段 | 支撑 Supabase 主存储，完整保存看板元数据 |
| 24 | 前端移除手机框 | 移动端全屏 + 桌面端 sm:max-w-lg 居中 | PWA 应用体验，安卓为主无需安全区 |
| 25 | SparksView 拖拽边界 | useRef + window resize 读取容器宽度 | 自适应任何容器 |
| 26 | 学期数据模型 | Semester 表（id, name, startDate, endDate, weeks） | 课表天然按学期组织 |
| 27 | 学期筛选 UI | 水平滚动学期 pill 选择器 | pill 交互最轻量 |
| 28 | 周周期配置 | startDate 为第 1 周周一，前端计算当前周数 | 统一周数计算基准 |
| 29 | 日历绿点扩展 | CalendarHeader eventDays 合并 task + courseEvent | 一目了然，无需切 tab |
| 30 | 项目代办自动折叠 | 无 In progress 任务的项目分组自动折叠 | 减少视觉噪音 |
| 31 | @双向链接 | 描述中用 @项目名/@任务标题 建立双向链接 | 追溯引用网络，纯前端计算 |
| 32 | Google Calendar 同步架构 | 后端作为同步中枢，Google Calendar API 双向同步 | Android 系统日历通过 Google 账号原生接入 |
| 33 | OAuth 2.0 认证方案 | Authorization Code + PKCE，后端代理模式 | Refresh Token 仅存后端，前端不接触 |
| 34 | 同步冲突策略 | Sparkflow 优先（last-write-wins） | 简化冲突，减少用户裁决 |
| 35 | **删除 CURRENT_CONTEXT 同步架构** | 移除 context-bridge + syncSlice + contextMdHash，改纯 REST CRUD | PWA ↔ REST ↔ Supabase，消除 md 翻译层 |
| 36 | **APP 端方案** | Capacitor 打包 React PWA 为 Android APK | 复用 100% 现有代码，获得 FCM + 系统日历 |
| 37 | Google OAuth Web/App 回调 | 保持 `/api/google/auth/callback` 作为 Google Console redirect URI，Guard 对 GET callback 单独放行 | 部署环境与 `.env` 保持一致，避免 Google 回调被 API key 或路径前缀拦截 |
| 38 | 小米/Android 本地日历接入 | Capacitor App 读取系统日历，导入到 CalendarEvent 并生成/更新 Task；Web 仅通过 Google/ICS 间接同步 | 浏览器不能直接读取手机系统日历，原生 App 才能接入 Xiaomi 本地日历 |

---

## 二、整体架构

```
sparkflow/
├── api/                  ← NestJS 后端（数据中枢）
│   ├── src/
│   │   ├── tasks/           ← Task 模块：纯 REST CRUD
│   │   ├── inspirations/    ← 灵感模块
│   │   ├── course/           ← 课程管理：CRUD + ICS 导入
│   │   ├── calendar/         ← 日历事件查询
│   │   ├── semester/         ← 学期管理
│   │   ├── push/            ← Web Push 订阅与推送
│   │   ├── google-calendar/ ← Google Calendar 双向同步
│   │   ├── pomodoro/        ← 番茄钟持久化
│   │   └── schedule/        ← 定时检查截止日期
│   ├── prisma/schema.prisma ← Task, Course, Semester, CalendarEvent, GoogleToken ...
│   └── package.json
├── web/                  ← React 前端（PWA + Capacitor APK）
│   ├── src/
│   │   ├── components/      ← BoardView, TaskCard, CalendarView, SparksView ...
│   │   ├── stores/          ← Zustand stores（taskSlice, uiSlice, googleSyncSlice ...）
│   │   ├── hooks/           ← useBoard, useTasks, usePush
│   │   └── service-worker/  ← Web Push handling
│   ├── public/manifest.json ← PWA manifest
│   ├── android/             ← Capacitor Android 平台
│   └── package.json
├── scripts/              ← 导入脚本、配置
├── docs/                 ← 方案文档 + 原型 + 归档
│   ├── plans/            ← 活跃方案
│   ├── archive/          ← 已完成方案（只读）
│   └── prototypes/       ← 交互原型
└── PROJECT_BLUEPRINT.md  ← 本文档
```

### 数据流（v2：纯 Supabase，无 md 中间层）

```
sparkflow-web (PWA / APK)
       │
       │ REST API (JSON) — 直接 CRUD Tasks、CalendarEvents
       ▼
sparkflow-api (NestJS)
       │
       │ Prisma ORM
       ▼
Supabase PostgreSQL (唯一数据源)
```

---

## 三、实施进度

### Phase 1～8：全部完成 ✅

| Phase | 内容 | 状态 | 归档 |
|---|---|---|---|
| 1 | ContextBridge 模块（md 解析/读写） | ✅ | — |
| 2 | PWA 看板 UI + 前后端联通 | ✅ | — |
| 3 | Web Push 通知 | ✅ | — |
| 4 | 灵感转化流程 | ⬜ 待实施 | — |
| 5 | 性能优化 | ✅ | — |
| 6 | 功能深化（时间线、子任务、双向链接） | ✅ | — |
| 7 | 学期 + Course 基础 + 稳定性修复 | ✅ | — |
| 8 | 删除 CURRENT_CONTEXT + Google Calendar 同步 + Capacitor APK | ✅ | [archive](docs/archive/) |

### 当前活跃 Phase

| Phase | 状态 | 方案文档 |
|---|---|---|
| 09 — Course 模块深化（课程详情页、笔记看板、事件追踪） | 🚧 部分实施中 | [phase09-course-module.md](docs/plans/phase09-course-module.md) |
| 10 — 待办功能收束（VAPID 部署、拖入时间线、事件类型扩展等） | ⬜ | [phase10-pending-features.md](docs/plans/phase10-pending-features.md) |

---

## 四、技术选型详情

| 层级 | 技术 | 用途 |
|---|---|---|
| 前端框架 | React 19 + TypeScript + Vite | PWA / APK 共用代码 |
| 前端状态 | Zustand 5 | 轻量状态管理，多 slice 拆分 |
| 前端样式 | Tailwind CSS 4 | 原子化 CSS，dark mode |
| 前端路由 | React Router（Hash 路由） | Capacitor 兼容 |
| 后端框架 | NestJS 11 + TypeScript | 模块化后端 |
| ORM | Prisma 7 | PostgreSQL 类型安全数据访问 |
| 数据库 | Supabase PostgreSQL | 持久化主存储 |
| 移动端 | Capacitor 8 | 打包为 Android APK |
| 推送 | Web Push API + FCM | PWA 推送 + Android 原生推送 |
| 日历同步 | Google Calendar API（OAuth 2.0 + PKCE） | 双向同步，Android 系统日历借道 |
| 认证 (Google) | Authorization Code + PKCE，后端代理 | Refresh Token 仅存后端 |
| 认证 (API) | X-API-Key Header Guard | MVP 单用户 |
| 部署 | Render (API) + Vercel (Web) | 免费层，零运维 |

### 关键依赖

| 包名 | 用途 |
|---|---|
| @prisma/client, @prisma/adapter-pg | 数据库 ORM + Supabase pooler 适配 |
| @nestjs/schedule, web-push | 定时推送 |
| googleapis, google-auth-library | Google Calendar API |
| @capacitor/push-notifications, @capacitor/local-notifications | Android 原生通知 |
| @ebarooni/capacitor-calendar | Android 系统日历读写 |
| @fullcalendar/react | CalendarView 日历组件 |
| lucide-react | 图标库 |
| zustand | 状态管理 |

---

## 五、使用指南

```bash
# === 后端开发 ===
cd api
npm run start:dev          # 启动 NestJS dev server（热重载）
npm run build              # 构建生产版本
npm test                   # 运行测试

# === 前端开发 ===
cd web
npm run dev                # 启动 Vite dev server
npm run build              # TypeScript 检查 + Vite 生产构建
npm run preview            # 预览生产构建

# === Android APK 构建 ===
cd web
npm run android:build      # 完整构建：tsc + vite + cap sync + gradlew assembleDebug
npm run android:install    # ADB 安装到设备

# === ICS 课程导入 ===
node scripts/import-courses.js   # 根据 course-import-config.json 导入课表

# === 部署 ===
# API: git push → Render 自动部署（Dockerfile）
# Web: git push → Vercel 自动部署（vercel.json）
# 详细部署步骤见 docs/DEPLOY.md
```

---

## 六、更新日志

### 2026-06-04
- ✅ **Google Calendar OAuth Web/App 闭环**：OAuth URL 带 `userId/platform`，PKCE verifier 加密进 state；Web popup 自动关闭，Android 通过 `sparkflow://oauth` deep link 返回；`/api/google/auth/callback` 对 Google GET 回调放行。
- ✅ **Google Calendar 双向同步增强**：手动/定时同步会先将 SparkFlow Task/CalendarEvent 推到 Google，再拉取 Google 事件；Google 事件落库到 CalendarEvent 并生成/更新 Task，syncToken 失效时自动 full sync。
- ✅ **Xiaomi/Android 本地日历接入**：Settings 新增系统日历权限、近期本地事件导入、SparkFlow 日程写入系统日历；本地事件按 external id upsert，并关联 Task，Web 端明确通过 Google/ICS 间接同步。
- ✅ **日历视图适配**：CalendarView 展示 Google/local/manual/course 等非课程日程，修复 CalendarService 查询 where/时间 overlap，避免已关联 Task 的日历事件重复渲染。

### 2026-06-01
- ✅ **删除 CURRENT_CONTEXT 同步架构**：移除 context-bridge 模块 + syncSlice + Task.contextMdHash，改纯 REST CRUD；数据流简化为 PWA ↔ REST ↔ Supabase
- ✅ **Capacitor Android APK 打包**：Capacitor v8.3.4 配置 + FCM 推送 + 系统日历插件 + OAuth deep link + 8 个构建脚本
- ✅ **Google Calendar 双向同步**：GoogleToken 表 + OAuth PKCE 后端代理 + push/pull/cron 同步 + SettingsView 连接管理

### 2026-05-29
- ✅ **数据同步全修复**：解决 sync-context.cjs push 覆盖问题（writeLocalMd + syncGeneration 竞态防护）、isSyncing 锁丢弃并发请求（needsResync 重触发）、mtime 动态导致 poll 每次刷新（contextVersion 计数器）、push 无差异检测（远程条目数警告）
- ✅ **Dashboard 柱状图修复**：日视图追加全天条，周/月追加未排条，改用实际状态比例 + 组内归一化柱高，chartDefaultView 配置生效
- ✅ **renderMd 丢失项目标题修复**：动态生成项目分组标题确保条目归属正确
- ✅ **跨界面任务同步兜底**：localStorage 缓存 + API 失败时保留现有 tasks
- ✅ **CalendarView 截止任务区域**：列表展示当日有 dueDate 但未安排时间线的任务 + ⏱️ 快速安排按钮
- ✅ **时间线长按创建 + ghost 拖拽**：两轮 bug 修复（React 合成事件 pointerId 失效 + pointer capture 移动端不兼容）
- ✅ **Course 模块后端基础设施**：Prisma Schema 迁移 + NestJS API + ICS 导入脚本 + CalendarView 课程渲染 + CourseDetailView 原型
- ✅ **学期管理**：Semester CRUD + 激活切换 + 周数计算 + 学期 pill 选择器
- ✅ **双向链接**：@项目名 / @任务标题 纯前端双向链接 + mention 标签 + 回链计数

### 2026-05-28
- ✅ **前端移除手机框**：全屏自适应 + SparksView 拖拽边界动态化
- ✅ **截止时间功能闭环**：toggle 控制日期选择器 + 时区修复（toISOString） + 通知确认弹窗
- ✅ **Dashboard 柱状图空状态**：无任务时显示引导占位图

### 2026-05-27
- ✅ **部署上线（Render + Vercel）**：9 项踩坑全修复（Prisma 7 配置、dotenv、Dockerfile COPY、Supabase IPv6 pooler、Vercel Hobby 限制等）
- ✅ **Web Push 通知编码完成**：后端 PushModule + 前端 Service Worker + 铃铛订阅 UI（待部署 VAPID 环境变量）
- ✅ **番茄钟持久化**：Pomodoro CRUD API + Dashboard 专注统计 + DarkFrostedModal 全局 tick 驱动
- ✅ **子任务协议扩展**：notes 升级为 NoteItem[]（含 completed），解析/渲染/合并全链路
- ✅ **3D 卡片编辑恢复**：左右滑动切换（编辑/专注/子任务），delete 两次确认
- ✅ **元数据解析修复**：从完整 content 提取而非仅 description，In progress 状态不再丢失
- ✅ **V4 交互原型**：Dashboard 日/周/月柱状图 + Calendar 时间线拖拽 + 参数面板

### 2026-05-30（删除后闪现问题排查记录）
- **现象**：网页端 `https://sparkflow031.vercel.app/` 删除任务后，任务短暂消失又重新出现，表现为“不能删除”。
- **根因 1（后端软删除回流）**：前端 `deleteTask` 通过全量 `syncToApi()` 提交删除后的任务列表；后端 `ContextBridgeService.write()` 清理孤立条目时，若任务有关联的番茄钟或日历记录，会将任务状态改为 `cancelled` 而非硬删除；随后 `read()` 未过滤 `cancelled`，导致该任务又被返回给前端并重新渲染。
- **根因 2（并发同步覆盖风险）**：`syncToApi()` 在已有同步进行中时只设置 `needsResync`，第一次同步成功响应仍会整表替换 `tasks`，快速连续操作场景下可能短暂覆盖本地新状态。
- **建议修复方案 P0**：后端 `read()` 默认过滤 `status='cancelled'`，并在前端 `entriesToTasks()` 增加 `Cancelled` 兜底过滤；软删除任务保留在 DB 中用于历史关联，但不进入看板协议层。
- **建议修复方案 P1**：新增显式删除接口或同步协议 `deletedHashes`，避免依赖“全量 entries 少一条”来推断删除；`syncToApi()` 增加 mutation id/提交快照校验，防止旧响应覆盖新本地状态。
- **状态**：🚧 已完成排查与蓝图记录，待按 P0/P1 实施代码修复并部署验证。

### 2026-05-06
- ✅ **项目蓝图创建**：确立 sparkflow 定位（CURRENT_CONTEXT 可视化管理面板）
- ✅ **10 项关键决策**：解析规范、同步机制、数据模型、推送、灵感转化、部署
- ✅ **Phase 1 完成**：ContextBridge 模块（解析器 + 写回器 + 锁 + 合并），17 项单测全通过

---

## 七、已知问题与修复记录

| 时间 | 问题 | 修复 |
|---|---|---|
| 2026-05-27 | **部署踩坑 1**：Prisma 7 datasource.url 不支持 schema 文件 | URL 移至 prisma.config.ts |
| 2026-05-27 | **部署踩坑 2**：dotenv 未安装 | 移除导入，依赖 process.env |
| 2026-05-27 | **部署踩坑 3**：Dockerfile 缺少 prisma.config.ts | COPY 加入 |
| 2026-05-27 | **部署踩坑 4**：prisma 在 devDependencies | 移至 dependencies |
| 2026-05-27 | **部署踩坑 5**：构建产物在 dist/src/ | CMD 改为 node dist/src/main |
| 2026-05-27 | **部署踩坑 6**：class-validator/class-transformer 缺失 | 安装到 dependencies |
| 2026-05-27 | **部署踩坑 7**：Supabase IPv6-only vs Render IPv4 | 改用 shared pooler (5432) |
| 2026-05-27 | **部署踩坑 8**：Vercel Hobby commit 作者限制 | Git user.email 匹配 Vercel 账号 |
| 2026-05-27 | **部署踩坑 9**：ApiKeyGuard 拦截 OPTIONS | Guard 中 OPTIONS 直接放行 |
| 2026-05-29 | **sync-context push 覆盖 Web 数据** | writeLocalMd + syncGeneration 竞态防护 |
| 2026-05-29 | **isSyncing 锁丢弃并发请求** | needsResync 重触发机制 |
| 2026-05-29 | **poll 因 mtime 动态每次刷新** | contextVersion 计数器替代 Date.now() |
| 2026-05-29 | **Dashboard 柱状图数据映射错误** | 日/周/月三视图追加全天/未排条 + 状态比例 |
| 2026-05-28 | **renderMd 丢失项目标题** | 动态生成分组标题 |
| 2026-05-28 | **跨界面刷新任务消失** | localStorage 缓存兜底 |
| 2026-05-28 | **截止时间时区偏移 8 小时** | toISOString 转换 |
| 2026-05-28 | **时间线长按创建不响应** | ref 即时存 pointerId + try-catch setPointerCapture |
| 2026-05-28 | **ghost 拖拽无法调时长** | 弃用 setPointerCapture，注册原生 document 监听 |

---

## 八、当前活跃 Phase

### Phase 09：Course 模块深化

| 子阶段 | 内容 | 状态 |
|---|---|---|
| 9.1 | 后端基础设施（Schema + API + ICS 导入 + CalendarView 渲染 + 原型） | ✅ |
| 9.2 | 课程详情页正式版 + 调课/换课编辑 | 🚧 |
| 9.3 | 任务关联课程 + Dashboard 今日课程 | ⬜ |
| 9.4 | 课程笔记看板（CourseNote Kanban） | ⬜ |
| 9.5 | 课表编辑器 + 学期管理 | ⬜ |
| 9.6 | 事件追踪（EventView + eventType 扩展） | ⬜ |

> 详细方案：[docs/plans/phase09-course-module.md](docs/plans/phase09-course-module.md)

### Phase 10：待办功能收束

| 子阶段 | 内容 | 状态 |
|---|---|---|
| 10.1 | VAPID 密钥部署（编码完成，待环境变量） | 🚧 |
| 10.2 | 截止任务拖入时间线 | ⬜ |
| 10.3 | md 协议扩展 @start @duration | ⬜ |
| 10.4 | CalendarEvent eventType 扩展 | ⬜ |
| 10.5 | 灵感转化流程 | ⬜ |
| 10.6 | 多用户 / 正式 OAuth | ⬜ |

> 详细方案：[docs/plans/phase10-pending-features.md](docs/plans/phase10-pending-features.md)

---

## 九、文档导航

| 文档 | 说明 |
|---|---|
| [docs/plans/INDEX.md](docs/plans/INDEX.md) | 所有实施方案索引 |
| [docs/plans/phase09-course-module.md](docs/plans/phase09-course-module.md) | Phase 09：Course 模块深化方案 |
| [docs/plans/phase10-pending-features.md](docs/plans/phase10-pending-features.md) | Phase 10：待办功能收束方案 |
| [docs/archive/](docs/archive/) | 已完成方案 + 设计决策（只读） |
| [docs/prototypes/](docs/prototypes/) | 交互原型（v2/v3/v4/course-detail） |
| [docs/DEPLOY.md](docs/DEPLOY.md) | 部署手册（Supabase/Render/Vercel） |

### 文档管理规范

1. **新建方案**：在 `docs/plans/` 下创建 `phaseXX-description.md`，更新 INDEX.md 和本导航
2. **方案完成**：移至 `docs/archive/`，更新 INDEX.md 和本导航
3. **命名**：用 `phaseXX-description.md` 格式（如 `phase09-course-module.md`），不用无编号 slug
4. **归档只读**：历史方案仅作参考，不再修改
5. **BLUEPRINT 职责**：只记录决策、架构、问题——不做详细任务追踪
