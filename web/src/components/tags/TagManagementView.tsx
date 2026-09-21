import { useEffect, useMemo, useState } from 'react';
import { Archive, Check, Loader2, Pencil, Plus, RotateCcw, Tag as TagIcon, X } from 'lucide-react';
import { archiveTag, createTag, listTags, updateTag, type TagRecord } from '../../api/tags';
import { PageHeader, SectionCard, TagChip } from '../ui/foundation';

const COLORS = ['#cae393', '#b0a8db', '#8fc7bb', '#f1c97b', '#df9f9f', '#8fb5df'];

export default function TagManagementView({ onBack }: { onBack: () => void }) {
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [parentId, setParentId] = useState('');
  const [editing, setEditing] = useState<TagRecord | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try { setTags(await listTags(true)); }
    catch (err) { setError(err instanceof Error ? err.message : '读取标签失败'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    listTags(true)
      .then((items) => { if (active) setTags(items); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : '读取标签失败'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const active = useMemo(() => tags.filter((tag) => !tag.archived), [tags]);
  const roots = active.filter((tag) => !tag.parentId);
  const visible = tags.filter((tag) => showArchived || !tag.archived);
  const reset = () => { setName(''); setColor(COLORS[0]); setParentId(''); setEditing(null); };
  const startEdit = (tag: TagRecord) => { setEditing(tag); setName(tag.name); setColor(tag.color); setParentId(tag.parentId || ''); };

  const save = async () => {
    if (!name.trim() || busyId) return;
    setBusyId(editing?.id || 'new');
    setError('');
    try {
      if (editing) await updateTag(editing.id, { name, color, parentId: parentId || null });
      else await createTag({ name, color, parentId: parentId || null, sortOrder: active.length });
      reset();
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : '保存标签失败'); }
    finally { setBusyId(''); }
  };

  const toggleArchive = async (tag: TagRecord) => {
    setBusyId(tag.id);
    setError('');
    try {
      if (tag.archived) await updateTag(tag.id, { archived: false });
      else await archiveTag(tag.id);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : '更新标签失败'); }
    finally { setBusyId(''); }
  };

  return (
    <div className="animate-page-enter pb-24">
      <PageHeader title="标签管理" subtitle="标签用于横向检索和统计；文件夹与阶段保持独立。" onBack={onBack} />
      <SectionCard>
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#eef6dc]"><TagIcon size={16} /></span>
          <div><h2 className="text-sm font-black">{editing ? '编辑标签' : '新建标签'}</h2><p className="text-[10px] text-[var(--sf-text-tertiary)]">支持一级、二级、颜色与归档。</p></div>
        </div>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：六级、阅读、SparkFlow" className="w-full rounded-2xl bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none" />
        <div className="mt-3 flex flex-wrap gap-2">
          {COLORS.map((item) => <button key={item} type="button" onClick={() => setColor(item)} aria-label={`选择颜色 ${item}`} className={`relative grid h-8 w-8 place-items-center rounded-full border-2 ${color === item ? 'border-[var(--sf-text-primary)]' : 'border-transparent'}`}><span className="h-5 w-5 rounded-full" style={{ backgroundColor: item }} />{color === item && <Check size={10} className="absolute" />}</button>)}
        </div>
        <label className="mt-3 block"><span className="text-[10px] font-bold text-[var(--sf-text-tertiary)]">父级标签（可选）</span><select value={parentId} onChange={(event) => setParentId(event.target.value)} className="mt-1 w-full rounded-2xl bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none"><option value="">一级标签</option>{roots.filter((tag) => tag.id !== editing?.id).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
          {editing && <button type="button" onClick={reset} className="grid h-11 w-11 place-items-center rounded-full bg-[var(--sf-bg)]" aria-label="取消编辑"><X size={15} /></button>}
          <button type="button" onClick={() => void save()} disabled={!name.trim() || Boolean(busyId)} className="flex items-center justify-center gap-2 rounded-full bg-[var(--sf-text-primary)] py-3 text-xs font-black text-[var(--sf-surface)] disabled:opacity-35">{busyId === (editing?.id || 'new') ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{editing ? '保存修改' : '创建标签'}</button>
        </div>
      </SectionCard>

      <div className="mb-2 mt-5 flex items-center justify-between px-1"><h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">标签列表</h2><button type="button" onClick={() => setShowArchived((value) => !value)} className="text-[10px] font-bold text-[var(--sf-text-secondary)]">{showArchived ? '隐藏已归档' : '显示已归档'}</button></div>
      <SectionCard className="!p-2">
        {loading ? <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" /></div> : visible.length === 0 ? <p className="py-8 text-center text-xs text-[var(--sf-text-tertiary)]">还没有标签</p> : <div>{visible.map((tag) => { const parent = tags.find((item) => item.id === tag.parentId); return <div key={tag.id} className="flex items-center gap-2 border-b border-[var(--sf-divider)] px-2 py-3 last:border-0"><span className="min-w-0 flex-1"><TagChip name={tag.name} color={tag.color} muted={tag.archived} /><span className="ml-2 text-[9px] text-[var(--sf-text-tertiary)]">{parent ? `属于 #${parent.name}` : '一级'}{tag.archived ? ' · 已归档' : ''}</span></span><button type="button" onClick={() => startEdit(tag)} disabled={tag.archived} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sf-bg)] disabled:opacity-30" aria-label="编辑标签"><Pencil size={13} /></button><button type="button" onClick={() => void toggleArchive(tag)} disabled={busyId === tag.id} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sf-bg)]" aria-label={tag.archived ? '恢复标签' : '归档标签'}>{busyId === tag.id ? <Loader2 size={13} className="animate-spin" /> : tag.archived ? <RotateCcw size={13} /> : <Archive size={13} />}</button></div>; })}</div>}
      </SectionCard>
      {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
    </div>
  );
}
