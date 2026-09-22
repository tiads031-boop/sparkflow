# SparkFlow — 实施方案索引

> **最后更新**：2026-09-23  
> **仓库代码基线**：master@76f8f77db2d6ed1abda8d98c4303d6c17b1a544f`（PR #144）
> **当前开发进度**：R1–R9、R7-C 与 Timeline 周网格 Task 调整代码已合并；Issue #26 跨视图及真机验收仍待推进；终端/生产验收待集中进行。
> **最近有直接回显的生产版本**：`990edabb9a2b3d26f523f17850ed9080a7507ff8`（2026-09-21；发布时重新核对）
> **唯一近期执行队列**：[NEXT.md](NEXT.md)

本目录只保留仍需执行、验收或具有当前架构参考价值的方案。已经完成且被新架构覆盖的旧方案移动到 `docs/archive/`，避免旧任务继续与当前主线竞争优先级。

---

## 当前主线

| 文件 | 定位 | 状态 |
|---|---|---|
| [NEXT.md](NEXT.md) | 唯一近期执行队列 | 🚧 当前 |
| [v11-production-ui-real-code-implementation.md](v11-production-ui-real-code-implementation.md) | V11 视觉与真实业务代码的主实施规格 | 🚧 R1–R9 代码已合并；Issue #26 待推进，终端与生产验收最后集中进行 |
| [vnext-execution-intelligence-ui-system.md](vnext-execution-intelligence-ui-system.md) | Tags → Actual Timeline → Analytics → Goal Progress → AI Feedback → Android Usage | 🚧 M1–M6 代码已合并，终端与生产验收待集中进行 |
| [phase12-course-import-experience.md](phase12-course-import-experience.md) | 课程导入、幂等、冲突、Web/Android 真实验收 | 🚧 剩余生产/真机验收 |
| [phase15-capture-review-insight-action.md](phase15-capture-review-insight-action.md) | Capture → Review → Insight → Action 与 Focus 多模态链路 | 🚧 主体完成，剩余 PWA/Android/多模态验收 |

---

## 已实现、暂留作当前架构参考

这些方案主体代码已经进入 master，不再作为新的“开发 Phase”，但暂不归档，因为仍包含当前架构说明或未完成验收。

| 文件 | 已完成内容 | 剩余处理 |
|---|---|---|
| [vnext-information-architecture-plan-workspace.md](vnext-information-architecture-plan-workspace.md) | 五工作空间、Plan Workspace、统一投影、Planner Preview | 保留为 IA 参考；验收完全收口后归档 |
| [vnext-ai-orchestration-study-course-capture.md](vnext-ai-orchestration-study-course-capture.md) | AI PlanningThread、Research、语音、Study 目标、课程变动、多模态记录、通知/设置 | 保留为 AI/Study/Course 架构参考；真机收口后归档 |
| [phase14-rhythm-experience.md](phase14-rhythm-experience.md) | Today / Schedule / Planner / Focus 早期统一闭环 | 旧 Timeline 余项已被新 Execution Intelligence 方案吸收；后续可归档 |

---

## 独立候选

| 文件 | 范围 | 状态 |
|---|---|---|
| [phase13-local-codex-bridge.md](phase13-local-codex-bridge.md) | 桌面本机 Codex 监督接入 | ⬜ 独立候选，不进入当前移动端执行智能主线 |

---

## 2026-09-21 ～ 2026-09-22 已确认进入 master 的关键能力

以下只用于防止重复开发，不作为新的执行清单：

- PR #48–#50：五工作空间、Plan M1–M3；
- PR #55–#63：通知正确性、Today 极简、任务新建 UI、四象限、Settings、新 AI Planner；
- PR #66/#68/#69：独立 AI 学习目标；
- PR #70–#73：课程单次与周期变动；
- PR #74/#77/#78/#80/#81：多模态记录、通知偏好、外观、显式附件 AI；
- PR #105/#106：可靠 Focus 与完成后多模态记录；
- PR #113：节假日/调休上下文与完整批量计划；
- PR #114：真实 scheduledStart/scheduledEnd、长期计划自动归入学习文件夹、全天周视图；
- PR #115：倒计时/正计时、课程永久删除、Planner 单一关键追问与更清晰网络错误。

当前 master 已明显领先最近确认的生产版本，因此“代码已合并”与“生产已部署”继续分开记录。

---

## 已归档：2026-09-22

以下文件已从 `docs/plans/` 移至 `docs/archive/`：

| 文件 | 归档原因 |
|---|---|
| [../archive/phase09-course-module.md](../archive/phase09-course-module.md) | Phase 09 大量目标已由当前 Course / Plan / Study / Timeline 架构覆盖 |
| [../archive/phase10-pending-features.md](../archive/phase10-pending-features.md) | 历史待办已完成、取消或迁移到后续主线 |
| [../archive/p0-phase12-execution.md](../archive/p0-phase12-execution.md) | 旧 Render/Supabase/P0 基线已被腾讯云自托管与当前 NEXT 替代 |
| [../archive/course-schedule-enhancements.md](../archive/course-schedule-enhancements.md) | 已实现课程表能力的历史实现记录，不再单独推进 |
| [../archive/gantt-quadrant-view-design.md](../archive/gantt-quadrant-view-design.md) | 四象限已实现；复杂时间视图的新方向由 Execution Intelligence 方案接管 |

此前已归档：

| 文件 | 简述 |
|---|---|
| [../archive/phase11-auth-registration-onboarding.md](../archive/phase11-auth-registration-onboarding.md) | 早期账户 / Onboarding |
| [../archive/phase08-capacitor-setup.md](../archive/phase08-capacitor-setup.md) | Capacitor Android |
| [../archive/phase08-google-calendar-sync.md](../archive/phase08-google-calendar-sync.md) | Google Calendar 历史架构 |
| [../archive/2026-05-29-improvement-plan.md](../archive/2026-05-29-improvement-plan.md) | 早期改进计划 |
| [../archive/2026-05-29-p0-execution-plan.md](../archive/2026-05-29-p0-execution-plan.md) | 早期 P0 |
| [../archive/2026-05-29-post-md-transition-audit.md](../archive/2026-05-29-post-md-transition-audit.md) | 去 md 架构审计 |

---

## 状态口径

- ✅：实现/仓库事实已确认；
- 🚧：有明确未关闭的实现、生产或真机工作；
- ⬜：方案存在但尚未进入当前实施队列；
- ⚠️：保留参考，不允许直接按旧基线继续开发；
- ❌：取消或被新架构替代。

“代码存在”“CI 通过”“生产部署”“真实业务验收”“真机验收”必须分开描述。

---

## 文档管理规则

1. **NEXT 只维护顺序**：不再把所有历史实现细节堆进 NEXT。
2. **方案文档维护范围**：产品设计、数据边界、里程碑、验收写在对应方案。
3. **完成方案归档**：若主体完成且新架构已接管剩余范围，移入 `docs/archive/`。
4. **仍有真实验收的方案可暂留 plans**：但不得继续作为“新开发 Phase”重复排期。
5. **新方案必须说明与现有事实源的关系**：优先复用 Task / Course / CalendarEvent / PomodoroSession / Inspiration / StudyFolder / PlanningThread。
6. **发布事实单独核验**：仓库 master 不能代替生产 buildSha 与真机结果。
7. **不新增无必要门禁**：普通功能依赖现有 Git、版本、事务、唯一约束、类型和测试；只在不可逆、跨系统、安全或正式发布边界增加必要确认。
