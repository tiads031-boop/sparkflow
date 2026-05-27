# sparkflow — 项目改造/开发蓝图

> 本文档记录项目的所有决策、实施进度和下一步计划。
> **创建时间**: 2026-05-06 | **最后更新**: 2026-05-27 | **状态**: Phase 2 完成，K70 适配完成，待部署

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
| PushSubscription 数据表 | ⬜ | 存储浏览器 subscription 对象 |
| Web Push API 集成（web-push） | ⬜ | VAPID key 生成 + 推送端点 |
| @nestjs/schedule 定时任务 | ⬜ | 每分钟扫描截止日期，触发推送 |
| PWA 端订阅/取消订阅 UI | ⬜ | 允许用户控制推送开关 |

### Phase 4: 灵感转化

| 任务 | 状态 | 说明 |
|---|---|---|
| InspirationPanel 组件 | ⬜ | 展示用户灵感列表 |
| 转化流程：灵感 → Task + 写入 md | ⬜ | 用户确认后自动生成待办条目 |
| 关联回显：Task 上展示来源 Inspiration | ⬜ | 可选 |

### Phase 5: 部署

| 任务 | 状态 | 说明 |
|---|---|---|
| sparkflow-api 部署 Railway/Render | ⬜ | Node + PostgreSQL |
| sparkflow-web 部署 Vercel | ⬜ | 静态 PWA，指向远程 API |
| 端到端测试（手机真机） | ⬜ | PWA 安装 → 看板 → 编辑 → 推送 |

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
| 2026-05-27 | `context-bridge.controller.ts` 类型导入导致 `TS1272`（`isolatedModules` + `emitDecoratorMetadata`） | 接口类型改用 `import type` 导入 |
| 2026-05-27 | `CalendarView.tsx` 存在未使用导入导致构建失败 | 移除 `CalendarIcon` 和 `MapPin` |
| 2026-05-27 | `Task` 接口缺少 `description` 字段，映射时 TS 报错 | 接口添加 `description?: string` |
| 2026-05-27 | 首次部署时 `CURRENT_CONTEXT.md` 不存在导致 API 500 | `ensureFile()` 改为自动创建默认模板 |

---

## 九、下一步计划

| 优先级 | 任务 | 说明 | 状态 |
|---|---|---|---|
| P0 | 启动 Phase 1：ContextBridge 模块开发 | md 解析器 + 写回器 + 冲突检测 + 单元测试 | ✅ |
| P0 | Prisma 扩展：Task 加 contextMdHash + PushSubscription 表 | schema 变更 + migration | ✅ |
| P1 | Phase 2 原型：PWA 看板可交互 HTML | 先出原型调参，再生成正式版 | ✅ |
| P1 | Phase 2 正式版：BoardView + TaskCard + TaskEditor | React 组件 + Zustand store，读取调参 JSON | ✅ |
| P1 | 前后端联通 + 最小认证 + 部署配置 | 前端接入真实 API、ApiKeyGuard、Dockerfile、vercel.json | ✅ |
| P1 | 部署上线（Render + Vercel） | 按 docs/DEPLOY.md 执行，手机验证 PWA 安装 | 🔄 待执行（K70 适配已完成） |
| P2 | Phase 3：Web Push 通知集成 | web-push + @nestjs/schedule 定时检查截止日期 | ⬜ |
| P2 | Phase 4：灵感转化流程完善 | Inspiration → Task + 写入 CURRENT_CONTEXT.md | ⬜ |
| P2 | 子任务状态持久化 | 子任务 completed 状态目前只保存在前端，刷新丢失 | ⬜ |
| P3 | 多用户 / 正式 OAuth | 当前 API Key 方案仅适合单用户 | ⬜ |
