# 课程表功能完善

参考：[拾光课程表](https://github.com/XingHeYuZhuan/shiguangschedule)。查阅其 `WidgetUpdateHelper.kt`、`IcsExportTool.kt`、`BackupRepository.kt`、`NotificationSettingsViewModel.kt` 和 `Theme.kt`，学习课程实例统一、今日/明日视图、版本化备份、提前提醒和主题跟随系统的设计。代码按 SparkFlow 的 React + Zustand + NestJS + Prisma + Capacitor 架构独立实现。

## 已实现

- 课程页内小组件：下一节（含正在上课）、今日课程、今日与明日；按所选学期过滤，点击进入原有课程详情。使用实际 CalendarEvent，不根据周规则重新猜测调课时间。
- JSON 备份和恢复：导出当前学期或全部学期的课程及实际排课；恢复前预览，服务端校验后事务新增学期、课程和事件。保留调课标记/地点，重新生成 ID，不覆盖已有数据，不导入用户归属、外部同步标识或课程任务。重复恢复会新增副本。
- ICS 导出：UTC 时间、稳定事件 UID、文本转义、75 字节 UTF-8 折行。原有 ICS 导入补传当前学期。
- 提醒：独立开关、提前 0/5/10/15/30 分钟、免提醒日期；默认关闭，主动开启时请求通知权限。Android 使用已有本地通知插件预排最近 60 条；网页在运行期间通知并按事件/提醒时刻去重。设置本机持久化，所有学期共用，切换筛选不取消其他学期提醒。
- 深色：跟随系统、浅色、深色；覆盖课程页、详情、表单和页内小组件。课程彩色详情卡根据亮度选择文字颜色。
- 补齐新课程周次输入和时间校验；首次使用可创建学期；刷新保留学期筛选；实际排课限定在学期日期内；调课教室正确写入事件 location。

## 范围与验证限制

- 小组件是应用内组件，未添加 Android 桌面 AppWidget。
- 未接入各学校教务适配、WebDAV、自动系统勿扰/静音或自动节假日服务。假期可手动加入免提醒日期。
- 网页关闭后不执行本地提醒。Android 送达受系统权限和电池设置影响，需要打开应用补充预排队列；未做真机送达验收。
- 备份范围为课表，不包含课程任务、笔记或本机显示偏好。恢复后的新学期不自动设为活跃。
- 浏览器插件缺少运行文件，未完成视觉和交互实测；未对真实数据库执行导入以避免写入用户数据。

## 自动验证

- `web`: `npm run build`
- `api`: `npm run build`
- `api`: `node node_modules/jest/bin/jest.js course-backup course-schedule --runInBand`
- 根目录：`node scripts/test-course-schedule.mjs`，使用 node-ical 反向解析 ICS 验证中文、时区、调课地点与折行。
