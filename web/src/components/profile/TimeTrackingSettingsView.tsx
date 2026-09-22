import { useEffect, useState } from 'react';
import { listScenes, type SceneTemplate } from '../../api/scenes';
import { getTimeTrackingPreferences, updateTimeTrackingPreferences, type TimeTrackingPatch, type TimeTrackingPreferences } from '../../api/timeTracking';

const switches: Array<{ key: Exclude<keyof TimeTrackingPatch, 'defaultSceneId'>; title: string; description: string }> = [
  { key: 'focusActualEnabled', title: '专注计入实际时间', description: '只影响新开始的 Focus，之前的时间记录保持原样。' },
  { key: 'manualBackfillEnabled', title: '允许手工补记', description: '关闭后不能新建补记，已有记录仍可查看和编辑。' },
  { key: 'quickStartEnabled', title: '显示快捷开始', description: '在快捷添加中显示快速进入 Focus 的入口。' },
  { key: 'focusAttachmentEnabled', title: '专注后允许附件', description: '关闭后仍可写文字记录，但不显示媒体入口。' },
];

export default function TimeTrackingSettingsView({ onBack, onOpenActual }: { onBack: () => void; onOpenActual: () => void }) {
  const [preferences, setPreferences] = useState<TimeTrackingPreferences | null>(null);
  const [scenes, setScenes] = useState<SceneTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([getTimeTrackingPreferences(controller.signal), listScenes()])
      .then(([pref, items]) => { if (!controller.signal.aborted) { setPreferences(pref); setScenes(items); } })
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '设置加载失败'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const save = async (patch: TimeTrackingPatch) => {
    if (busy) return;
    setBusy(true); setError('');
    try { setPreferences(await updateTimeTrackingPreferences(patch)); }
    catch (err) { setError(err instanceof Error ? err.message : '保存设置失败'); }
    finally { setBusy(false); }
  };

  return <div className="animate-page-enter space-y-4 pb-24 text-[var(--sf-text-primary)]">
    <header className="flex items-start gap-3"><button type="button" onClick={onBack} aria-label="返回我的" className="rounded-full bg-white px-3 py-2 text-sm">←</button><div><h1 className="text-xl font-black">时间记录</h1><p className="mt-1 text-xs text-[var(--sf-text-secondary)]">这些设置在你的设备之间同步。</p></div></header>
    {loading ? <p className="rounded-2xl bg-white p-4 text-sm">读取设置中…</p> : null}
    {error ? <p role="alert" className="rounded-2xl bg-red-50 p-4 text-xs text-red-700">{error}</p> : null}
    {preferences ? <>
      <section className="space-y-1 rounded-[24px] bg-white p-4">{switches.map(({ key, title, description }) => <label key={key} className="flex items-center justify-between gap-4 border-b border-[var(--sf-border)] py-3 last:border-0"><span><strong className="block text-sm">{title}</strong><span className="mt-1 block text-xs leading-5 text-[var(--sf-text-secondary)]">{description}</span></span><input type="checkbox" checked={preferences[key]} disabled={busy} onChange={(event) => void save({ [key]: event.target.checked })} aria-label={title} className="h-5 w-5 shrink-0 accent-[#829f49]" /></label>)}</section>
      <section className="rounded-[24px] bg-white p-4"><label className="block text-sm font-bold">默认场景<select value={preferences.defaultSceneId ?? ''} disabled={busy} onChange={(event) => void save({ defaultSceneId: event.target.value || null })} className="mt-3 w-full rounded-xl bg-[var(--sf-bg)] p-3 text-sm font-normal"><option value="">不自动关联</option>{scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.emoji} {scene.name}{scene.triggers.includes('focus') ? '' : '（未开启专注触发）'}</option>)}</select></label><p className="mt-2 text-xs leading-5 text-[var(--sf-text-secondary)]">新完成的 Focus 仅在该场景开启“专注”触发时自动关联；带必填字段的记录可之后补全。</p></section>
      <section className="rounded-[24px] bg-white p-4"><strong className="text-sm">外部时间来源</strong><p className="mt-1 text-xs text-[var(--sf-text-secondary)]">Android 使用记录：未连接</p></section>
      <button type="button" onClick={onOpenActual} className="w-full rounded-2xl bg-[var(--sf-graphite)] p-4 text-sm font-bold text-white">打开实际时间线</button>
    </> : null}
  </div>;
}
