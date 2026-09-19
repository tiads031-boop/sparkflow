# SparkFlow 自托管部署手册

生产架构：Vercel 托管前端 `fish-life.cc.cd`，腾讯云服务器运行 Nginx、SparkFlow API 与 PostgreSQL。注册、登录、密码哈希和会话均由 SparkFlow API 处理，不依赖外部认证或数据库服务。

## 1. PostgreSQL

数据库容器与 API 使用同一个私有 Docker 网络。数据库端口只绑定回环地址，不对公网开放。

```bash
docker network create sparkflow-db-net
docker run -d --name sparkflow-postgres --restart unless-stopped \
  --network sparkflow-db-net --memory 768m --cpus 0.75 \
  -e POSTGRES_DB=sparkflow -e POSTGRES_USER=sparkflow_app \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/db_password \
  -v /opt/sparkflow/postgres/password:/run/secrets/db_password:ro \
  -v /opt/sparkflow/postgres/data:/var/lib/postgresql/data \
  -v /opt/sparkflow/postgres/backups:/backups \
  -p 127.0.0.1:5433:5432 \
  --health-cmd='pg_isready -U sparkflow_app -d sparkflow' \
  --health-interval=10s --health-timeout=5s --health-retries=5 \
  postgres:17-alpine
```

## 2. API 源码与可追溯镜像

首次部署：

```bash
git clone --branch master --single-branch https://github.com/tiads031-boop/sparkflow.git /opt/sparkflow/app
cd /opt/sparkflow/app
```

后续部署只允许从最新 `master` 快进更新：

```bash
cd /opt/sparkflow/app
git fetch origin master
git checkout master
git pull --ff-only origin master
```

构建前记录准确 commit，并把它写入镜像：

```bash
BUILD_SHA="$(git rev-parse HEAD)"
docker build \
  --build-arg BUILD_SHA="$BUILD_SHA" \
  -t "sparkflow-api:$BUILD_SHA" \
  -t sparkflow-api:latest \
  ./api
printf 'SparkFlow API image built from %s\n' "$BUILD_SHA"
```

不要只保留 `latest` 标签；commit 标签用于回滚和生产对账。`/api/health` 会返回镜像中的 `buildSha`，因此公网响应可以直接与 GitHub commit 对比。

后端环境文件只允许 root 读取：

```dotenv
DATABASE_URL=postgresql://sparkflow_app:DB_PASSWORD@sparkflow-postgres:5432/sparkflow?schema=public
PORT=3001
CORS_ORIGIN=https://fish-life.cc.cd
INSPIRATION_UPLOAD_DIR=/data/inspiration-attachments
```

`/opt/sparkflow/api-data:/data` 已经是 API 的持久化数据卷。M8 多模态随手记把图片、语音和视频写到 `/data/inspiration-attachments`；不要把该目录放在容器临时层，否则重建 API 容器会丢附件。附件不会由 Nginx 直接公开，读取必须经过 SparkFlow 会话鉴权。

## 3. 启动 / 更新 API

首次启动：

```bash
docker run -d --name sparkflow-api --restart unless-stopped \
  --network sparkflow-db-net --memory 1024m --cpus 1 \
  --env-file /opt/sparkflow/api.env \
  -v /opt/sparkflow/api-data:/data \
  -p 127.0.0.1:3001:3001 \
  sparkflow-api:latest
```

更新已有容器时，先记录旧镜像，再替换容器：

```bash
docker inspect -f '{{.Config.Image}}' sparkflow-api || true
docker stop sparkflow-api
docker rm sparkflow-api

docker run -d --name sparkflow-api --restart unless-stopped \
  --network sparkflow-db-net --memory 1024m --cpus 1 \
  --env-file /opt/sparkflow/api.env \
  -v /opt/sparkflow/api-data:/data \
  -p 127.0.0.1:3001:3001 \
  sparkflow-api:latest
```

容器启动时自动执行 `prisma migrate deploy`，只有 migration 成功后才启动 NestJS API。

## 4. Nginx 与 HTTPS

`api.fish-life.cc.cd` 反向代理到 `127.0.0.1:3001`。仅开放 HTTPS；PostgreSQL 和 API 容器端口继续只绑定回环地址。

```nginx
server {
  server_name api.fish-life.cc.cd;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 5. Vercel

前端生产变量：

```dotenv
VITE_API_BASE_URL=https://api.fish-life.cc.cd/api
```

不再配置 `VITE_SUPABASE_URL` 或 `VITE_SUPABASE_PUBLISHABLE_KEY`。

## 6. 部署后强制验证

先确认本地容器与公网 API 都健康，并读取实际部署 commit：

```bash
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS https://api.fish-life.cc.cd/api/health
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' sparkflow-api | grep '^BUILD_SHA='
```

三个位置应指向同一个 SHA：

```text
/opt/sparkflow/app 当前 git rev-parse HEAD
= sparkflow-api 容器 BUILD_SHA
= /api/health 返回的 buildSha
```

核对数据库 migration：

```bash
docker exec sparkflow-api npx prisma migrate status
```

Phase 12 至少必须确认以下 migration 已应用：

```text
20260914050000_add_schedule_plans
20260915120000_add_course_import_idempotency
```

继续检查：

```bash
docker inspect -f '{{.State.Health.Status}}' sparkflow-postgres
docker logs --tail 100 sparkflow-api
```

如果 `/api/health` 返回 `buildSha: "unknown"`，说明镜像构建时没有传 `--build-arg BUILD_SHA=...`，该部署不得作为已完成的生产版本验收证据。

最后用正常测试账户分别验证登录/会话、学期、课程、任务、日程、Planner Preview → Apply → Undo，以及 Phase 12 教务导入的首次提交与重复重放。`/health` 200 只证明进程存活，不替代真实业务验收。


---

## Vercel Web 发布

SparkFlow 的 Vercel 项目使用 Hobby 配额。历史上短分支每个小 commit 都触发 Git Preview，曾实际触发每日 deployment 次数硬限制。

当前策略：

1. `web/vercel.json` 使用 `git.deploymentEnabled=false`，关闭 Git 自动 deployments。
2. GitHub Web/API CI 继续作为代码质量门禁。
3. 业务 PR 合并后，确认目标 master commit，再显式创建一次 Vercel Production deployment。
4. 发布完成后核对 Production deployment 的 Git SHA / bundle，并做真实页面验收。
5. 不因为 Preview 缺失而把 GitHub CI 判为失败；也不把 Vercel 平台额度错误当成代码失败。

推荐节奏：

```text
short branch commits
  ↓
GitHub CI
  ↓
PR merge
  ↓
confirm master SHA
  ↓
one explicit Vercel Production deployment
  ↓
production smoke
```

如果 Vercel 返回 `api-deployments-free-per-day`，停止重复重试，等待平台配额恢复后再发布；API/Android 发布状态需要单独记录，不能用 Web 部署失败覆盖其实际状态。
