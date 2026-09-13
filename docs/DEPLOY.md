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

## 2. API 镜像

```bash
git clone --branch master --single-branch https://github.com/tiads031-boop/sparkflow.git /opt/sparkflow/app
docker build -t sparkflow-api:latest /opt/sparkflow/app/api
```

后端环境文件只允许 root 读取：

```dotenv
DATABASE_URL=postgresql://sparkflow_app:DB_PASSWORD@sparkflow-postgres:5432/sparkflow?schema=public
PORT=3001
CORS_ORIGIN=https://fish-life.cc.cd
CONTEXT_MD_PATH=/data/CURRENT_CONTEXT.md
```

## 3. 启动 API

```bash
docker run -d --name sparkflow-api --restart unless-stopped \
  --network sparkflow-db-net --memory 1024m --cpus 1 \
  --env-file /opt/sparkflow/api.env \
  -v /opt/sparkflow/api-data:/data \
  -p 127.0.0.1:3001:3001 \
  sparkflow-api:latest
```

容器启动时自动执行 `prisma migrate deploy`，然后启动 NestJS API。

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

## 6. 验证

```bash
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS https://api.fish-life.cc.cd/api/health
docker inspect -f '{{.State.Health.Status}}' sparkflow-postgres
docker logs --tail 50 sparkflow-api
```

最后在前端分别验证昵称注册、邮箱注册、登录、退出、改密及刷新后会话恢复。旧账号不迁移，切换后重新注册。
