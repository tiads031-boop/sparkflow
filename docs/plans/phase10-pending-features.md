# Phase 10 — 待办功能收束

> **创建时间**: 2026-06-03（从旧 BLUEPRINT §九 提取） | **状态**: ⬜

---

## 子阶段 10.1 — VAPID 密钥部署 🚧

| 任务 | 状态 | 说明 |
|---|---|---|
| Render 环境变量配置 | 🚧 | VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT |
| 推送代码触发自动部署 | 🚧 | 编码已完成，待部署环境变量 |

## 子阶段 10.2 — 截止任务拖入时间线 ⬜

| 任务 | 状态 | 说明 |
|---|---|---|
| 长按截止任务卡片拖入时间线 | ⬜ | 混合方案 A：⏱️ 按钮已实现为主路径，拖拽为增强交互 |
| 松手设置 startTime + duration | ⬜ | 复用现有 Calendar 拖拽逻辑 |

## 子阶段 10.3 — md 协议扩展 @start @duration ⬜

| 任务 | 状态 | 说明 |
|---|---|---|
| 后端 parse/render 支持 @start + @duration | ⬜ | 使时间线数据可写入 md 供 AI 读取 |
| 前后端映射完整 | ⬜ | Task.startTime/duration ↔ md 元数据标签 |

## 子阶段 10.4 — CalendarEvent 事件类型扩展 ⬜

| 任务 | 状态 | 说明 |
|---|---|---|
| eventType 枚举扩展 | ⬜ | task / focus / meeting / reminder / course / exam / cert / contest / other |
| EventsView 独立页面 | ⬜ | 考试/考证/竞赛 分类列表 + 倒计时 |

## 子阶段 10.5 — 灵感转化流程 ⬜

| 任务 | 状态 | 说明 |
|---|---|---|
| Inspiration → Task 转化 | ⬜ | 保留 sparkflow 原有灵感功能，桥接到看板 |

## 子阶段 10.6 — 多用户 / 正式 OAuth ⬜

| 任务 | 状态 | 说明 |
|---|---|---|
| 正式认证方案 | ⬜ | 当前 API Key 方案仅适合单用户 MVP |
