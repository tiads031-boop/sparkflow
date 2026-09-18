# SparkFlow — 下一步执行队列

> **最后更新**：2026-09-18 | **代码基线**：`master@1e5f8356`
>
> 本文件是唯一近期执行队列。其他 Phase 文档只负责范围、约束与验收细节；若与本文件冲突，以代码/生产事实和本文件顺序为准。

## 当前生产与仓库基线

| 范围 | 已确认事实 |
|---|---|
| 数据与认证 | 腾讯云独立自建 PostgreSQL + SparkFlow API 自建密码/会话认证；与 DeepTutor 数据库隔离 |
| API | `https://api.fish-life.cc.cd`，腾讯云已运行 `1e5f8356`；公网 `/api/health.buildSha` 与仓库一致；生产库 19 个 migrations 全部 up to date |
| Web | Vercel 项目 `sparkflow031`；当前 Production 仍为 M2 `3286458a`。M3 `1e5f8356` 本地 Web build 已通过，但 Hobby 当日 >100 deployments 硬限额阻止新 Production；已关闭 Git 自动 deployments，待额度恢复后显式发布 |
| GitHub | `master@1e5f8356`；Phase 15 M1/M2/M3 分别由 PR #38/#39/#40 合并；PR #41 为重复实现已关闭 |
| Phase 12 CI | PostgreSQL 16 全量 migration、API build/test、顺序 replay、并发 replay、rollback、跨用户隔离真实 Prisma/PostgreSQL E2E 已纳入 CI |
| Android | Capacitor CORS 已补齐 `https://localhost` / `capacitor://localhost`；APK CI 会核验生产 API、写入 commit 标识并发布 GitHub prerelease |
| 最新 APK | Release `android-1e5f8356089c`；`sparkflow-1e5f8356089c-debug.apk`；对应 M3 master，Android CI 成功 |
| 部署噪声 | Vercel Hobby 已触发 `api-deployments-free-per-day`（>100/day）；这不是代码失败。Git 自动 deployments 已在当前治理分支关闭，后续采用 CI 后显式 Production 发布 |

## 近期总原则

1. **Phase 15 M1/M2/M3 代码均已进入 master；不要再重复实现 Capture、Insight 或 Insight→Task。**
2. **当前第一收口项是 M3 Web Production：待 Vercel Hobby 每日 deployment 配额恢复后，将当前 master 显式发布并做真实浏览器验收。**
3. **M2 真正的 AI 生成仍缺生产 Provider 配置；未配置时 503 是预期降级，禁止用伪造洞察代替。**
4. **腾讯云 API 已部署到 `1e5f8356`，19 个 migrations 已应用；Phase 12 剩余重点缩小为真实 Web/Android 教务导入、Planner 与网络未知结果验收。**
5. **Android 继续以 commit-stamped Release 做真机验收；最新 M3 包为 `android-1e5f8356089c`。**
6. **M3 Web + AI Provider 真实验收完成后，再在 Phase 15 M4 主动助手、Study Mode、Phase 14 余项之间选择下一产品批次。**

---

## 0. 仓库收口与基础门禁（P0）— ✅ 已完成

### 旧 PR 收口

- [x] PR #23 被 PR #25 / `docs/study-mode/` 替代并关闭。
- [x] PR #24 已 squash 合并为 `fad1a619`，课程任务统一进入共享 Task Store。
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

- [ ] 从最新 `master` 构建腾讯云 API 镜像，并传入 `--build-arg BUILD_SHA=<git HEAD>`。
- [ ] 确认 `/api/health.buildSha` 与服务器仓库 `git rev-parse HEAD`、容器 `BUILD_SHA` 完全一致。
- [ ] 在腾讯云生产库运行/核验 `prisma migrate status`。
- [ ] 确认 `20260914050000_add_schedule_plans` 已执行。
- [ ] 确认 `20260915120000_add_course_import_idempotency` 已执行。
- [ ] 确认 `course_import_batches` 与课程来源/import 字段真实存在。

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

- [ ] 安装 `sparkflow-8e7e0700f894-debug.apk` 或之后同机制生成的更新包。
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
- [ ] **配置真实 AI Provider**（当前生产无 `AI_API_KEY` / OpenAI / DeepSeek key；生成接口按设计降级 503）。
- [ ] 配置后用真实账户验证多卡片 → Insight 的模型质量。

### M3 Insight → Task — ✅ 代码/API/Android，🚧 Web Production

- [x] PR #40：`Task.insightId`，一个 Insight 可产生多个 Task。
- [x] Action 洞察点击“加入待办”后先显示确认 Sheet；用户可改标题、时长、截止日期、优先级。
- [x] Task ↔ Insight 双向回链；Task 详情显示洞察与来源记录数量。
- [x] 普通 Task 编辑不能重新绑定 `insightId/inspirationId`；创建时校验 Insight 属于当前用户。
- [x] 腾讯云 API 已部署 `master@1e5f8356`；M3 migration 后生产库共 19 migrations，状态 up to date。
- [x] GitHub CI 与 Android APK `android-1e5f8356089c` 成功。
- [ ] **Web Production 发布 `1e5f8356`**：当前被 Vercel Hobby >100 deployments/day 限额阻断；额度恢复后显式发布。
- [ ] Web/Android 真机跑完整链路：记录 → 回顾 → Insight → 确认 Task → Planner → Timeline → Focus → Done。

### 发布策略

- Git 自动 Vercel deployments 关闭，避免每个短分支小 commit 消耗 Hobby 每日 deployment 次数。
- GitHub CI 是代码门禁；Vercel Production 在合并并确认 commit 后显式创建。
- 不把 Preview/health 200 当成业务验收。

---

## 7. Study Mode（候选主线，Phase 15 M1 稳定后评估启动）

当前状态：方案、路线图与九张参考设计图已通过 PR #25 合入 master，但运行时代码尚未实施。

建议顺序：

1. **M1：Study Mode 壳层 + Study Home + StudyFolder**
2. **M2：ReviewPlan / ReviewRecord + 固定间隔复习闭环**
3. **M3：StudyHabit / 周计划 / 热力图**
4. **M4：模板 / PDF / 年度统计导出**

核心约束：复用现有 Course / Task / Calendar / Planner / Focus；不建立第二套数据事实源。

第一阶段验收链路：`Folder → Today → Focus → Review → Schedule`。

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
