import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useCoursePreferences } from '../store/coursePreferences';
import { useCourseSchedule } from '../store/courseSchedule';
import { useAppStore } from '../store/appStore';
import { localDay, occurrences } from '../utils/courseSchedule';
import { courseIsMuted } from '../utils/courseAutomation';

export async function requestCourseNotifications() {
  if (Capacitor.isNativePlatform()) return (await LocalNotifications.requestPermissions()).display === 'granted';
  return 'Notification' in window && await Notification.requestPermission() === 'granted';
}
// Serialise native cancel/schedule operations across data and preference changes.
let nativeQueue = Promise.resolve();
let nativeSignature = '';
export default function CourseReminderRuntime() {
  const courses = useAppStore(s => s.courses);
  const selected = useAppStore(s => s.selectedCourse);
  const { backup, refresh } = useCourseSchedule();
  const { reminders, leadMinutes, skippedDates, autoHolidays, holidayCache } = useCoursePreferences();
  useEffect(() => { void refresh(); }, [courses, selected, refresh]);
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 60000);
    const resume = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', resume);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, [refresh]);
  useEffect(() => {
    if (!backup && reminders) return;
    const automatic = autoHolidays ? Object.values(holidayCache).flatMap(h => h.dates) : [];
    const entries = (backup ? occurrences(backup) : []).filter(e => !courseIsMuted(e, skippedDates, automatic));
    if (Capacitor.isNativePlatform()) {
      const signature = JSON.stringify([reminders, leadMinutes, skippedDates, entries.map(e => [e.id, e.startTime, e.endTime, e.title, e.location, e.course.room]), localDay(new Date())]);
      nativeQueue = nativeQueue.then(async () => {
        if (nativeSignature === signature) return;
        const pending = await LocalNotifications.getPending();
        const own = pending.notifications.filter(n => n.extra?.source === 'sparkflow-course');
        if (own.length) await LocalNotifications.cancel({ notifications: own.map(n => ({ id: n.id })) });
        if (!reminders) { nativeSignature = signature; return; }
        if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
        const future = entries.filter(e => Date.parse(e.startTime) - leadMinutes * 60000 > Date.now()).slice(0, 60);
        if (future.length) await LocalNotifications.schedule({ notifications: future.map((e, i) => ({
          id: 1700000000 + i, title: `即将上课：${e.title}`,
          body: `${new Date(e.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · ${e.location || e.course.room || '地点待定'}`,
          schedule: { at: new Date(Date.parse(e.startTime) - leadMinutes * 60000), allowWhileIdle: true },
          extra: { source: 'sparkflow-course', courseId: e.course.id },
        })) });
        nativeSignature = signature;
      }).catch((e: unknown) => { useCourseSchedule.setState({ error: `课程提醒同步失败：${e instanceof Error ? e.message : String(e)}` }); });
      return;
    }
    if (!reminders || !('Notification' in window)) return;
    const tick = async () => {
      if (Notification.permission !== 'granted') return;
      for (const e of entries) {
        const due = Date.parse(e.startTime) - leadMinutes * 60000;
        if (Date.now() < due || Date.now() - due > 60000) continue;
        const key = `sparkflow-course-notified:${e.id}:${due}`;
        if (localStorage.getItem(key)) continue;
        const options = { body: `${e.location || e.course.room || '地点待定'} · ${leadMinutes} 分钟后上课`, tag: key };
        try {
          const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
          if (registration) await registration.showNotification(e.title, options);
          else new Notification(e.title, options);
          localStorage.setItem(key, '1');
        } catch { /* Permission may have been revoked while the application is open. */ }
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 15000);
    return () => clearInterval(timer);
  }, [backup, reminders, leadMinutes, skippedDates, autoHolidays, holidayCache]);
  return null;
}
