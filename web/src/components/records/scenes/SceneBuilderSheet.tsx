import { useState } from 'react';
import { createScene, updateScene, type SceneTemplate } from '../../../api/scenes';
import SceneDialog from './SceneDialog';

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

  return <SceneDialog title={scene ? '编辑场景' : '创建场景'} onClose={onClose} busy={busy}
    footer={<button type="button" onClick={() => void save()} disabled={busy || !name.trim() || !triggers.length}
      className="w-full rounded-full bg-[var(--sf-graphite)] p-3.5 text-sm font-bold text-white disabled:opacity-50">
      {busy ? '保存中…' : '保存场景'}
    </button>}>
    <p className="text-xs leading-5 text-[var(--sf-text-secondary)]">为常用的记录定义名称、颜色与触发方式。</p>
    <div className="mt-5 grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
      <label className="min-w-0 text-xs font-bold">图标<input aria-label="场景图标" value={emoji} maxLength={12} onChange={(event) => setEmoji(event.target.value)} className="mt-2 box-border w-full min-w-0 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-3 text-sm font-normal" /></label>
      <label className="min-w-0 text-xs font-bold">名称<input required value={name} maxLength={60} onChange={(event) => setName(event.target.value)} className="mt-2 box-border w-full min-w-0 rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-3 text-sm font-normal" placeholder="例如：阅读" /></label>
    </div>
    <label className="mt-4 block text-xs font-bold">描述（可选）<textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-2 block w-full resize-y rounded-xl border border-[var(--sf-border)] bg-[var(--sf-bg)] p-3 text-sm font-normal leading-5" placeholder="这个场景想记录什么？" /></label>
    <label className="mt-4 flex min-w-0 items-center gap-3 text-xs font-bold">主题色<input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--sf-border)] bg-transparent" /><span className="font-normal text-[var(--sf-text-secondary)]">{color}</span></label>
    <fieldset className="mt-5 min-w-0 border-t border-[var(--sf-divider)] pt-4"><legend className="sr-only">触发方式</legend><p className="text-sm font-bold">触发方式</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(triggerNames).map(([key, label]) => <label key={key} className="inline-flex max-w-full items-center rounded-full bg-[var(--sf-bg)] px-3 py-2 text-xs"><input type="checkbox" disabled={key === 'task_completed'} checked={triggers.includes(key)} onChange={() => setTriggers((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} className="mr-2 shrink-0 accent-[var(--sf-graphite)]" /><span className="min-w-0">{label}{key === 'task_completed' ? ' · 即将支持' : ''}</span></label>)}</div><p className="mt-3 break-words text-[11px] leading-5 text-[var(--sf-text-secondary)]">自动关联专注记录：在“我的 → 时间记录”中设为默认场景。</p></fieldset>
    {error ? <p role="alert" className="mt-4 text-xs text-red-600">{error}</p> : null}
  </SceneDialog>;
}
