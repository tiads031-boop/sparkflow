# Study Mode 分阶段实施路线图

> 依赖：现有认证、Today、ScheduleItem、Planner、Focus 与 Course 主链路稳定。  
> 原则：每个里程碑都必须能独立验收；优先完成学习闭环，再扩展导出与统计。

## M0：方案与设计资产整理

范围：

- 整理九张参考图并使用语义化文件名。
- 固化 Study Mode 的边界、信息架构与 MVP。
- 明确复用模型与新增模型，避免复制 Task/Calendar/Course 数据。

交付：

- `docs/study-mode/README.md`
- `docs/study-mode/roadmap.md`
- `docs/study-mode/assets/`

验收：文档中的九张图可正常显示，路径与命名可读。

## M1：Study Mode 壳层与学习首页（✅ 代码完成，🚧 生产验收）

范围：

- 欢迎页增加学习场景选择。
- 导航设置增加 Study Mode 开关。
- 新增 Study Home 与二级导航。
- 聚合现有课程、任务、日程与专注数据。
- 新增 StudyFolder 的最小 CRUD。

建议代码位置：

```text
web/src/components/study/
api/src/study/
api/prisma/migrations/<timestamp>_add_study_folder/
```

验收：

- 学习模式可启用/隐藏。
- 用户可创建、编辑、归档文件夹。
- Study Home 可查看今天学习事项与关联课程。
- 360px、PWA、Android 基础回归通过。

## M2：复习闭环

范围：

- ReviewPlan 与 ReviewRecord。
- 掌握程度记录。
- 下一次复习建议。
- Preview → Apply → Undo 接入现有 Planner/Calendar。
- 从 Focus 完成页进入复习记录。

第一版算法建议使用可解释的固定间隔策略，例如按掌握程度选择 1 / 3 / 7 / 14 / 30 天；算法参数可配置，但不引入不可解释的模型决策。

验收：

- 完成一次复习后生成唯一 ReviewRecord。
- 下一次复习时间可预览、确认、撤销。
- 重试不会重复生成记录或日程。
- Today、Study Home 与 Timeline 状态一致。

## M3：习惯与学习计划

范围：

- StudyHabit / HabitCheckIn。
- 周计划与考试倒数日。
- 习惯连续天数和近 13 周热力图。
- 学习日程继续复用 CalendarEvent。

验收：

- 同一习惯同一天最多一条有效打卡。
- 跨时区和午夜边界有测试。
- 周计划与现有日历冲突规则一致。
- 打卡与撤销均能即时更新统计。

## M4：模板与导出

范围：

- 内页模板浏览与组合。
- 复习计划导出。
- 年度热力图导出。
- PDF 打印样式与分页。

约束：

- 导出使用服务端或确定性的客户端渲染，结果可复现。
- 首版只提供内置模板；暂不建设模板市场。
- 导出失败不得影响原始学习数据。

验收：

- 常见 A4 页面无裁切、乱码或分页重叠。
- 三类导出在 Web 与移动端均可下载或分享。
- 导出数据与页面统计一致。

## 建议拆分的开发 Issue

### Issue 1 — feat: introduce study mode workspace

- Study Mode 入口与开关
- Study Home
- StudyFolder 数据模型与 CRUD
- 现有 Course / Task / ScheduleItem 聚合

### Issue 2 — feat: add spaced repetition review flow

- ReviewPlan / ReviewRecord
- 掌握程度
- 下一次复习建议
- Planner Preview / Apply / Undo
- Focus 完成回流

### Issue 3 — feat: add study habits and schedule

- StudyHabit / HabitCheckIn
- 周计划
- 连续天数与短周期热力图

### Issue 4 — feat: add study templates and exports

- Inner Page 模板
- Memory Plan
- Yearly Heatmap
- PDF 输出

## 测试重点

- 服务端用户隔离与越权测试。
- 复习记录幂等与事务测试。
- 日程冲突、撤销、跨时区与夏令时测试。
- 360px 移动端、safe-area、软键盘和底部导航遮挡测试。
- 真实账户端到端测试：Folder → Focus → Review → Schedule。
