# SparkFlow — 下一步执行队列

> **最后更新**：2026-09-19 | **代码基线**：`master@735944fd`
>
> 本文件是唯一近期执行队列。其他 Phase 文档只负责范围、约束与验收细节；若与本文件冲突，以代码/生产事实和本文件顺序为准。

## 当前生产与仓库基线

| 范围 | 已确认事实 |
|---|---|
| 数据与认证 | 腾讯云独立自建 PostgreSQL + SparkFlow API 自建密码/会话认证；与 DeepTutor 数据库隔离 |
| API | `https://api.fish-life.cc.cd`，腾讯云运行 `master@99ebb3c`；公网 `/api/health.buildSha` 与仓库一致；生产库 20 个 migrations 全部 up to date，包含 `20260919130000_add_study_folders` |
| Web | Vercel 项目 `sparkflow031`；2026-09-19 已从 GitHub `master@e883b9a3` 源码显式发布 Production，部署 `dpl_BSM7vB7tF2V43sfDLw8cNPH2Pf6e` 为 READY，`fish-life.cc.cd` HTTP 200；生产 bundle 已核到五项导航与 M3 Planner Preview 文案 |
| GitHub | `master@735944fd`；VNext AI-first M4–M8 方案 PR #54 已合并；M4.1–M4.4 已通过 PR #55/#56 落地并通过 Web/API/fresh PostgreSQL CI |
| Phase 12 CI | PostgreSQL 16 全量 migration、API build/test、顺序 replay、并发 replay、rollback、跨用户隔离真实 Prisma/PostgreSQL E2E 已纳入 CI |
| Android | Capacitor CORS 已补齐 `https://localhost` / `capacitor://localhost`；APK CI 会核验生产 API、写入 commit 标识并发布 GitHub prerelease |
| 最新功能 APK | Release `android-7145ba0ea3d2`；`sparkflow-7145ba0ea3d2-debug.apk`；对应 VNext M3 功能提交 `7145ba0ea3d2`，Android CI 成功；之后 `e883b9a3` 仅改文档，未触发 APK |
| 部署噪声 | Vercel Hobby 已触发 `api-deployments-free-per-day`（>100/day）；本次首个 Production 发布成功，随后仅为补 Git metadata 的第二次部署被额度拒绝，这不是代码失败。当前部署 `meta` 为空，因此以本文件记录的 `e883b9a3 → dpl_BSM7vB7tF2V43sfDLw8cNPH2Pf6e` 映射作为本次手工发布证据 |

## 近期总原则

1. **Phase 15 M1/M2/M3 代码均已进入 master；不要再重复实现 Capture、Insight 或 Insight→Task。**
2. **当前第一收口项是已发布版本的真实账号验收：Study Mode CRUD、M2/M3 Insight→Task、教务导入、Planner 与未知结果恢复。**
3. **M2 已出现真实 Qwen Provider 生产调用；PR #43 稳定性修复已随 `99ebb3c` API 镜像上线，下一步复验真实生成质量与失败恢复，禁止用伪造洞察代替。**
4. **腾讯云 API 仍运行 `99ebb3c`（VNext M1–M3 未改 API）；Web Production 已发布 VNext `master@e883b9a3`，公网首页 200 且未发现发布后一小时 Vercel runtime error。**
5. **Android 继续以 commit-stamped Release 做真机验收；当前 VNext M3 包为 `android-7145ba0ea3d2`。**
6. **VNext Plan M1–M3 已进入 master；用户已明确重定义下一阶段产品方向：学习改为独立 AI 目标规划、AI 安排升级为对话式调度、课程支持单次调课/换课、四象限手机同屏可关闭、Today 极简、多模态随手记、设置/通知/任务表单重做。按 M4–M8 新方案推进，不再沿用旧的“Study 关联 Course / M4 仅拖拽过滤”方向。**

---

## 0. 仓库收口与基础门禁（P0）— ✅ 已完成

### 旧 PR 收口

- [x] PR #23 被 PR #25 / `docs/study-mode/` 替代并关闭。
- [x] PR #24 已 squash 合并为 `fad1a619`，课程任务统一进入共享 Task Store。
- [x] PR #27 已由后续 #28/#29/#30/#36 的更完整 Phase 12 安全与真实 PostgreSQL 验证覆盖，关闭旧分支避免重复维护。
- [x] PR #14 已关闭；剩余 Timeline M3 要求迁移到 Issue #26，从最新 master 重做。

### Phase 12 安全与数据库门禁

- [x] PR #28：处理中不可重放、并发竞争恢复、回滚失败传播、`(userId, requestId)` 查询隔离等安全测试。
- [x] PR #29：CI 启动全新 PostgreSQL 16，执行全部 Prisma migrations，并验证 `prisma migrate status`。
- [x] PR #30：真实 Prisma/PostgreSQL 执行 V2 导入并重复相同 `requestId`；数据库最终仅保留一份 batch / course / course event。
- [x] PR #32：`/api/health` 暴露 `buildSha`；Docker 支持 `BUILD_SHA`；部署手册要求 Git HEAD = 容器 BUILD_SHA = 公网 health buildSha。
- [x] PR #33：后端 CORS 始终显式允许受控 Capacitor Origin，同时保留配置的 Web Origin。
- [x] PR #34：Android CI 校验生产 API 地址、校验构建产物、用 commit SHA 命名 APK，并自动发布 GitHub prerelease。
- [x] PR #36：真实 PostgreSQL 验证同 requestId 并发竞争、事务失败 rollback、同 requestId 跨用户隔离。

**仓库/CI 侧安全基线已经收口，后续不要重复实现同一套幂等、migration、真实数据库并发/rollback 或 APK 可追溯机制。**

---

## 1. Phase 12：腾讯云生产验收（P0，当前唯一主线）

以 Issue #31 为执行清单。

### A. 部署版本与 migration

- [x] 已从 `master@99ebb3c` 构建腾讯云 API 镜像并写入 `BUILD_SHA`。
- [x] 公网 `/api/health.buildSha`、服务器 Git HEAD、运行镜像均已对齐 `99ebb3c`。
- [x] 腾讯云生产库 `prisma migrate status` 已核验：20 migrations，schema up to date。
- [x] `20260919130000_add_study_folders` 已应用并通过 StudyController 路由启动核验。
- [x] `20260914050000_add_schedule_plans` 已包含在生产 migration chain。
- [x] `20260915120000_add_course_import_idempotency` 已包含在生产 migration chain。
- [x] 生产 migration chain 已覆盖 `course_import_batches` 与课程来源/import 字段；CI 与生产 status 均通过。

### B. 生产 API 冒烟

使用正常测试账号，不触碰其他用户数据：

- [ ] 登录 / Session 恢复。
- [ ] semesters、courses、tasks、schedule/calendar 读取。
- [ ] Planner Preview → Apply → Undo，使用可删除的测试任务。
- [ ] 核对服务端日志无 migration / auth / CORS 异常。

### C. Web 真实教务导入

- [ ] 真实学校路径：获取 → 返回 → 预览 → 导入。
- [ ] 服务端重复/冲突预览可见。
- [ ] 同一 `requestId` 重放不产生副本。
- [ ] 已有学期路径不静默覆盖无关历史课程。
- [ ] 未知结果/超时后先按 `requestId` 查询，再决定是否重试。

### D. Android 真机

使用最新 GitHub Release APK：

- [ ] 安装 VNext M3 Release `sparkflow-7145ba0ea3d2-debug.apk`（或之后同机制生成的更新包）。
- [ ] 登录成功；确认此前 CORS 分叉已消失。
- [ ] Session 刷新/重启后恢复。
- [ ] SchoolImport / 文件降级 → 返回 SparkFlow → 预览 → 导入。
- [ ] 重复提交仍然幂等。
- [ ] 360px 等效窄屏、safe-area、软键盘、文件选择可用。

**完成门槛**：腾讯云 migration + buildSha 可追溯、Web 真实导入、Android 真机登录/导入、Planner 生产闭环全部通过；失败/重试后无重复或半成品数据。

---

## 2. Phase 12：数据库回归防护（P1）

真实 PostgreSQL CI 当前已经覆盖：

- [x] 首次导入 + 相同 requestId 顺序 replay。
- [x] 两个并发请求竞争相同 requestId，最终一份 commit + 一份 replay。
- [x] 事务在 batch 创建后失败时完整 rollback，不残留 batch/course。
- [x] 两个用户复用相同 requestId 时结果和课程数据保持用户隔离。
- [ ] 客户端断连/超时但数据库已提交的 HTTP 端到端未知结果恢复测试。

最后一项更适合与 Issue #31 的生产/HTTP 验收一起验证，不再阻塞数据库代码本身的收口。

---

## 3. 平台与发布治理（P0/P1，可与生产验收并行）

- [x] Vercel 账户实际项目列表已确认只剩 `sparkflow031`；旧 `sparkflow` / `sparkflow-psi1` 项目本体已不存在。
- [x] Android workflow 会核验 `.env.production` 指向 `https://api.fish-life.cc.cd/api`。
- [x] Android workflow 会在 Vite build 后确认生产 API 真正嵌入 bundle。
- [x] APK 文件名、Actions artifact 和 GitHub Release 均绑定 commit SHA；Release 中记录 APK SHA-256。
- [ ] 继续区分/清理 GitHub 中残留的旧 Vercel status context，避免误导 PR 判断。
- [ ] 处理 Vercel Hobby `build-rate-limit`，恢复稳定 Preview/Production 部署信号。
- [ ] 确认 GitHub 必需检查只依赖有效 Web/API CI 与当前有效部署信号。

完成门槛：代码 CI、Vercel 部署状态、Android Release 均能明确追溯且互不混淆。

---

## 4. Phase 14：核心效率闭环收口（P1）

不重复实现已经进入 master 的 Today、四象限、甘特图、Focus、Planner 基础能力。

剩余范围：

- [ ] M3 Timeline V2 余项按 Issue #26 从最新 master 重新实现，并保留现有甘特能力。
- [ ] M4 自然语言意图解析；确定性 Scheduler 继续作为唯一排程决策层。
- [ ] M4 “帮我顺延”模式及生产/真机验收。
- [ ] M5 Daily Receipt 与 PNG 分享。
- [ ] M5 历史核心页面深色 Token 迁移。
- [ ] M5 Settings V5 分组整理，保持现有数据能力和 storage key 不变。
- [ ] M5 Android Widget 最后实施，不阻塞 Web 主线。

完成门槛：`今天 → 待办 → 时间轴 → AI 安排 → 专注 → 完成` 在 Web/PWA/Android 均有真实闭环验收。

---

## 4.5 VNext 信息架构与 Plan Workspace（M1–M3 ✅ 代码/CI，🚧 生产与真机验收）

方案：[vnext-information-architecture-plan-workspace.md](vnext-information-architecture-plan-workspace.md)

- [x] PR #47：详细信息架构与实施方案合入。
- [x] PR #48 / M1：底部导航固定为“今天 / 计划 / 记录 / 学习 / 我的”；PlanWorkspace 与 Month / Week / Agenda / Timetable 壳层、旧入口兼容、视图记忆。
- [x] PR #49 / M2：Task / Course / CalendarEvent / Study Task 统一前端投影；真实月/周/日程/时间表；课程周次与重复来源去重。
- [x] PR #50 / M3：Planner Preview 以临时时间块叠加到 Week / Agenda；Apply 后转为真实 Task 排程；Undo 恢复；未修改 Planner API 契约。
- [x] 三批均通过 Web build/tests 与现有 API/fresh PostgreSQL CI。
- [x] Vercel Production 已从 `master@e883b9a3` 源码显式发布：`dpl_BSM7vB7tF2V43sfDLw8cNPH2Pf6e` READY，`fish-life.cc.cd` HTTP 200；bundle 静态核验包含“今天 / 计划 / 记录 / 学习 / 我的”和 M3“返回计划查看时间块预览”。
- [ ] Web/PWA 真实账号：Month / Week / Agenda / Timetable + Planner Preview → Apply → Undo。
- [x] Android VNext M3 commit-stamped APK 已生成：Release `android-7145ba0ea3d2` / `sparkflow-7145ba0ea3d2-debug.apk`。
- [ ] Android 真机：360px、safe-area、底栏、周视图密度、课表、Planner 闭环。
- [ ] M4（拖拽、过滤、视觉细化）仅在上述真实验收稳定后启动。

核心约束继续保持：PlanItem 只是一层前端视图模型；Task / Course / CalendarEvent / Planner / Focus 仍为现有事实源，不创建第二套 Schedule/StudySchedule。

---

## 4.6 VNext M4–M8：AI 调度中枢与产品重整（✅ 方案，⏭ 下一产品主线）

方案：[vnext-ai-orchestration-study-course-capture.md](vnext-ai-orchestration-study-course-capture.md)

用户已确认的新方向：

- [x] **M4.1 / 通知正确性**：PR #55 已修 PushService 用户隔离、`reminderAt` 优先、每任务/提醒/订阅的持久化 delivery key；新增 server-only `notification_deliveries` migration 并通过 fresh PostgreSQL CI。
- [x] **M4.2 / Today 极简**：PR #55 已移除日期选择 / WeekStrip / RhythmDial / FreeTime / TodayProgress / Review 卡片；Today 固定读取真实今天，只显示统一“今日安排”。
- [x] **M4.3 / 新建任务 UI**：PR #56 已新增统一浅色 Task Sheet；常用字段首屏，提醒/重复/指定开始时间进入“更多设置”；支持“保存并交给 AI 安排”。旧编辑详情暂保留，避免移除子任务/Pomodoro。
- [x] **M4.4 / 四象限**：PR #56 已将 Plan 待办切换为“列表 / 四象限”；手机端同屏 2×2，选择持久化；旧 Board 入口兼容映射到四象限。
- [ ] **M4.5 / Settings 新壳层**：重做“我的/设置”为偏好、连接、数据、账户安全、诊断等分组二级页；补四象限启用开关与通知设置入口。
- [ ] **M5 / AI 规划与调整 2.0**：把固定“AI 帮我安排”改为对话式助手；AI 根据需求缺口自主访谈，不限制固定问题数；保存持续 Planning Context（已确认目标/约束/偏好/策略/假设/revision）；当规划依赖外部事实时自动联网研究，保存来源/获取时间/有效期并在过期后重新核验；支持文字 + 语音、临时想法/任务、增量重规划、目标替换、Preview → Apply → Undo。
- [ ] **M6 / 学习目标 AI**：Study 与 Course 完全解耦；长期目标绑定持续 Planning Context；AI 尽可能了解成功标准、当前水平、资源、时间预算、偏好与取舍，并可主动核实考试规则、官方大纲、报名/考试时间、目标要求与资源版本等当前信息，再拆阶段/里程碑/Task；后续冲突、执行效果、外部事实变化和目标变化沿用上下文增量调整。
- [ ] **M7 / 课程灵活调整**：调课、换课、停课、补课；单次变动使用 CalendarEvent override，不静默修改 Course 周期模板；AI 可自然语言操作同一套 Preview/Apply/Undo。
- [ ] **M8 / 多模态记录与设置收尾**：随手记支持文字/语音/图片/视频；附件从属 Inspiration；完善通知设置、安静时段、测试通知和设置页视觉。

### M4 第一优先级安全修复 — ✅ 已完成

PR #55 已完成：

1. 到期/提醒任务按 userId 分组；
2. 只发送到同 userId 的 subscriptions；
3. `reminderAt` 优先于 `dueDate`，无显式提醒时保留 due-soon fallback；
4. `notification_deliveries.deliveryKey` 唯一约束防 cron 重复推送；
5. 仅在通道发送成功后写 delivery，临时失败仍可重试；
6. 新表启用 RLS 并拒绝 anon/authenticated 直连。

该隐私/正确性风险已由代码 + migration + CI 收口；生产部署仍需按 API 发布流程执行。

### 已明确取消/替代的旧方向

- Study 新 UI 不再关联 Course，也不显示“今日课程/课程管理”。
- 四象限移动端不再“一次只看一个象限”，改为完整 2×2。
- Today 不再显示 WeekStrip / RhythmDial / FreeTime / TodayProgress。
- “AI 帮我安排”固定日期/时间窗表单不再作为最终交互。
- 五项底栏固定后，Settings 不再暴露旧导航排序/显示设置。

---

## 5. Phase 15 M1：Capture → Review → Task（✅ 代码 + 生产核心链路已完成）

- [x] 服务端 `Inspiration` 成为记录事实源，支持 manual 随手记。
- [x] `InspirationReflection` 保留回顾历史，不覆盖原文。
- [x] 全局 Quick Add、记录卡片 / 回顾 / 自由墙、Today 回顾入口。
- [x] 新记录次日、Reflection +3 天、稍后 +1 天、已消化 +14 天。
- [x] 记录 → Task 并保留 `Task.inspirationId` 回链。
- [x] fresh PostgreSQL migration、Web/API CI、生产 API 与核心真实链路验收。

仍可后续增强但不阻塞 M1 收口：关键词搜索、离线 pending create、回顾左右滑动等体验项。

---

## 6. Phase 15 M2/M3：Insight → Action（🚧 代码完成，生产收尾）

### M2 Insight — ✅ 代码/数据库/API

- [x] `Insight` + `InsightInspiration` 正式 N:N 来源关系。
- [x] Theme / Evolution / Action 三类可解释 Insight。
- [x] 每个 Insight 展开真实来源；支持归档/删除。
- [x] OpenAI-compatible Provider 抽象与输出校验；虚构/越权 source id 不落库。
- [x] 腾讯云生产已应用 M2 migration。
- [x] **真实 AI Provider 已接通并出现 Qwen 生产调用证据**；PR #43 针对 qwen3.7-plus 默认 thinking、JSON 输出、Provider 超时与 429/5xx 短重试做了稳定性修复。
- [ ] 用真实账户复验多卡片 → Insight 的成功率、延迟与模型质量。

### M3 Insight → Task — ✅ 代码/API/Android，🚧 Web Production

- [x] PR #40：`Task.insightId`，一个 Insight 可产生多个 Task。
- [x] Action 洞察点击“加入待办”后先显示确认 Sheet；用户可改标题、时长、截止日期、优先级。
- [x] Task ↔ Insight 双向回链；Task 详情显示洞察与来源记录数量。
- [x] 普通 Task 编辑不能重新绑定 `insightId/inspirationId`；创建时校验 Insight 属于当前用户。
- [x] 腾讯云 API 已部署 `master@99ebb3c`；生产库共 20 migrations，状态 up to date。
- [x] GitHub CI 与最新 Android APK `android-5835e3223748` 成功；该包已包含 PR #43 的前端请求超时治理。
- [x] **Web Production 已发布 `master@99ebb3c`**：Production READY，首页 HTTP 200；仍需真实账户验证 Insight 75s 专用超时与普通 API 15s 有界超时。
- [ ] Web/Android 真机跑完整链路：记录 → 回顾 → Insight → 确认 Task → Planner → Timeline → Focus → Done。

### 发布策略

- Git 自动 Vercel deployments 关闭，避免每个短分支小 commit 消耗 Hobby 每日 deployment 次数。
- GitHub CI 是代码门禁；Vercel Production 在合并并确认 commit 后显式创建。
- 不把 Preview/health 200 当成业务验收。

### PR #43 稳定性补丁（已进入 master）

- Qwen/DashScope 请求关闭默认 thinking，并启用 JSON object 输出。
- Provider 超时提升为 60s；429/500/502/503/504 首次失败允许一次短重试。
- 普通 Web API 请求默认 15s 超时；Insight 生成单独允许 75s。
- Provider 失败写入不含密钥/用户内容的安全摘要日志；前端区分 408 请求超时。
- 该补丁已进入 `master@99ebb3c` 并随腾讯云 API/Vercel Production 上线；真实账户链路仍需验收。

---

## 7. Study / 学习工作区（旧 M1 已部署，新方向已重定义）

旧 StudyFolder M1 代码仍在仓库，但产品方向已于 2026-09-19 重定义：

- 不再把 Course 作为 Study 的组成部分；
- StudyFolder 升级为“学习目标容器”，继续复用 StudyFolderTask；
- 新 UI 围绕“目标 → AI 追问 → 阶段/里程碑 → Task → 日程 → 重新规划”；
- 课程继续由独立 Course 模块管理；
- 旧 StudyFolderCourse 关系暂时只保留兼容，不在新 UI 中继续使用。

后续实施以 [vnext-ai-orchestration-study-course-capture.md](vnext-ai-orchestration-study-course-capture.md) 的 M6 为准，旧 Study Mode M2/M3/M4 路线不再作为近期执行依据。

---


## 8. Phase 13：Local Codex Bridge（P2）

启动条件：Phase 12 / 14 / 15 的用户主链路稳定，且可在受支持的 Windows/macOS 环境完成 Node 24、Bridge、Gateway 与 native Codex 联调。

- [ ] loopback Gateway 与只读状态/工具契约。
- [ ] 只读监督 UI。
- [ ] 分批开放 turn/observe、steer/respond/interrupt、UNKNOWN 对账与验收。

不进入云端 API/数据库控制链路，不建立第二套 Codex runtime 或 transcript 数据库。

---

## 暂不进入主线

- Phase 09 中通用任务课程筛选、批量换课、独立 EventsView：待真实需求重估。
- Phase 10 中 Web Push 生产配置、扩展事件类型：在 Phase 12/14 稳定后另立短期方案。
- Phase 10 原“灵感转任务”不再单独推进，由 Phase 15 接管。
- 已取消的 CURRENT_CONTEXT、`@start`、`@duration` md 协议不得恢复。

## 每批次通用门禁

1. 从最新 `master` 建短期分支，避免长期叠加 PR。
2. Web/API 对应 build 与 tests 通过；数据库相关改动同时通过 fresh PostgreSQL migration + targeted E2E。
3. 数据库 migration 必须 additive、可备份、可验证，不与未经合并的 migration 并行冲突。
4. API 自托管镜像必须带 `BUILD_SHA`；生产验收记录必须能追溯到明确 commit。
5. Android 构建必须通过生产 API gate，并发布带 commit 的 APK；Android 相关功能仍必须至少做一次真机登录/网络/导航回归。
6. Preview / CI / health 200 都不等于生产业务验收完成。
7. 文档状态只写已证实事实：代码存在、CI 通过、生产可用分别记录。
8. 每次合并、生产迁移或真实设备验收后，同步更新 `NEXT.md`、相关 Phase、`INDEX.md` 与 `PROJECT_BLUEPRINT.md`。
