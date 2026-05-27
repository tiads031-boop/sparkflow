# SparkFlow MVP 部署手册

> 目标：将 SparkFlow 前后端部署到公网，手机可访问 PWA 并读写 CURRENT_CONTEXT.md。
> 预计耗时：20-30 分钟（不含等待 Render 构建的 5 分钟）。

---

## 一、前置准备

| 工具 | 用途 | 注册地址 |
|---|---|---|
| GitHub | 代码托管 | https://github.com |
| Supabase | 免费 PostgreSQL | https://supabase.com |
| Render | 后端 API 托管 | https://render.com |
| Vercel | 前端 PWA 托管 | https://vercel.com |

> 全部使用免费层即可。

---

## 二、数据库：Supabase

1. 登录 Supabase，点击 **New project**
2. 输入项目名称（如 `sparkflow-db`），设置密码（记住它）
3. 等待项目创建完成（约 1-2 分钟）
4. 进入 **Project Settings > Database**
5. 复制 **Connection string > URI** 格式：
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxx.supabase.co:5432/postgres
   ```
6. 把 `[YOUR-PASSWORD]` 替换成你设的密码，这就是 `DATABASE_URL`

---

## 三、后端：Render

### 3.1 推送代码到 GitHub

确保 `sparkflow/api/` 下的代码已提交到 GitHub 仓库（可以是单仓库内的子目录，也可以单独一个 repo）。

### 3.2 创建 Web Service

1. Render 面板点击 **New > Web Service**
2. 连接你的 GitHub 仓库
3. 配置如下：

| 字段 | 值 |
|---|---|
| Name | `sparkflow-api` |
| Root Directory | `api`（如果 api 在仓库根目录下；否则留空） |
| Runtime | `Docker` |
| Branch | `main` |

> Render 会自动检测 `Dockerfile`。

4. 展开 **Advanced**，添加环境变量：

```
DATABASE_URL=postgresql://postgres:xxx@db.xxxxxx.supabase.co:5432/postgres
PORT=3001
API_KEY=设一个强密码（如 32 位随机字符串）
CORS_ORIGIN=https://sparkflow-web.vercel.app
CONTEXT_MD_PATH=/data/CURRENT_CONTEXT.md
```

> `CORS_ORIGIN` 先填 Vercel 的默认域名，部署完前端后再换成真实域名。

5. 点击 **Create Web Service**
6. 等待构建完成（约 3-5 分钟），记录生成的域名：`https://sparkflow-api.onrender.com`

### 3.3 挂载持久化磁盘（CURRENT_CONTEXT.md 需要）

1. 在 Render 的 Service 页面，点击 **Disks**
2. 点击 **Add Disk**
3. 配置：
   - Name: `data`
   - Mount Path: `/data`
   - Size: 1 GB（免费层最大 1GB）
4. 点击 **Save**，Render 会自动重启服务
5. 重启后 ContextBridge 会自动在 `/data/CURRENT_CONTEXT.md` 创建默认模板

> 不挂载磁盘的话，容器重启后 md 文件会丢失。

---

## 四、前端：Vercel

### 4.1 准备生产环境变量

在 `sparkflow/web/` 目录下，确认 `.env.production` 内容：

```
VITE_API_BASE_URL=https://sparkflow-api.onrender.com/api
VITE_API_KEY=你在 Render 上设的 API_KEY
```

> 把 `sparkflow-api.onrender.com` 替换成 Render 给你的真实域名。

### 4.2 部署

1. Vercel 面板点击 **Add New Project**
2. 导入同一个 GitHub 仓库
3. 配置：

| 字段 | 值 |
|---|---|
| Framework Preset | Vite |
| Root Directory | `web` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

4. 点击 **Deploy**
5. 等待构建（约 1 分钟），记录域名：`https://sparkflow-web.vercel.app`

### 4.3 更新后端 CORS

回到 Render，把 `CORS_ORIGIN` 环境变量更新为 Vercel 的真实域名，保存后 Render 自动重部署。

---

## 五、环境变量总览

### 后端（Render）

| Key | 示例值 | 说明 |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | Supabase 连接串 |
| `PORT` | `3001` | 服务端口 |
| `API_KEY` | `sk_live_xxxxxxxx` | 前后端通信密钥 |
| `CORS_ORIGIN` | `https://...vercel.app` | 前端域名，逗号分隔多域名 |
| `CONTEXT_MD_PATH` | `/data/CURRENT_CONTEXT.md` | 持久化磁盘挂载路径 |
| `VAPID_PUBLIC_KEY` | `BCl...` | Web Push VAPID 公钥 |
| `VAPID_PRIVATE_KEY` | `abc...` | Web Push VAPID 私钥 |
| `VAPID_SUBJECT` | `mailto:you@email.com` | VAPID 联系邮箱 |

### 前端（Vercel / 本地）

| Key | 示例值 | 说明 |
|---|---|---|
| `VITE_API_BASE_URL` | `https://...onrender.com/api` | 后端 API 地址 |
| `VITE_API_KEY` | `sk_live_xxxxxxxx` | 与后端 `API_KEY` 一致 |

> 本地开发时 `VITE_API_BASE_URL` 留空，走 Vite proxy。

---

## 六、验证步骤

1. 打开 Vercel 域名，确认 PWA 页面正常加载
2. 观察 Header 徽章：首次应显示"同步中"，随后显示"已同步"
3. 添加一个任务，观察徽章变为"同步中"然后回到"已同步"
4. 刷新页面，确认任务仍然存在（已持久化到 Supabase + md 文件）
5. 手机浏览器打开 Vercel 域名，点击"添加到主屏幕"，确认 PWA 安装成功

---

## 七、已知限制（免费层）

| 限制 | 说明 | 缓解方案 |
|---|---|---|
| Render 休眠 | 15 分钟无请求后休眠，首次请求延迟 30 秒 | 用 UptimeRobot 每 5 分钟 ping 一次 `/api/health` |
| Supabase 暂停 | 7 天无活动后项目暂停 | 定期登录 Supabase 面板 |
| 单用户 | API Key 是唯一认证手段 | 不分享域名和 Key |

---

## 八、故障排查

**Q: 前端显示"同步异常"**
- 检查浏览器 Network 面板，确认请求 URL 是否正确
- 检查 Render logs，确认后端是否报错
- 确认前后端 `API_KEY` 一致
- 确认 `CORS_ORIGIN` 包含 Vercel 域名

**Q: 添加任务后刷新丢失**
- 检查 Render 是否挂载了 `/data` 磁盘
- 检查 `CONTEXT_MD_PATH` 是否为 `/data/CURRENT_CONTEXT.md`
- 检查数据库连接是否正常（Render logs 看 Prisma 报错）

**Q: 构建失败**
- 后端：确认 `Dockerfile` 在 `api/` 目录下，Render 的 Root Directory 配置正确
- 前端：确认 `vercel.json` 已提交到仓库
