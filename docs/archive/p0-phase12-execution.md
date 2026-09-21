> **归档说明（2026-09-22）**：本文已从活跃方案目录迁出，仅保留历史决策与实现背景。当前执行顺序以 [NEXT](../plans/NEXT.md) 与 [VNext 时间账本、智能分类与统一 UI 系统](../plans/vnext-time-ledger-tagging-ui-system.md) 为准。不要从本文恢复旧优先级。

# SparkFlow P0 + Phase 12 旧执行清单

> **原更新日期**：2026-09-13 | **状态**：⚠️ 冻结、已被替代
>
> 原清单以 Render、Supabase 和较早 Git 基线为前提，已不适用于当前生产。完整历史可通过 Git 读取本文件的旧版本。

## 替代关系

| 旧内容 | 当前去向 |
|---|---|
| Render/Supabase 生产基线 | 已由腾讯云 Nginx + NestJS API + 独立 PostgreSQL + 自建认证替代；见 [部署手册](../DEPLOY.md) |
| P0 执行顺序 | 由 [NEXT.md](NEXT.md) 统一维护 |
| Phase 12 交互、幂等与验收 | 由 [phase12-course-import-experience.md](phase12-course-import-experience.md) 维护 |
| M2.1/M2.2/M2.3 旧合并状态 | 三批均已合并；当前优先级为服务端幂等/冲突策略与真实导入验收 |

## 保留的有效原则

1. 生产稳定性和数据安全优先于新功能。
2. 客户端负责获取、解析和预览；服务端负责授权、去重、事务和结果查询。
3. 数据库 migration 采用 additive 方式；发布前备份，首期不静默覆盖用户已编辑课程。
4. Preview、CI、健康接口和真实业务验收分别记录，不互相替代。

本文件不得再新增任务或更新优先级；后续修改应写入 `NEXT.md` 或 Phase 12 主方案。