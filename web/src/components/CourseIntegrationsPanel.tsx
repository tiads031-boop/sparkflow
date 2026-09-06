import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CourseAutomation, SchoolImport, type AutomationStatus } from '../api/courseNative';
import { davStatus, readDav, writeDav, type DavConfig, type DavRemote } from '../api/courseIntegrations';
import { useCoursePreferences } from '../store/coursePreferences';
import { schoolBackup, type SchoolImportData } from '../utils/schoolImport';
import type { ScheduleBackup } from '../utils/courseSchedule';
import { refreshAutomaticHolidays, useIntegrationStatus } from './CourseIntegrationsRuntime';

interface Adapter { id: string; scriptId?: string; school: string; name: string; url: string; description: string }
export default function CourseIntegrationsPanel({ onPreview }: { onPreview: (backup: ScheduleBackup) => void }) {
  const prefs = useCoursePreferences(), status = useIntegrationStatus();
  const [catalog, setCatalog] = useState<Adapter[]>([]);
  const [adapterId, setAdapterId] = useState('jisu_external');
  const [search, setSearch] = useState('');
  const [url, setUrl] = useState('http://36.48.94.159:10000/jwglxt');
  const [schoolData, setSchoolData] = useState<SchoolImportData | null>(null);
  const [semester, setSemester] = useState({ name: '吉林外国语大学 · 新学期', start: '', end: '' });
  const [slots, setSlots] = useState('');
  const [bookmark, setBookmark] = useState('');
  const [dav, setDav] = useState<DavConfig>({ url: '', username: '', password: '' });
  const [remote, setRemote] = useState<DavRemote | null>(null);
  const [nativeStatus, setNativeStatus] = useState<AutomationStatus | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const android = Capacitor.getPlatform() === 'android';
  const adapter = catalog.find(a => a.id === adapterId);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  useEffect(() => {
    let mounted = true;
    fetch('/school-adapters/catalog.json').then(r => { if (!r.ok) throw new Error('学校目录加载失败'); return r.json(); }).then(data => { if (mounted) setCatalog(data); }).catch(e => { if (mounted) setMessage(e.message); });
    davStatus().then(data => { if (mounted) setDav(d => ({ ...d, url: data.defaultUrl })); }).catch(() => {});
    const refresh = () => { if (android) CourseAutomation.status().then(s => { if (mounted) setNativeStatus(s); }).catch(e => { if (mounted) setMessage(`请更新 Android 应用：${e.message}`); }); };
    refresh(); document.addEventListener('visibilitychange', refresh);
    return () => { mounted = false; document.removeEventListener('visibilitychange', refresh); };
  }, [android]);
  const receive = (data: SchoolImportData) => {
    if (!data || !Array.isArray(data.courses) || !data.courses.length || data.courses.length > 500) throw new Error('文件中没有有效教务课程');
    setSchoolData(data);
    setSlots(Array.isArray(data.timeSlots) ? data.timeSlots.map(s => `${s.number} ${s.startTime}-${s.endTime}`).join('\n') : '');
    const start = data.config?.semesterStartDate;
    if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) setSemester(s => ({ ...s, start }));
    setMessage(`已解析 ${data.courses.length} 条排课，请核对学期和节次后生成预览`);
  };
  return <div className="course-integrations">
    <section className="course-settings" aria-label="教务导入">
      <strong>教务导入</strong>
      <p>登录后进入个人课表，选择学期并查询，再执行解析。账号只在教务页面输入。目录脚本来自拾光适配仓库，实际兼容情况以学校当前页面为准。</p>
      <label>搜索学校<input value={search} onChange={e => setSearch(e.target.value)} placeholder="学校 / 正方 / 超星 / 青果" /></label>
      <label>适配入口<select value={adapterId} onChange={e => { const next = catalog.find(a => a.id === e.target.value); setAdapterId(e.target.value); setUrl(next?.url || ''); setBookmark(''); setSchoolData(null); if (next) setSemester(s => ({ ...s, name: `${next.school} · 新学期` })); }}>
        {catalog.filter(a => a.id === adapterId || `${a.school} ${a.name}`.toLowerCase().includes(search.toLowerCase())).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select></label>
      <p>{adapter?.description}</p>
      <label>教务网址<input type="url" value={url} onChange={e => setUrl(e.target.value)} /></label>
      {url.startsWith('http:') && <p>此入口使用 HTTP，请确认学校地址，并优先在可信校园网络登录。</p>}
      <div className="course-tools">
        {android ? <button disabled={busy || !adapter} onClick={() => void run(async () => { const target = new URL(url); if (!['http:', 'https:'].includes(target.protocol)) throw new Error('教务地址须为 HTTP/HTTPS'); receive(await SchoolImport.open({ adapter: adapter!.scriptId || adapter!.id, url })); })}>打开教务并登录</button>
          : <button disabled={busy || !adapter} onClick={() => void run(async () => {
            const responses = await Promise.all([fetch('/school-adapters/bridge.js'), fetch(`/school-adapters/${adapter!.scriptId || adapter!.id}.js`)]);
            if (responses.some(r => !r.ok)) throw new Error('适配脚本加载失败');
            const [bridge, script] = await Promise.all(responses.map(r => r.text()));
            const finish = `window.shiguangBridge.notifyTaskCompletion=()=>{const s=window.__sparkflowImport;if(!s.courses.length){alert('未读取到课程');return;}const u=URL.createObjectURL(new Blob([JSON.stringify(s)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='SparkFlow-教务课表.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);};`;
            setBookmark('javascript:' + encodeURIComponent(`void(function(){${bridge}\n${finish}\n${script}\n})()`));
          })}>生成浏览器导入工具</button>}
        <button disabled={busy} onClick={() => file.current?.click()}>读取教务结果 JSON</button>
      </div>
      {bookmark && <><p>新建浏览器书签，将下方代码粘贴到书签网址。登录教务并打开课表后点击书签，下载结果文件，再回到这里读取。</p><textarea aria-label="导入工具书签代码" readOnly rows={3} value={bookmark} /><div className="course-tools"><button onClick={() => void run(async () => { await navigator.clipboard.writeText(bookmark); setMessage('书签代码已复制'); })}>复制书签代码</button></div></>}
      <input ref={file} type="file" hidden accept=".json" onChange={e => { const selected = e.target.files?.[0]; e.target.value = ''; if (selected) void run(async () => { if (selected.size > 8 * 1024 * 1024) throw new Error('文件不能超过 8 MB'); receive(JSON.parse(await selected.text())); }); }} />
      {schoolData && <>
        <p>共 {schoolData.courses.length} 条：{schoolData.courses.slice(0, 5).map(c => c.name).join('、')}</p>
        <label>学期名称<input value={semester.name} onChange={e => setSemester(s => ({ ...s, name: e.target.value }))} /></label>
        <label>学期开始<input type="date" value={semester.start} onChange={e => setSemester(s => ({ ...s, start: e.target.value }))} /></label>
        <label>学期结束<input type="date" value={semester.end} onChange={e => setSemester(s => ({ ...s, end: e.target.value }))} /></label>
        <label>节次作息（北京时间）<textarea rows={6} value={slots} onChange={e => setSlots(e.target.value)} placeholder={'请填写学校实际时间，格式示例：\n1 08:00-08:45\n2 08:55-09:40'} /></label>
        <p>第一周从开学日期所在周的周一计算。请核对作息，应用不会猜测缺失的节次时间。</p>
        <div className="course-tools"><button disabled={busy} onClick={() => void run(async () => { onPreview(schoolBackup(schoolData, semester.name, semester.start, semester.end, slots)); setMessage('已生成上方预览，将新增学期；请确认后恢复'); })}>生成导入预览</button></div>
      </>}
    </section>
    <section className="course-settings" aria-label="WebDAV 课表同步">
      <strong>WebDAV 备份与恢复</strong>
      <p>使用已存在的目录。服务器需配置 WEBDAV_ALLOWED_ORIGINS；账号可临时填写或由服务器提供。表单密码不存入浏览器。</p>
      {(['url', 'username', 'password'] as const).map(key => <label key={key}>{({ url: '目录地址', username: '用户名', password: '密码 / 应用密码' })[key]}<input type={key === 'password' ? 'password' : 'text'} autoComplete="off" value={dav[key]} onChange={e => { setDav(d => ({ ...d, [key]: e.target.value })); setRemote(null); }} /></label>)}
      <div className="course-tools">
        <button disabled={busy} onClick={() => void run(async () => { const result = await readDav(dav); setRemote(result); setMessage(result.exists ? '已读取远端备份' : '远端尚无备份，可以上传'); })}>检查远端</button>
        <button disabled={busy || !remote || (remote.exists && (!remote.etag || remote.etag.startsWith('W/')))} onClick={() => void run(async () => { await writeDav(dav, remote?.etag); setRemote(null); setMessage('全部课表已上传；下次操作请重新检查远端'); })}>{remote?.exists ? '用全部课表覆盖远端' : '上传全部课表'}</button>
        <button disabled={busy || !remote?.backup} onClick={() => { if (remote?.backup) onPreview(remote.backup); }}>预览恢复远端</button>
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
