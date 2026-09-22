import { useCallback, useEffect, useState } from 'react';
import { deleteSceneEntry, listSceneEntries, sceneAnalytics, type SceneAnalytics, type SceneEntry, type SceneTemplate } from '../../../api/scenes';
import InspirationAttachmentList from '../InspirationAttachmentList';
import SceneEntrySheet from './SceneEntrySheet';

type View = 'heatmap' | 'trend' | 'list' | 'photo';
type Period = 'week' | 'month' | 'year' | 'custom';
const daysAgo = (count: number) => new Date(Date.now() - count * 86_400_000).toISOString().slice(0, 10);
const viewLabels: Record<View, string> = { heatmap: '热力图', trend: '趋势', list: '列表', photo: '照片' };

export default function SceneDetail({ scene, onBack, onEdit }: { scene: SceneTemplate; onBack: () => void; onEdit: () => void }) {
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState(daysAgo(30));
  const [customEnd, setCustomEnd] = useState(daysAgo(0));
  const [view, setView] = useState<View>('heatmap');
  const [summary, setSummary] = useState<SceneAnalytics | null>(null);
  const [entries, setEntries] = useState<SceneEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState('');
  const rangeStart = period === 'custom' ? customStart : daysAgo(period === 'week' ? 7 : period === 'month' ? 30 : 365);
  const rangeEnd = period === 'custom' ? customEnd : daysAgo(0);
  const validRange = !!rangeStart && !!rangeEnd && rangeStart <= rangeEnd && new Date(`${rangeEnd}T00:00:00`).getTime() - new Date(`${rangeStart}T00:00:00`).getTime() <= 369 * 86_400_000;
  const start = new Date(`${validRange ? rangeStart : daysAgo(30)}T00:00:00`).toISOString();
  const end = new Date(new Date(`${validRange ? rangeEnd : daysAgo(0)}T00:00:00`).getTime() + 86_400_000).toISOString();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const load = useCallback(async () => {
    if (!validRange) { setError('请选择最长 370 天的有效日期范围'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [analytics, page] = await Promise.all([sceneAnalytics(scene.id, start, end, timeZone), listSceneEntries(scene.id, start, end)]);
      setSummary(analytics); setEntries(page.items); setCursor(page.nextCursor);
    } catch (err) { setError(err instanceof Error ? err.message : '场景加载失败'); }
    finally { setLoading(false); }
  }, [scene.id, start, end, timeZone, validRange]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const more = async () => {
    if (!cursor) return;
    try { const page = await listSceneEntries(scene.id, start, end, cursor); setEntries((current) => [...current, ...page.items]); setCursor(page.nextCursor); }
    catch (err) { setError(err instanceof Error ? err.message : '更多记录加载失败'); }
  };
  const remove = async (entry: SceneEntry) => {
    setBusyId(entry.id); setError('');
    try { await deleteSceneEntry(scene.id, entry.id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : '移除失败'); }
    finally { setBusyId(''); }
  };

  const visibleViews = scene.allowedViews.filter((item) => item !== 'photo' || summary?.hasImages);
  const activeView = visibleViews.includes(view) ? view : visibleViews[0] ?? 'list';
  const maxCount = Math.max(1, ...(summary?.heatmap.map((day) => day.count) ?? []));
  const counts = new Map(summary?.heatmap.map((day) => [day.date, day.count]) ?? []);
  const heatmapDays: Array<{ date: string; count: number }> = [];
  if (validRange) for (let cursor = new Date(`${rangeStart}T12:00:00Z`), last = new Date(`${rangeEnd}T12:00:00Z`); cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    heatmapDays.push({ date, count: counts.get(date) ?? 0 });
  }
  const maxBucket = Math.max(1, ...(summary?.buckets.map((bucket) => bucket.count) ?? []));
  const photos = entries.filter((entry) => entry.inspiration?.attachments?.some((attachment) => attachment.kind === 'image'));

  return <section className="space-y-4 pb-5">
    <div className="flex items-center justify-between gap-2"><button type="button" onClick={onBack} className="rounded-full bg-white px-3 py-2 text-xs font-bold">← 场景</button><button type="button" onClick={onEdit} className="rounded-full bg-white px-3 py-2 text-xs">编辑模板</button></div>
    <header className="rounded-[28px] p-5 text-[#202322]" style={{ background: scene.color }}><span className="text-3xl" aria-hidden="true">{scene.emoji}</span><h2 className="mt-3 text-2xl font-black">{scene.name}</h2><p className="mt-1 text-xs opacity-70">{scene.description || '持续记录，看见自己的节奏。'}</p><div className="mt-4 flex gap-4 text-xs font-semibold"><span>{summary?.totalCount ?? '—'} 条记录</span><span>{summary ? `${Math.round(summary.totalDurationSeconds / 60)} 分钟` : '—'}</span></div></header>
    <div className="flex flex-wrap gap-2" role="group" aria-label="时间范围">{(['week', 'month', 'year', 'custom'] as const).map((item) => <button type="button" key={item} aria-pressed={period === item} onClick={() => setPeriod(item)} className={`rounded-full px-3 py-2 text-xs ${period === item ? 'bg-[var(--sf-graphite)] text-white' : 'bg-white'}`}>{({ week: '7 天', month: '30 天', year: '一年', custom: '自定义' })[item]}</button>)}</div>
    {period === 'custom' ? <div className="flex flex-wrap gap-3 text-xs"><label>开始<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="ml-1 rounded-lg bg-white p-2" /></label><label>结束<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="ml-1 rounded-lg bg-white p-2" /></label></div> : null}
    <div className="flex flex-wrap gap-2" role="group" aria-label="场景视图">{visibleViews.map((item) => <button type="button" key={item} aria-pressed={activeView === item} onClick={() => setView(item)} className={`rounded-full px-3 py-2 text-xs ${activeView === item ? 'bg-[var(--sf-graphite)] text-white' : 'bg-white'}`}>{viewLabels[item]}</button>)}</div>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
    {loading ? <p className="rounded-2xl bg-white p-5 text-sm">加载场景中…</p> : null}
    {!loading && summary?.totalCount === 0 ? <p className="rounded-2xl bg-white p-5 text-sm text-[var(--sf-text-secondary)]">这个时间范围还没有场景记录。</p> : null}
    {!loading && activeView === 'heatmap' ? <div className="rounded-[24px] bg-white p-4"><h3 className="mb-3 text-xs font-bold">记录热力图</h3><div className={period === 'year' ? 'grid grid-cols-14 gap-1' : 'grid grid-cols-7 gap-1.5'}>{heatmapDays.map((day) => <span key={day.date} title={`${day.date} · ${day.count} 条`} aria-label={`${day.date} ${day.count} 条`} className="aspect-square rounded-md" style={{ backgroundColor: scene.color, opacity: day.count ? 0.25 + day.count / maxCount * 0.75 : 0.12 }} />)}</div></div> : null}
    {!loading && activeView === 'trend' ? <div className="space-y-3 rounded-[24px] bg-white p-4"><h3 className="text-xs font-bold">记录趋势</h3>{summary?.buckets.map((bucket) => <div key={bucket.key} className="flex items-center gap-2 text-xs"><time className="w-20 shrink-0">{bucket.key}</time><span className="h-3 min-w-1 rounded-full" style={{ width: `${Math.max(2, bucket.count / maxBucket * 70)}%`, backgroundColor: scene.color }} /><span>{bucket.count}</span></div>)}</div> : null}
    {!loading && (activeView === 'list' || activeView === 'photo') ? <div className="space-y-3">{(activeView === 'photo' ? photos : entries).map((entry) => <article key={entry.id} className="rounded-[24px] bg-white p-4"><div className="flex justify-between gap-2 text-xs"><time className="text-[var(--sf-text-secondary)]">{new Date(entry.occurredAt).toLocaleString('zh-CN')}</time><button type="button" disabled={busyId === entry.id} onClick={() => void remove(entry)} className="text-red-600">移出场景</button></div><p className="mt-2 text-sm font-semibold">{entry.inspiration?.title || entry.inspiration?.contentText || entry.pomodoroSession?.title || '场景记录'}</p>{entry.pomodoroSession ? <p className="mt-1 text-xs">实际 {Math.round(entry.pomodoroSession.effectiveDurationSeconds / 60)} 分钟</p> : null}{Object.entries(entry.metadata).length ? <div className="mt-2 flex flex-wrap gap-1">{Object.entries(entry.metadata).map(([key, value]) => <span key={key} className="rounded-full bg-[var(--sf-bg)] px-2 py-1 text-[10px]">{scene.fieldSchema.find((field) => field.key === key)?.label || key}：{value}</span>)}</div> : null}{activeView === 'photo' && entry.inspiration?.attachments ? <InspirationAttachmentList inspirationId={entry.inspiration.id} attachments={entry.inspiration.attachments.filter((attachment) => attachment.kind === 'image')} /> : null}</article>)}{cursor ? <button type="button" onClick={() => void more()} className="w-full rounded-xl bg-white p-3 text-xs">加载更多</button> : null}</div> : null}
    <button type="button" onClick={() => setAdding(true)} className="w-full rounded-2xl bg-[var(--sf-graphite)] p-4 text-sm font-bold text-white">+ 添加已有记录</button>
    {adding ? <SceneEntrySheet scene={scene} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void load(); }} /> : null}
  </section>;
}
