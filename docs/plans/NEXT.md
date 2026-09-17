# SparkFlow — 下一步执行队列

> **最后更新**：2026-09-17 | **事实基线**：`master@9a316060`
>
> 本文件是唯一近期执行队列。其他 Phase 文档只负责范围、约束与验收细节；若与本文件冲突，以代码/生产事实和本文件顺序为准。

## 当前生产与仓库基线

| 范围 | 已确认事实 |
|---|---|
| 数据与认证 | 腾讯云独立自建 PostgreSQL + SparkFlow API 自建密码/会话认证；与 DeepTutor 数据库隔离 |
| API | `https://api.fish-life.cc.cd`，Nginx 反向代理至 NestJS；健康接口可用，但健康 200 不等于业务验收完成 |
| Web | Vercel 主项目 `sparkflow031`，生产域名 `fish-life.cc.cd` |
| GitHub | `master@9a316060`；Phase 15 与 Study Mode 方案已进入 master |
| 当前开放 PR | #14 Timeline V2（旧基线、需重新对齐 master）；#24 Course linked tasks；#23 Study Mode proposal 已被 #25 替代，应关闭 |
| 部署噪声 | 旧 Vercel 项目 `sparkflow`、`sparkflow-psi1` 仍会产生失败检查；`sparkflow031` 才是主项目 |

## 近期总原则

1. **先收口旧分支和生产风险，再继续扩产品面。**
2. **Phase 12 的数据安全与真实导入是当前最高优先级。**
3. **Phase 14 只做剩余核心闭环，不重复已经进入 master 的 UI/任务能力。**
4. **Phase 15 先做 M1（Capture → Review → Task），AI Insight 放 M2。**
5. **Study Mode 已有方案但暂不抢占主线；启动前必须保证 Phase 12/14/15 主链路稳定。**
6. **Local Codex Bridge 保持 P2，不进入当前生产控制链。**

---

## 0. 仓库收口与冲突清理（P0，立即执行）

### PR #23 — Study Mode proposal

状态判断：已被已合并的 PR #25（更完整的 Study Mode 提案、路线图和设计资产）替代。

- [x] 以 #25 / `docs/study-mode/` 为 Study Mode 唯一方案事实源。
- [ ] 关闭 #23，避免后续误合并旧提案。

### PR #14 — Timeline V2

状态判断：PR 基于旧 master，当前已不可直接合并；不能再把“合并 #14”作为下一步前置条件。

处理方式：

- [ ] 对照当前 master 核对 #14 的 13 个改动文件。
- [ ] 将“已经被后续 master 覆盖的能力”和“仍缺失的能力”拆开。
- [ ] 仅保留仍缺失且可独立验收的 Timeline 能力；必要时新建短期分支重新实现，不强行 merge 旧 PR。
- [ ] 保留原验收要求：360px、Android 手势/滚动、Google/本地/课程多来源一致性、DST/跨时区/日期边界。
- [ ] 完成对账后关闭或替代 #14。

### PR #24 — Course linked tasks

状态判断：可合并，Web/API 测试与 build 已通过；属于当前课程任务链路的修复，不应被长期悬挂。

- [ ] 做一次当前 master 上的冲突/回归核对。
- [ ] 确认 CourseNote → Task 后不会重复创建、关联信息可保留、待办立即可见。
- [ ] 通过后合并并做生产冒烟。

完成门槛：#23 不再开放；#14 有明确“关闭/替代/重做”的结论；#24 不再处于长期悬挂状态。

---

## 1. Phase 12：服务端安全导入（P0，当前开发主线）

先完成数据安全闭环，再扩展视觉或新学习能力。

- [ ] 支持选择已有学期，且不静默覆盖历史课程。
- [ ] 定义导入 `requestId`、payload hash、目标学期、处理状态和结果摘要。
- [ ] 建立稳定排课指纹、重复检测、时间冲突检测。
- [ ] “跳过重复（默认）/保留副本”策略贯穿预览、API 与结果。
- [ ] Prisma Transaction 原子写入；失败回滚；未知结果先查询再重试。
- [ ] 跨用户隔离、重复重放、并发、超时和事务回滚集成测试。
- [ ] 核验 `SchedulePlan` migration 已在生产执行，并用真实账户走通 Planner Preview → Apply → Undo。

完成门槛：双击、断网和超时重试不产生意外副本；失败无半成品；真实账户可确认唯一结果。

---

## 2. Phase 12：真实导入与生产验收（P0/P1）

当前已有 JISU 夏/冬作息模板和分段课程元数据解析修复，但这不等于真实导入闭环已经完成。

- [ ] Web 用真实学校数据走通：获取 → 返回 → 预览 → 导入。
- [ ] Android 真机走通：SchoolImport / 文件降级 → 返回应用 → 预览 → 导入。
- [ ] 校验上午/下午/晚间分段作息与不同季节模板。
- [ ] 360px、软键盘、safe-area、文件选择、错误定位和成功后切换目标学期。
- [ ] 生产 Auth、semesters、courses、schedule、tasks 冒烟与日志检查。
- [ ] 登录态、跨设备 session、Android API 地址/证书/网络策略纳入回归，避免 APK 出现“Web 正常、App 无法登录”的分叉。

完成门槛：Web/Android 各一条真实路径通过，导入结果可验证、可重试且不会产生重复数据。

---

## 3. 平台与发布治理（P0/P1，可与 Phase 12 并行）

- [ ] 确认 `sparkflow031` 是唯一生产 Web 项目，Root Directory=`web`、域名和环境变量正确。
- [ ] 归档或断开旧项目 `sparkflow`、`sparkflow-psi1` 的 Git 集成，停止重复部署红灯。
- [ ] 确认 GitHub 必需检查只依赖有效 Web/API CI 与主项目部署。
- [ ] Release/APK 发布流程统一：Android 构建必须对应明确 commit/tag，并保留生产 API 配置核对。

完成门槛：后续 PR 的 CI 状态不再被旧项目误导；Web 与 APK 可追溯到同一代码基线。

---

## 4. Phase 14：核心效率闭环收口（P1）

不重复实现已经进入 master 的 Today、四象限、甘特图、Focus、Planner 基础能力。

剩余范围：

- [ ] M3 Timeline 剩余真实设备/边界验收（以 #14 对账结果为准）。
- [ ] M4 自然语言意图解析；确定性 Scheduler 继续作为唯一排程决策层。
- [ ] M4 “帮我顺延”模式及生产/真机验收。
- [ ] M5 Daily Receipt 与 PNG 分享。
- [ ] M5 历史核心页面深色 Token 迁移。
- [ ] M5 Settings V5 分组整理，保持现有数据能力和 storage key 不变。
- [ ] M5 Android Widget 最后实施，不阻塞 Web 主线。

完成门槛：`今天 → 待办 → 时间轴 → AI 安排 → 专注 → 完成` 在 Web/PWA/Android 均有真实闭环验收。

---

## 5. Phase 15 M1：Capture → Review → Task（P1，下一产品批次）

启动条件：Phase 12 的数据安全/真实导入闭环完成，Phase 14 没有阻断级回归。

- [ ] 将前端旧 `Spark` 主链路迁移到服务端 `Inspiration` 事实源。
- [ ] `sourceUrl` 改为 nullable，支持 `manual` 随手记。
- [ ] 全局 Quick Add 提供“随手记”，目标 5 秒内完成一条记录。
- [ ] “灵感”升级为“记录”：卡片 / 回顾；自由墙作为可选视图保留。
- [ ] 新增 Reflection 历史，不覆盖原始记录正文。
- [ ] Today 提供轻量每日回顾入口。
- [ ] 支持记录 / Reflection → Task，并保留来源回链。
- [ ] Web/Android 真实账户验收、跨用户隔离和 migration 测试。

完成门槛：一条随手记可以经过回顾后由用户确认转成 Task，并继续进入 Planner / Timeline / Focus。

---

## 6. Phase 15 M2：Insight → Action（P1/P2）

- [ ] Theme / Evolution / Action 三类 Insight。
- [ ] 每个 Insight 必须展示来源卡片，可解释、可删除、可归档。
- [ ] AI 只产生候选，不自动修改原记录、不自动创建 Task。
- [ ] ActionSuggestion 经用户确认后创建 Task。
- [ ] Task ↔ Insight 双向回链，能回答“为什么做这个任务”。

首版不引入向量数据库、知识图谱或独立 RAG 基础设施。

---

## 7. Study Mode（候选主线，Phase 15 M1 稳定后评估启动）

当前状态：方案、路线图与九张参考设计图已通过 PR #25 合入 master，但运行时代码尚未实施。

建议顺序：

1. **M1：Study Mode 壳层 + Study Home + StudyFolder**
2. **M2：ReviewPlan / ReviewRecord + 固定间隔复习闭环**
3. **M3：StudyHabit / 周计划 / 热力图**
4. **M4：模板 / PDF / 年度统计导出**

核心约束：复用现有 Course / Task / Calendar / Planner / Focus；不建立第二套数据事实源。

第一阶段验收链路：`Folder → Today → Focus → Review → Schedule`。

---

## 8. Phase 13：Local Codex Bridge（P2）

启动条件：Phase 12 / 14 / 15 的用户主链路稳定，且可在受支持的 Windows/macOS 环境完成 Node 24、Bridge、Gateway 与 native Codex 联调。

- [ ] loopback Gateway 与只读状态/工具契约。
- [ ] 只读监督 UI。
- [ ] 分批开放 turn/observe、steer/respond/interrupt、UNKNOWN 对账与验收。

不进入云端 API/数据库控制链路，不建立第二套 Codex runtime 或 transcript 数据库。

---

## 暂不进入主线

- Phase 09 中通用任务课程筛选、批量换课、独立 EventsView：待真实需求重估。
- Phase 10 中 Web Push 生产配置、扩展事件类型：在 Phase 12/14 稳定后另立短期方案。
- Phase 10 原“灵感转任务”不再单独推进，由 Phase 15 接管。
- 已取消的 CURRENT_CONTEXT、`@start`、`@duration` md 协议不得恢复。

## 每批次通用门禁

1. 从最新 `master` 建短期分支，避免长期叠加 PR。
2. Web/API 对应 build 与 tests 通过；`git diff --check` 通过。
3. 数据库 migration 必须 additive、可备份、可验证，不与未经合并的 migration 并行冲突。
4. Preview 验收后再合并；合并后检查生产健康和关键业务路径。
5. Android 相关改动必须至少做一次真机登录/网络/导航回归。
6. 文档状态只写已证实事实：开放 PR 不写已完成，健康接口不替代真实数据读写验收。
7. 每次合并、生产迁移或真实设备验收后，同步更新 `NEXT.md`、相关 Phase 和 `PROJECT_BLUEPRINT.md`。
