# SparkFlow — 实施方案索引

> **最后更新**：2026-09-15 | **代码基线**：`master@4d9ebe1`
>
> 近期顺序只在 [NEXT.md](NEXT.md) 维护；Phase 文档负责范围、约束和验收，不各自争夺优先级。

## 当前主线

| 文件 | 范围 | 状态 | 当前动作 |
|---|---|---|---|
| [NEXT.md](NEXT.md) | 唯一近期执行队列 | 🚧 | PR #14 验收合并 → 重复 Vercel 治理 → Phase 12 安全导入/真实验收 |
| [phase12-course-import-experience.md](phase12-course-import-experience.md) | 课程导入、作息、幂等、冲突与真机验收 | 🚧 | 下一开发批次为服务端 requestId/指纹/事务/结果查询；随后 Web/Android 真实导入 |

## 后续队列

| 文件 | Phase | 状态 | 启动条件 |
|---|---|---|---|
| [phase14-rhythm-experience.md](phase14-rhythm-experience.md) | 14 | 🚧 M3 在 PR #14；M4/M5 部分完成 | 先合并 M3 并完成 Phase 12 数据安全闭环，再继续意图解析、顺延、Daily Receipt、深色与 Widget |
| [phase13-local-codex-bridge.md](phase13-local-codex-bridge.md) | 13 | ⬜ 方案完成，未实施 | Phase 12 与 Phase 14 主线稳定后，在 Windows/macOS 受支持环境启动 |

## 冻结 / 待重估

| 文件 | 原范围 | 状态 | 处理方式 |
|---|---|---|---|
| [phase09-course-module.md](phase09-course-module.md) | Course 深化、课程任务、课表与事件追踪 | ⚠️ 大量已覆盖 | 已按当前代码核对；剩余项需真实需求后拆新方案 |
| [phase10-pending-features.md](phase10-pending-features.md) | 历史待办收束 | ⚠️ 逐项重估 | md 协议已取消；认证已完成；其余 P2 |
| [p0-phase12-execution.md](p0-phase12-execution.md) | 旧 P0/Phase 12 执行清单 | ⚠️ 被替代 | 旧 Render/Supabase 基线仅作历史参考；执行以 NEXT + Phase 12 为准 |
| [course-schedule-enhancements.md](course-schedule-enhancements.md) | 课程表功能完善记录 | ⚠️ 实现记录 | 已实现能力的补充说明；未完成项已并入 Phase 12/14，不单独推进 |

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
- ⬜ 表示方案存在、尚未实施。
- ⚠️ 表示文档保留，但不得直接按旧清单开发。
- ❌ 表示已取消或已被新架构替代。

## 管理规则

1. 新的近期动作先进入 `NEXT.md`，再链接到对应 Phase 方案。
2. 已完成方案移至 `docs/archive/` 并修正 BLUEPRINT、INDEX 与相互链接。
3. 架构迁移后，旧方案保留历史决策，但必须明确“已被替代”，不得继续写成生产现状。
4. 每次合并、生产迁移或真实设备验收后同步更新 NEXT、相关 Phase 和 BLUEPRINT。
