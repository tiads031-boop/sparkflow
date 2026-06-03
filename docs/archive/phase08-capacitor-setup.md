# Phase 8C：Capacitor Android 打包与联调指南

> **创建时间**: 2026-06-01 | **状态**: 配置完成 | **关联**: Phase 8 Google Calendar Sync

---

## 一、架构概览

```
┌─────────────────────────────────────────────────────────┐
│                     Capacitor Shell                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │              React PWA (web/dist)                  │  │
│  │   Dashboard / BoardView / CalendarView / Settings │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────┼───────────────────────────┐  │
│  │            Capacitor Bridge Layer                  │  │
│  │     src/capacitor/push.ts  +  calendar.ts         │  │
│  └───────────────────────┼───────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────┼───────────────────────────┐  │
│  │            Native Plugins (Android)                │  │
│  │  @capacitor/push-notifications (FCM)              │  │
│  │  @ebarooni/capacitor-calendar (系统日历)           │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**关键设计**：
- React 前端代码不变，Capacitor 用 WebView 加载 `dist/` 目录
- `src/capacitor/` 下的桥接层提供统一的原生能力调用接口
- 浏览器环境（PWA）下调用桥接层会静默降级，不崩溃

---

## 二、前置条件

| 工具 | 版本要求 | 用途 |
|---|---|---|
| Node.js | 18+ | 构建前端 |
| Java (JDK) | 17+ | 编译 Android APK |
| Android SDK | API 34+ | 编译目标 |
| Gradle | 8.x（已内嵌在 android/ 目录） | 构建系统 |
| ADB | 任意版本 | 安装 APK 到手机 |
| Android Studio | 可选（推荐，用于 SDK 管理） | 开发调试 |

### 红米 K70 手机设置

1. **开启开发者选项**：设置 → 我的设备 → 全部参数 → 连续点击"OS 版本"7 次
2. **开启 USB 调试**：设置 → 更多设置 → 开发者选项 → USB 调试
3. **开启谷歌基础服务**：设置 → 更多设置 → 帐号与同步 → 谷歌基础服务
4. **安装 Google Play 服务**（如未预装）：从应用商店下载 Google Play 商店，登录 Google 账号

---

## 三、项目结构

```
web/
├── capacitor.config.ts          # Capacitor 配置
├── package.json                 # 含 cap: / android: 构建脚本
├── .gitignore                   # 忽略 android build 产物 + google-services.json
│
├── dist/                        # Vite 构建输出 → Capacitor 加载此目录
│
├── src/
│   └── capacitor/
│       ├── index.ts             # 统一导出 + 平台检测
│       ├── push.ts              # FCM 推送封装
│       └── calendar.ts          # 系统日历封装
│
└── android/                     # Capacitor 自动生成的 Android 项目
    ├── build.gradle             # 项目级 Gradle（含 Google Services 插件）
    ├── variables.gradle         # SDK 版本变量
    └── app/
        ├── build.gradle         # 应用级 Gradle
        ├── google-services.json # FCM 配置文件（需从 Firebase Console 下载）
        └── src/main/
            ├── AndroidManifest.xml  # 权限声明 + OAuth deep link
            └── ...
```

---

## 四、构建流程

### 4.1 完整构建（开发 / 调试）

```bash
# 1. 构建前端
npm run build

# 2. 同步 web 资源到 Android 项目
npx cap sync

# 3. 编译 Debug APK
cd android && gradlew assembleDebug
```

一步完成：
```bash
npm run android:build
```

### 4.2 APK 产物

```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 4.3 安装到手机

**USB 连接安装**：
```bash
npm run android:install
# 等价于：adb install android\app\build\outputs\apk\debug\app-debug.apk
```

**无线传输**：
1. 将 APK 文件传输到手机（微信文件传输助手 / USB 文件传输）
2. 手机文件管理器 → 找到 APK → 点击安装
3. 首次安装需允许"未知来源"安装

### 4.4 开发热重载模式

开发时如需实时预览，取消 `capacitor.config.ts` 中的注释：

```ts
server: {
  url: 'http://192.168.x.x:5173',  // 替换为你的开发机 IP
  cleartext: true,
},
```

然后运行 `npm run dev`，Android 应用会直接从开发服务器加载，UI 修改即时生效。

---

## 五、红米 K70 特别设置

### 5.1 电池优化

HyperOS 的省电策略会杀死后台进程，导致推送延迟或日历同步失败。

**设置**：设置 → 应用设置 → Sparkflow → 省电策略 → **无限制**

### 5.2 通知权限

确保 FCM 推送能在锁屏和通知栏显示。

**设置**：设置 → 通知与状态栏 → 应用通知管理 → Sparkflow → **允许通知**

检查项：
- [ ] 允许通知（总开关）
- [ ] 锁屏通知 → 显示
- [ ] 悬浮通知 → 允许
- [ ] 设为不重要通知 → 关闭
- [ ] 允许振动（可选）

### 5.3 日历权限

**设置**：设置 → 应用设置 → Sparkflow → 权限管理 → 日历 → **使用时允许**

### 5.4 自启动管理

**设置**：设置 → 应用设置 → 授权管理 → 自启动管理 → Sparkflow → **允许**

此设置确保 Sparkflow 在手机重启后能自动注册 FCM 推送。

### 5.5 谷歌基础服务

**前置条件**：红米 K70 登录 Google 账号后，系统日历会自动同步 Google Calendar 事件。

**验证同步**：
1. 打开系统"日历"应用
2. 右上角菜单 → 设置 → 日历账户
3. 确认 Google 账号已列出且已勾选
4. 在 Google Calendar（网页/其他设备）创建测试事件
5. 等待 30 秒，系统日历应自动显示

---

## 六、联调检查清单

### 6.1 安装与启动
- [ ] APK 能在红米 K70 上安装
- [ ] 首次启动不闪退
- [ ] 应用图标正确显示为 Sparkflow

### 6.2 前端 UI
- [ ] Dashboard 正常渲染
- [ ] BoardView（看板）正常渲染
- [ ] CalendarView（日历时间线）正常渲染
- [ ] SettingsView（设置页）正常渲染
- [ ] 暗色模式 / 毛玻璃效果正常

### 6.3 Google Calendar 同步链路
- [ ] 设置页"连接 Google 日历"按钮可点击
- [ ] OAuth 弹窗能正确弹出（WebView 中打开 Google 授权页）
- [ ] 授权后回调能正确返回 Sparkflow
- [ ] OAuth deep link（`sparkflow://oauth`）能正确唤起应用
- [ ] 连接状态显示为"已连接"
- [ ] 创建任务 → 同步到 Google Calendar → Google Calendar 网页端可见
- [ ] Google Calendar 网页端创建 → Sparkflow 拉取更新
- [ ] 手机系统日历中能看到同步的事件（通过 Google 系统同步）

### 6.4 FCM 推送
- [ ] `google-services.json` 已放入 `android/app/`
- [ ] 应用启动后 FCM token 能成功获取（logcat 中可见）
- [ ] 后端能收到 token 注册请求
- [ ] 发送测试推送 → 手机能收到通知
- [ ] 应用在后台时推送正常显示
- [ ] 点击推送通知能正确唤起应用到对应页面

### 6.5 离线灰度
- [ ] 断开网络 → 本地操作（创建/修改任务）
- [ ] 重新连接 → 数据正常同步

### 6.6 边界情况
- [ ] 用户拒绝通知权限 → 应用不崩溃，提示请求权限
- [ ] 用户拒绝日历权限 → 应用不崩溃，提示请求权限
- [ ] Google 账号未登录 → OAuth 流程能正常处理
- [ ] Token 过期 → 自动刷新或提示重新授权

---

## 七、FCM 配置步骤

### 7.1 Firebase Console 创建项目

1. 访问 [Firebase Console](https://console.firebase.google.com/)
2. 创建新项目（或使用已有项目）
3. 项目名称：Sparkflow

### 7.2 添加 Android 应用

1. 在项目概览页点击"添加应用" → Android
2. **Android 包名**：`work.mindd.sparkflow`
3. 填写应用昵称：Sparkflow
4. 下载 `google-services.json`
5. 将文件放入 `web/android/app/google-services.json`

### 7.3 验证

Gradle 构建时会自动检测 `google-services.json` 存在性并应用 Google Services 插件。如果文件不存在，构建不会失败，但 FCM 推送会不可用。

---

## 八、常见问题

### Q1: `gradlew assembleDebug` 报错 "JAVA_HOME not set"

设置环境变量（PowerShell）：
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
```

或安装 Android Studio，它会自动处理 JDK 路径。

### Q2: 构建时下载 Gradle 很慢

使用腾讯云 Gradle 镜像：在 `android/gradle/wrapper/gradle-wrapper.properties` 中修改 distributionUrl 为镜像地址。

### Q3: 红米 K70 收不到 FCM 推送

按顺序排查：
1. 检查"谷歌基础服务"是否开启
2. 检查 Sparkflow 通知权限是否已授予
3. 检查 Sparkflow 电池策略是否为"无限制"
4. 检查 Sparkflow 是否在自启动白名单中
5. 使用 `adb logcat | grep -i fcm` 查看日志

### Q4: 系统日历看不到 Google Calendar 事件

1. 确认 Google 账号已在手机设置中登录
2. 打开系统日历 → 设置 → 日历账户 → 勾选你的 Google 账号
3. 等待同步（通常 30 秒内）
4. 仍不显示则手动同步：设置 → 帐号与同步 → Google → 立即同步

### Q5: OAuth 授权后无法跳回应用

确认 `AndroidManifest.xml` 中的 deep link scheme 配置正确：
```xml
<data android:scheme="sparkflow" android:host="oauth" />
```

OAuth 回调 URL 应为 `sparkflow://oauth`。

---

## 九、技术备注

### 插件详情

| 插件 | 版本 | 用途 |
|---|---|---|
| `@capacitor/core` | 8.x | Capacitor 核心运行时 |
| `@capacitor/cli` | 8.x | CLI 工具（cap sync / cap add） |
| `@capacitor/android` | 8.x | Android 平台支持 |
| `@capacitor/push-notifications` | 8.x | FCM 推送 |
| `@capacitor/local-notifications` | 8.x | 本地通知（用作推送降级方案） |
| `@ebarooni/capacitor-calendar` | 8.x | 系统日历读写 |

### SDK 版本

| 变量 | 值 | 说明 |
|---|---|---|
| minSdkVersion | 24 | Android 7.0+ |
| compileSdkVersion | 36 | Android 15 |
| targetSdkVersion | 36 | Android 15 |

### 与 Google Calendar API 的关系

```
Sparkflow API (NestJS)
    │  Google Calendar API (OAuth 2.0)
    ▼
Google Calendar (云端)
    │  Android 系统内置同步
    ▼
Redmi K70 系统日历
```

**关键理解**：Capacitor 的系统日历桥接层（`src/capacitor/calendar.ts`）是一个**补充手段**，不是主同步通道。主同步通过后端 Google Calendar API 完成，系统日历自动跟随。桥接层仅在需要纯本地操作（离线添加事件、直接读取系统日历等）时使用。
