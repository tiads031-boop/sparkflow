# SparkFlow — 下一步执行队列

> **最后更新**：2026-09-22  
> **GitHub 当前代码**：`master@56a555490a09a1290a1b09c2139dc796a09651fb`  
> **生产最后已验证版本**：`9f72d16b`（以现有生产验收记录为准；不要把 GitHub 最新代码等同于已部署）  
> 本文件仍是唯一近期执行队列。完整下一阶段产品方案见 [VNext 时间账本、智能分类与统一 UI 系统](vnext-time-ledger-tagging-ui-system.md)。

---

## 0. 当前代码事实

截至 2026-09-22，最近已经合并：

- PR #114：真实 `scheduledStart / scheduledEnd`、长期计划自动创建/复用 StudyFolder、未排期 Todo 不进入日历、00:00–24:00 紧凑周视图；
- PR #115：Focus 正计时 / 倒计时、课程永久删除、Planner 只追问一个最高影响问题、避免重复确认、网络错误文案改进；
- Phase 15 Capture / Review / Insight / Action、Focus C1/C2、VNext M4–M8 主体代码此前已进入 master。

因此以下能力**不得重复实现**：

- 第二套 Task / Calendar / Focus / Inspiration / Study Task；
- 已有 Planner Preview → Apply → Undo；
- 已有 StudyFolder 长期目标容器；
- 已有多模态随手记；
- 已有单次 / 周期课程变更；
- 已有 Focus 分段、暂停恢复、连续记录；
- 已有正计时 / 倒计时；
- 已有全天周视图。

---

# 1. P0 — 剩余生产 / PWA / Android 验收

仍先完成真实设备与生产证据，不把 GitHub 合并自动视为生产完成。

## Phase 12 / Issue #31

- [ ] Web 真实学校导入：获取 → 返回 → 预览 → 导入；
- [ ] 重复 / 冲突预览真实可见；
- [ ] 相同 requestId 重放不产生副本；
- [ ] 客户端超时 / 断连但服务端已提交时，按 requestId 恢复结果；
- [ ] Android 真机登录 / Session 恢复；
- [ ] Android SchoolImport / 文件导入；
- [ ] 360px、safe-area、软键盘、文件选择；
- [ ] 服务端日志无 migration / auth / CORS 异常。

## Phase 15 / VNext 余项

- [ ] PWA / Android 麦克风；
- [ ] 私有附件播放；
- [ ] 图片 / 音频 / 视频显式 AI；
- [ ] Push / quiet hours；
- [ ] 深浅色真机；
- [ ] 网络失败与恢复；
- [ ] 最新 #114 / #115 功能进入生产后做真实账号回归。

完成这些验收时，继续区分：

```text
代码存在
≠ CI 通过
≠ 已部署
≠ 真实业务闭环已通过
```

---

# 2. P1 第一批 — UI Foundation + Tags

主方案：[vnext-time-ledger-tagging-ui-system.md](vnext-time-ledger-tagging-ui-system.md)

这是下一轮产品开发第一批。

## 2.1 Task Edit Deck

- [ ] 保留现有 3D 卡片切换；
- [ ] 重做其余任务编辑 UI；
- [ ] 降低透视 / 背景卡存在感；
- [ ] 使用统一 InfoRow / SegmentControl / BottomActionBar；
- [ ] 增加 Folder / Project / Tags / 来源区域；
- [ ] 去掉长期常驻的引导说明。

## 2.2 共享 UI 组件

优先提取：

- [ ] PageHeader
- [ ] SectionCard
- [ ] SegmentControl
- [ ] InfoRow
- [ ] TagChip
- [ ] FolderChip
- [ ] StatusChip
- [ ] BottomActionBar
- [ ] MetricCard
- [ ] ChartCard

目标：任务、学习、记录、设置、分析不再各自维护一套按钮和表单语言。

## 2.3 标签管理

- [ ] “我的 → 标签管理”；
- [ ] 新建 / 重命名 / 颜色 / 排序 / 父子 / 归档；
- [ ] Task 标签选择；
- [ ] Inspiration 标签选择；
- [ ] AI 优先复用已有 Tag；
- [ ] Folder / Project / Tag 文案与行为统一。

第一轮继续复用现有 `Task.tags` / `Inspiration.tags`。只有跨端标签元数据真正需要持久化时，再增加最小 TagDefinition。

---

# 3. P1 第二批 — Timeline 2.0

明确拆分：

```text
Planned Time
= Task scheduledStart/end + Course + CalendarEvent

Actual Time
= Focus Session + 手工补记 +（以后）App Usage
```

执行项：

- [ ] Plan 增加 Actual Timeline；
- [ ] Focus Session 直接投影到实际时间流水；
- [ ] Agenda 继续只显示真正已排期事项；
- [ ] 未排期 Todo 不进入 Calendar / Agenda；
- [ ] 支持查看某个 Task 的计划时间 vs 实际 Focus；
- [ ] 支持手工补记实际时间。

不要把 Actual 重新写成 CalendarEvent。

---

# 4. P1 第三批 — Time Analytics

入口：

```text
计划 → 分析
```

实施：

- [ ] 日 / 周 / 月时间热力图；
- [ ] Tag 时间分布；
- [ ] StudyFolder / 长期目标投入；
- [ ] Planned vs Actual；
- [ ] 删除 Focus 后统计同步；
- [ ] 按 Folder / Tag 过滤。

Today 不承担完整统计。

---

# 5. P1 第四批 — Goal Progress

长期目标支持：

- [ ] Task Progress；
- [ ] Numeric Progress；
- [ ] Time Progress；
- [ ] 自定义单位；
- [ ] Task 完成联动；
- [ ] Focus 时间联动；
- [ ] StudyFolder 目标摘要。

普通 Task 默认不强制进度条。

---

# 6. P1 第五批 — AI Behavior Feedback

当 Actual Timeline / Analytics 有稳定数据后：

- [ ] Planner 读取实际投入；
- [ ] 读取计划 / 实际偏差；
- [ ] 读取历史完成情况；
- [ ] 读取高完成率时间段；
- [ ] 用于下一轮增量调整。

仍保持：

```text
AI 理解 / 建议
→ Scheduler
→ Preview
→ 用户确认
→ Apply
```

---

# 7. P2 — Android 自动时间记录

仅在 Tags / Timeline / Analytics 稳定后启动。

- [ ] “我的 → 时间记录 → 自动记录应用”；
- [ ] Android Usage Access；
- [ ] App → Tag 映射；
- [ ] AppUsageSession 最小事实源；
- [ ] 默认关闭；
- [ ] 不读取屏幕 / 输入 / 聊天 / 通知正文。

不使用 AccessibilityService 作为第一版实现。

---

# 8. Today 规则

Today 保持极简：

- 今日安排；
- 当前 / 下一项；
- 必要时显示轻量“今日投入 / 完成”摘要；
- 有待回顾记录时提供入口。

不要把：

- 热力图；
- 标签统计；
- 全量报告；
- 标签管理；
- 模板中心

重新塞回 Today。

---

# 9. 旧方案处理

已经完成、冻结或被后续架构替代的方案已迁入 `docs/archive/`：

- `phase09-course-module.md`
- `phase10-pending-features.md`
- `p0-phase12-execution.md`
- `course-schedule-enhancements.md`
- `gantt-quadrant-view-design.md`
- `vnext-information-architecture-plan-workspace.md`

活跃方案目录只保留仍有明确未关闭项或下一阶段需要执行的文档。

---

# 10. 当前执行顺序

```text
真实生产 / PWA / Android 验收
        ↓
UI Foundation + Tags
        ↓
Timeline 2.0
        ↓
Time Analytics
        ↓
Goal Progress
        ↓
AI Behavior Feedback
        ↓
Android App Usage
```

本轮不为了“文档完整”新增额外 gate、冻结 contract 或第二套事实源；现有 Git、版本、数据库约束、事务、类型和测试继续承担日常工程保障，只有生产发布、权限 / 隐私和跨系统写入等真实边界保留必要验收。
