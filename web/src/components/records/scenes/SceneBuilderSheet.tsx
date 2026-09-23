import { useState } from 'react';
import { createScene, updateScene, type SceneTemplate } from '../../../api/scenes';

const triggerNames = { manual: '手动', focus: '专注', task_completed: '完成任务' } as const;

export default function SceneBuilderSheet({ scene, onClose, onSaved }: { scene?: SceneTemplate; onClose: () => void; onSaved: (scene: SceneTemplate) => void }) {
  const [name, setName] = useState(scene?.name ?? '');
  const [emoji, setEmoji] = useState(scene?.emoji ?? '✨');
  const [color, setColor] = useState(scene?.color ?? '#e8b8cb');
  const [description, setDescription] = useState(scene?.description ?? '');
  const fields = scene?.fieldSchema ?? [];
  const [triggers, setTriggers] = useState(scene?.triggers ?? ['manual']);
  const views = scene?.allowedViews?.length ? scene.allowedViews : ['heatmap', 'list'] as SceneTemplate['allowedViews'];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const payload = { name, emoji, color, description: description.trim() || null, fieldSchema: fields, triggers, allowedViews: views };
      onSaved(scene ? await updateScene(scene.id, payload) : await createScene(payload));
    } catch (err) { setError(err instanceof Error ? err.message : '场景保存失败'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[70] flex items-end justify-center overflow-hidden bg-black/40 px-3 sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={scene ? '编辑场景' : '创建场景'} className="mb-[env(safe-area-inset-bottom,0px)] max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-16px)] w-full min-w-0 max-w-xl overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-[28px] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-4 pb-6 text-[var(--sf-text-primary)] shadow-xl sm:rounded-[28px] sm:p-6">
      <div className="flex items-center justify-between"><h2 className="text-xl font-black">{scene ? '编辑场景' : '创建场景'}</h2><button type="button" onClick={onClose} className="rounded-full bg-[var(--sf-bg)] px-3 py-2 text-xs">关闭</button></div>
      <p className="mt-2 text-xs text-[var(--sf-text-secondary)]">场景定义记录方式，时间与照片继续引用已有记录。</p>
      <div className="mt-5 grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
        <label className="min-w-0 text-xs">图标<input aria-label="场景图标" value={emoji} maxLength={12} onChange={(event) => setEmoji(event.target.value)} className="mt-1 box-border w-full min-w-0 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-3" /></label>
        <label className="min-w-0 text-xs">名称<input required value={name} maxLength={60} onChange={(event) => setName(event.target.value)} className="mt-1 box-border w-full min-w-0 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-3" placeholder="例如：阅读" /></label>
      </div>
      <label className="mt-3 block text-xs">描述<textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-3" /></label>
      <label className="mt-3 flex min-w-0 items-center gap-3 text-xs">主题色<input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-12 shrink-0" /><span className="truncate">{color}</span></label>
      <fieldset className="mt-5 min-w-0"><legend className="text-sm font-bold">触发方式</legend><div className="mt-2 flex flex-wrap gap-2">{Object.entries(triggerNames).map(([key, label]) => <label key={key} className="inline-flex max-w-full items-center rounded-full bg-[var(--sf-bg)] px-3 py-2 text-xs"><input type="checkbox" disabled={key === 'task_completed'} checked={triggers.includes(key)} onChange={() => setTriggers((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} className="mr-2 shrink-0" /><span className="min-w-0">{label}{key === 'task_completed' ? ' · 即将支持' : ''}</span></label>)}</div><p className="mt-2 break-words text-[11px] leading-5 text-[var(--sf-text-secondary)]">自动关联专注记录：在“我的 → 时间记录”中设为默认场景。</p></fieldset>
      {error ? <p role="alert" className="mt-4 text-xs text-red-600">{error}</p> : null}
      <button type="button" onClick={() => void save()} disabled={busy || !name.trim() || !triggers.length} className="mt-6 w-full rounded-2xl bg-[var(--sf-graphite)] p-4 text-sm font-bold text-white disabled:opacity-50">{busy ? '保存中…' : '保存场景'}</button>
    </section>
  </div>;
}
