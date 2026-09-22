# SparkFlow — 下一步执行队列

> **最后更新**：2026-09-22  
> **仓库代码基线**：`master@37ac6690bcd2581f92172c46c83adc0c0ececdcd`
> **M1/M2/R1/R2/R3-A 合并记录**：[#118](https://github.com/tiads031-boop/sparkflow/pull/118)、[#119](https://github.com/tiads031-boop/sparkflow/pull/119)、[#120](https://github.com/tiads031-boop/sparkflow/pull/120)、[#121](https://github.com/tiads031-boop/sparkflow/pull/121)、[#122](https://github.com/tiads031-boop/sparkflow/pull/122)，GitHub Actions CI 全绿，均已 squash 合并
> **最近已确认生产版本**：`9f72d16b`（生产仍落后于当前 master；后续部署必须重新核对 buildSha）  
> **规则**：本文件只维护近期执行顺序；详细产品范围见对应方案文档。

---

## 0. 当前已完成能力，不重复开发

以下能力已经进入 master，后续只做回归、真实设备验收或在新方案中复用：

- 五工作空间：今天 / 计划 / 记录 / 学习 / 我的；
- Month / Week / Agenda 计划视图与 Task / Course / CalendarEvent 统一投影；
- 周视图 00:00–24:00、半小时辅助线、当前时间线；
- 待办列表 / 四象限；
- 对话式 AI Planner、持续 PlanningThread、语音、SearXNG Research；
- Preview → Apply → Undo；
- 长期学习目标、AI 阶段/里程碑、共享 Task；
- 单次调课 / 换课 / 停课 / 补课、周期 Course 模板变动；
- 课程永久删除；
- 多模态 Inspiration、Review、Insight、Insight → Task；
- Focus 倒计时 / 正计时、暂停恢复、完成后多记录；
- AI 对长期连贯计划创建/复用学习文件夹；
- Planner 已确认信息不重复询问，只追问最高影响问题。

不要把上述能力重新拆成“新 Phase”。

---

## 1. P0：生产与真机收口

代码已经明显领先最近一次确认的生产版本，因此新功能开发可以继续，但发布前必须先知道实际运行版本。

### 1.1 生产版本对齐

- [ ] 部署或确认腾讯云 Web/API 当前运行版本；
- [ ] 公网 `/api/health.buildSha` 与部署 commit 一致；
- [ ] 若部署到最新 master，执行并确认 Prisma migration 状态；
- [ ] Web 首页、登录、Session 恢复、核心 API 冒烟。

### 1.2 Phase 12 剩余真实验收

详细范围继续见 [phase12-course-import-experience.md](phase12-course-import-experience.md)。

- [ ] Web 真实学校导入：获取 → 返回 → 预览 → 导入；
- [ ] 重复提交不产生副本；
- [ ] 超时/断连但服务端可能已提交时，按 requestId 恢复未知结果；
- [ ] Android 真机完成登录、Session、教务/文件导入、360px、safe-area、软键盘；
- [ ] 核对真实服务端日志无 auth / CORS / migration 异常。

### 1.3 Phase 15 / Focus 剩余真机验收

详细范围继续见 [phase15-capture-review-insight-action.md](phase15-capture-review-insight-action.md)。

- [ ] PWA / Android 麦克风；
- [ ] 图片 / 音频 / 视频文件选择与私有播放；
- [ ] 显式 AI 处理音频 / 图片 / 视频；
- [ ] Push / 安静时段 / 深浅色；
- [ ] 网络失败与恢复；
- [ ] Focus 正计时 / 倒计时真机回归。

---

## 2. 新主线：V11 真实业务 UI 落地

完整规格：

[v11-production-ui-real-code-implementation.md](v11-production-ui-real-code-implementation.md)

当前实施顺序：

- [x] R1 代码：Graphite Aurora tokens、Hyalite 本地依赖与 fallback、GlassProvider、悬浮五栏导航、去除全局顶栏、QuickAdd、density / reduceMotion；
- [x] R1 本地验证：Web 76 tests、生产构建、新增文件定向 ESLint；
- [x] R1 GitHub Actions 远端 CI 与 squash 合并；
- [ ] R1 360px / PWA / Android WebView 与 Hyalite supported/fallback 视觉验收；
- [x] R2 代码：Today 聚合首页、Plan 紧凑工具栏、统一 Task Editor、Actual 逐条匹配/gap/manual edit；
- [x] R2 本地验证：Web 80 tests、API 163 tests、Web/API 生产构建、新增 TSX 定向 ESLint；
- [x] R2 GitHub Actions 远端 CI 与 squash 合并；
- [ ] R2 生产 API、360px / PWA / Android 视觉与交互验收；
- [x] R3-A 代码：Planner 对话 / Preview / Why 三层结构、高级依据入口、Flash / Pro 切换；Focus Setup / Running / Paused / Completed 状态与 Actual 刷新；
- [x] R3-A 本地验证：Web 83 tests、API 163 tests、Web/API 生产构建、改动文件定向 ESLint；
- [x] R3-A GitHub Actions CI #321；
- [x] R3-A squash 合并（PR #122）；
- [ ] R3-A 360px / PWA / Android 视觉与交互验收；
- [x] R3-B1 代码：RecordsWorkspace 拆分；Study 目标 / 课程切换与课程详情 / 导入入口；Profile 标签 / Actual 时间记录一级入口；
- [x] R3-B1 本地验证：Web 85 tests、Web production build、改动文件定向 ESLint；
- [x] R3-B1 GitHub Actions CI #324；
- [ ] R3-B2 Capture / Record Detail、Course Detail / Import、Tag Management 二级页视觉与移动端细节；
- [ ] R4 Time Analytics；
- [ ] R5 Scene Core（PR #126/#127 已合并；字段编辑已本地实现；自动触发依赖 R6 默认场景，另待真机视觉验收）；
- [ ] R6 Scene AI + Time Record Settings；
- [ ] R7 Goal Progress；
- [ ] R8 AI Execution Feedback；
- [ ] R9 Android Usage。

R1 已由 PR #120 合并，R2 已由 PR #121 合并，R3-A 已由 PR #122 合并。R3-B1 实现分支：`feat/ui-v11-r3-records-study-profile`。代码存在、合并、部署和真机验收继续分别记录。

---

## 3. Execution Intelligence & UI System

完整方案：

[vnext-execution-intelligence-ui-system.md](vnext-execution-intelligence-ui-system.md)

产品目标：

```text
计划
↓
AI 分类
↓
日程
↓
实际执行
↓
Actual Timeline
↓
标签 / 目标 / 时间分析
↓
执行反馈
↓
AI 增量调整
```

### M1 — UI Foundation + Tags（代码已合并，待部署 / 真实设备验收）

- [x] Task Edit Deck：保留并弱化 3D 卡片，重做层级、圆角与说明；
- [x] 共享 `PageHeader / SectionCard / SegmentControl / InfoRow / TagChip / BottomActionBar` 等组件；
- [x] 标签管理页；
- [x] Task 创建 / 编辑支持标签；
- [x] Inspiration Capture / Detail 支持标签；
- [x] Folder / Project / Tag 视觉和语义分离；
- [x] AI 分类优先复用已有标签，孤立任务不滥建 Folder；
- [ ] 360px / PWA / Android 基础视觉回归。

PR [#118](https://github.com/tiads031-boop/sparkflow/pull/118) 已 squash 合并为 `master@c856b4f`。本地 Prisma validate、API/Web build、API 157 tests、Web 73 tests 已通过；远端 CI run #310 的 Web build/tests 与 API fresh PostgreSQL migration/build/tests/真实数据库导入验证均通过。此前 `PlannerSheet.tsx` 的远端内容异常已由 `c4f0350` 恢复。本地浏览器自动化守护进程无法启动，因此 360px/PWA/Android 视觉验收仍未完成。

M1 当前收口顺序：

1. 部署时应用并核对 Tag migration；
2. 完成 360px/PWA/Android 与标签真实链路验收；
3. M2 代码可并行推进，但正式发布仍需同时核对 M1/M2 migration 与移动端链路。

### M2 — Timeline 2.0（代码已合并，待生产 / 移动验收）

- [x] 明确 Planned Time 与 Actual Time；
- [x] Focus Session 作为第一批 Actual Timeline 真实数据；
- [x] 手工补记实际时间；
- [x] Timeline 按真实发生时间展示；
- [x] Agenda 继续只展示真正排入日程的事项；
- [x] 计划 / 实际切换或对照；
- [x] Focus 直接读取 PomodoroSession，有效时长排除暂停且不与 CalendarEvent 投影重复统计；
- [x] fresh PostgreSQL migration CI、API/Web build/tests 与真实数据库导入验证；
- [ ] 生产环境真实 API 链路与 migration 应用；
- [ ] 360px / PWA / Android Timeline 视觉与交互验收。

实现分支：`codex/m2-timeline-actual`，PR [#119](https://github.com/tiads031-boop/sparkflow/pull/119) 已 squash 合并为 `master@b40854c`。本地 Prisma validate、API/Web build、API 159 tests、Web 73 tests 与新增前端专项 ESLint 已通过；CI run #313 的 fresh PostgreSQL migration/API/Web jobs 全绿。浏览器自动化守护进程仍无法在当前环境启动，因此移动视觉验收不标记为完成。

### M3 — Time Analytics

- [ ] 时间热力图；
- [ ] 标签 / 分类时间分布；
- [ ] 计划 vs 实际；
- [ ] 学习目标实际投入；
- [ ] 日 / 周 / 月切换；
- [ ] 清楚区分无数据、部分数据、加载失败。

### M4 — Goal Progress

- [ ] Task Progress；
- [ ] Numeric Progress；
- [ ] Time Progress；
- [ ] 学习目标主指标；
- [ ] Focus 可推动时间型指标；
- [ ] 普通任务默认不强制进度条。

### M5 — AI Behavior Feedback

- [ ] Planner Context 接入真实执行摘要；
- [ ] 使用计划偏差、真实投入、常见顺延时段解释调整建议；
- [ ] 不把统计相关性当成用户确认事实；
- [ ] 仍由 Scheduler 生成 Preview → Apply → Undo。

### M6 — Android App Usage Tracking

仅在 M1–M3 数据链稳定后进入。

- [ ] Usage Access 授权；
- [ ] App → Tag 映射；
- [ ] UsageStatsManager / UsageEvents 读取；
- [ ] 独立 AppUsageSession；
- [ ] Actual Timeline / Analytics 接入；
- [ ] 默认关闭，不读取页面、聊天、输入、通知内容。

---

## 4. 文档状态处理

### 3.1 已归档 / 不再单独推进

以下旧方案已被新架构覆盖，移动到 `docs/archive/` 后仅作历史参考：

- Phase 09 Course 深化；
- Phase 10 历史待办；
- 旧 P0 + Phase 12 执行清单；
- 课程表功能完善实现记录；
- 甘特图与四象限设计稿。

### 3.2 暂留 plans 的历史实现方案

以下文档虽然主体代码已完成，但仍有生产 / PWA / Android 验收或仍具架构参考价值，因此暂留 `docs/plans/`：

- [vnext-information-architecture-plan-workspace.md](vnext-information-architecture-plan-workspace.md)
- [vnext-ai-orchestration-study-course-capture.md](vnext-ai-orchestration-study-course-capture.md)
- [phase15-capture-review-insight-action.md](phase15-capture-review-insight-action.md)

它们不再争夺近期开发优先级；实施顺序只看本文件。

### 3.3 独立候选

[phase13-local-codex-bridge.md](phase13-local-codex-bridge.md) 仍为独立桌面能力候选，不进入当前移动端/执行智能主线。

---

## 5. 当前执行顺序

```text
A. V11 R3-A 评审与 R1/R2/R3-A 移动端视觉验收
        ↓
B. 生产/真机关键路径收口
        ↓
C. V11 R3-B Records / Study / Course / Profile 视觉收敛
        ↓
D. V11 R4 / Execution Intelligence M3 Time Analytics
        ↓
E. M4 Goal Progress
        ↓
F. M5 AI Behavior Feedback
        ↓
G. M6 Android Usage Tracking
```

生产验收与 M1 文档/前端开发可并行，但任何正式发布仍需按真实运行版本、migration 与关键业务路径确认。

---

## 6. 文档维护规则

1. 近期优先级只更新 `NEXT.md`。
2. 新产品范围更新对应方案文档，不把 NEXT 写成超长设计稿。
3. 已完成且被新架构覆盖的方案归档，不继续在旧文件追加“未来任务”。
4. 代码存在、CI 通过、生产部署、真机验收分别记录，不互相替代。
5. 不为普通开发新增无必要的 hash、冻结 contract、baseline 或 gate；只在不可逆、跨系统、安全或正式发布边界保留必要确认。
