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
      <strong>法定节假日、调休与上课模式</strong>
      <label><input type="checkbox" checked={prefs.autoHolidays} onChange={e => prefs.setPreferences({ autoHolidays: e.target.checked })} />自动识别中国法定休息日和调休工作日</label>
      <p>数据来自 holiday-cn 整理的国务院年度安排，每日更新并缓存。法定休息日自动跳过提醒和上课模式；调休工作日会提供给 AI，但学校具体按星期几上课仍以校历或你的明确说明为准。</p>
      <p>在 AI 规划中可直接说“法定节假日不上课”或“这个调休日按周一课表上课”。AI 会先定位受影响课次，再生成可预览、可应用、可撤销的单次课表变动。</p>
      {prefs.autoHolidays && <><p>已缓存年份：{Object.keys(prefs.holidayCache).join('、') || '暂无'}；调休工作日：{Object.values(prefs.holidayCache).reduce((total, item) => total + (item.workdays?.length || 0), 0)} 天</p><div className="course-tools"><button disabled={busy} onClick={() => void run(() => refreshAutomaticHolidays(true))}>刷新节假日与调休</button></div></>}
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
