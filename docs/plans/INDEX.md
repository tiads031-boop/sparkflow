# SparkFlow — 实施方案索引

> **最后更新**：2026-09-17 | **代码基线**：`master@a1fe22c6`
>
> 近期执行顺序只在 [NEXT.md](NEXT.md) 维护；Phase 文档负责范围、约束和验收，不各自争夺优先级。

## 当前主线

| 文件 | 范围 | 状态 | 当前动作 |
|---|---|---|---|
| [NEXT.md](NEXT.md) | 唯一近期执行队列 | 🚧 | ✅ 仓库收口 → ✅ Phase 12 服务端安全代码/CI → 生产 migration + Web/Android 真实验收 → 平台治理 → Phase 14 收口 |
| [phase12-course-import-experience.md](phase12-course-import-experience.md) | 课程导入、作息、幂等、冲突与真机验收 | 🚧 当前 P0 | V2 幂等/事务/重复冲突代码已具备；当前转入腾讯云 migration、真实 PostgreSQL 与 Web/Android 验收 |
| [phase14-rhythm-experience.md](phase14-rhythm-experience.md) | Phase 14 | 🚧 部分完成 | M3 Timeline 余项由 Issue #26 承接；继续自然语言意图、顺延、Daily Receipt、深色、Settings 与 Widget |

## 下一产品批次

| 文件 | Phase | 状态 | 启动条件 |
|---|---|---|---|
| [phase15-capture-review-insight-action.md](phase15-capture-review-insight-action.md) | 15 | ⬜ 方案已确认，未实施 | Phase 12 真实导入闭环完成，且 Phase 14 无阻断级回归后启动 M1：Capture → Review → Task；AI Insight 放 M2 |

## 候选方案（已完成设计、未排期实施）

| 文件 | 范围 | 状态 | 说明 |
|---|---|---|---|
| [../study-mode/README.md](../study-mode/README.md) | Study Mode、Study Home、学习文件夹、复习闭环、习惯与导出 | ⬜ M0 完成 | PR #25 已合并；复用 Today / Task / Calendar / Planner / Focus / Course，不建立第二套事实源；实施拆分见 [roadmap](../study-mode/roadmap.md) |
| [phase13-local-codex-bridge.md](phase13-local-codex-bridge.md) | 13 / Local Codex Bridge | ⬜ 方案完成，未实施 | Phase 12 / 14 / 15 的用户主链路稳定后再启动；不进入云端 API/数据库控制链 |

## 仓库与近期里程碑

| 项目 | 最终状态 | 后续去向 |
|---|---|---|
| PR #23 Study Mode proposal | ✅ 已关闭 | 被已合并的 PR #25 与 `docs/study-mode/` 替代 |
| PR #24 Course linked tasks | ✅ 已合并 | `fad1a619`；课程任务统一进入共享 Task Store |
| PR #14 Timeline V2 | ✅ 旧 PR 已关闭 | 剩余 M3 要求迁移到 Issue #26，从最新 master 重做 |
| PR #28 Phase 12 safety tests | ✅ CI 成功并已合并 | `a1fe22c6`；补齐处理中、并发竞争、回滚、用户范围查询等安全证据 |

## 活跃执行 Issue

| Issue | 范围 | 优先级/时机 |
|---|---|---|
| #26 Phase 14 M3 Timeline V2 reconciliation | 保留 Gantt 的前提下，从最新 master 重做 Month/Week/Day Timeline 与真实设备验收 | Phase 12 主线完成/稳定后进入 Phase 14 收口 |

## Phase 12 当前事实

已实现并通过 CI 证实：

- V2 `requestId` / payload hash。
- stable course fingerprint。
- duplicate / conflict preview。
- skip / keep duplicate policy。
- `Serializable` Prisma transaction。
- `CourseImportBatch` 结果查询和成功 replay。
- `(userId, requestId)` 查询隔离与并发竞争/回滚相关单元测试。

仍未关闭：

- 腾讯云生产库 migration 是否已执行。
- 真实 PostgreSQL 并发、断连/超时、事务回滚验收。
- Web / Android 真实学校导入与重复提交验收。
- Android 登录、API 地址、TLS / 网络策略生产回归。

## 冻结 / 待重估

| 文件 | 原范围 | 状态 | 处理方式 |
|---|---|---|---|
| [phase09-course-module.md](phase09-course-module.md) | Course 深化、课程任务、课表与事件追踪 | ⚠️ 大量已覆盖 | 剩余项需真实需求后拆新方案 |
| [phase10-pending-features.md](phase10-pending-features.md) | 历史待办收束 | ⚠️ 逐项重估 | md 协议已取消；认证已完成；“灵感转任务”由 Phase 15 接管，其余 P2 |
| [p0-phase12-execution.md](p0-phase12-execution.md) | 旧 P0/Phase 12 执行清单 | ⚠️ 被替代 | 旧 Render/Supabase 基线仅作历史参考；执行以 NEXT + Phase 12 为准 |
| [course-schedule-enhancements.md](course-schedule-enhancements.md) | 课程表功能完善记录 | ⚠️ 实现记录 | 已实现能力的补充说明；未完成项并入 Phase 12/14，不单独推进 |

## 归档

| 文件 | Phase | 简述 |
|---|---|---|
| [../archive/phase11-auth-registration-onboarding.md](../archive/phase11-auth-registration-onboarding.md) | 11 | 早期账户/问候页实现；生产认证后来被腾讯云自建认证替代 |
| [../archive/phase08-capacitor-setup.md](../archive/phase08-capacitor-setup.md) | 08 | Capacitor Android APK 打包与联调 |
| [../archive/phase08-google-calendar-sync.md](../archive/phase08-google-calendar-sync.md) | 08 | Google Calendar 双向同步架构（历史部署描述） |
| [../archive/2026-05-29-improvement-plan.md](../archive/2026-05-29-improvement-plan.md) | — | 2026-05-29 改进与历史设计决策 |
| [../archive/2026-05-29-p0-execution-plan.md](../archive/2026-05-29-p0-execution-plan.md) | — | 2026-05-29 P0 执行计划 |
| [../archive/2026-05-29-post-md-transition-audit.md](../archive/2026-05-29-post-md-transition-audit.md) | — | 去 md 架构后的审计记录 |

## 状态口径

- ✅ 代码/仓库状态已确认；涉及功能完成时仍需有对应验收证据。
- 🚧 表示已有实现或正在推进，但仍有明确未关闭项。
- ⬜ 表示方案存在、尚未实施；若仅 M0 文档/设计完成，会明确写出。
- ⚠️ 表示文档保留，但不得直接按旧基线继续开发。
- ❌ 表示已取消或已被新架构/新方案替代。

## 管理规则

1. 新的近期动作先进入 `NEXT.md`，再链接到对应 Phase 方案。
2. 已完成方案移至 `docs/archive/` 并修正 BLUEPRINT、INDEX 与相互链接。
3. 架构迁移后，旧方案保留历史决策，但必须明确“已被替代”，不得继续写成生产现状。
4. 开放 PR 若落后 master，必须先做能力对账；禁止仅因旧 PR 曾通过 CI 就直接合并。
5. 每次合并、生产迁移或真实设备验收后同步更新 NEXT、相关 Phase 和 BLUEPRINT。