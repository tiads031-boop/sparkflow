# SparkFlow P0 + Phase 12 实施方案

> 更新日期：2026-09-09  
> 目标版本：v0.9 Beta  
> 当前基线：GitHub `master` 为 `d3b06f7f`；Render 生产后端为 `552f3caa`；Vercel 主生产项目为 `sparkflow031`。

## 1. 当前结论

| 领域 | 已确认状态 | 直接动作 |
|---|---|---|
| GitHub | `master` 已建立 Web 与 API CI | 所有功能分支先过构建和测试 |
| Render | `sparkflow` 服务已自动部署 `552f3caa`；`/api/health` 返回 200 | 保持部署后日志与健康检查 |
| Supabase | `sparkflow-db` 健康，Postgres 17；业务表均启用 RLS | 暂不改数据；启用泄露密码保护并核验 RLS 策略内容 |
| Vercel | `sparkflow031` 是主生产项目并指向 `fish-life.cc.cd`；仍有两个重复项目检查 | 恢复团队 scope 后归档重复项目 |
| 课程导入 | 已进入 M1，实现状态契约与时间归一化 | 完成导入纯函数和四步向导 |

## 2. 实施原则

1. 生产稳定性先于新功能：任何 Phase 12 发布都必须建立在可重复构建、可验证部署之上。
2. 数据安全优先：导入采用服务端事务和幂等键；首期只提供“跳过重复 / 保留副本”。
3. 前后端职责清晰：浏览器负责解析、校验和预览；服务端负责授权、去重、事务写入和结果查询。
4. 渐进发布：每一批次都可独立回滚，不一次替换全部课程功能。

## 3. 里程碑与任务

### M0：生产基线收口（1–2 天）

- [x] 盘点 GitHub、Render、Supabase 的真实状态。
- [x] 增加 Web build 与 API build/test CI。
- [x] 修复 Prisma Client 未生成导致的本地 API 构建失败。
- [x] 使用 Node 22，避免 Supabase 客户端停止支持 Node 20。
- [x] 新增真正的公开 `GET /api/health`。
- [ ] 确认 Vercel 唯一生产项目、域名、Root Directory=`web` 和部署 commit。
- [ ] 将 Render `CORS_ORIGIN` 精确设置为唯一生产域名、预览域名策略及 Capacitor 来源。
- [x] 部署 `master`，确认 Render commit 与 GitHub 一致。
- [ ] 以真实账号回归 Auth、学期、课程列表、课表概览和任务接口。

验收：生产前后端各只有一个明确入口；`/api/health` 返回 200；CI 绿灯；课程失败态不再被显示为空数据。

### M1：课程状态契约与导入基础（已完成）

- [x] 为课程列表和课表概览定义统一状态：`idle/loading/success/error/refreshing`。
- [x] 缓存已有数据；刷新失败时保留旧数据并显示非阻断提示。
- [x] 请求支持 AbortController、统一超时和学期/账号切换后的过期响应隔离。
- [x] 将时间归一化与作息文本解析拆成纯函数；其余字段校验和预览转换在 M2 继续拆分。
- [x] 接受 `8:00`、`08:00`、中文冒号与常见连接符，内部统一为 `HH:mm`。

验收：空数据与加载失败可区分；快速切换学期不会串数据；时间解析边界用例全部通过。

### M2：四步导入向导（4–6 天）

1. 选择学校：搜索、最近使用、适配状态、可点击教务网址。
2. 获取课表：Web 文件/书签桥接；Android 复用 SchoolImport；两端都有降级路径。
3. 学期与作息：已有/新建学期、结构化作息编辑、批量生成、字段级错误。
4. 预览与确认：课程数、排课数、生成实例数、冲突与重复、固定操作栏。

同时将 WebDAV 移到“设置 → 数据管理”，提醒和 Android 上课模式移到“课表设置”。

验收：Web 与 Android 各跑通一条真实导入；点击预览立即换页；360px 宽度无横向溢出。

### M3：幂等导入 API（3–4 天）

- 新增导入会话：`requestId`、用户、目标学期、payload hash、状态、结果摘要。
- 生成稳定排课指纹：用户 + 学期 + 课程名规范值 + 星期 + 时间 + 周次。
- 服务端事务内完成授权、去重、课程/事件写入及结果记录。
- 相同 `requestId` 重放直接返回首次结果；未知结果先查询，禁止盲目重试。
- 为“跳过重复 / 保留副本”建立 API 与数据库集成测试。

验收：双击、刷新、超时和断网重试不产生意外副本；失败事务不留下半套课表。

### M4：Beta 发布与后续收口（2–3 天）

- Preview 部署 → 冒烟测试 → Promote 到生产，不重新构建同一产物。
- Android 手动 release 构建与真实学校导入验收。
- 课程与 Task 关联：创建任务可选课程、卡片课程标签、Board 课程筛选。
- Dashboard 增加今日课程与课程相关待办；Events/Push 留到课程链路稳定后。

验收：生产错误扫描无新增高优先级问题；回滚步骤已演练；版本标记为 v0.9 Beta。

## 4. 分支、发布与回滚

```text
feature/* → Pull Request → CI → Preview → 验收 → master → Production
```

- 数据库迁移必须向前兼容：先加表/列，再发布读写逻辑，最后才移除旧结构。
- Vercel 使用已验收 Preview 的 promote；Render 保留上一个 live deploy 供回滚。
- 导入 UI 受功能开关控制；出现异常可关闭入口，不影响手动课程与既有数据。
- 生产发布前备份 Supabase；首期绝不自动覆盖用户已编辑课程。

## 5. 平台配置清单

### GitHub

- 默认分支：`master`。
- 必需检查：`Web build`、`API build and test`。
- 后续清零现有 lint 债务后再将 lint 升为必需检查。

### Vercel

- Root Directory：`web`；Node.js 22；构建命令 `npm run build`；输出 `dist`。
- Production 环境仅保存公开的 Vite 配置；不得放入 service role 或数据库密码。
- 只保留一个生产 alias，其他项目标记为 Preview/Archive。

### Render

- Git 仓库：`tiads031-boop/sparkflow`；分支 `master`；Root Directory `api`。
- Docker 使用 Node 22；健康检查路径 `/api/health`。
- `CORS_ORIGIN` 使用逗号分隔的精确来源，不使用 `*` 与 credentials 组合。

### Supabase

- 项目：`sparkflow-db`，Postgres 17。
- 所有暴露表保持 RLS；授权不得依赖用户可编辑的 `user_metadata`。
- 开启泄露密码保护；数据库变更后运行安全与性能 advisors。
- 不因当前“unused index”提示立即删索引：现有数据量极小，尚不足以判断索引价值。

## 6. 测试矩阵

| 层级 | 必测内容 |
|---|---|
| 单元 | 时间归一化、日期锚点、周次、指纹、冲突检测、状态 reducer |
| API | Auth 拒绝、跨用户隔离、事务回滚、幂等重放、重复策略 |
| Web | 登录、切换学期、空/错/旧数据、四步向导、移动窄屏 |
| Android | SchoolImport、文件降级、返回应用、时区、本地通知权限 |
| 生产冒烟 | health、Auth、semesters、courses、schedule、tasks、错误日志 |

## 7. 当前阻塞项

1. Vercel 主生产部署已确认，但插件缺少 `sparkflow031` 团队 scope，尚不能读取失败日志或归档两个重复项目。
2. Supabase 泄露密码保护需要在 Auth 设置中启用；这是控制台配置，不应通过数据库 SQL 假装完成。
