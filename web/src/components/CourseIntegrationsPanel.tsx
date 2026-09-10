import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CourseAutomation, type AutomationStatus } from '../api/courseNative';
import { useCoursePreferences } from '../store/coursePreferences';
import { refreshAutomaticHolidays, useIntegrationStatus } from './CourseIntegrationsRuntime';

export default function CourseIntegrationsPanel() {
  const prefs = useCoursePreferences(), status = useIntegrationStatus();
  const [nativeStatus, setNativeStatus] = useState<AutomationStatus | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const android = Capacitor.getPlatform() === 'android';
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  useEffect(() => {
    let mounted = true;
    const refresh = () => { if (android) CourseAutomation.status().then(s => { if (mounted) setNativeStatus(s); }).catch(e => { if (mounted) setMessage(`请更新 Android 应用：${e.message}`); }); };
    refresh(); document.addEventListener('visibilitychange', refresh);
    return () => { mounted = false; document.removeEventListener('visibilitychange', refresh); };
  }, [android]);
  return <div className="course-integrations">
    <section className="course-settings" aria-label="自动假期与上课模式">
      <strong>自动节假日与上课模式</strong>
      <label><input type="checkbox" checked={prefs.autoHolidays} onChange={e => prefs.setPreferences({ autoHolidays: e.target.checked })} />自动跳过中国法定休息日的提醒和上课模式</label>
      <p>数据来自 holiday-cn（整理国务院公告），每日更新并缓存；补班日不作为假期。不改变课表日期，学校另行放假仍可手动添加免提醒日期。</p>
      {prefs.autoHolidays && <><p>已缓存年份：{Object.keys(prefs.holidayCache).join('、') || '暂无'}</p><div className="course-tools"><button disabled={busy} onClick={() => void run(() => refreshAutomaticHolidays(true))}>刷新节假日</button></div></>}
      {status.holidayError && <p role="status">{status.holidayError}；未获取的年份不会自动免提醒。</p>}
      <label>上课期间<select disabled={!android || busy} value={prefs.autoMode} onChange={e => {
        const mode = e.target.value as typeof prefs.autoMode;
        void run(async () => { if (mode !== 'off' && !(await CourseAutomation.status()).policyAccess) throw new Error('请先授予勿扰访问权限'); prefs.setPreferences({ autoMode: mode }); });
      }}><option value="off">不改变声音</option><option value="dnd">勿扰（保留系统优先通知）</option><option value="silent">铃声静音</option></select></label>
      {android ? <><div className="course-tools"><button onClick={() => void run(() => CourseAutomation.openSettings({ kind: 'policy' }))}>设置勿扰权限</button><button onClick={() => void run(() => CourseAutomation.openSettings({ kind: 'exact' }))}>设置精确闹钟</button><button onClick={() => void run(async () => setNativeStatus(await CourseAutomation.status()))}>刷新权限</button></div><p>勿扰：{nativeStatus?.policyAccess ? '已允许' : '未允许'}；精确闹钟：{nativeStatus?.exactAlarms ? '已允许' : '未允许，切换可能延迟'}。连续课程合并处理，下课后结束本应用勿扰并恢复原铃声模式；期间手动改变铃声模式则保留手动设置。</p></> : <p>自动系统勿扰/铃声静音仅限 Android 安装版。</p>}
      {(status.automationError || nativeStatus?.error) && <p role="status">{status.automationError || nativeStatus?.error}</p>}
    </section>
    {message && <p role="status">{message}</p>}
  </div>;
}
