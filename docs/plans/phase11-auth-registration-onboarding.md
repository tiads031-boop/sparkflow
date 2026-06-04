# Phase 11：账户注册、密码管理与问候页多选

> **创建时间**: 2026-06-04 | **状态**: ✅ 已完成

## 背景

SparkFlow 原先采用硬编码单账户 fish031/000000，登录页直接展示默认密码，问候页职业/状态为单选。三个需求同时实施。

## 方案

### 注册与密码管理

- 用户数据存储在 localStorage `sparkflow.users`，密码 SHA-256 哈希（Web Crypto API）
- 内置账户 fish031 保留作为默认入口
- 登录页新增「注册新账号」切换按钮，注册表单含账号/密码/确认密码
- 注册校验：用户名 2-20 字符字母数字下划线，密码 ≥6 字符，防重名
- 注册成功自动登录并进入问候页
- 设置页新增「修改密码」：旧密码验证 → 新密码哈希更新

### 问候页多选

- `profession: SparkFlowProfession` → `professions: SparkFlowProfession[]`
- `statusNeed: SparkFlowStatusNeed` → `statusNeeds: SparkFlowStatusNeed[]`
- 问候页和设置页均改为数组 toggle，至少保留 1 个选中
- 向后兼容：v1 单值字符串自动迁移为单元素数组

## 实施文件

| 文件 | 变更 |
|---|---|
| `web/src/store/authSlice.ts` | 类型升级 + register/login/changePassword + 密码哈希 + 向后兼容 |
| `web/src/components/AuthGate.tsx` | 登录/注册切换 + 问候页多选 |
| `web/src/components/SettingsView.tsx` | 多选显示 + 密码修改 |
| `web/src/components/DarkFrostedModal.tsx` | getDefaultSectionForProfile 适配数组 |

## 构建验证

`web npm run build` 通过，TypeScript 零错误。
