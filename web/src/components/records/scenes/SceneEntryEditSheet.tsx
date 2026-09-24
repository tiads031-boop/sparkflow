import { useState } from 'react';
import { updateSceneEntry, type SceneEntry, type SceneTemplate } from '../../../api/scenes';
import SceneDialog from './SceneDialog';

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

  return <SceneDialog title="编辑场景记录" onClose={onClose} busy={busy}
    footer={<button type="button" disabled={busy} onClick={() => void save()} className="w-full rounded-full bg-[var(--sf-graphite)] p-3.5 text-sm font-bold text-white disabled:opacity-50">{busy ? '保存中…' : '保存修改'}</button>}>
    <p className="text-xs leading-5 text-[var(--sf-text-secondary)]">只修改场景的发生时间、字段和标签；原始时间或图文记录保持原样。</p>
    <label className="mt-5 block text-xs font-bold">发生时间<input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className="mt-2 w-full min-w-0 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-3 text-sm font-normal" /></label>
    {scene.fieldSchema.map((field) => <label key={field.id} className="mt-4 block text-xs font-bold">{field.label}{field.required ? ' *' : ''}<input value={metadata[field.key] ?? ''} type={['duration', 'rating', 'number'].includes(field.type) ? 'number' : 'text'} min={field.min} max={field.max} onChange={(event) => setMetadata((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-2 w-full min-w-0 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-3 text-sm font-normal" /></label>)}
    <label className="mt-4 block text-xs font-bold">标签（逗号分隔）<input value={tags} onChange={(event) => setTags(event.target.value)} className="mt-2 w-full min-w-0 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-3 text-sm font-normal" /></label>
    {error ? <p role="alert" className="mt-4 text-xs text-red-600">{error}</p> : null}
  </SceneDialog>;
}
