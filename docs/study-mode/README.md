# SparkFlow Study Mode 提案

> 状态：候选方案，尚未进入近期执行队列  
> 目标：在不拆分现有应用、不复制任务与日程数据的前提下，为学习场景提供独立入口、信息架构与闭环体验。

## 1. 为什么需要 Study Mode

SparkFlow 当前已经具备 Today、Task、Timeline、Planner、Focus、Course 与 Calendar 等基础能力，但学习场景仍分散在通用工作流中。Study Mode 应当是现有能力之上的“学习工作区”，而不是第二套应用或第二套数据源。

学习闭环定义为：

```text
学习目标 / 课程
  → 拆分学习任务
  → 安排到日程
  → 专注执行
  → 记录掌握程度
  → 生成下一次复习
  → 查看长期进展
```

## 2. 产品边界

### 本阶段要做

- 在欢迎页和导航设置中提供“学习模式”入口。
- 建立独立的 Study Home，聚合今日学习、待复习、学习习惯和近期计划。
- 以 Folder 组织课程、考试、证书或自定义学习目标。
- 支持复习计划、复习记录与下一次复习日期。
- 复用现有 Task、CalendarEvent、ScheduleItem、PomodoroSession 与 Course。
- 保持 Web、PWA 与 Android 的移动端一致性。

### 本阶段不做

- 不复制现有 Today、Calendar、Focus 或 Course 数据。
- 不让 LLM 直接修改复习时间；建议仍遵循 Preview → Apply → Undo。
- 不在 MVP 中引入复杂的知识图谱、题库或第三方笔记同步。
- PDF 模板与年度热力图放到后续里程碑，不阻塞学习闭环上线。

## 3. 信息架构

| 页面 | 核心内容 | 与现有模块的关系 |
|---|---|---|
| Study Home | 今日学习、待复习、习惯、倒数日、进度 | 复用 Today 聚合与 ScheduleItem |
| Folders | 学习目标、课程、考试、子项目 | 可关联 Course 与 Task，不复制数据 |
| Review | 本次复习、掌握程度、下次复习 | 新增 ReviewPlan / ReviewRecord |
| Habits | 学习习惯、连续天数、热力图 | 新增 Habit / HabitCheckIn |
| Schedule | 学习周计划、考试节点、复习安排 | 复用 CalendarEvent 与 Planner |
| Inner Pages | 学习模板选择与预览 | 后续导出模块 |
| Export | 内页、记忆计划、年度热力图 | 后续 PDF/打印能力 |

建议底部导航不直接塞入六个新入口。Study Mode 内部使用二级导航，首屏只保留“首页 / 文件夹 / 复习 / 更多”，避免继续挤压现有移动端底部导航。

## 4. 与现有架构的衔接

### 前端

- 继续使用 Zustand 的 `activeTab` 与 navigation registry，不引入第二套路由。
- 新增 `web/src/components/study/`，Study Home 内复用 Today 卡片、任务编辑器、Schedule Editor 和 Focus 入口。
- Study Mode 的显示开关沿用现有导航设置与 onboarding 偏好。
- 所有弹层继续遵循 portal、safe-area、软键盘和 360px 宽度约束。

### 服务端

建议最小新增模型：

| 模型 | 作用 | 关键关系 |
|---|---|---|
| StudyFolder | 学习目标容器 | userId；可关联 Course / Task |
| ReviewPlan | 复习策略与当前状态 | folderId；可选 taskId/courseId |
| ReviewRecord | 单次复习结果 | planId；reviewedAt；rating；duration |
| StudyHabit | 学习习惯定义 | userId；schedule |
| HabitCheckIn | 每日打卡记录 | habitId；checkedAt |

`Task`、`CalendarEvent`、`Course`、`PomodoroSession` 继续作为事实源。复习计划只保存学习语义与调度状态，通过现有排程层投影为日程，不建立重复日历表。

### 权限与数据

- 所有新模型按服务端 Session 中的 userId 隔离。
- 客户端传入的 userId 不作为授权依据。
- 多表写入（例如完成复习并生成下一次复习）使用数据库事务。
- 通过唯一约束防止同一计划的重复打卡或重复生成同一轮次。

## 5. 参考设计

| 编号 | 参考图 | 对应能力 | 建议优先级 |
|---|---|---|---|
| 01 | [Today](assets/01-today.jpg) | 学习首页与今日聚合 | P0 |
| 02 | [Folders](assets/02-folders.jpg) | 学习目标空间 | P0 |
| 03 | [Review](assets/03-review.jpg) | 复习闭环 | P0 |
| 04 | [Inner Pages](assets/04-inner-pages.jpg) | 内页模板选择 | P2 |
| 05 | [Habits](assets/05-habits.jpg) | 习惯与连续性 | P1 |
| 06 | [Schedule](assets/06-schedule.jpg) | 学习计划与日程 | P1 |
| 07 | [Export Inner Pages](assets/07-export-inner-pages.jpg) | 可打印内页 | P2 |
| 08 | [Export Memory Plan](assets/08-export-memory-plan.jpg) | 记忆计划导出 | P2 |
| 09 | [Export Yearly Heatmap](assets/09-export-yearly-heatmap.jpg) | 年度投入可视化 | P2 |

这些图片只作为产品结构与视觉方向参考。具体组件应继承 SparkFlow 当前 Design Tokens、主题系统和交互规范，不直接复制另一套视觉框架。

## 6. MVP

MVP 只覆盖一条可验证的主链路：

1. 用户从欢迎页或设置启用 Study Mode。
2. 创建学习文件夹并关联课程或任务。
3. 在 Study Home 查看今天要学和待复习内容。
4. 开始 Focus，结束后记录掌握程度。
5. 系统生成下一次复习建议。
6. 用户确认后写入现有日程。
7. 返回 Study Home 能看到状态变化。

MVP 不要求 PDF 导出、模板商城或全年热力图。

## 7. 验收标准

- 360px 宽度下入口、二级导航、列表和弹层无遮挡。
- Web/PWA/Android 均能完成“创建文件夹 → 完成一次学习 → 记录复习 → 安排下一次复习”。
- Study Home 与 Today/Timeline 显示同一事实，不产生重复任务或日程。
- 断网重试不会生成重复 ReviewRecord 或重复日程。
- 不同账户无法读取或修改彼此的学习数据。
- 复习建议在确认前不写入日程，Apply 后可 Undo。
- 关闭 Study Mode 只隐藏入口，不删除数据。

## 8. 实施顺序

详细拆分见 [roadmap.md](roadmap.md)。本提案暂列为候选方案，不改变 `docs/plans/NEXT.md` 的当前执行优先级。
