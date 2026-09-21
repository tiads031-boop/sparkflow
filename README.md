# SparkFlow

SparkFlow 是一个面向个人学习、工作与日常安排的智能效率应用，目标不是单独管理“任务”或“日历”，而是把 **记录、计划、排程、专注和复盘** 放在同一条工作流里。

项目采用 React + TypeScript 构建 Web/PWA 前端，NestJS + Prisma + PostgreSQL 提供服务端能力，并通过 Capacitor 复用同一套前端构建 Android 应用。

> 当前产品主线：**今天 → 待办 → 时间轴 → AI 安排 → 专注 → 完成**  
> Phase 15 已补齐代码主链路：**记录 → 回顾 → 洞察 → 行动**；当前进入真实账号与真机验收

---

## 核心功能

### 今天 / Today

以“今天要怎么过”为入口，而不是单纯展示任务列表：

- 今日课程、任务、日历事项统一聚合。
- 周日期切换与每日安排查看。
- 今日节奏、空闲时间与完成进度。
- 点击任务可直接进入安排与编辑流程。

### 待办与四象限

支持从简单任务清单逐步进入更结构化的行动管理：

- 任务创建、编辑、完成与删除。
- 优先级、截止日期、预计时长、项目与分区。
- 提醒、重复任务与子任务。
- 列表 / 四象限视图切换。
- 根据重要性和紧急程度整理任务。
- 桌面端拖放与移动端移动操作。

### 时间轴、日历与甘特图

统一展示来自不同来源的时间安排：

- Task 与 CalendarEvent 统一投影为 ScheduleItem。
- 月 / 周 / 时间轴等日程视图。
- 支持课程、普通任务、Google Calendar 与本地日历来源。
- 任务可排期、拖动、调整持续时间与锁定。
- 甘特图用于查看任务跨度、截止节点和阶段安排。

### AI 智能安排

SparkFlow 的 AI 排程遵循“建议优先、用户确认”的原则：

- 根据可用时间生成安排预览。
- 避开课程、会议和已有安排。
- 优先考虑高优先级、临近截止任务。
- 锁定事项不会被自动移动。
- Preview → Apply → Undo，确认后才真正写入日程。

当前排程决策仍由确定性 Scheduler 负责；自然语言主要用于理解用户意图，避免让 LLM 直接决定不可控的时间修改。

### 专注 / Focus

任务安排完成后可以继续进入执行：

- 从任务进入专注流程。
- 记录专注时长与完成情况。
- Pomodoro 数据由服务端保存。
- 与 Today / Task 形成“安排 → 执行 → 完成”的闭环。

### 课程与课表

面向学生场景提供课程管理能力：

- 学期管理。
- 课程、教师、教室、周次与时间信息。
- 课程详情、课程笔记与相关任务。
- ICS / 教务数据导入。
- Web 与 Android 导入流程。
- 正在持续完善重复检测、冲突检查、幂等、事务写入和真实学校数据验收。

### 日历同步与提醒

- Google Calendar 后端同步。
- Android 本地日历接入。
- Web Push / Android 推送基础能力。
- 日程、课程和任务统一进入时间视图。

### 看板

作为可选工作视图保留：

- 项目与个人任务分组。
- 用于更偏项目式的任务整理。
- 可通过导航设置选择是否显示。

### 灵感 / 记录

当前版本已经把“记录”统一到服务端 `Inspiration`，支持多模态随手记、回顾、可解释 Insight、Insight/Inspiration → Task，以及专注完成后的连续记录：

```text
随手记
  ↓
每天推动回顾
  ↓
补充新的理解
  ↓
AI 把多张卡片串成洞察
  ↓
用户确认后转成待办
  ↓
Planner → Timeline → Focus
```

已实现内容包括：

- Quick Capture 随手记。
- 服务端记录持久化。
- 每日回顾与 Reflection 历史。
- AI Theme / Evolution / Action 洞察。
- 洞察来源卡片可解释。
- Inspiration / Insight → Task。
- 任务反向展示“为什么要做这件事”。

详细方案见 [`docs/plans/phase15-capture-review-insight-action.md`](docs/plans/phase15-capture-review-insight-action.md)。

---

## 产品原则

SparkFlow 当前开发遵循几条比较明确的原则：

- **一个数据事实源**：任务、课程、日历和用户数据以服务端 PostgreSQL 为事实源。
- **AI 不直接替用户做不可逆决定**：先预览、再确认，需要时提供撤销。
- **移动端优先**：Web、PWA 与 Android 共享核心能力，同时处理 safe-area、软键盘和触控交互。
- **真实使用优先于功能堆叠**：新功能必须能进入现有 Today / Task / Timeline / Focus 工作流。
- **渐进扩展**：能用现有数据库、类型、事务和测试解决的问题，不额外引入复杂基础设施。

---

## 技术架构

```text
Web / PWA / Android
        │
        │ HTTPS REST + Session Token
        ▼
      Nginx
        │
        ▼
   NestJS API
        │
      Prisma
        │
        ▼
   PostgreSQL
```

主要技术栈：

| 层级 | 技术 |
|---|---|
| Web | React 19、TypeScript、Vite、Zustand、Tailwind CSS |
| Android | Capacitor 8、Android Gradle |
| API | NestJS、Node.js 22 |
| 数据库 | PostgreSQL、Prisma |
| 日历 | FullCalendar、Google Calendar API、Android 本地日历 |
| 部署 | 腾讯云 Nginx（Web/PWA）+ Docker / Nginx（API 与数据库） |

---

## 项目结构

```text
sparkflow/
├── web/                    # React / PWA / Android 共用前端
│   ├── src/components/
│   │   ├── today/          # Today Rhythm
│   │   ├── schedule/       # 安排编辑
│   │   ├── planner/        # AI / Scheduler 预览与应用
│   │   ├── focus/          # 专注流程
│   │   └── ...             # Tasks / Course / Timeline / Settings 等
│   └── android/            # Capacitor Android 工程
├── api/                    # NestJS REST API
│   ├── src/auth/           # 自建密码 / Session 认证
│   ├── src/tasks/          # Task CRUD
│   ├── src/calendar/       # CalendarEvent
│   ├── src/course/         # 课程与导入
│   ├── src/planner/        # Scheduler Preview / Apply / Undo
│   ├── src/pomodoro/       # Focus / Pomodoro
│   └── prisma/             # Schema 与 migrations
├── docs/
│   ├── plans/              # 当前及后续实施方案
│   └── archive/            # 历史方案与归档
├── scripts/                # 辅助脚本
└── PROJECT_BLUEPRINT.md    # 架构、决策与进度总览
```

近期执行顺序以 [`docs/plans/NEXT.md`](docs/plans/NEXT.md) 为准；所有方案索引见 [`docs/plans/INDEX.md`](docs/plans/INDEX.md)。

---

## 环境要求

- Node.js 22 或更高版本
- npm
- PostgreSQL（运行 API 服务时需要）
- Android 构建：JDK 21 + Android SDK

---

## 本地运行

先安装并启动 API：

```bash
cd api
npm install
cp .env.example .env
```

填写 `api/.env` 中的 `DATABASE_URL`，然后：

```bash
npm run start:dev
```

在另一个终端启动 Web：

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

前端默认运行在：

```text
http://localhost:5173
```

后端默认运行在：

```text
http://localhost:3001
```

如需调整 API 地址，请配置 `web/.env.local` 中的 `VITE_API_BASE_URL`。

---

## 常用命令

```bash
# Web
cd web
npm run dev
npm run build
npm test
npm run lint

# API
cd api
npm run start:dev
npm run build
npm test
```

> 仓库目前仍有部分历史 ESLint 债务；构建、测试、目标文件检查和真实业务验收需要分别判断，不应把已有 lint 存量问题误认为所有功能均不可用。

---

## Android 构建

需要 JDK 21 和 Android SDK。

在 `web/` 目录执行：

```bash
npm run android:build
```

该命令会构建 Web 前端、同步 Capacitor 工程并生成 Android Debug APK。

使用 Android Studio：

```bash
npm run cap:open
```

---

## 配置与安全

环境变量模板位于：

```text
web/.env.example
api/.env.example
```

不要提交包含以下内容的 `.env` 文件：

- 数据库密码
- Session / OAuth 凭据
- API Key
- Push / VAPID 私钥
- 第三方服务密钥

服务端使用 Session Token 识别当前用户，业务数据必须按服务端解析出的用户身份进行隔离，不能信任客户端自行提交的 `userId` 作为授权依据。

---

## 开发状态

SparkFlow 仍处于持续开发阶段。当前重点包括：

1. 完成课程导入的数据安全与真实 Web / Android 验收。
2. 继续收口 Timeline、Planner 与移动端体验。
3. 完成 Phase 15 与 Focus C1/C2 的真实账号、PWA 和 Android 真机验收。
4. 留存生产 migration 直接证据，并验证课程导入、Planner 与未知网络结果恢复。

详细状态请查看：

- [`PROJECT_BLUEPRINT.md`](PROJECT_BLUEPRINT.md)
- [`docs/plans/NEXT.md`](docs/plans/NEXT.md)
- [`docs/plans/INDEX.md`](docs/plans/INDEX.md)
