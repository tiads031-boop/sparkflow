# Phase 09 — Course 模块深化（现状核对）

> **创建时间**：2026-05-28 | **最后核对**：2026-09-15 | **状态**：⚠️ 冻结，剩余项待重估
>
> Phase 09 的大量目标已由现有课程页、Today/Schedule Layer、课程导入和 Timeline V2 覆盖。本文件保留代码核对结果，不作为近期执行队列；近期工作见 [NEXT.md](NEXT.md)。

## 1. 当前事实

- `Course`、`CourseNote`、`Semester` 与 `CalendarEvent(courseId, isOverride)` 已在 Prisma 模型中。
- NestJS Course API 已提供课程 CRUD、排课实例、单次调课、课程任务（沿用 notes 路径）、ICS 与课表备份能力。
- `CourseDetailView` 已是正式页面：展示本周/后续/历史实例、关联任务，并支持课程任务增删、状态、标签、置顶和转为普通 Task。
- `TodayView` 与统一 `ScheduleItem` projection 已把课程/Google/local/普通日程汇入“今天”；因此旧“Dashboard 今日课程”不再单独实施。
- 当前 `timeline` 仍由 `CalendarView` 承载；PR #14 提供 Timeline V2，但截至 2026-09-15 仍开放、尚未合并。

## 2. 原计划核对

| 原子项 | 当前状态 | 结论 |
|---|---|---|
| 9.1 Schema、Course API、ICS、课程事件渲染 | ✅ 已完成 | 保持维护 |
| 9.2 CourseDetailView 正式版 | ✅ 已完成 | 已展示课程信息、实例、关联任务与课程任务 |
| 9.2 单次调课 | ✅ 基础能力完成 | `PATCH /courses/events/:eventId` 更新实例并标记 override；真实课程数据仍需回归 |
| 9.2 换课/批量规则更新 | ⬜ 未核实完整闭环 | 不在近期主线；若恢复，先补真实数据与回滚方案 |
| 9.2 实例按周展示 | ✅ 被更实用的分组替代 | 现按本周、未来、历史分组，不再重复开发旧布局 |
| 9.3 Task 关联 Course | 🚧 部分完成 | Schema、详情页关联展示、课程任务转 Task 已完成；通用任务编辑器中的课程选择器、TaskCard 标签和 Board 课程筛选仍未核实 |
| 9.3 Dashboard 今日课程 | ✅ 被 Today/Schedule Layer 替代 | 课程通过 CalendarEvent 投影进入 Today；不再新增旧 Dashboard 区块 |
| 9.4 独立 CourseNotesView Kanban | ❌ 取消原布局 | CourseNote CRUD 已收束到 CourseDetailView 的“课程任务”；只有出现明确跨课程看板需求时再立新方案 |
| 9.5 7×N 课程表编辑器 | ⬜ 待重估 | 当前 `ScheduleEditor` 是统一任务安排编辑器，并非课程网格；课程导入向导已有结构化作息编辑，避免名称混淆 |
| 9.5 学期管理与单双周 | 🚧 基础能力已有 | Semester CRUD、学期筛选与 Course.weeks 已存在；真实导入与编辑闭环归 Phase 12 验收 |
| 9.6 exam/cert/contest/other 与 EventsView | ⬜ 待重估 | 当前 eventType 主要覆盖 task/focus/meeting/reminder/course；不阻塞当前主线 |

## 3. 真实剩余项

这些事项仅进入后续需求池，不自动恢复开发：

1. 普通任务编辑器选择课程、TaskCard 课程标签、Board 按课程筛选。
2. 换课/批量更新非 override 实例的完整交互、事务和回滚。
3. 独立事件追踪页及扩展事件类型。
4. 如真实用户需要，再设计课程专用 7×N 网格编辑器。

## 4. 重启条件

- 完成 [Phase 12](phase12-course-import-experience.md) 的服务端幂等、冲突策略和 Web/Android 真实导入验收。
- 合并并稳定 [Phase 14](phase14-rhythm-experience.md) M3，避免再次在旧 CalendarView 上重复建设。
- 每个剩余项有明确用户场景、验收样例和数据回滚路径后，拆成新的短期方案，而不是整体恢复 Phase 09。
