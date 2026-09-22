import { useEffect, useState } from 'react';
import {
  deleteAppUsageMapping, getAppUsageSettings, saveAppUsageMapping, setAppUsageEnabled,
  type AppUsageSettings as Settings,
} from '../../api/appUsage';
import { listTags, type TagRecord } from '../../api/tags';
import { androidUsage, isAndroidUsageAvailable } from '../../capacitor/appUsage';
import { syncAppUsage } from '../../lib/appUsageSync';

interface Candidate { packageName: string; appName: string }

export default function AppUsageSettings() {
  const android = isAndroidUsageAvailable();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [granted, setGranted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([getAppUsageSettings(), listTags(), android ? androidUsage.status() : Promise.resolve({ granted: false })])
      .then(([config, items, status]) => {
        if (active) { setSettings(config); setTags(items.filter((item) => !item.archived)); setGranted(status.granted); }
      })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : '读取应用记录设置失败'); });
    return () => { active = false; };
  }, [android]);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作失败'); }
    finally { setBusy(false); }
  };

  const discover = () => void run(async () => {
    const status = await androidUsage.status();
    setGranted(status.granted);
    if (!status.granted) { await androidUsage.openSettings(); setMessage('请在系统设置中授予权限，返回后再点“查找应用”。'); return; }
    setCandidates((await androidUsage.discover()).apps);
  });

  return <section className="space-y-3 rounded-[24px] bg-white p-4">
    <div><strong className="text-sm">Android 应用使用记录</strong>
      <p className="mt-1 text-xs leading-5 text-[var(--sf-text-secondary)]">默认关闭。只记录你选择的应用的前台时段和标签；不读取页面、输入、聊天或通知内容。与主动专注分开统计。</p>
    </div>
    {message && <p role="status" className="rounded-xl bg-[var(--sf-bg)] p-3 text-xs">{message}</p>}
    {settings && <>
      <label className="flex items-center justify-between gap-3 text-sm">自动记录已选应用
        <input type="checkbox" checked={settings.enabled} disabled={!android || busy} onChange={(event) => {
          const enabled = event.target.checked;
          void run(async () => { setSettings(await setAppUsageEnabled(enabled)); if (enabled) setMessage('已开启。请授予系统权限并选择需要记录的应用。'); });
        }} aria-label="自动记录已选应用" className="h-5 w-5 accent-[#829f49]" />
      </label>
      {!android && <p className="text-xs text-[var(--sf-text-secondary)]">请在 Android 应用中开启并选择应用。</p>}
      {android && settings.enabled && <>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={discover} className="rounded-xl bg-[var(--sf-bg)] px-3 py-2 text-xs">{granted ? '查找最近使用的应用' : '授予系统使用情况权限'}</button>
          <button type="button" disabled={busy || !granted} onClick={() => void run(async () => {
            const count = await syncAppUsage(); setMessage(`同步完成，新增 ${count} 条使用记录。`);
          })} className="rounded-xl bg-[var(--sf-graphite)] px-3 py-2 text-xs text-white">同步最近 24 小时</button>
        </div>
        {candidates.filter((item) => !settings.mappings.some((mapped) => mapped.packageName === item.packageName)).map((item) =>
          <button key={item.packageName} type="button" disabled={busy} onClick={() => void run(async () => {
            await saveAppUsageMapping({ ...item, tagId: null, enabled: true }); setSettings(await getAppUsageSettings());
          })} className="block w-full rounded-xl bg-[var(--sf-bg)] px-3 py-2 text-left text-xs">＋ {item.appName} <span className="block truncate text-[10px] opacity-60">{item.packageName}</span></button>)}
      </>}
      {settings.mappings.map((item) => <div key={item.id} className="rounded-xl bg-[var(--sf-bg)] p-3 text-xs">
        <div className="flex items-center justify-between gap-2"><strong>{item.appName}</strong><button type="button" disabled={busy} onClick={() => void run(async () => {
          await deleteAppUsageMapping(item.packageName); setSettings(await getAppUsageSettings());
        })} aria-label={`移除${item.appName}的自动记录`} className="text-red-600">移除</button></div>
        <p className="truncate text-[10px] opacity-60">{item.packageName}</p>
        <label className="mt-2 flex items-center justify-between gap-2">归类标签<select value={item.tagId || ''} disabled={busy || !android} onChange={(event) => void run(async () => {
          await saveAppUsageMapping({ packageName: item.packageName, appName: item.appName, tagId: event.target.value || null, enabled: item.enabled });
          setSettings(await getAppUsageSettings());
        })} className="max-w-[65%] rounded-lg bg-white p-2"><option value="">未分类</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
        <label className="mt-2 flex items-center justify-between">记录此应用<input type="checkbox" checked={item.enabled} disabled={busy || !android} onChange={(event) => void run(async () => {
          await saveAppUsageMapping({ packageName: item.packageName, appName: item.appName, tagId: item.tagId, enabled: event.target.checked });
          setSettings(await getAppUsageSettings());
        })} /></label>
      </div>)}
    </>}
  </section>;
}
