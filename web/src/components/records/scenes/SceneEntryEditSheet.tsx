import { useState } from 'react';
import { updateSceneEntry, type SceneEntry, type SceneTemplate } from '../../../api/scenes';

function localDateTime(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function SceneEntryEditSheet({ scene, entry, onClose, onSaved }: { scene: SceneTemplate; entry: SceneEntry; onClose: () => void; onSaved: () => void }) {
  const [occurredAt, setOccurredAt] = useState(localDateTime(entry.occurredAt));
  const [metadata, setMetadata] = useState<Record<string, string>>(Object.fromEntries(Object.entries(entry.metadata).map(([key, value]) => [key, String(value)])));
  const [tags, setTags] = useState(entry.tags.join('，'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (busy) return;
    const values: Record<string, string | number> = {};
    for (const field of scene.fieldSchema) {
      const value = metadata[field.key]?.trim();
      if (!value) { if (field.required) { setError(`请填写${field.label}`); return; } continue; }
      values[field.key] = ['duration', 'rating', 'number'].includes(field.type) ? Number(value) : value;
    }
    const instant = new Date(occurredAt);
    if (!Number.isFinite(instant.getTime())) { setError('发生时间无效'); return; }
    setBusy(true); setError('');
    try { await updateSceneEntry(scene.id, entry.id, { occurredAt: instant.toISOString(), metadata: values, tags: [...new Set(tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean))] }); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : '修改失败'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="编辑场景记录" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-[30px] bg-[var(--sf-bg)] p-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div className="flex items-center justify-between"><h2 className="text-xl font-black">编辑场景记录</h2><button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-2 text-xs">关闭</button></div>
      <p className="mt-2 text-xs text-[var(--sf-text-secondary)]">只修改场景的发生时间、字段和标签；原始时间或图文记录保持原样。</p>
      <label className="mt-5 block text-xs font-bold">发生时间<input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className="mt-2 w-full rounded-xl bg-white p-3 text-sm" /></label>
      {scene.fieldSchema.map((field) => <label key={field.id} className="mt-4 block text-xs font-bold">{field.label}{field.required ? ' *' : ''}<input value={metadata[field.key] ?? ''} type={['duration', 'rating', 'number'].includes(field.type) ? 'number' : 'text'} min={field.min} max={field.max} onChange={(event) => setMetadata((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-2 w-full rounded-xl bg-white p-3 text-sm" /></label>)}
      <label className="mt-4 block text-xs font-bold">标签（逗号分隔）<input value={tags} onChange={(event) => setTags(event.target.value)} className="mt-2 w-full rounded-xl bg-white p-3 text-sm" /></label>
      {error ? <p role="alert" className="mt-4 text-xs text-red-600">{error}</p> : null}
      <button type="button" disabled={busy} onClick={() => void save()} className="mt-6 w-full rounded-2xl bg-[var(--sf-graphite)] p-4 text-sm font-bold text-white disabled:opacity-50">{busy ? '保存中…' : '保存修改'}</button>
    </section>
  </div>;
}
