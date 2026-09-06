import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '../store/appStore';
import { useCoursePreferences } from '../store/coursePreferences';
import { useCourseSchedule } from '../store/courseSchedule';
import { fetchScheduleBackup, importScheduleBackup } from '../api/courses';
import { downloadSchedule, localDay, occurrences, scheduleIcs, type ScheduleBackup } from '../utils/courseSchedule';
import { requestCourseNotifications } from './CourseReminderRuntime';
import CourseIntegrationsPanel from './CourseIntegrationsPanel';

export default function CourseSchedulePanel({ onCourseClick }: { onCourseClick: (id: string) => void }) {
  const { backup, error, refresh } = useCourseSchedule();
  const semesterId = useAppStore(s => s.activeSemesterId);
  const prefs = useCoursePreferences();
  const [settings, setSettings] = useState(false);
  const [integrations, setIntegrations] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ScheduleBackup | null>(null);
  const [now, setNow] = useState(() => new Date());
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  const entries = backup ? occurrences(backup, semesterId) : [];
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const next = entries.find(e => Date.parse(e.endTime) > now.getTime());
  const groups = prefs.widget === 'next' ? [{ label: '下一节课程', entries: next ? [next] : [] }]
    : [now, ...(prefs.widget === 'twoDays' ? [tomorrow] : [])].map((day, i) => ({
      label: i ? '明日预告' : '今日课程', entries: entries.filter(e => localDay(new Date(e.startTime)) === localDay(day)),
    }));
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : '操作失败，请重试'); }
    finally { setBusy(false); }
  };
  return <>
    <div className="course-tools" aria-label="课表工具">
      <button disabled={busy} onClick={() => void run(async () => { downloadSchedule(JSON.stringify(await fetchScheduleBackup(semesterId), null, 2), 'json'); setMessage('已导出当前范围的课表备份'); })}>备份 JSON</button>
      <button disabled={busy} onClick={() => void run(async () => { const data = await fetchScheduleBackup(semesterId); if (!occurrences(data).length) throw new Error('当前范围没有已排课实例，无法导出日历'); downloadSchedule(scheduleIcs(data), 'ics'); setMessage('已导出 ICS 日历'); })}>导出 ICS</button>
      <button disabled={busy} onClick={() => input.current?.click()}>恢复 JSON</button>
      <button aria-expanded={settings} onClick={() => setSettings(!settings)}>显示与提醒</button>
      <button aria-expanded={integrations} onClick={() => setIntegrations(!integrations)}>教务与同步</button>
      <input ref={input} hidden type="file" accept=".json,application/json" onChange={e => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (file) void run(async () => {
          if (file.size > 8 * 1024 * 1024) throw new Error('备份文件不能超过 8 MB');
          const data = JSON.parse(await file.text());
          if (data?.format !== 'sparkflow-courses' || data.version !== 1 || !Array.isArray(data.courses) || !Array.isArray(data.semesters)) throw new Error('请选择 SparkFlow 课程表备份文件（版本 1）');
          setPreview(data);
        });
      }} />
    </div>
    {(message || error) && <p role="status">{message || error} {error && <button onClick={() => void refresh()}>重试</button>}</p>}
    {preview && <section className="course-settings" aria-label="恢复预览">
      <strong>恢复 {preview.semesters.length} 个学期、{preview.courses.length} 门课程</strong>
      <p>将新增课程与学期，保留原有数据。重复恢复会生成副本；备份不包含课程任务。</p>
      <div className="course-tools"><button disabled={busy} onClick={() => void run(async () => {
        const result = await importScheduleBackup(preview);
        setPreview(null);
        await useAppStore.getState().loadSemesters();
        useAppStore.getState().setActiveSemester(null);
        await useAppStore.getState().loadCourses(); await refresh();
        setMessage(`已恢复 ${result.courseCount} 门课程、${result.eventCount} 次课`);
      })}>确认恢复</button><button disabled={busy} onClick={() => setPreview(null)}>取消</button></div>
    </section>}
    {integrations && <CourseIntegrationsPanel onPreview={setPreview} />}
    {settings && <section className="course-settings" aria-label="课程显示与提醒设置">
      <label>外观<select value={prefs.theme} onChange={e => prefs.setPreferences({ theme: e.target.value as typeof prefs.theme })}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label>
      <label>页内小组件<select value={prefs.widget} onChange={e => prefs.setPreferences({ widget: e.target.value as typeof prefs.widget })}><option value="next">下一节</option><option value="today">今日列表</option><option value="twoDays">今日与明日</option></select></label>
      <label><input type="checkbox" checked={prefs.reminders} disabled={busy} onChange={e => {
        const enabled = e.target.checked;
        void run(async () => {
          if (enabled && !await requestCourseNotifications()) throw new Error('通知权限未开启，请在系统或浏览器设置中允许通知后重试');
          prefs.setPreferences({ reminders: enabled });
        });
      }} />上课提醒（所有学期的已排课实例）</label>
      <label>提前<select value={prefs.leadMinutes} onChange={e => prefs.setPreferences({ leadMinutes: Number(e.target.value) })}>{[0, 5, 10, 15, 30].map(n => <option key={n} value={n}>{n} 分钟</option>)}</select></label>
      <label>免提醒日期<input type="date" onChange={e => { if (e.target.value) prefs.setPreferences({ skippedDates: [...new Set([...prefs.skippedDates, e.target.value])].sort() }); e.target.value = ''; }} /></label>
      <div className="course-tools">{prefs.skippedDates.map(d => <button key={d} aria-label={`移除免提醒日期 ${d}`} onClick={() => prefs.setPreferences({ skippedDates: prefs.skippedDates.filter(x => x !== d) })}>{d} ×</button>)}</div>
      <p>{Capacitor.isNativePlatform() ? '本机预排最近 60 次提醒，打开应用后自动补充；送达受系统通知与电池设置影响。' : '浏览器提醒需要保持应用运行；关闭页面后请使用导出的 ICS 添加到系统日历。'} 免提醒日期可用于假期，课程仍保留在课表中。</p>
    </section>}
    {!backup ? <p role="status">{error ? '课程概览暂不可用' : '正在加载课程概览…'}</p> : groups.map(group => <section className="course-widget" key={group.label}>
      <h2>{group.label}</h2>
      {!group.entries.length && <p>{group.label === '下一节课程' ? '暂无后续排课' : '当天没有课程，好好安排自己的时间'}</p>}
      {group.entries.map(e => <button className="course-widget-row" key={e.id} onClick={() => onCourseClick(e.course.id)}>
        <time>{new Date(e.startTime).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}<br />{new Date(e.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}–{new Date(e.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time>
        <span><strong>{e.title}{Date.parse(e.startTime) <= now.getTime() && Date.parse(e.endTime) > now.getTime() ? ' · 上课中' : ''}</strong><p>{e.location || e.course.room || '地点待定'}{e.course.teacher ? ` · ${e.course.teacher}` : ''}{e.isOverride ? ' · 已调课' : ''}</p></span>
      </button>)}
    </section>)}
  </>;
}
