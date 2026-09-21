# Phase 10 — 历史待办收束

> **归档说明（2026-09-22）**：本文件已退出活跃实施队列，仅保留历史设计与实现来源。当前执行顺序见 [NEXT](../plans/NEXT.md)，新一轮产品方案见 [Execution Intelligence & UI System](../plans/vnext-execution-intelligence-ui-system.md)。


> **创建时间**：2026-06-03 | **最后核对**：2026-09-15 | **状态**：⚠️ 冻结，逐项重估
>
> 本文保留 Phase 10 的历史待办及其去向，不再作为近期执行队列。唯一近期队列见 [NEXT.md](../plans/NEXT.md)。

## 状态核对

| 原子项 | 当前状态 | 优先级/去向 | 事实说明 |
|---|---|---|---|
| 10.1 Web Push/VAPID 生产配置 | ⬜ 待生产核验 | P2，按实际通知需求重启 | 推送代码仍在；旧 Render 环境变量描述已失效，若启用应改为腾讯云 API 容器配置并完成 Web/Android 实际送达测试 |
| 10.2 截止任务拖入时间线 | 🚧 已有主路径，增强待验收 | 并入 Phase 14 M3 | 现有 Calendar/Timeline 已有快速安排、长按创建与拖拽能力；PR #14 正在替换为 Timeline V2，避免在旧视图重复开发 |
| 10.3 `@start` / `@duration` md 协议 | ❌ 已取消 | 无 | 2026-06-01 已删除 CURRENT_CONTEXT/ContextBridge，同步改为纯 REST；排程字段已进入 PostgreSQL 数据模型 |
| 10.4 CalendarEvent 事件类型扩展 | ⬜ 待重估 | P2，Phase 14 稳定后 | 当前 `eventType` 已覆盖 task/focus/meeting/reminder/course；exam/cert/contest/other 与独立 EventsView 尚未实现，需先验证真实使用需求 |
| 10.5 Inspiration → Task | ⬜ 待重估 | P2 | 灵感与快速添加入口存在，但转化闭环仍未核实；不阻塞 Phase 12/14 主线 |
| 10.6 多用户/正式认证 | ✅ 已完成 | 已由新架构替代 | 生产已使用腾讯云自建 PostgreSQL + SparkFlow API 自建密码/会话认证，按服务端 session userId 隔离数据；不再使用 API Key 或 Supabase Auth |
| 10.7 独立提醒、重复任务、月历预览 | ✅ 已完成 | 维护 | Task 已具备提醒/重复字段，时间线和日历已接入相应展示与编辑路径 |

## 后续处理规则

1. Phase 14 M3 合并前，不再在旧 `CalendarView` 上单独实现拖拽增强。
2. Phase 12 服务端幂等和真实导入验收完成前，事件类型与灵感转化不进入主线。
3. 若恢复 Web Push，先在腾讯云生产环境确认密钥、CORS、Service Worker 与实际送达，再把 10.1 转为独立实施方案。
4. 已取消的 md 协议不得重新进入蓝图或新代码；历史背景可从归档文档追溯。