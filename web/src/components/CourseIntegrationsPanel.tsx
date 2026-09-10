import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CourseAutomation, type AutomationStatus } from '../api/courseNative';
import { davStatus, readDav, writeDav, type DavConfig, type DavRemote } from '../api/courseIntegrations';
import { useCoursePreferences } from '../store/coursePreferences';
import { refreshAutomaticHolidays, useIntegrationStatus } from './CourseIntegrationsRuntime';

export default function CourseIntegrationsPanel() {
  const prefs = useCoursePreferences(), status = useIntegrationStatus();
  const [dav, setDav] = useState<DavConfig>({ url: '', username: '', password: '' });
  const [remote, setRemote] = useState<DavRemote | null>(null);
  const [nativeStatus, setNativeStatus] = useState<AutomationStatus | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const android = Capacitor.getPlatform() === 'android';
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  useEffect(() => {
    let mounted = true;
    davStatus().then(data => { if (mounted) setDav(d => ({ ...d, url: data.defaultUrl })); }).catch(() => {});
    const refresh = () => { if (android) CourseAutomation.status().then(s => { if (mounted) setNativeStatus(s); }).catch(e => { if (mounted) setMessage(`请更新 Android 应用：${e.message}`); }); };
    refresh(); document.addEventListener('visibilitychange', refresh);
    return () => { mounted = false; document.removeEventListener('visibilitychange', refresh); };
  }, [android]);
  return <div className="course-integrations">
    <section className="course-settings" aria-label="课表 WebDAV 备份">
      <strong>课表 WebDAV 备份</strong>
      <p>使用已存在的目录。服务器需配置 WEBDAV_ALLOWED_ORIGINS；账号可临时填写或由服务器提供。表单密码不存入浏览器。</p>
      {(['url', 'username', 'password'] as const).map(key => <label key={key}>{({ url: '目录地址', username: '用户名', password: '密码 / 应用密码' })[key]}<input type={key === 'password' ? 'password' : 'text'} autoComplete="off" value={dav[key]} onChange={e => { setDav(d => ({ ...d, [key]: e.target.value })); setRemote(null); }} /></label>)}
      <div className="course-tools">
        <button disabled={busy} onClick={() => void run(async () => { const result = await readDav(dav); setRemote(result); setMessage(result.exists ? '已读取远端备份' : '远端尚无备份，可以上传'); })}>检查远端</button>
        <button disabled={busy || !remote || (remote.exists && (!remote.etag || remote.etag.startsWith('W/')))} onClick={() => void run(async () => { await writeDav(dav, remote?.etag); setRemote(null); setMessage('全部课表已上传；下次操作请重新检查远端'); })}>{remote?.exists ? '用全部课表覆盖远端' : '上传全部课表'}</button>
      </div>
      {remote?.exists && (!remote.etag || remote.etag.startsWith('W/')) && <p>远端未提供强 ETag，已禁用覆盖；可换用新的空目录备份。</p>}
      <p>恢复将新增副本；远端内容变化时拒绝覆盖，请重新检查再决定。</p>
    </section>
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
