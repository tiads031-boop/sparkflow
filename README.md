# SparkFlow

SparkFlow 是一个面向个人学习与工作管理的任务、日历和灵感整理应用。项目包含 React + Vite 前端和 NestJS + Prisma 后端，并支持通过 Capacitor 构建 Android 应用。

## 项目结构

- `web/`：React、TypeScript、Vite 前端，包含任务、日历、提醒和灵感视图。
- `api/`：NestJS API 服务，使用 Prisma 连接 PostgreSQL。
- `docs/`：项目文档。
- `scripts/`：辅助脚本。

## 环境要求

- Node.js 20 或更高版本
- npm
- PostgreSQL（运行 API 服务时需要）

## 本地运行

先分别安装两个子项目的依赖：

```bash
cd api
npm install
cp .env.example .env
```

填写 `api/.env` 中的 `DATABASE_URL`，然后启动后端：

```bash
npm run start:dev
```

在另一个终端启动前端：

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

前端默认运行在 `http://localhost:5173`，后端默认运行在 `http://localhost:3001`。如需调整 API 地址，请配置 `web/.env.local` 中的 `VITE_API_BASE_URL`。

## 常用命令

```bash
# 前端构建与检查
cd web
npm run build
npm run lint

# 后端构建与测试
cd api
npm run build
npm test
```

## Android 构建

在 `web/` 目录执行：

```bash
npm run android:build
```

该命令会先构建 Web 前端，再同步 Capacitor 项目并生成 Android Debug APK。Android Studio 打开项目可使用：

```bash
npm run cap:open
```

## 配置说明

环境变量模板位于 `web/.env.example` 和 `api/.env.example`。请勿提交包含数据库密码、API 密钥或 OAuth 凭据的 `.env` 文件。

