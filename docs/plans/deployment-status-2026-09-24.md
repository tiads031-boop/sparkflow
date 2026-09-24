# Sparkflow 部署状态（2026-09-24）

- 来源：master 合并提交 `ebbb50b03ca912808f30066da5d001fb1fe47da1`，包含 PR #151、#152、#153。
- Web：已发布同一提交；HTTPS 首页返回 200，浏览器显示登录界面。
- API：已切换至同一提交的镜像；本机与公网 `/api/health` 返回 `status: ok`，`buildSha` 为同一提交。
- 数据库：部署前备份已生成并验证可列出内容；Prisma 迁移完成，`migrate status` 报告数据库为最新；PostgreSQL 健康。
- 可回滚性：保留上一版 Web 发布目录和此前的 API 镜像。
- 待验收：使用真实账号检查记录新增、逐张照片故事、附件增删与查看；PWA、Android 图片格式及触控体验仍需设备测试。当前检查不能替代这些业务验收。
