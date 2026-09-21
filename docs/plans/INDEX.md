# SparkFlow — 实施方案索引

> **最后更新**：2026-09-22  
> **GitHub 当前代码**：`master@56a555490a09a1290a1b09c2139dc796a09651fb`  
> 近期执行顺序只在 [NEXT.md](NEXT.md) 维护。方案文档负责范围、约束和验收，不各自争夺优先级。

---

## 1. 当前主线

| 文件 | 范围 | 状态 |
|---|---|---|
| [NEXT.md](NEXT.md) | 唯一近期执行队列 | 🚧 当前有效 |
| [vnext-time-ledger-tagging-ui-system.md](vnext-time-ledger-tagging-ui-system.md) | 时间账本、智能分类、统一 UI、Timeline 2.0、分析、目标进度、Android Usage | ✅ 方案确认，待实施 |
| [phase12-course-import-experience.md](phase12-course-import-experience.md) | 课程导入、幂等、冲突、真实 Web / Android / HTTP 恢复 | 🚧 剩余生产验收 |
| [phase15-capture-review-insight-action.md](phase15-capture-review-insight-action.md) | Capture → Review → Insight → Action + Focus 记录 | 🚧 主体已实现，剩余 PWA/Android/多模态验收 |
| [vnext-ai-orchestration-study-course-capture.md](vnext-ai-orchestration-study-course-capture.md) | AI 调度、学习目标、课程变动、多模态记录、通知/设置 | ✅ 主体代码完成，🚧 真实设备收尾 |

---

## 2. 次级 / 待后续评估

| 文件 | 范围 | 状态 | 处理 |
|---|---|---|---|
| [phase13-local-codex-bridge.md](phase13-local-codex-bridge.md) | Local Codex Bridge | ⬜ 尚未实施 | 等用户主链路稳定后再启动 |
| [phase14-rhythm-experience.md](phase14-rhythm-experience.md) | Rhythm / Daily Receipt / Timeline 历史方案 | ⚠️ 仅保留未被新 VNext 替代的剩余项 | Timeline / UI 部分以后以新 VNext 为准 |

---

## 3. 最近已进入 master 的关键能力

| PR / 提交 | 结果 |
|---|---|
| PR #114 / `7f8f9305` | AI 创建任务可保留真实日程时间；长期计划自动创建/复用 StudyFolder；未排期 Todo 与日历分离；周视图 00:00–24:00 |
| PR #115 / `56a55549` | Focus 正计时/倒计时；课程永久删除；Planner 减少重复确认，只问一个最高影响问题；网络错误文案改进 |
| PR #105 / #106 | Focus 精确分段、暂停/恢复、完成后多模态连续记录 |
| PR #66/#68/#69 | 独立 AI 学习目标、阶段/里程碑、执行反馈 |
| PR #70–#73 | 单次课程 override、周期课程模板变更、Preview/Apply/Undo |
| PR #74/#80/#81 | 多模态记录与显式 AI 处理 |
| PR #77/#78 | 通知偏好、时区、深浅色与 Settings 重整 |

这些能力进入 master 后，后续方案不得再建立重复事实源或按旧方案重新实现。

---

## 4. 新 VNext 的核心语义

### Folder / Project / Tag

```text
Folder
= 长期、连续、有明确目标的容器

Project
= Folder 内阶段 / 里程碑

Tag
= 横向分类 / 搜索 / 时间统计
```

例如：

```text
Folder = 六级听力训练
Project = 长对话强化
Tags = #英语 #六级 #听力
```

### Planned / Actual

```text
Planned Time
= Task scheduledStart/end + Course + CalendarEvent

Actual Time
= Focus Session + 手工补记 + 后续 AppUsageSession
```

Agenda 负责计划，Timeline 负责实际流水。

---

## 5. 新 VNext 实施批次

| 批次 | 内容 | 优先级 |
|---|---|---|
| A | UI Foundation + Task Edit Deck + 标签管理 | P1 第一批 |
| B | Timeline 2.0：计划 / 实际分离 | P1 |
| C | 热力图、分类时间、计划 vs 实际、目标投入 | P1 |
| D | Goal Progress：Task / Numeric / Time | P1 |
| E | AI Behavior Feedback | P1 |
| F | Android Usage Access / AppUsageSession | P2 |

完整定义见 [vnext-time-ledger-tagging-ui-system.md](vnext-time-ledger-tagging-ui-system.md)。

---

## 6. UI 方向

统一视觉语言：

> **Graphite Aurora**

原则：

- 大方、克制、高可读；
- 深色石墨层级 + 柔和浅绿 / 淡紫 / 柔黄；
- 3D 只保留在有意义的卡片切换场景；
- 设置、日历、统计等不滥用 3D；
- 逐步统一 PageHeader / InfoRow / SegmentControl / TagChip / BottomActionBar / MetricCard 等共享组件。

当前任务编辑页的 3D 卡片保留，但其余 UI 以新 Task Edit Deck 方案重做。

---

## 7. 仍需完成的真实验收

### Phase 12 / Issue #31

- Web 真实学校导入；
- 重复 / 冲突预览；
- requestId replay；
- 超时 / 断连后的未知结果恢复；
- Android 登录 / Session / SchoolImport / 文件导入；
- 360px / safe-area / 软键盘 / 文件选择。

### Phase 15 / VNext

- PWA / Android 麦克风；
- 私有附件播放；
- 图片 / 音频 / 视频显式 AI；
- Push / quiet hours；
- 深浅色真机；
- 网络失败恢复；
- #114 / #115 部署后的真实账号回归。

---

## 8. 已归档方案

以下文档已从 `docs/plans/` 迁入 `docs/archive/`，只保留历史背景，不再承担执行优先级：

| 文件 | 原范围 | 归档原因 |
|---|---|---|
| [../archive/phase09-course-module.md](../archive/phase09-course-module.md) | Course 深化 | 大量能力已被后续 Course / VNext 覆盖 |
| [../archive/phase10-pending-features.md](../archive/phase10-pending-features.md) | 历史待办 | 多项已完成、取消或由 Phase 15/VNext 接管 |
| [../archive/p0-phase12-execution.md](../archive/p0-phase12-execution.md) | 旧 P0 / Phase 12 队列 | Render/Supabase 等旧生产前提已失效 |
| [../archive/course-schedule-enhancements.md](../archive/course-schedule-enhancements.md) | 课程表完善记录 | 属于已实现/历史实现说明 |
| [../archive/gantt-quadrant-view-design.md](../archive/gantt-quadrant-view-design.md) | 甘特 / 四象限设计 | 四象限已进入主线，时间视图以后按新 VNext 推进 |
| [../archive/vnext-information-architecture-plan-workspace.md](../archive/vnext-information-architecture-plan-workspace.md) | 五工作区 / Plan M1–M3 设计 | 核心 IA 已实施，后续由新 VNext 继承 |

已有旧归档继续保留：

- [../archive/phase11-auth-registration-onboarding.md](../archive/phase11-auth-registration-onboarding.md)
- [../archive/phase08-capacitor-setup.md](../archive/phase08-capacitor-setup.md)
- [../archive/phase08-google-calendar-sync.md](../archive/phase08-google-calendar-sync.md)
- [../archive/2026-05-29-improvement-plan.md](../archive/2026-05-29-improvement-plan.md)
- [../archive/2026-05-29-p0-execution-plan.md](../archive/2026-05-29-p0-execution-plan.md)
- [../archive/2026-05-29-post-md-transition-audit.md](../archive/2026-05-29-post-md-transition-audit.md)

---

## 9. 文档状态口径

- ✅：方案或代码已确认；
- 🚧：已有实现，但还有明确真实验收 / 收尾项；
- ⬜：尚未实施；
- ⚠️：只保留部分有效范围，不得按整份旧方案继续推进；
- ❌：已取消 / 被新架构替代。

“代码存在”“CI 通过”“已部署”“真实业务验收”继续分别记录，不互相替代。

---

## 10. 管理规则

1. 近期动作只写入 `NEXT.md`；
2. 旧方案被后续实现覆盖后，迁入 `docs/archive/` 或明确标记剩余范围；
3. 不从归档方案恢复旧优先级；
4. 不重复建设已有事实源；
5. 需要数据库变更时先说明现有 Task / Course / Calendar / Focus / Inspiration / StudyFolder 为什么无法表达；
6. 普通工程继续依赖 Git、版本、主键、事务、唯一约束、类型和测试；不额外引入无具体失败场景的冻结、hash、baseline 或 gate。
