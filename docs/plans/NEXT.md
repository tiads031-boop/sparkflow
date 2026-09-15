# SparkFlow — 下一步执行队列

> **最后更新**：2026-09-15 | **事实基线**：`master@4d9ebe1`
>
> 本文件是唯一近期执行队列。其他 Phase 文档负责范围与验收细节；发生冲突时，以代码/生产事实和本文件的顺序为准。

## 当前生产基线

| 范围 | 已确认事实 |
|---|---|
| 数据与认证 | 腾讯云独立自建 PostgreSQL + SparkFlow API 自建密码/会话认证；与 DeepTutor 数据库隔离 |
| API | `https://api.fish-life.cc.cd`，Nginx 反向代理至 NestJS；健康接口可用 |
| Web | Vercel 主项目 `sparkflow031`，生产域名 `fish-life.cc.cd` |
| GitHub | `master@4d9ebe1`；开放 PR #14 为 Timeline V2 |
| 部署噪声 | 旧 Vercel 项目 `sparkflow`、`sparkflow-psi1` 会产生失败检查，不代表主项目 Preview 失败 |

## 串行执行顺序

### 1. PR #14：Timeline V2 验收并合并（P0）

当前状态：代码已在 PR #14；Web/API CI 与 `sparkflow031` Preview 成功，**尚未合并**。

- [ ] 360px 窄屏浏览器验收。
- [ ] Android 真机横向滚动、长按创建、拖动和 Resize。
- [ ] Google、本地日历、课程数据在 Month/Week/Timeline 三视图一致。
- [ ] 15 分钟吸附、锁定项、任意分钟时长、DST/跨时区/日期边界。
- [ ] 验收通过后合并，核对生产部署与关键回归。

完成门槛：PR #14 已合并；主生产部署健康；没有阻断级数据错位或移动端交互回归。未达到门槛前不得宣布 M3/V5 Core 完成。

### 2. Vercel 重复项目治理（P0，平台配置）

- [ ] 确认 `sparkflow031` 是唯一生产项目，Root Directory=`web`、域名和环境变量正确。
- [ ] 归档或断开旧项目 `sparkflow`、`sparkflow-psi1` 的 Git 集成，停止重复部署检查。
- [ ] 确认 GitHub 必需检查只依赖有效的 Web/API CI 与主项目部署。

完成门槛：后续 PR 不再因两个旧项目产生误导性红灯；主项目 Preview/Production 状态可单独判断。

### 3. Phase 12：服务端安全导入（P0，下一开发批次）

先完成数据安全闭环，再扩展视觉或新课程能力。

- [ ] 支持选择已有学期，且不静默覆盖历史课程。
- [ ] 定义导入 `requestId`、payload hash、目标学期、处理状态和结果摘要。
- [ ] 稳定排课指纹、重复检测、时间冲突检测。
- [ ] “跳过重复（默认）/保留副本”策略贯穿预览、API 与结果。
- [ ] Prisma Transaction 原子写入；失败回滚；未知结果先查询再重试。
- [ ] 跨用户隔离、重复重放、并发、超时和事务回滚集成测试。
- [ ] 核验 `SchedulePlan` migration 已在生产执行，并顺带走通 Planner Preview → Apply → Undo。

完成门槛：双击、断网和超时重试不产生意外副本；失败无半成品；真实账户能确认结果。

### 4. Phase 12：真实导入与发布验收（P0/P1）

- [ ] 上午/下午/晚间分段作息生成。
- [ ] Web 用真实学校数据走通获取 → 返回 → 预览 → 导入。
- [ ] Android 真机走通 SchoolImport/文件降级、返回应用、时区与文件选择。
- [ ] 360px、软键盘、safe-area、错误定位和成功后切换目标学期。
- [ ] 生产 Auth、semesters、courses、schedule、tasks 冒烟与日志检查。

完成门槛：Web/Android 各一条真实路径通过，且可回滚。

### 5. Phase 14：完成 M4/M5（P1）

- [ ] M4 自然语言意图解析；确定性 Scheduler 继续作为唯一排程决策层。
- [ ] M4 “帮我顺延”模式及生产/真机验收。
- [ ] M5 Daily Receipt 与 PNG 分享。
- [ ] M5 历史核心页面深色 Token 迁移。
- [ ] M5 Android Widget（最后实施，不阻塞 Web）。
- [ ] Settings V5 分组整理，保持现有数据能力和 storage key 不变。

### 6. Phase 13：Local Codex Bridge（P2）

启动条件：前五步稳定，且可在受支持的 Windows/macOS 环境完成 Node 24、Bridge、Gateway 与 native Codex 联调。

- [ ] 先实现 loopback Gateway 与只读状态/工具契约。
- [ ] 再实现只读监督 UI。
- [ ] 最后分批开放 turn/observe、steer/respond/interrupt、UNKNOWN 对账与验收。

不进入云端 API/数据库控制链路，不建立第二套 Codex runtime 或 transcript 数据库。

## 暂不进入主线

- Phase 09 中的通用任务课程筛选、批量换课、独立 EventsView：待真实需求重估。
- Phase 10 的 Web Push 生产配置、扩展事件类型、灵感转任务：在 Phase 12/14 稳定后另立短期方案。
- 已取消的 CURRENT_CONTEXT、`@start`、`@duration` md 协议不得恢复。

## 每批次通用门禁

1. 从最新 `master` 建短期分支，避免长期叠加 PR。
2. Web/API 对应 build 与 tests 通过；`git diff --check` 通过。
3. 数据库 migration 必须 additive、可备份、可验证，不与未经合并的 migration 并行冲突。
4. Preview 验收后再合并；合并后检查生产健康和关键业务路径。
5. 文档状态只写已证实事实：开放 PR 不写已完成，健康接口不替代真实数据读写验收。
