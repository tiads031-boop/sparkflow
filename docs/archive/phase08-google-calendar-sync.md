# Phase 8: Google Calendar 双向同步 + Android 系统日历接入

> **创建时间**: 2026-06-01 | **状态**: 方案设计阶段 | **优先级**: P1

---

## 一、方案概述

### 1.1 核心架构：后端作为同步中枢

```
┌─────────────────┐     Google Calendar API      ┌──────────────────┐     Android Account Sync     ┌─────────────────┐
│   Sparkflow API  │ ←──────────────────────────→ │  Google Calendar  │ ←──────────────────────────→ │  Redmi K70       │
│   (NestJS 后端)  │    OAuth 2.0 + REST          │  (交换格式)        │    系统内置、零代码           │  系统日历         │
└─────────────────┘                               └──────────────────┘                               └─────────────────┘
        │                                                  │
        │ Supabase                                         │ Google 原生同步
        │ PostgreSQL                                       │ (已登录 Google 账号时自动启用)
        ▼                                                  ▼
┌─────────────────┐                               ┌──────────────────┐
│  Sparkflow PWA  │                               │  任何 Google 设备  │
│  (React 前端)   │                               │  (Web/其他手机)    │
└─────────────────┘                               └──────────────────┘
```

**设计原则**：不造轮子。Google Calendar 是业界标准的日程交换格式，Android 出厂自带与 Google Calendar 的双向同步。Sparkflow 只需打通 Google Calendar API，手机端自动受益。

### 1.2 为什么这条路是最优解

| 对比维度 | 方案 A（推荐） | 方案 B：自建 CalDAV | 方案 C：PWA 直接操作 |
|---|---|---|---|
| Android 端工作量 | 零（系统自带） | 需用户装 DAVx⁵ | 不可行（PWA 无系统日历权限） |
| 后端工作量 | Google Calendar Module | 完整 CalDAV 协议栈 | 无后端 |
| 跨设备支持 | 自动支持所有 Google 设备 | 仅 CalDAV | 仅当前设备 |
| 用户配置复杂度 | 登录 Google 账号（一次） | 装 DAVx⁵ + 配置 URL/账号/密码 | 每次打开都要授权 |
| 可靠性 | Google 基础设施级 | 自建服务可用性 | 完全依赖前台 |
| 维护成本 | API 升级适配 | 协议栈维护 + DAVx⁵ 兼容 | 低但功能受限 |

---

## 二、技术调研结论

### 2.1 Google Calendar API

**核心能力**：
- `Events.insert`：创建事件（POST）
- `Events.list`：列出事件（GET），支持 `syncToken` 增量同步
- `Events.update`：全量更新（PUT）
- `Events.patch`：部分更新（PATCH）
- `Events.delete`：删除事件
- `Events.watch`：通过 Webhook 推送变更通知

**增量同步机制（syncToken）**：
```
首次请求：GET /calendars/{id}/events → 返回 nextSyncToken
增量请求：GET /calendars/{id}/events?syncToken={token} → 仅返回变更项 + 新的 nextSyncToken
```

**配额限制**（免费层）：
- 每日 1,000,000 次查询
- 每 100 秒 500 次查询（即 5 QPS 稳态）

### 2.2 OAuth 2.0 认证方案

**推荐流程：Authorization Code + PKCE（后端代理模式）**

```
PWA 前端                        Sparkflow API                         Google
   │                                │                                    │
   │ GET /api/google/auth/url       │                                    │
   │───────────────────────────────→│                                    │
   │                                │ 生成 OAuth URL (PKCE)              │
   │ 返回 Google 授权 URL            │                                    │
   │←───────────────────────────────│                                    │
   │                                │                                    │
   │ 浏览器跳转 Google 授权页面       │                                    │
   │──────────────────────────────────────────────────────────────────→│
   │                                │                                    │
   │ 用户授权后，Google 回调          │                                    │
   │←──────────────────────────────────────────────────────────────────│
   │ 带着 authorization code 回调    │                                    │
   │                                │                                    │
   │ POST /api/google/auth/callback │                                    │
   │ { code, codeVerifier }         │                                    │
   │───────────────────────────────→│                                    │
   │                                │ 交换 code → access + refresh token │
   │                                │──────────────────────────────────→│
   │                                │                                    │
   │ 200 OK，连接成功                 │                                    │
   │←───────────────────────────────│                                    │
```

**关键设计决策**：
- Refresh Token 存后端数据库（GoogleToken 表），前端永远不接触
- Access Token 由后端管理，自动过期前刷新
- 前端只需发起一次授权，后续完全无感

### 2.3 Redmi K70 / MIUI 兼容性

**结论：完全兼容，零额外开发。**

根据实测和社区反馈：
- 红米 K70 系列（含 K70 Pro）在 Google Play 支持设备列表中
- 需开启"谷歌基础服务"（HyperOS：设置 → 更多设置 → 帐号与同步 → 谷歌基础服务）
- 安装 Google Play 商店后登录 Google 账号
- MIUI 自带日历应用支持显示 Google 日历事件
- 同步由 Android 系统的 Calendar Sync Adapter 驱动，后台自动运行

**注意事项**：
- MIUI 省电策略可能影响后台同步频率，建议将"日历"加入"无限制"电池优化白名单
- 首次同步可能需要几分钟，后续增量同步通常在 30 秒内

### 2.4 NestJS 集成方案

使用 Google 官方 Node.js SDK：`googleapis`

```typescript
// 典型用法
import { google } from 'googleapis';

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// 列出事件
const res = await calendar.events.list({
  calendarId: 'primary',
  timeMin: new Date().toISOString(),
  maxResults: 50,
  syncToken: storedSyncToken,  // 增量同步
});

// 创建事件
await calendar.events.insert({
  calendarId: 'primary',
  requestBody: { summary, start, end, ... },
});
```

**依赖包**：
- `googleapis`：Google API Node.js 客户端
- `google-auth-library`：OAuth 2.0 认证库（googleapis 内置依赖）

---

## 三、数据模型设计

### 3.1 新增表：GoogleToken

```prisma
model GoogleToken {
  id            String   @id @default(uuid())
  userId        String
  accessToken   String            // 加密存储
  refreshToken  String            // 加密存储
  tokenExpiry   DateTime          // access_token 过期时间
  googleEmail   String?           // 关联的 Google 账号邮箱
  calendarId    String?           // 同步目标日历 ID（默认 primary）
  syncToken     String?           // Google 增量同步 token
  lastSyncAt    DateTime?         // 上次同步时间
  isActive      Boolean  @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId])
  @@map("google_tokens")
}
```

### 3.2 扩展：CalendarEvent

在现有 `CalendarEvent` 模型新增字段：

```prisma
model CalendarEvent {
  // ... 现有字段保留 ...

  googleEventId   String?    // Google Calendar 端的事件 ID（建立关联）
  googleSyncedAt  DateTime?  // 最近一次同步到 Google 的时间
  syncStatus      String     @default("pending")  // pending | synced | conflict | skipped

  @@map("calendar_events")
}
```

**syncStatus 状态机**：
```
pending  →  新创建/修改后未同步
synced   →  已成功同步到 Google
conflict →  Google 端和本地都有修改，需要用户裁决
skipped  →  用户选择不同步此事件（如私密事件）
```

### 3.3 数据映射：Sparkflow CalendarEvent ↔ Google Calendar Event

| Sparkflow 字段 | Google Calendar Event 字段 | 映射说明 |
|---|---|---|
| `title` | `summary` | 事件标题 |
| `startTime` | `start.dateTime` | 开始时间（ISO 8601） |
| `endTime` | `end.dateTime` | 结束时间 |
| `description` | `description` | 事件描述/备注 |
| `location` | `location` | 地点 |
| `eventType` | `extendedProperties.private.eventType` | 自定义字段 |
| `courseId` | `extendedProperties.private.courseId` | 课程关联 |
| `color` | `colorId` | 映射到 Google 日历颜色（1-11） |
| `id` | `extendedProperties.private.sparkflowId` | 本地 ID，用于反向匹配 |
| `isAllDay` | `start.date` + `end.date` | 全天事件用 date 而非 dateTime |

---

## 四、模块设计

### 4.1 api/src/google-calendar/ 目录结构

```
api/src/google-calendar/
├── google-calendar.module.ts       # NestJS 模块定义
├── google-calendar.service.ts      # 核心同步逻辑
├── google-calendar.controller.ts   # REST 端点（授权/设置/手动同步）
├── google-auth.service.ts          # OAuth 2.0 认证逻辑
├── google-sync.service.ts          # 双向同步引擎
├── dto/
│   ├── auth-callback.dto.ts        # 授权回调参数
│   ├── sync-settings.dto.ts        # 同步设置
│   └── sync-status.dto.ts          # 同步状态响应
└── interfaces/
    └── google-event-mapping.ts      # 类型定义
```

### 4.2 核心 Service 职责

**GoogleAuthService**：
- 生成 OAuth 授权 URL（含 PKCE challenge）
- 处理授权回调（code → token）
- Access Token 自动刷新（到期前 5 分钟）
- Token 加密存储/读取

**GoogleCalendarService**：
- 封装 Google Calendar API CRUD
- 事件映射（Sparkflow ↔ Google）
- 批量操作（减少 API 调用）

**GoogleSyncService**：
- **推送同步**：Sparkflow 变更 → Google（触发式，实时）
- **拉取同步**：Google 变更 → Sparkflow（定时 + syncToken 增量）
- 冲突检测与自动合并策略
- 同步状态管理

### 4.3 同步引擎设计

#### 4.3.1 推送方向（Sparkflow → Google）

触发时机：
- 用户创建/修改/删除 CalendarEvent
- Task 设置了 startTime + dueDate 后自动生成 CalendarEvent

执行流程：
```
1. Event 变更 → 标记 syncStatus = 'pending'
2. 异步队列处理（避免阻塞用户操作）
3. 查找对应 Google 事件：
   - 有 googleEventId → Events.update 或 Events.patch
   - 无 googleEventId → Events.insert
4. 更新 googleEventId + googleSyncedAt + syncStatus = 'synced'
5. 失败时重试 3 次（指数退避），仍失败则 syncStatus = 'conflict'
```

#### 4.3.2 拉取方向（Google → Sparkflow）

触发时机：
- 定时任务：每 5 分钟（可通过 `@nestjs/schedule` 配置）
- 用户手动触发（设置页"立即同步"按钮）

执行流程：
```
1. 使用存储的 syncToken 发起增量请求
2. 对比返回的变更项：
   - 新增事件（有 sparkflowId → 检查是否为已知事件）
   - 修改事件（有 googleEventId 匹配 → 更新对应 CalendarEvent）
   - 删除事件（status=cancelled → 标记本地事件 syncStatus='skipped' 或删除）
3. 无 sparkflowId 的新事件 → 创建本地 CalendarEvent（来源标记为 'google'）
4. 同时存在本地修改和 Google 修改 → syncStatus = 'conflict'
5. 更新 syncToken + lastSyncAt
```

#### 4.3.3 冲突解决策略

**自动合并规则**（按优先级）：
1. 本地和 Google 修改不同字段 → 自动合并
2. 本地和 Google 修改同一字段 → **Sparkflow 优先**（last-write-wins，以本地为准）
3. Google 端删除但本地有修改 → 重新推送本地版本到 Google
4. 本地已删除但 Google 端仍存在 → 删除 Google 端事件

**手动裁决**（冲突无法自动解决时）：
- 前端 SyncConflictModal 展示冲突详情
- 用户选择：采用本地 / 采用 Google / 手动合并
- 裁决结果同步到两端

---

## 五、前端设计

### 5.1 授权流程 UI

**设置页新增"日历同步"区块**：

```
┌─────────────────────────────────┐
│  📅 日历同步                      │
│                                  │
│  未连接                           │
│  ┌─────────────────────────────┐ │
│  │    🔗 连接 Google 日历       │ │
│  └─────────────────────────────┘ │
│                                  │
│  连接后可将 Sparkflow 日程同步到    │
│  手机系统日历和所有 Google 设备     │
└─────────────────────────────────┘
```

**已连接状态**：

```
┌─────────────────────────────────┐
│  📅 日历同步                      │
│                                  │
│  ✅ 已连接：xxx@gmail.com         │
│  上次同步：3 分钟前                │
│  同步状态：34 个事件已同步          │
│                                  │
│  [立即同步] [同步设置] [断开连接]   │
│                                  │
│  同步范围：                       │
│  ☑ 任务事件    ☑ 课程事件         │
│  ☑ 手动日程    ☐ 灵感（不同步）    │
└─────────────────────────────────┘
```

### 5.2 事件级别同步控制

在 DarkFrostedModal（事件编辑弹窗）中新增同步开关：

- 每个事件可选择是否同步到 Google
- 私密事件默认不同步
- 课程事件默认同步（方便手机查看课表）

### 5.3 同步状态指示

- CalendarView 时间线事件卡片右上角：小图标表示同步状态
  - 🟢 绿点 = 已同步
  - 🟡 黄点 = 同步中
  - 🔴 红点 = 冲突
  - ⚪ 灰点 = 不同步

---

## 六、实施计划

### Phase 8A：Google Cloud Console 配置（0.5h）

| 任务 | 说明 |
|---|---|
| 创建 Google Cloud 项目 | 或复用现有项目 |
| 启用 Google Calendar API | APIs & Services → Enable API |
| 创建 OAuth 2.0 凭据 | Web application 类型，配置 redirect URI |
| 配置 OAuth consent screen | 添加测试用户，scopes: calendar.events, calendar.readonly |
| 记录凭据 | CLIENT_ID, CLIENT_SECRET 加入 .env |

### Phase 8B：数据库扩展（0.5h）

| 任务 | 说明 |
|---|---|
| Prisma Schema 新增 GoogleToken 模型 | 含 accessToken/refreshToken/syncToken |
| CalendarEvent 扩展 googleEventId/syncStatus | Migration 执行 |
| Token 加密方案确认 | 使用 Node.js crypto 或环境变量级加密 |

### Phase 8C：Google Calendar Module（6h）

| 任务 | 说明 | 预估 |
|---|---|---|
| GoogleAuthService | OAuth URL 生成、code 换 token、自动刷新 | 2h |
| GoogleCalendarService | CRUD 封装、事件映射、批量操作 | 2h |
| GoogleSyncService | 推送同步、拉取同步（syncToken）、冲突检测 | 1.5h |
| GoogleCalendarController | 授权端点、设置端点、手动同步端点 | 0.5h |

### Phase 8D：前端 OAuth 流程（3h）

| 任务 | 说明 | 预估 |
|---|---|---|
| 设置页"日历同步"区块 | 连接/断开/状态展示 UI | 1h |
| OAuth 弹窗流程 | 弹出 Google 授权窗口 → 回调处理 | 1h |
| 同步设置面板 | 同步范围选择、手动同步按钮 | 0.5h |
| 事件卡片同步指示器 | CalendarView 事件卡片绿/黄/红点 | 0.5h |

### Phase 8E：前后端联调 + 测试（3h）

| 任务 | 说明 | 预估 |
|---|---|---|
| 创建事件 → Google 同步 | 端到端验证 push 链路 | 1h |
| Google 端创建 → Sparkflow 拉取 | 验证 pull 链路 + syncToken | 1h |
| 冲突场景测试 | 两端同时修改 → 冲突检测 + 裁决 | 0.5h |
| 边界情况 | 网络断开、Token 过期、API 限流 | 0.5h |

### Phase 8F：Android 端配置文档（0.5h）

| 任务 | 说明 |
|---|---|
| 编写用户配置指南 | 红米 K70 开启谷歌服务 → 登录 Google 账号 → 验证同步 |
| 常见问题 FAQ | 同步延迟、省电策略、日历不显示等 |

### Phase 8G：部署（1h）

| 任务 | 说明 |
|---|---|
| Render 环境变量 | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI |
| Vercel 环境变量 | VITE_GOOGLE_CLIENT_ID（如前端需要） |
| 数据库 Migration | Render 启动时自动 migrate deploy |
| 验证生产环境同步 | 端到端验证完整链路 |

---

## 七、风险与缓解

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| Google OAuth 审核被拒 | 只有测试用户可用 | 提前提交 OAuth consent screen 审核；敏感范围需说明用途 |
| API 配额超限 | 同步中断 | syncToken 增量同步大幅减少调用量；5 分钟轮询间隔可控 |
| Token 泄露 | 用户 Google 数据安全 | Refresh Token 仅存后端，数据库字段加密；Access Token 不暴露给前端 |
| MIUI 省电策略阻断同步 | 手机端不更新 | 用户文档中说明将"日历"加入电池优化白名单 |
| Render 休眠导致定时任务停摆 | 同步延迟 | Render 休眠缓解已就位（每 10 分钟 ping）；唤醒后自动执行积压同步 |

---

## 八、后续扩展

| 扩展方向 | 说明 | 优先级 |
|---|---|---|
| 多日历支持 | 用户可将任务同步到不同 Google 日历（工作/个人/学习） | P2 |
| Webhook 实时推送 | 用 Events.watch 替代轮询，Google 变更秒级感知 | P2 |
| CalDAV 输出 | 自建 CalDAV 端点，供无 Google 账号的用户使用 | P3 |
| iCloud 日历同步 | 扩展同步 Provider 架构，支持多日历源 | P3 |
| 双向冲突自动合并 | 基于 CRDT 的智能合并，减少手动裁决 | P3 |

---

## 九、参考资源

- [Google Calendar API v3 文档](https://developers.google.com/calendar/api/v3/reference)
- [Google OAuth 2.0 Web Server 流程](https://developers.google.com/identity/protocols/oauth2/web-server)
- [googleapis npm 包](https://www.npmjs.com/package/googleapis)
- [红米 Google Play 安装教程](https://cyrusyip.org/zh-cn/posts/2023/05/05/google-play-miui/)
- [小米日历帮助页面](https://cnbj1.fds.api.xiaomi.com/calendar-account-manage/index.html)
