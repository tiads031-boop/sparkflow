# SparkFlow — 下一步执行队列

> **最后更新**：2026-09-18 | **代码基线**：`master@8e7e0700`
>
> 本文件是唯一近期执行队列。其他 Phase 文档只负责范围、约束与验收细节；若与本文件冲突，以代码/生产事实和本文件顺序为准。

## 当前生产与仓库基线

| 范围 | 已确认事实 |
|---|---|
| 数据与认证 | 腾讯云独立自建 PostgreSQL + SparkFlow API 自建密码/会话认证；与 DeepTutor 数据库隔离 |
| API | `https://api.fish-life.cc.cd`，Nginx 反向代理至 NestJS；`/api/health` 已具备 `buildSha` 契约，但腾讯云当前实际运行 commit 仍需部署后核验 |
| Web | Vercel 主项目 `sparkflow031`，生产域名 `fish-life.cc.cd`；Vercel 当前账户仅保留该项目，旧 status context 仍可能残留 |
| GitHub | `master@8e7e0700`；PR #28–#34 已全部合并；Issue #31 承接 Phase 12 生产验收 |
| Phase 12 CI | PostgreSQL 16 全量 migration、API build/test、真实 Prisma/PostgreSQL 导入重放 E2E 已纳入 CI |
| Android | Capacitor CORS 已补齐 `https://localhost` / `capacitor://localhost`；APK CI 会核验生产 API、写入 commit 标识并发布 GitHub prerelease |
| 最新 APK | Release `android-8e7e0700f894`；`sparkflow-8e7e0700f894-debug.apk`；生产 API 地址在构建前后均已校验 |
| 部署噪声 | Vercel Hobby build-rate-limit 仍可能导致部署状态失败；不得把平台额度失败等同于代码 CI 失败 |

## 近期总原则

1. **Phase 12 的服务端安全代码、全量 migration CI 和真实 PostgreSQL 基础幂等 E2E 已具备；当前唯一 P0 主线是 Issue #31 的腾讯云生产 + Web/Android 真机验收。**
2. **没有腾讯云 migration、`buildSha`、真实账户和真机证据前，不把 Phase 12 宣布为生产完成。**
3. **Android “Web 正常、App 无法登录”的代码侧高概率 CORS 分叉已修复，但必须用最新 Release 真机复测后才能关闭。**
4. **Phase 14 不重复已经进入 master 的 Today、四象限、甘特、Planner、Focus；M3 余项由 Issue #26 承接。**
5. **Phase 15 先做 M1（Capture → Review → Task），AI Insight 放 M2。**
6. **Study Mode 已有方案但暂不抢占主线；Local Codex Bridge 保持 P2。**

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

**仓库/CI 侧安全基线已经收口，后续不要重复实现同一套幂等、migration 或 APK 可追溯机制。**

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

## 2. Phase 12：仍需补强但不阻塞首轮生产验收的数据库场景（P1）

当前已有真实 PostgreSQL 的 migration 与“首次导入 + 相同 requestId replay”E2E；以下更复杂场景仍可继续补：

- [ ] 两个真实数据库连接同时竞争同一 requestId 的并发 E2E。
- [ ] 数据库事务中途失败后的真实 rollback E2E。
- [ ] 客户端断连/超时但数据库已提交的端到端恢复测试。
- [ ] 两个用户的真实 PostgreSQL import-result 隔离 E2E。

这些不能替代 Issue #31 的生产验收，但可继续提高回归防护等级。

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

## 5. Phase 15 M1：Capture → Review → Task（P1，下一产品批次）

启动条件：Phase 12 的生产真实导入闭环完成，Phase 14 没有阻断级回归。

- [ ] 将前端旧 `Spark` 主链路迁移到服务端 `Inspiration` 事实源。
- [ ] `sourceUrl` 改为 nullable，支持 `manual` 随手记。
- [ ] 全局 Quick Add 提供“随手记”，目标 5 秒内完成一条记录。
- [ ] “灵感”升级为“记录”：卡片 / 回顾；自由墙作为可选视图保留。
- [ ] 新增 Reflection 历史，不覆盖原始记录正文。
- [ ] Today 提供轻量每日回顾入口。
- [ ] 支持记录 / Reflection → Task，并保留来源回链。
- [ ] Web/Android 真实账户验收、跨用户隔离和 migration 测试。

完成门槛：一条随手记可以经过回顾后由用户确认转成 Task，并继续进入 Planner / Timeline / Focus。

---

## 6. Phase 15 M2：Insight → Action（P1/P2）

- [ ] Theme / Evolution / Action 三类 Insight。
- [ ] 每个 Insight 必须展示来源卡片，可解释、可删除、可归档。
- [ ] AI 只产生候选，不自动修改原记录、不自动创建 Task。
- [ ] ActionSuggestion 经用户确认后创建 Task。
- [ ] Task ↔ Insight 双向回链，能回答“为什么做这个任务”。

首版不引入向量数据库、知识图谱或独立 RAG 基础设施。

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
