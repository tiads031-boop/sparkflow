import { useState } from 'react';
import { createScene, updateScene, type SceneField, type SceneTemplate } from '../../../api/scenes';

const fieldTypes: SceneField['type'][] = ['rating', 'number', 'text', 'duration', 'image', 'location', 'people'];
const viewNames = { heatmap: '热力图', trend: '趋势', list: '列表', photo: '照片' } as const;
const triggerNames = { manual: '手动', focus: '专注', task_completed: '完成任务' } as const;

export default function SceneBuilderSheet({ scene, onClose, onSaved }: { scene?: SceneTemplate; onClose: () => void; onSaved: (scene: SceneTemplate) => void }) {
  const [name, setName] = useState(scene?.name ?? '');
  const [emoji, setEmoji] = useState(scene?.emoji ?? '✨');
  const [color, setColor] = useState(scene?.color ?? '#e8b8cb');
  const [description, setDescription] = useState(scene?.description ?? '');
  const [fields, setFields] = useState<SceneField[]>(scene?.fieldSchema ?? []);
  const [triggers, setTriggers] = useState(scene?.triggers ?? ['manual']);
  const [views, setViews] = useState<SceneTemplate['allowedViews']>(scene?.allowedViews ?? ['heatmap', 'list']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addField = () => setFields((current) => [...current, { id: `field_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`, key: `field_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`, label: '', type: 'text', required: false }]);
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

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={scene ? '编辑场景' : '创建场景'} className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-[30px] border border-[var(--sf-border)] bg-[var(--sf-bg)] p-5 pb-[calc(env(safe-area-inset-bottom)+24px)] text-[var(--sf-text-primary)] shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-xl font-black">{scene ? '编辑场景' : '创建场景'}</h2><button type="button" onClick={onClose} className="rounded-full bg-white px-3 py-2 text-xs">关闭</button></div>
      <p className="mt-2 text-xs text-[var(--sf-text-secondary)]">把记录方式保存为可复用模板，时间与照片仍保留原始记录。</p>
      <div className="mt-5 grid grid-cols-[5rem_1fr] gap-3">
        <label className="text-xs">图标<input aria-label="场景图标" value={emoji} maxLength={12} onChange={(event) => setEmoji(event.target.value)} className="mt-1 w-full rounded-xl bg-white p-3" /></label>
        <label className="text-xs">名称<input required value={name} maxLength={60} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl bg-white p-3" placeholder="例如：阅读" /></label>
      </div>
      <label className="mt-3 block text-xs">描述<textarea value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1 w-full rounded-xl bg-white p-3" /></label>
      <label className="mt-3 flex items-center gap-3 text-xs">主题色<input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-10 w-12" />{color}</label>
      <fieldset className="mt-5"><legend className="text-sm font-bold">触发方式</legend><div className="mt-2 flex flex-wrap gap-2">{Object.entries(triggerNames).map(([key, label]) => <label key={key} className="rounded-full border border-[var(--sf-border)] bg-white px-3 py-2 text-xs"><input type="checkbox" disabled={key === 'task_completed'} checked={triggers.includes(key)} onChange={() => setTriggers((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} className="mr-2 accent-[#94ba66]" />{label}{key === 'task_completed' ? ' · 即将支持' : ''}</label>)}</div><p className="mt-2 text-[11px] text-[var(--sf-text-secondary)]">自动关联 Focus 需在“我的 → 时间记录”选择此场景为默认场景。</p></fieldset>
      <fieldset className="mt-5"><legend className="text-sm font-bold">记录字段</legend><div className="mt-2 space-y-2">{fields.map((field, index) => <div key={field.id} className="grid grid-cols-[1fr_6rem_auto] gap-2 rounded-2xl bg-white p-3"><input aria-label={`字段 ${index + 1} 名称`} value={field.label} maxLength={50} placeholder="字段名称" onChange={(event) => setFields((current) => current.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} className="min-w-0 text-xs" /><select aria-label={`字段 ${index + 1} 类型`} value={field.type} onChange={(event) => setFields((current) => current.map((item, i) => i === index ? { ...item, type: event.target.value as SceneField['type'] } : item))} className="text-xs">{fieldTypes.map((type) => <option key={type}>{type}</option>)}</select><button type="button" aria-label={`删除字段 ${index + 1}`} onClick={() => setFields((current) => current.filter((_, i) => i !== index))} className="text-xs text-red-600">删除</button><label className="col-span-3 text-xs"><input type="checkbox" checked={field.required} onChange={(event) => setFields((current) => current.map((item, i) => i === index ? { ...item, required: event.target.checked } : item))} className="mr-2" />必填</label></div>)}</div><button type="button" onClick={addField} disabled={fields.length >= 20} className="mt-2 rounded-full bg-white px-3 py-2 text-xs">+ 添加字段</button></fieldset>
      <fieldset className="mt-5"><legend className="text-sm font-bold">允许视图</legend><div className="mt-2 flex flex-wrap gap-2">{Object.entries(viewNames).map(([key, label]) => <label key={key} className="rounded-full border border-[var(--sf-border)] bg-white px-3 py-2 text-xs"><input type="checkbox" checked={views.includes(key as keyof typeof viewNames)} onChange={() => setViews((current) => current.includes(key as keyof typeof viewNames) ? current.filter((item) => item !== key) : [...current, key as keyof typeof viewNames])} className="mr-2 accent-[#94ba66]" />{label}</label>)}</div></fieldset>
      {error ? <p role="alert" className="mt-4 text-xs text-red-600">{error}</p> : null}
      <button type="button" onClick={() => void save()} disabled={busy || !name.trim() || !triggers.length || !views.length} className="mt-6 w-full rounded-2xl bg-[var(--sf-graphite)] p-4 text-sm font-bold text-[var(--sf-green)] disabled:opacity-50">{busy ? '保存中…' : '保存场景'}</button>
    </section>
  </div>;
}
