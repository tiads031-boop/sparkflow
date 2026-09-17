# SparkFlow — 实施方案索引

> **最后更新**：2026-09-17 | **代码基线**：`master@14b523ad`
>
> 近期执行顺序只在 [NEXT.md](NEXT.md) 维护；Phase 文档负责范围、约束和验收，不各自争夺优先级。

## 当前主线

| 文件 | 范围 | 状态 | 当前动作 |
|---|---|---|---|
| [NEXT.md](NEXT.md) | 唯一近期执行队列 | 🚧 | 仓库收口 → Phase 12 数据安全/真实导入 → Phase 14 收口 → Phase 15 M1 |
| [phase12-course-import-experience.md](phase12-course-import-experience.md) | 课程导入、作息、幂等、冲突与真机验收 | 🚧 | 当前 P0；完成服务端安全导入与 Web/Android 真实路径验收 |
| [phase14-rhythm-experience.md](phase14-rhythm-experience.md) | 14 | 🚧 部分完成 | 对账旧 PR #14；继续自然语言意图、顺延、Daily Receipt、深色、Settings 与 Widget |

## 下一产品批次

| 文件 | Phase | 状态 | 启动条件 |
|---|---|---|---|
| [phase15-capture-review-insight-action.md](phase15-capture-review-insight-action.md) | 15 | ⬜ 方案已确认，未实施 | Phase 12 数据安全/真实导入闭环完成，且 Phase 14 无阻断级回归后启动 M1：Capture → Review → Task；AI Insight 放 M2 |

## 候选方案（已完成设计、未排期实施）

| 文件 | 范围 | 状态 | 说明 |
|---|---|---|---|
| [../study-mode/README.md](../study-mode/README.md) | Study Mode、Study Home、学习文件夹、复习闭环、习惯与导出 | ⬜ M0 完成 | PR #25 已合并；复用 Today / Task / Calendar / Planner / Focus / Course，不建立第二套事实源；实施拆分见 [roadmap](../study-mode/roadmap.md) |
| [phase13-local-codex-bridge.md](phase13-local-codex-bridge.md) | 13 / Local Codex Bridge | ⬜ 方案完成，未实施 | Phase 12 / 14 / 15 的用户主链路稳定后再启动；不进入云端 API/数据库控制链 |

## 当前 PR 对账

| PR | 状态判断 | 处理方式 |
|---|---|---|
| #14 Timeline V2 | ⚠️ 基于旧 master，当前不可直接合并 | 对照当前 master 重新核对剩余能力；必要时以短期新分支替代，不强行 merge 旧 PR |
| #23 Study Mode proposal | ❌ 已被 #25 替代 | 关闭，避免误合并旧提案 |
| #24 Course linked tasks | 🚧 可合并、待最终回归 | 在当前 master 上核对冲突/回归，通过后合并并做生产冒烟 |

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

- ✅ 仅表示代码已合并且对应验收有证据；开放 PR 不标完成。
- 🚧 表示已有实现或正在验收，但仍有明确未关闭项。
- ⬜ 表示方案存在、尚未实施；若仅 M0 文档/设计完成，会明确写出。
- ⚠️ 表示文档或 PR 保留，但不得直接按旧基线继续开发。
- ❌ 表示已取消或已被新架构/新方案替代。

## 管理规则

1. 新的近期动作先进入 `NEXT.md`，再链接到对应 Phase 方案。
2. 已完成方案移至 `docs/archive/` 并修正 BLUEPRINT、INDEX 与相互链接。
3. 架构迁移后，旧方案保留历史决策，但必须明确“已被替代”，不得继续写成生产现状。
4. 开放 PR 若落后 master，必须先做能力对账；禁止仅因旧 PR 曾通过 CI 就直接合并。
5. 每次合并、生产迁移或真实设备验收后同步更新 NEXT、相关 Phase 和 BLUEPRINT。
