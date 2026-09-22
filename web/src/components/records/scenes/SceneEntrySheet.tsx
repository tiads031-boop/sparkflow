import { useEffect, useState } from 'react';
import { getActualTimeline, type ActualTimelineEntry } from '../../../api/actualTimeline';
import { listInspirations, type InspirationRecord } from '../../../api/inspirations';
import { createSceneEntry, type SceneTemplate } from '../../../api/scenes';

export default function SceneEntrySheet({ scene, onClose, onSaved }: { scene: SceneTemplate; onClose: () => void; onSaved: () => void }) {
  const [actual, setActual] = useState<ActualTimelineEntry[]>([]);
  const [records, setRecords] = useState<InspirationRecord[]>([]);
  const [selected, setSelected] = useState('');
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86_400_000);
    let active = true;
    Promise.all([getActualTimeline(start.toISOString(), end.toISOString()), listInspirations()])
      .then(([time, notes]) => { if (active) { setActual(time); setRecords(notes); } })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : '来源加载失败'); });
    return () => { active = false; };
  }, []);

  const save = async () => {
    const [kind, id] = selected.split(':');
    if (!id || busy) return;
    const source = kind === 'time' ? actual.find((item) => item.id === id) : records.find((item) => item.id === id);
    if (!source) return;
    const sourceType = kind === 'time' ? (source as ActualTimelineEntry).source : 'note';
    const values: Record<string, string | number> = {};
    for (const field of scene.fieldSchema) {
      const value = metadata[field.key]?.trim();
      if (!value) { if (field.required) { setError(`请填写${field.label}`); return; } continue; }
      values[field.key] = ['duration', 'rating', 'number'].includes(field.type) ? Number(value) : value;
    }
    setBusy(true);
    setError('');
    try {
      await createSceneEntry(scene.id, {
        sourceType,
        occurredAt: kind === 'time' ? (source as ActualTimelineEntry).start : (source as InspirationRecord).createdAt,
        ...(kind === 'time' ? { pomodoroSessionId: id } : { inspirationId: id }),
        metadata: values,
        tags: [],
        clientRequestId: crypto.randomUUID(),
      });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : '关联记录失败'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="添加场景记录" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-[30px] bg-[var(--sf-bg)] p-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div className="flex justify-between"><h2 className="text-xl font-black">加入 {scene.name}</h2><button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-2 text-xs">关闭</button></div>
      <p className="mt-2 text-xs text-[var(--sf-text-secondary)]">选择已有时间或图文记录，场景只保存关联与字段。</p>
      <label className="mt-5 block text-xs font-bold">已有记录<select value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-2 w-full rounded-xl bg-white p-3 text-sm"><option value="">请选择</option><optgroup label="最近 30 天的实际时间">{actual.map((item) => <option key={item.id} value={`time:${item.id}`}>{new Date(item.start).toLocaleString('zh-CN')} · {item.title || '时间记录'}</option>)}</optgroup><optgroup label="图文记录">{records.map((item) => <option key={item.id} value={`note:${item.id}`}>{new Date(item.createdAt).toLocaleDateString('zh-CN')} · {item.title || item.contentText?.slice(0, 30) || '记录'}</option>)}</optgroup></select></label>
      {scene.fieldSchema.map((field) => <label key={field.id} className="mt-4 block text-xs font-bold">{field.label}{field.required ? ' *' : ''}<input value={metadata[field.key] ?? ''} type={['duration', 'rating', 'number'].includes(field.type) ? 'number' : 'text'} min={field.min} max={field.max} onChange={(event) => setMetadata((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-2 w-full rounded-xl bg-white p-3 text-sm" /></label>)}
      {error ? <p role="alert" className="mt-4 text-xs text-red-600">{error}</p> : null}
      <button type="button" onClick={() => void save()} disabled={busy || !selected} className="mt-6 w-full rounded-2xl bg-[var(--sf-graphite)] p-4 text-sm font-bold text-white disabled:opacity-50">{busy ? '保存中…' : '关联记录'}</button>
    </section>
  </div>;
}
