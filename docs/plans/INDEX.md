# SparkFlow — 实施方案索引

> **最后更新**：2026-09-19 | **代码基线**：`master@735944fd`
>
> 近期执行顺序只在 [NEXT.md](NEXT.md) 维护；Phase 文档负责范围、约束和验收，不各自争夺优先级。

## 当前主线

| 文件 | 范围 | 状态 | 当前动作 |
|---|---|---|---|
| [NEXT.md](NEXT.md) | 唯一近期执行队列 | 🚧 | VNext M4.1–M4.4 已通过 PR #55/#56 进入 `master@735944fd`；当前下一步是 M4.5 Settings，随后进入 M5 AI 规划与调整 2.0 |
| [phase12-course-import-experience.md](phase12-course-import-experience.md) | 课程导入、作息、幂等、冲突与真机验收 | 🚧 当前 P0：生产验收 | V2 安全实现、fresh PostgreSQL migrations、顺序/并发 replay、rollback、用户隔离真实 PG E2E 已完成；当前只把生产 migration、真实 Web/Android、Planner 真账号闭环作为 P0 |
| [phase14-rhythm-experience.md](phase14-rhythm-experience.md) | Phase 14 | 🚧 部分完成 | M3 Timeline 余项由 Issue #26 承接；继续自然语言意图、顺延、Daily Receipt、深色、Settings 与 Widget |

## 下一产品批次

| 文件 | Phase | 状态 | 启动条件 |
|---|---|---|---|
| [phase15-capture-review-insight-action.md](phase15-capture-review-insight-action.md) | 15 | 🚧 M1–M3 已实现，生产收尾 | PR #38/#39/#40 已合并；PR #43 已补 Qwen/请求超时稳定性；真实 Provider 已有生产调用证据，当前需发布 `5835e322` 并完成真实 AI/真机验收 |

## 候选方案（已完成设计、未排期实施）

| 文件 | 范围 | 状态 | 说明 |
|---|---|---|---|
| [vnext-information-architecture-plan-workspace.md](vnext-information-architecture-plan-workspace.md) | VNext 信息架构、五工作空间、Plan 四视图、课程/任务/Planner 统一投影 | 🚧 M1–M3 已发布，待真账号/真机 | PR #48/#49/#50 已合并；Web Production `dpl_BSM7vB7tF2V43sfDLw8cNPH2Pf6e` READY，五项导航/M3 bundle 已静态核验；Android M3 Release `android-7145ba0ea3d2` 已生成 |
| [vnext-ai-orchestration-study-course-capture.md](vnext-ai-orchestration-study-course-capture.md) | VNext M4–M8：AI 调度中枢、目标学习、课程变动、多模态记录、通知/设置/任务表单重整 | 🚧 M4.1–M4.4 已完成 | PR #55：通知隔离 + Today 极简；PR #56：新建 Task Sheet + 手机同屏四象限；下一步 M4.5 Settings，然后 M5 对话式 AI + 语音 + Planning Context + Web Research |
| [../study-mode/README.md](../study-mode/README.md) | 旧 Study Mode 方案 | ⚠️ 历史参考 | M1 已实现，但“Study 关联 Course”的产品方向已被 VNext M6 替代；后续学习以独立 AI 目标规划为准 |
| [phase13-local-codex-bridge.md](phase13-local-codex-bridge.md) | 13 / Local Codex Bridge | ⬜ 方案完成，未实施 | Phase 12 / 14 / 15 的用户主链路稳定后再启动；不进入云端 API/数据库控制链 |

## 仓库与近期里程碑

| 项目 | 状态 | 结果 / 后续 |
|---|---|---|
| PR #23 Study Mode proposal | ✅ 已关闭 | 被已合并的 PR #25 与 `docs/study-mode/` 替代 |
| PR #24 Course linked tasks | ✅ 已合并 | `fad1a619`；课程任务统一进入共享 Task Store |
| PR #14 Timeline V2 | ✅ 旧 PR 已关闭 | 剩余 M3 要求迁移到 Issue #26，从最新 master 重做 |
| PR #28 Phase 12 safety tests | ✅ 已合并 | `a1fe22c6`；补齐处理中、并发竞争、回滚、用户范围查询等安全证据 |
| PR #29 PostgreSQL migration CI | ✅ 已合并 | `526b234e`；全新 PostgreSQL 16 可执行完整 migrations 且状态一致 |
| PR #30 PostgreSQL import replay E2E | ✅ 已合并 | `2ffbf448`；真实 Prisma/PG 导入 + 同 requestId replay 最终仅一份 batch/course/event |
| PR #32 API build SHA | ✅ 已合并 | `5158bad1`；health / Docker / 部署手册建立生产 commit 可追溯契约 |
| PR #33 Capacitor CORS | ✅ 已合并 | `38f6cdbc`；显式允许 `https://localhost` / `capacitor://localhost`，修复 Android 登录代码侧高概率分叉 |
| PR #34 Android release gate | ✅ 已合并 | `8e7e0700`；生产 API 双重校验、commit 命名、SHA-256、GitHub prerelease 自动发布 |
| PR #35 Planning sync | ✅ 已合并 | `7afb7bb4`；NEXT / INDEX / BLUEPRINT 对齐生产验收主线 |
| PR #36 Real PostgreSQL safety E2E | ✅ 已合并 | `4569a3a1`；真实 PG 并发同 request、事务 rollback、同 requestId 跨用户隔离全部通过 |
| PR #38 Phase 15 M1 | ✅ 已合并 | Capture → Review → Task；生产 API/Web 核心链路已验收 |
| PR #39 Phase 15 M2 | ✅ 已合并 | 可解释 Theme/Evolution/Action Insight；生产 API/DB 已部署，真实 Qwen Provider 已出现生产调用证据 |
| PR #40 Phase 15 M3 | ✅ 已合并 | Insight → 用户确认 Task + 双向来源回链；CI/API/Android 已完成 |
| PR #41 duplicate M3 | ✅ 已关闭 | 被 PR #40 完整实现替代，避免重复 migration/API 变体 |
| PR #43 Qwen insight stability | ✅ 已合并 | `master@5835e322`；关闭 Qwen thinking、启用 JSON mode、Provider 重试/超时与 Web API 有界超时 |
| PR #47 VNext IA proposal | ✅ 已合并 | 五工作空间与 Plan M1–M4 详细方案 |
| PR #48 VNext Plan M1 | ✅ 已合并 | 固定五项主导航、PlanWorkspace、四视图壳层、旧入口兼容与视图记忆 |
| PR #49 VNext Plan M2 | ✅ 已合并 | Task/Course/CalendarEvent/Study Task 统一投影，真实 Month/Week/Agenda/Timetable |
| PR #50 VNext Plan M3 | ✅ 已合并 | Planner Preview 临时时间块、Apply 转真实排程、Undo 恢复；CI 全绿 |
| VNext Web Production | ✅ 已发布 / 🚧 待业务验收 | `fish-life.cc.cd` 指向 READY 部署 `dpl_BSM7vB7tF2V43sfDLw8cNPH2Pf6e`；首页 200，五项导航与 M3 Preview 文案已在生产 bundle 核到；Vercel deployment meta 因手工 codeload 发布为空，SHA 映射记录在 NEXT |
| Android VNext M3 | ✅ APK 已生成 / 🚧 待真机 | Release `android-7145ba0ea3d2`；asset `sparkflow-7145ba0ea3d2-debug.apk`；对应功能提交 `7145ba0ea3d2` |
| PR #27 legacy Phase 12 tests | ✅ 已关闭 | 被 #28/#29/#30/#36 更完整的安全与真实 PostgreSQL 验证覆盖 |

## 活跃执行 Issue

| Issue | 范围 | 优先级/时机 |
|---|---|---|
| #31 Phase 12 production acceptance | 腾讯云 buildSha/migrations、生产 API、真实 Web/Android 教务导入、Planner、未知网络结果恢复 | **当前唯一 P0 主线** |
| #26 Phase 14 M3 Timeline V2 reconciliation | 保留 Gantt 的前提下，从最新 master 重做 Month/Week/Day Timeline 与真实设备验收 | Issue #31 关闭/稳定后进入 Phase 14 收口 |

## Phase 12 当前事实

### 已由代码 / CI / 真实 PostgreSQL 证实

- V2 `requestId` / payload hash。
- stable course fingerprint、duplicate / conflict preview、skip / keep policy。
- `Serializable` Prisma transaction 与 `CourseImportBatch` 结果查询 / replay。
- fresh PostgreSQL 16 完整 migration chain 成功。
- 真实 PG 顺序 replay 不重复写入。
- 真实 PG 同 requestId 并发竞争最终只保留一次 commit，并返回一次 replay。
- 真实 PG 事务中途失败完整 rollback，不残留 batch/course。
- 真实 PG 中同 requestId 可被不同用户独立使用，结果与课程保持用户隔离。
- API 自托管镜像支持 `BUILD_SHA`，health 可回显部署 commit。
- Android Capacitor Origin 已加入 API CORS allowlist。
- Android APK CI 会验证 production API，生成 commit-stamped APK，并发布 GitHub prerelease。

### 仍未关闭

- ~~腾讯云运行镜像 buildSha / production migration 状态~~：已确认 `master@1e5f8356`、19 migrations up to date。
- Web 真实学校导入、重复提交与未知网络结果恢复。
- Android 最新 Release 的真机登录、Session、SchoolImport/文件导入与窄屏交互。
- Planner 生产 Preview → Apply → Undo。
- HTTP 层“客户端超时/断连但服务端已经提交”的端到端恢复验证。

## 平台 / 发布状态

- Vercel 连接当前只发现 `sparkflow031` 一个真实项目；旧 `sparkflow` / `sparkflow-psi1` 项目本体已不在项目列表。
- Vercel Hobby 已实际触发 `api-deployments-free-per-day`（>100/day）；已关闭 Git 自动 deployments，后续 Web 采用 CI 后显式 Production 发布。
- Android 最新自动 Release：`android-5835e3223748`，资产 `sparkflow-5835e3223748-debug.apk`；对应 `master@5835e322`。
- `/health` 200 只说明进程存活；只有带明确 `buildSha` 且真实业务路径通过，才算生产证据。

## 冻结 / 待重估

| 文件 | 原范围 | 状态 | 处理方式 |
|---|---|---|---|
| [phase09-course-module.md](phase09-course-module.md) | Course 深化、课程任务、课表与事件追踪 | ⚠️ 大量已覆盖 | 剩余项需真实需求后拆新方案 |
| [phase10-pending-features.md](phase10-pending-features.md) | 历史待办收束 | ⚠️ 逐项重估 | md 协议已取消；认证已完成；“灵感转任务”由 Phase 15 接管，其余 P2 |
| [p0-phase12-execution.md](p0-phase12-execution.md) | 旧 P0/Phase 12 执行清单 | ⚠️ 被替代 | 旧 Render/Supabase 基线仅作历史参考；执行以 NEXT + Phase 12 + Issue #31 为准 |
| [course-schedule-enhancements.md](course-schedule-enhancements.md) | 课程表功能完善记录 | ⚠️ 实现记录 | 已实现能力的补充说明；未完成项并入 Phase 12/14，不单独推进 |

## 归档

| 文件 | Phase | 简述 |
|---|---|---|
| [../archive/phase11-auth-registration-onboarding.md](../archive/phase11-auth-registration-onboarding.md) | 11 | 早期账户/Onboarding 历史方案；生产认证后来被腾讯云自建认证替代 |
| [../archive/phase08-capacitor-setup.md](../archive/phase08-capacitor-setup.md) | 08 | Capacitor Android APK 打包与联调 |
| [../archive/phase08-google-calendar-sync.md](../archive/phase08-google-calendar-sync.md) | 08 | Google Calendar 双向同步架构（历史部署描述） |
| [../archive/2026-05-29-improvement-plan.md](../archive/2026-05-29-improvement-plan.md) | — | 2026-05-29 改进与历史设计决策 |
| [../archive/2026-05-29-p0-execution-plan.md](../archive/2026-05-29-p0-execution-plan.md) | — | 2026-05-29 P0 执行计划 |
| [../archive/2026-05-29-post-md-transition-audit.md](../archive/2026-05-29-post-md-transition-audit.md) | — | 去 md 架构后的审计记录 |

## 状态口径

- ✅ 代码/仓库状态已确认；涉及功能完成时仍需对应层级的验收证据。
- 🚧 表示已有实现或正在推进，但仍有明确未关闭项。
- ⬜ 表示方案存在、尚未实施；若仅 M0 文档/设计完成，会明确写出。
- ⚠️ 表示文档保留，但不得直接按旧基线继续开发。
- ❌ 表示已取消或已被新架构/新方案替代。

## 管理规则

1. 新的近期动作先进入 `NEXT.md`，再链接到对应 Phase / Issue。
2. 架构迁移后，旧方案保留历史决策，但必须明确“已被替代”，不得继续写成生产现状。
3. 开放 PR 若落后 master，必须先做能力对账；禁止仅因旧 PR 曾通过 CI 就直接合并。
4. “代码存在”“CI 成功”“生产可用”必须使用不同状态口径。
5. 每次合并、生产迁移或真实设备验收后同步更新 NEXT、相关 Phase、INDEX 和 BLUEPRINT。
