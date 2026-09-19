# SparkFlow 自托管部署手册

生产架构：腾讯云服务器的 Nginx 直接托管前端 `fish-life.cc.cd`，并将 `api.fish-life.cc.cd` 反向代理到 SparkFlow API；API 与 PostgreSQL 继续使用现有 Docker 部署。注册、登录、密码哈希和会话均由 SparkFlow API 处理，不依赖外部认证或数据库服务。

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

## 5. Web / PWA 前端（腾讯云 Nginx）

前端生产变量：

```dotenv
VITE_API_BASE_URL=https://api.fish-life.cc.cd/api
```

不再配置 `VITE_SUPABASE_URL` 或 `VITE_SUPABASE_PUBLISHABLE_KEY`。

前端是 React/Vite 静态站，构建结果为 `web/dist`。服务器使用 `/var/www/sparkflow` 作为站点目录；API 继续走独立域名，不把 `/api` 代理到前端站点。

首次准备服务器：

```bash
sudo apt-get update
sudo apt-get install -y nginx rsync
```

从仓库最新 `master` 构建并发布：

```bash
cd /opt/sparkflow/app
sudo APP_ROOT=/opt/sparkflow/app bash scripts/deploy-web-server.sh
```

脚本会执行 `git pull --ff-only`、`npm ci`、`npm run build`，再把 `web/dist` 同步到 `/var/www/sparkflow`。首次运行时安装仓库内的 Nginx 配置；后续不会覆盖 Certbot 已写入的 HTTPS 配置。脚本只在 `nginx -t` 通过后 reload。`try_files ... /index.html` 保证 SPA 深层路由刷新可用；带哈希的 `/assets/` 长缓存，`index.html`、`sw.js` 与 `manifest.json` 不长缓存。

DNS 切换时把 `fish-life.cc.cd` 的记录指向腾讯云公网 IP；`api.fish-life.cc.cd` 保持不变。DNS 生效后签发/安装证书：

```bash
sudo certbot --nginx -d fish-life.cc.cd -d www.fish-life.cc.cd
sudo certbot renew --dry-run
```

如果没有启用 `www.fish-life.cc.cd`，从 Nginx 配置和证书命令中同时移除该名称，避免证书签发因未解析的域名失败。

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

## 从 Vercel 切换到腾讯云

1. 先在服务器完成前端构建和本机 Host 头冒烟，不改 DNS。
2. 将 `fish-life.cc.cd` DNS 指向腾讯云公网 IP，保留 `api.fish-life.cc.cd` 现有记录。
3. DNS 生效后用 Certbot 安装 HTTPS，并检查根路径和一个 SPA 深层路由。
4. 检查浏览器请求仍发往 `https://api.fish-life.cc.cd/api`，登录与 Session 恢复正常。
5. PWA 强制刷新一次，验证 Service Worker、manifest、安装与离线壳层。
6. 稳定后再解除 Vercel 上的生产域名绑定；Vercel 项目可以暂时保留作短期回退，不继续承担生产流量。
