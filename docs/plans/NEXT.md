# SparkFlow — 下一步执行队列

> **最后更新**：2026-09-21 | **代码基线**：`master@9f6b1fe7`（生产运行版本 `9f72d16b`）
>
> 本文件是唯一近期执行队列。其他 Phase 文档只负责范围、约束与验收细节；若与本文件冲突，以代码/生产事实和本文件顺序为准。

## 当前生产与仓库基线

| 范围 | 已确认事实 |
|---|---|
| 数据与认证 | 腾讯云独立自建 PostgreSQL + SparkFlow API 自建密码/会话认证；与 DeepTutor 数据库隔离 |
| API | `https://api.fish-life.cc.cd`，2026-09-21 公网 `/api/health.buildSha` 已确认运行 `master@9f72d16b`；进程与版本追溯通过。2026-09-21 已在服务器直接执行 `prisma migrate status`：31 个 migrations，`Database schema is up to date!` |
| Web | 腾讯云 Nginx 直接托管 `/var/www/sparkflow`；2026-09-21 首页 HTTPS 200，生产主 bundle 与本地 `master@9f72d16b` 构建哈希一致，并静态核到 Focus C2“记录一下 / 再记一条 / 保存专注记录”文案 |
| GitHub | `master@2c14b8d2`；生产运行版本为 `9f72d16b`，功能代码基线为 `e5978ecb`，其后提交为状态文档同步。VNext M4–M8 与 Focus C1/C2 代码/CI 已完成；2026-09-21 本地复验 API 141/141、Web 71/71 与两端 build 均通过 |
| Phase 12 CI | PostgreSQL 16 全量 migration、API build/test、顺序 replay、并发 replay、rollback、跨用户隔离真实 Prisma/PostgreSQL E2E 已纳入 CI |
| Android | Capacitor CORS 已补齐 `https://localhost` / `capacitor://localhost`；APK CI 会核验生产 API、写入 commit 标识并发布 GitHub prerelease |
| 最新功能 APK | Release `android-e5978ecbbc24`；`sparkflow-e5978ecbbc24-debug.apk`；对应 Focus C2 功能提交 `e5978ecbbc24`，生产 API 目标校验通过；SHA-256 `6db099865fdb8ee3febc6febf65c1f9b8b7a65c3db3bc0d2532e4fa7efe67d70` |
| Web 部署 | 已退出 Vercel 流量路径；DNS TTL 为 600 秒。服务器没有宿主机 Node.js，部署脚本会自动复用现有 `sparkflow-api:latest` 镜像中的 Node.js/npm 构建静态站 |

## 近期总原则

1. **Phase 15 M1/M2/M3 与 Focus C1/C2 代码均已进入 master；不要再重复实现 Capture、Insight、Insight→Task 或专注记录底座。**
2. **最新 `master@9f72d16b` 的 API/Web 同步已确认；生产 migration 直接证据已取得；Web 真实账号核心闭环已验收；当前第一收口项是剩余 Web/PWA 路径与 Android 真机验收。不要再继续重复实现 M4–M8 与 Focus C1/C2 已完成能力。**
3. **M2 已出现真实 Qwen Provider 生产调用；PR #43 稳定性修复已随 `99ebb3c` API 镜像上线，下一步复验真实生成质量与失败恢复，禁止用伪造洞察代替。**
4. **腾讯云 API/Web 已发布 `master@9f72d16b`，但 health 200 与静态 bundle 只能证明版本上线；C1 migration 已由服务器直接核验；真实业务闭环仍需单独验收。**
5. **Android 继续以 commit-stamped Release 做真机验收；当前最新包为 Focus C2 `android-e5978ecbbc24`。**
6. **VNext Plan M1–M3 已进入 master；用户已明确重定义下一阶段产品方向：学习改为独立 AI 目标规划、AI 安排升级为对话式调度、课程支持单次调课/换课、四象限手机同屏可关闭、Today 极简、多模态随手记、设置/通知/任务表单重做。按 M4–M8 新方案推进，不再沿用旧的“Study 关联 Course / M4 仅拖拽过滤”方向。**

---

## 0. 仓库收口与基础门禁（P0）— ✅ 已完成

### 旧 PR 收口

- [x] PR #23 被 PR #25 / `docs/study-mode/` 替代并关闭。
- [x] PR #24 已 squash 合并为 `fad1a619`，课程任务统一进入共享 Task Store。
- [x] PR #27 已由后续 #28/#29/#30/#36 的更完整 Phase 12 安全与真实 PostgreSQL 验证覆盖，关闭旧分支避免重复维护。
- [x] PR #14 已关闭；剩余 Timeline M3 要求迁移到 Issue #26，从最新 master 重做。

### Phase 12 安全与数据库门禁

- [x] PR #28：处理中不可重放、并发竞争恢复、回滚失败传播、`(userId, requestId)` 查询隔离等安全测试。
- [x] PR #29：CI 启动全新 PostgreSQL 16，执行全部 Prisma migrations，并验证 `prisma migrate status`。
- [x] PR #30：真实 Prisma/PostgreSQL 执行 V2 导入并重复相同 `requestId`；数据库最终仅保留一份 batch / course / course event。
- [x] PR #32：`/api/health` 暴露 `buildSha`；Docker 支持 `BUILD_SHA`；部署手册要求 Git HEAD = 容器 BUILD_SHA = 公网 health buildSha。
- [x] PR #33：后端 CORS 始终显式允许受控 Capacitor Origin，同时保留配置的 Web Origin。
- [x] PR #34：Android CI 校验生产 API 地址、校验构建产物、用 commit SHA 命名 APK，并自动发布 GitHub prerelease。
- [x] PR #36：真实 PostgreSQL 验证同 requestId 并发竞争、事务失败 rollback、同 requestId 跨用户隔离。

**仓库/CI 侧安全基线已经收口，后续不要重复实现同一套幂等、migration、真实数据库并发/rollback 或 APK 可追溯机制。**

---

## 1. Phase 12：腾讯云生产验收（P0，当前唯一主线）

以 Issue #31 为执行清单。

### A. 部署版本与 migration

- [x] 已从 `master@99ebb3c` 构建腾讯云 API 镜像并写入 `BUILD_SHA`。
- [x] 公网 `/api/health.buildSha`、服务器 Git HEAD、运行镜像均已对齐 `99ebb3c`。
- [x] 腾讯云生产库 `prisma migrate status` 已再次直接核验：31 migrations，`Database schema is up to date!`；Focus C1 migration 已进入生产链。
- [x] `20260919130000_add_study_folders` 已应用并通过 StudyController 路由启动核验。
- [x] `20260914050000_add_schedule_plans` 已包含在生产 migration chain。
- [x] `20260915120000_add_course_import_idempotency` 已包含在生产 migration chain。
- [x] 生产 migration chain 已覆盖 `course_import_batches` 与课程来源/import 字段；CI 与生产 status 均通过。

### B. 生产 API 冒烟

使用正常测试账号，不触碰其他用户数据：

- [x] 登录 / Session 恢复：真实生产账号登录成功，页面刷新后 Session 正常恢复。
- [ ] semesters、courses、tasks、schedule/calendar 读取。
- [x] Planner Preview → Apply → Undo：真实账号创建隔离 QA 任务，对话式 AI 追问与草案确认成功，Scheduler 生成预览、应用 1 项并撤销恢复 1 项。
- [ ] 核对服务端日志无 migration / auth / CORS 异常。

### C. Web 真实教务导入

- [ ] 真实学校路径：获取 → 返回 → 预览 → 导入。
- [ ] 服务端重复/冲突预览可见。
- [ ] 同一 `requestId` 重放不产生副本。
- [ ] 已有学期路径不静默覆盖无关历史课程。
- [ ] 未知结果/超时后先按 `requestId` 查询，再决定是否重试。

### D. Android 真机

使用最新 GitHub Release APK：

- [ ] 安装最新 Focus C2 Release `sparkflow-e5978ecbbc24-debug.apk`。
- [ ] 登录成功；确认此前 CORS 分叉已消失。
- [ ] Session 刷新/重启后恢复。
- [ ] SchoolImport / 文件降级 → 返回 SparkFlow → 预览 → 导入。
- [ ] 重复提交仍然幂等。
- [ ] 360px 等效窄屏、safe-area、软键盘、文件选择可用。

**完成门槛**：腾讯云 migration + buildSha 可追溯、Web 真实导入、Android 真机登录/导入、Planner 生产闭环全部通过；失败/重试后无重复或半成品数据。

---

## 2. Phase 12：数据库回归防护（P1）

真实 PostgreSQL CI 当前已经覆盖：

- [x] 首次导入 + 相同 requestId 顺序 replay。
- [x] 两个并发请求竞争相同 requestId，最终一份 commit + 一份 replay。
- [x] 事务在 batch 创建后失败时完整 rollback，不残留 batch/course。
- [x] 两个用户复用相同 requestId 时结果和课程数据保持用户隔离。
- [ ] 客户端断连/超时但数据库已提交的 HTTP 端到端未知结果恢复测试。

最后一项更适合与 Issue #31 的生产/HTTP 验收一起验证，不再阻塞数据库代码本身的收口。

---

## 3. 平台与发布治理（P0/P1，可与生产验收并行）

- [x] Vercel 账户实际项目列表已确认只剩 `sparkflow031`；旧 `sparkflow` / `sparkflow-psi1` 项目本体已不存在。
- [x] Android workflow 会核验 `.env.production` 指向 `https://api.fish-life.cc.cd/api`。
- [x] Android workflow 会在 Vite build 后确认生产 API 真正嵌入 bundle。
- [x] APK 文件名、Actions artifact 和 GitHub Release 均绑定 commit SHA；Release 中记录 APK SHA-256。
- [ ] 继续区分/清理 GitHub 中残留的旧 Vercel status context，避免误导 PR 判断。
- [ ] 处理 Vercel Hobby `build-rate-limit`，恢复稳定 Preview/Production 部署信号。
- [ ] 确认 GitHub 必需检查只依赖有效 Web/API CI 与当前有效部署信号。

完成门槛：代码 CI、Vercel 部署状态、Android Release 均能明确追溯且互不混淆。

---

## 4. Phase 14：核心效率闭环收口（P1）

不重复实现已经进入 master 的 Today、四象限、甘特图、Focus、Planner 基础能力。

剩余范围：

- [ ] M3 Timeline V2 余项按 Issue #26 从最新 master 重新实现，并保留现有甘特能力。
- [ ] M4 自然语言意图解析；确定性 Scheduler 继续作为唯一排程决策层。
- [ ] M4 “帮我顺延”模式及生产/真机验收。
- [ ] M5 Daily Receipt 与 PNG 分享。
- [ ] M5 历史核心页面深色 Token 迁移。
- [ ] M5 Settings V5 分组整理，保持现有数据能力和 storage key 不变。
- [ ] M5 Android Widget 最后实施，不阻塞 Web 主线。

完成门槛：`今天 → 待办 → 时间轴 → AI 安排 → 专注 → 完成` 在 Web/PWA/Android 均有真实闭环验收。

---

## 4.5 VNext 信息架构与 Plan Workspace（M1–M3 ✅ 代码/CI，🚧 生产与真机验收）

方案：[vnext-information-architecture-plan-workspace.md](vnext-information-architecture-plan-workspace.md)

- [x] PR #47：详细信息架构与实施方案合入。
- [x] PR #48 / M1：底部导航固定为“今天 / 计划 / 记录 / 学习 / 我的”；PlanWorkspace 与 Month / Week / Agenda / Timetable 壳层、旧入口兼容、视图记忆。
- [x] PR #49 / M2：Task / Course / CalendarEvent / Study Task 统一前端投影；真实月/周/日程/时间表；课程周次与重复来源去重。
- [x] PR #50 / M3：Planner Preview 以临时时间块叠加到 Week / Agenda；Apply 后转为真实 Task 排程；Undo 恢复；未修改 Planner API 契约。
- [x] 三批均通过 Web build/tests 与现有 API/fresh PostgreSQL CI。
- [x] 腾讯云 API/Web 已对齐 `master@9f72d16b`；公网 health buildSha、首页 HTTPS 与 Focus C2 bundle 文案已核验。
- [x] Web 真实账号：Planner Preview → Apply → Undo 已通过；Session 刷新恢复正常。
- [ ] Web/PWA 继续验收 Month / Week / Agenda / Timetable、安装态与离线/恢复。
- [x] Android Focus C2 commit-stamped APK 已生成：Release `android-e5978ecbbc24` / `sparkflow-e5978ecbbc24-debug.apk`。
- [ ] Android 真机：360px、safe-area、底栏、周视图密度、课表、Planner 闭环。
- [ ] M4（拖拽、过滤、视觉细化）仅在上述真实验收稳定后启动。

核心约束继续保持：PlanItem 只是一层前端视图模型；Task / Course / CalendarEvent / Planner / Focus 仍为现有事实源，不创建第二套 Schedule/StudySchedule。

---

## 4.6 VNext M4–M8：AI 调度中枢与产品重整（✅ 代码/CI 完成，🚧 生产/PWA/Android 验收）

方案：[vnext-ai-orchestration-study-course-capture.md](vnext-ai-orchestration-study-course-capture.md)

用户已确认的新方向：

- [x] **M4.1 / 通知正确性**：PR #55 已修 PushService 用户隔离、`reminderAt` 优先、每任务/提醒/订阅的持久化 delivery key；新增 server-only `notification_deliveries` migration 并通过 fresh PostgreSQL CI。
- [x] **M4.2 / Today 极简**：PR #55 已移除日期选择 / WeekStrip / RhythmDial / FreeTime / TodayProgress / Review 卡片；Today 固定读取真实今天，只显示统一“今日安排”。
- [x] **M4.3 / 新建任务 UI**：PR #56 已新增统一浅色 Task Sheet；常用字段首屏，提醒/重复/指定开始时间进入“更多设置”；支持“保存并交给 AI 安排”。旧编辑详情暂保留，避免移除子任务/Pomodoro。
- [x] **M4.4 / 四象限**：PR #56 已将 Plan 待办切换为“列表 / 四象限”；手机端同屏 2×2，选择持久化；旧 Board 入口兼容映射到四象限。
- [x] **M4.5 / Settings 新壳层**：PR #58 已把“我的/设置”重构为分组首页 + 二级设置页；四象限开关、默认提醒、Push 测试、Google/系统日历、数据备份、密码与诊断均保留真实能力。
- [x] **M5 / AI 规划与调整 2.0**：PR #59–#63 已完成持续 PlanningThread/Context、AI 自适应访谈、SearXNG Web Research 证据层、Qwen 语音转写、规划依据可编辑、对话 → Task 操作草案、临时冲突增量重排，以及 Preview → Apply → Undo。AI 仍不直接写时间；具体排程继续由确定性 Scheduler 决定。
- [x] **M6 / 学习目标 AI**：PR #66/#68/#69 已完成 Study 与 Course 新 UI 解耦、目标专属 PlanningThread、阶段/里程碑投影、目标 Task 回链、执行反馈快照与显式目标变化；继续复用 M5 Web Research / 语音 / 增量重规划。
- [x] **M7 / 课程灵活调整**：PR #70–#73 已完成单次调课/换课/停课/补课 occurrence override、Preview/Apply/Undo、AI 自然语言调整，以及“以后都改”类周期 Course 模板 Preview/Apply/Undo；单次变动与周期模板严格分离。
- [x] **M8.1 / 多模态记录**：PR #74 已完成 Inspiration 私有图片/音频/视频附件、语音录制、受控读取与媒体预览；上传时不自动调用 AI。
- [x] **M8.2 / 通知偏好**：PR #77 已完成账户级任务/课程提醒、默认提前量、安静时段、时区和测试通知；继续复用现有 `User.settings.notification`，未新增第二套设置表。
- [x] **M8.3 / 设置视觉与外观**：PR #78 已完成“我的”设置中心视觉收尾与真实“跟随系统/浅色/深色”外观选择；不暴露无真实后端能力的 AI 假开关。
- [x] **M8.4 / 显式附件 AI**：PR #80 已完成音频“转写 → 摘要”；PR #81 已完成图片信息提取与视频“语音转写 + 画面/语音综合摘要”。全部只在用户主动点击时调用 AI；上传本身不自动消耗额度。
- [x] **M8.5 / Focus C1**：PR #105 已完成精确专注分段、暂停/恢复计时、CAS 完成、Focus 日历投影与 `Inspiration.focusSessionId` 数据关联。
- [x] **M8.6 / Focus C2**：PR #106 已完成完成后“记录一下 / 稍后 / 再记一条”多模态记录，后端校验会话归属与 completed 状态；支持 5–180 分钟圆盘拖拽（5 分钟吸附）与精确输入。
- [ ] **M8 最终验收**：API/Web 已同步到生产 `9f72d16b`，31 个 migrations 已直接核验；Web 真实账号已通过 5 分钟精确时长、暂停/恢复、提前完成、关联任务与同一会话连续保存 2 条文字记录。继续在 PWA / Android 真机验证麦克风、文件选择、私有附件播放、音频/图片/视频显式 AI、通知、深浅色、safe-area 与网络失败恢复。

### M5 实施记录 — ✅ 代码/CI 完成

- PR #59 / M5.1：PlanningThread、结构化 Planning Context、revision 并发保护、SchedulePlan 回链规划版本。
- PR #60 / M5.2：对话式 AI Planner、SearXNG SearchProvider、证据持久化与来源展示、Quick Add“临时安排”。
- PR #61 / M5.3：Qwen `qwen3-asr-flash` 语音输入；转写后先回填文本再由用户发送；规划依据可人工编辑。
- PR #62 / M5.4：对话生成可审阅的 create_task / update_task 草案；服务端保存 proposal；用户逐项确认后才写入。
- PR #63 / M5.5：临时冲突增量重排；AI 只提出 blocked/planning window，Scheduler 计算“原时间 → 新时间”，Apply 再次校验冲突并支持 Undo。
- M5 全程保持：Task / Calendar / Course 事实源不变；AI 不绕过 Preview / Apply / Undo；锁定任务、课程和真实日历事件继续作为固定边界。

### M6–M8 实施记录 — ✅ 主体代码/CI 完成

- PR #66：Study 重建为独立 AI 学习目标工作区；每个目标复用持久 PlanningThread。
- PR #68：学习目标路线按现有共享 Task 的 `project` 聚合阶段/里程碑，不新增第二套 roadmap/task 事实源。
- PR #69：从真实 Task/Pomodoro 派生执行反馈，并支持用户明确确认后的 `update_goal`。
- PR #70：课程单次调课/停课/换课/补课 occurrence override + 冲突 Preview/Apply。
- PR #71：课程变动通过 typed SchedulePlan 支持安全 Undo。
- PR #72：AI 自然语言课程变动复用同一 Course Preview/Apply/Undo；AI 不直接写 CalendarEvent。
- PR #73：周期 Course 模板变更与单次 override 分流，并具备独立 Preview/Apply/Undo。
- PR #74：Inspiration 私有多模态附件与录音/图片/视频 Capture。
- PR #77：账户级任务/课程提醒偏好、安静时段、时区与测试通知。
- PR #78：Settings 视觉收尾 + 跟随系统/浅色/深色外观；Web/API CI 全绿。
- PR #80：音频附件由用户主动触发 Qwen ASR 转写与摘要；原音频继续保留在私有附件存储。
- PR #81：图片附件主动提取可见信息；视频附件主动生成语音转写与画面/语音综合摘要；图片/视频 AI 处理上限独立于存储上限。
- PR #105：精确专注分段、可恢复暂停/恢复、CAS 完成与 Focus 日历投影；为 Inspiration 增加专注会话回链字段。
- PR #106：完成后关联多条文字/语音/图片/视频记录；专注时长圆盘拖拽与精确输入；API/Web build/test 与 fresh PostgreSQL CI 全部通过。
- 当前仓库状态文档基线为 `master@2c14b8d2`；腾讯云 API/Web 运行 `9f72d16b`。生产 31 个 migrations 已直接核验；Web 真实账号已通过登录/Session、AI 草案、Planner Preview→Apply→Undo 与 Focus 多条文字记录；Android 真机及其余 PWA/多模态路径仍未验收。

### M4 第一优先级安全修复 — ✅ 已完成

PR #55 已完成：

1. 到期/提醒任务按 userId 分组；
2. 只发送到同 userId 的 subscriptions；
3. `reminderAt` 优先于 `dueDate`，无显式提醒时保留 due-soon fallback；
4. `notification_deliveries.deliveryKey` 唯一约束防 cron 重复推送；
5. 仅在通道发送成功后写 delivery，临时失败仍可重试；
6. 新表启用 RLS 并拒绝 anon/authenticated 直连。

该隐私/正确性风险已由代码 + migration + CI 收口；生产部署仍需按 API 发布流程执行。

### 已明确取消/替代的旧方向

- Study 新 UI 不再关联 Course，也不显示“今日课程/课程管理”。
- 四象限移动端不再“一次只看一个象限”，改为完整 2×2。
- Today 不再显示 WeekStrip / RhythmDial / FreeTime / TodayProgress。
- “AI 帮我安排”固定日期/时间窗表单不再作为最终交互。
- 五项底栏固定后，Settings 不再暴露旧导航排序/显示设置。

---

## 5. Phase 15 M1：Capture → Review → Task（✅ 代码 + 生产核心链路已完成）

- [x] 服务端 `Inspiration` 成为记录事实源，支持 manual 随手记。
- [x] `InspirationReflection` 保留回顾历史，不覆盖原文。
- [x] 全局 Quick Add、记录卡片 / 回顾 / 自由墙、Today 回顾入口。
- [x] 新记录次日、Reflection +3 天、稍后 +1 天、已消化 +14 天。
- [x] 记录 → Task 并保留 `Task.inspirationId` 回链。
- [x] fresh PostgreSQL migration、Web/API CI、生产 API 与核心真实链路验收。

仍可后续增强但不阻塞 M1 收口：关键词搜索、离线 pending create、回顾左右滑动等体验项。

---

## 6. Phase 15 M2/M3：Insight → Action（🚧 代码完成，生产收尾）

### M2 Insight — ✅ 代码/数据库/API

- [x] `Insight` + `InsightInspiration` 正式 N:N 来源关系。
- [x] Theme / Evolution / Action 三类可解释 Insight。
- [x] 每个 Insight 展开真实来源；支持归档/删除。
- [x] OpenAI-compatible Provider 抽象与输出校验；虚构/越权 source id 不落库。
- [x] 腾讯云生产已应用 M2 migration。
- [x] **真实 AI Provider 已接通并出现 Qwen 生产调用证据**；PR #43 针对 qwen3.7-plus 默认 thinking、JSON 输出、Provider 超时与 429/5xx 短重试做了稳定性修复。
- [ ] 用真实账户复验多卡片 → Insight 的成功率、延迟与模型质量。

### M3 Insight → Task — ✅ 代码/API/Android，🚧 Web Production

- [x] PR #40：`Task.insightId`，一个 Insight 可产生多个 Task。
- [x] Action 洞察点击“加入待办”后先显示确认 Sheet；用户可改标题、时长、截止日期、优先级。
- [x] Task ↔ Insight 双向回链；Task 详情显示洞察与来源记录数量。
- [x] 普通 Task 编辑不能重新绑定 `insightId/inspirationId`；创建时校验 Insight 属于当前用户。
- [x] 腾讯云 API 已部署 `master@9f72d16b`；此前生产库 20 个 migrations 状态 up to date，生产 31 个 migrations（含 Focus C1）已直接复核。
- [x] GitHub CI 与最新 Android APK `android-5835e3223748` 成功；该包已包含 PR #43 的前端请求超时治理。
- [x] **Web Production 已发布 `master@9f72d16b`**：首页 HTTPS 200，bundle 与同 SHA 本地构建一致；仍需真实账户验证 Insight 75s 专用超时与普通 API 15s 有界超时。
- [ ] Web/Android 真机跑完整链路：本次 Web 已通过 Task → AI Planner → Preview/Apply/Undo → Focus → 两条关联文字记录；仍需补齐回顾 → Insight → 确认 Task、Timeline、显式多模态 AI 与 Android 真机。

### 发布策略

- Git 自动 Vercel deployments 关闭，避免每个短分支小 commit 消耗 Hobby 每日 deployment 次数。
- GitHub CI 是代码门禁；Vercel Production 在合并并确认 commit 后显式创建。
- 不把 Preview/health 200 当成业务验收。

### PR #43 稳定性补丁（已进入 master）

- Qwen/DashScope 请求关闭默认 thinking，并启用 JSON object 输出。
- Provider 超时提升为 60s；429/500/502/503/504 首次失败允许一次短重试。
- 普通 Web API 请求默认 15s 超时；Insight 生成单独允许 75s。
- Provider 失败写入不含密钥/用户内容的安全摘要日志；前端区分 408 请求超时。
- 该补丁已进入 `master@99ebb3c` 并随腾讯云 API/Vercel Production 上线；真实账户链路仍需验收。

---

## 7. Study / 学习工作区（旧 M1 已部署，新方向已重定义）

旧 StudyFolder M1 代码仍在仓库，但产品方向已于 2026-09-19 重定义：

- 不再把 Course 作为 Study 的组成部分；
- StudyFolder 升级为“学习目标容器”，继续复用 StudyFolderTask；
- 新 UI 围绕“目标 → AI 追问 → 阶段/里程碑 → Task → 日程 → 重新规划”；
- 课程继续由独立 Course 模块管理；
- 旧 StudyFolderCourse 关系暂时只保留兼容，不在新 UI 中继续使用。

后续实施以 [vnext-ai-orchestration-study-course-capture.md](vnext-ai-orchestration-study-course-capture.md) 的 M6 为准，旧 Study Mode M2/M3/M4 路线不再作为近期执行依据。

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
2. Web/API 对应 build 与 tests 通过；数据库相关改动同时通过 fresh PostgreSQL migration + targeted E2E。
3. 数据库 migration 必须 additive、可备份、可验证，不与未经合并的 migration 并行冲突。
4. API 自托管镜像必须带 `BUILD_SHA`；生产验收记录必须能追溯到明确 commit。
5. Android 构建必须通过生产 API gate，并发布带 commit 的 APK；Android 相关功能仍必须至少做一次真机登录/网络/导航回归。
6. Preview / CI / health 200 都不等于生产业务验收完成。
7. 文档状态只写已证实事实：代码存在、CI 通过、生产可用分别记录。
8. 每次合并、生产迁移或真实设备验收后，同步更新 `NEXT.md`、相关 Phase、`INDEX.md` 与 `PROJECT_BLUEPRINT.md`。
