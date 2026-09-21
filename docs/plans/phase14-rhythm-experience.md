# Phase 14 — Rhythm Experience / SparkFlow V5

> **状态**：⚠️ 历史架构参考；主体已被后续 VNext 实现覆盖  
> **最后核对**：2026-09-22  
> **当前仓库基线**：`master@56a5554`  
> **近期顺序**：以 [NEXT.md](NEXT.md) 为唯一执行队列  
> **后续 Timeline 方向**：由 [Execution Intelligence & UI System](vnext-execution-intelligence-ui-system.md) 的 Timeline 2.0 接管；本文件不再单独恢复旧 M3

---

## 1. 产品目标

Phase 14 的目标不是继续增加孤立模块，而是把 SparkFlow 现有能力收束成稳定的日常效率闭环：

```text
今天
  ↓
待办 / 课程 / 日历
  ↓
时间轴
  ↓
AI / Scheduler 安排
  ↓
专注
  ↓
完成 / 回顾
```

原则：

- Task 与 CalendarEvent 统一投影为 `ScheduleItem`。
- LLM 只负责语言理解；确定性 Scheduler 决定具体时间。
- 所有会修改计划的智能操作遵循 Preview → Apply → Undo。
- Web / PWA / Android 尽量共享同一前端能力，但移动端验收必须单独完成。
- 不为 Phase 14 新建第二套任务、日历或课程事实源。

---

## 2. 当前里程碑状态

| Milestone | 状态 | 当前事实 |
|---|---|---|
| M1 UI Foundation | ✅ 代码已进入 master | Design Tokens、AppShell、导航注册表、Quick Add 等已实现；仍保留真实 360px/Android 回归要求 |
| M2 Today Rhythm | ✅ 主体已进入 master | Today、统一安排编辑器、ScheduleItem 投影等已存在 |
| M3 Timeline V2 | 🚧 需重新实现/验收 | 旧 PR #14 已关闭；剩余要求迁移到 Issue #26，从最新 master 重做 |
| M4 Smart Planner | 🚧 部分完成 | 确定性 Preview / Apply / Undo 已实现；自然语言意图与“帮我顺延”待完成 |
| M5 Life Loop | 🚧 部分完成 | Focus 已进入主线；Daily Receipt、深色迁移、Settings V5、Android Widget 待完成 |

`V5 Core` 不再以“旧 PR #14 是否合并”作为完成判断，而以最新 master 上的真实 Timeline 能力与设备验收为准。

---

## 3. M1 — UI Foundation

已完成的核心能力：

- 语义化 Design Tokens 与主题基础。
- AppShell / AppHeader / BottomNav / QuickAddSheet。
- 可扩展 navigation registry，支持可见性与排序。
- 旧 `dashboard / calendar` 导航配置迁移到 `today / timeline`。
- Board / Sparks 等能力保留，不因 V5 删除。

剩余验收：

- [ ] 360px 浏览器布局回归。
- [ ] Android 真机导航、safe-area、软键盘回归。

---

## 4. M2 — Today Rhythm

现有能力：

- Today 聚合课程、任务与日历事项。
- `ScheduleItem` 作为统一前端日程投影模型。
- `ScheduleEditor` 统一处理安排创建/编辑。
- Planner 与 Focus 可从现有任务链继续执行。

M2 不新增 `/day-plan` 第二事实源；继续复用 Task、CalendarEvent 与服务端 API。

---

## 5. M3 — Timeline V2

### 5.1 旧 PR #14 的最终处理

PR #14 在旧 master 上实现过：

- Month / Week / Day Timeline 模块化。
- 15 分钟吸附。
- 拖动与 Resize。
- 锁定项确认。
- 课程 / Google / 本地日历只读投影。
- 网格/长按创建并打开 ScheduleEditor。

但它后来与主线产生重叠：

- 当前 `CalendarView` 后续加入了 Gantt 能力。
- `App.tsx` 后续承载了新的产品流程。
- `ScheduleEditor` 后续修复了 portal / 移动端行为。

因此直接合并旧 PR 会有回退风险。2026-09-17 已关闭 PR #14，并把仍有效的要求迁移到 Issue #26。

### 5.2 Issue #26 的实施范围

从最新 master 新建短期分支实施：

- [ ] 在保留现有 Gantt 的前提下拆分 Month / Week / Day Timeline。
- [ ] 继续使用统一 `ScheduleItem` 投影。
- [ ] 15 分钟吸附与任意分钟时长。
- [ ] 锁定项确认。
- [ ] 课程 / Google / 本地日历保持只读。
- [ ] 网格点击/长按创建接入当前 ScheduleEditor。
- [ ] 不覆盖当前 App / ScheduleEditor 的后续修复。

### 5.3 M3 验收

- [ ] 360px 浏览器可用。
- [ ] Android 横向滚动、长按、拖动、Resize 可用。
- [ ] Month / Week / Timeline / Gantt 对同一来源数据显示一致。
- [ ] Google / Local / Course 来源显示与锁定行为一致。
- [ ] DST、跨时区、午夜/日期边界通过测试。
- [ ] Web build、tests、定向 lint 与 `git diff --check` 通过。

---

## 6. M4 — Smart Planner

当前已有：

- 确定性 Scheduler。
- Preview → Apply → Undo。
- `SchedulePlan` 持久化基础。

剩余：

- [ ] 自然语言意图解析。
- [ ] “帮我顺延”模式。
- [ ] 生产 `SchedulePlan` migration 核验。
- [ ] 真实账户走通 Preview → Apply → Undo。
- [ ] Android 真机排程回归。

约束：LLM 不直接写入最终时间；具体时间仍由确定性 Scheduler 计算。

---

## 7. M5 — Life Loop

当前已有：

- Focus / Pomodoro 主链路。

剩余：

- [ ] Daily Receipt。
- [ ] PNG 分享。
- [ ] 历史核心页面深色 Token 迁移。
- [ ] Settings V5 分组整理。
- [ ] Android Widget；最后实施，不阻塞 Web。

---

## 8. 与其他 Phase 的边界

### Phase 12

当前优先于 Phase 14 继续扩展。课程导入的服务端幂等、事务、重复/冲突检测和真实 Web/Android 验收完成前，不扩大 Phase 14 的非必要范围。

### Phase 15

Phase 15 负责 `Capture → Review → Insight → Action`，复用 Phase 14 已有 Task / Planner / Timeline / Focus，不在 Phase 14 中提前实现记录/洞察系统。

### Study Mode

Study Mode 复用 Course / Task / Planner / Focus / Timeline；不在 Phase 14 中建立独立学习数据链。

### Phase 13

Local Codex Bridge 保持独立 loopback 架构，不进入云端生产控制链。

---

## 9. Phase 14 完成门槛

只有同时满足以下条件，才能把 Phase 14 标记完成：

1. Issue #26 的 M3 Timeline 余项已在最新 master 实现并真实验收。
2. 自然语言排程与“帮我顺延”完成，且不绕过确定性 Scheduler。
3. Daily Receipt / 深色 / Settings 等核心 M5 收口完成。
4. Web / PWA / Android 至少各有一条真实闭环：

```text
今天 → 待办 → 时间轴 → AI 安排 → 专注 → 完成
```

5. 不存在阻断级数据错位、移动端交互或生产 migration 问题。

---

## 10. 发布门禁

- 从最新 master 建短期分支。
- 开放 PR 不等于功能完成。
- 历史 CI 不替代当前 master 回归。
- Web/API build 与 tests 必须通过。
- Android 相关改动必须真机验收。
- 涉及数据修改的操作必须可确认，能撤销的尽量提供 Undo。
- 每次合并后同步 `NEXT.md`、`INDEX.md` 与 `PROJECT_BLUEPRINT.md`。