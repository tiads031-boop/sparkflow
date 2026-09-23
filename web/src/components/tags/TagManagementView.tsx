import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Check,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Tag as TagIcon,
  X,
} from 'lucide-react';
import { archiveTag, createTag, listTags, updateTag, type TagRecord } from '../../api/tags';
import { PageHeader, SectionCard } from '../ui/foundation';

const COLORS = ['#cae393', '#b0a8db', '#8fc7bb', '#f1c97b', '#df9f9f', '#8fb5df'];

function TagListRow({
  tag,
  parent,
  childCount,
  busy,
  onEdit,
  onToggleArchive,
}: {
  tag: TagRecord;
  parent?: TagRecord;
  childCount: number;
  busy: boolean;
  onEdit: (tag: TagRecord) => void;
  onToggleArchive: (tag: TagRecord) => void;
}) {
  const detail = parent
    ? `属于 #${parent.name}`
    : childCount > 0
      ? `${childCount} 个子标签`
      : '一级标签';

  return (
    <div className={`flex items-center gap-3 border-b border-[var(--sf-divider)] px-3 py-3 last:border-0 ${parent ? 'pl-7' : ''}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-[var(--sf-bg)] text-sm font-black text-[var(--sf-text-secondary)]">{parent ? '↳' : '#'}</span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[11px] text-[var(--sf-text-primary)]">{tag.name}</strong>
        <span className="block truncate text-[9px] text-[var(--sf-text-tertiary)]">{detail}{tag.archived ? ' · 已归档' : ''}</span>
      </span>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} aria-hidden="true" />
      <button
        type="button"
        onClick={() => onEdit(tag)}
        disabled={tag.archived}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--sf-bg)] disabled:opacity-30"
        aria-label={`编辑标签 ${tag.name}`}
      >
        <Pencil size={13} />
      </button>
      <button
        type="button"
        onClick={() => onToggleArchive(tag)}
        disabled={busy}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--sf-bg)] disabled:opacity-40"
        aria-label={tag.archived ? `恢复标签 ${tag.name}` : `归档标签 ${tag.name}`}
      >
        {busy
          ? <Loader2 size={13} className="animate-spin" />
          : tag.archived ? <RotateCcw size={13} /> : <Archive size={13} />}
      </button>
    </div>
  );
}

export default function TagManagementView({ onBack }: { onBack: () => void }) {
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [parentId, setParentId] = useState('');
  const [editing, setEditing] = useState<TagRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      setTags(await listTags(true));
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取标签失败');
    } finally {
      setLoading(false);
    }
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
  const roots = useMemo(() => active.filter((tag) => !tag.parentId), [active]);
  const visible = useMemo(() => {
    const candidates = tags.filter((tag) => showArchived || !tag.archived);
    const rootTags = candidates.filter((tag) => !tag.parentId);
    const ordered = rootTags.flatMap((root) => [
      root,
      ...candidates.filter((tag) => tag.parentId === root.id),
    ]);
    const orderedIds = new Set(ordered.map((tag) => tag.id));
    return [...ordered, ...candidates.filter((tag) => !orderedIds.has(tag.id))];
  }, [showArchived, tags]);

  const reset = () => {
    setName('');
    setColor(COLORS[0]);
    setParentId('');
    setEditing(null);
    setEditorOpen(false);
  };

  const startEdit = (tag: TagRecord) => {
    setEditing(tag);
    setEditorOpen(true);
    setName(tag.name);
    setColor(tag.color);
    setParentId(tag.parentId || '');
  };

  const save = async () => {
    if (!name.trim() || busyId) return;
    setBusyId(editing?.id || 'new');
    setError('');
    try {
      if (editing) await updateTag(editing.id, { name, color, parentId: parentId || null });
      else await createTag({ name, color, parentId: parentId || null, sortOrder: active.length });
      reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存标签失败');
    } finally {
      setBusyId('');
    }
  };

  const toggleArchive = async (tag: TagRecord) => {
    setBusyId(tag.id);
    setError('');
    try {
      if (tag.archived) await updateTag(tag.id, { archived: false });
      else await archiveTag(tag.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新标签失败');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="animate-page-enter pb-24">
      <PageHeader title="标签管理" subtitle="分类、颜色、层级与归档" onBack={onBack} action={<button type="button" onClick={() => { reset(); setEditorOpen(true); }} className="shrink-0 rounded-full bg-[var(--sf-green)] px-3 py-2 text-[10px] font-black text-[var(--sf-text-primary)]"><Plus size={13} className="mr-1 inline" />新建</button>} />

      {editorOpen && <SectionCard className="mb-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eef6dc] text-[#40551d]"><TagIcon size={17} /></span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--sf-accent)]">Taxonomy</p>
            <h2 className="text-sm font-black">{editing ? '编辑标签' : '新建标签'}</h2>
          </div>
        </div>

        <label className="block">
          <span className="sr-only">标签名称</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：六级、阅读、SparkFlow"
            className="w-full rounded-2xl border border-transparent bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--sf-accent)]"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2" aria-label="标签颜色">
          {COLORS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setColor(item)}
              aria-label={`选择颜色 ${item}`}
              aria-pressed={color === item}
              className={`relative grid h-8 w-8 place-items-center rounded-full border-2 ${color === item ? 'border-[var(--sf-text-primary)]' : 'border-transparent'}`}
            >
              <span className="h-5 w-5 rounded-full" style={{ backgroundColor: item }} />
              {color === item && <Check size={10} className="absolute" />}
            </button>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="text-[10px] font-bold text-[var(--sf-text-tertiary)]">父级标签（可选）</span>
          <select
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            className="mt-1 w-full rounded-2xl bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--sf-accent)_30%,transparent)]"
          >
            <option value="">一级标签</option>
            {roots.filter((tag) => tag.id !== editing?.id).map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
        </label>

        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
          {editing && (
            <button type="button" onClick={reset} className="grid h-11 w-11 place-items-center rounded-full bg-[var(--sf-bg)]" aria-label="取消编辑">
              <X size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={!name.trim() || Boolean(busyId)}
            className="flex items-center justify-center gap-2 rounded-full bg-[var(--sf-text-primary)] py-3 text-xs font-black text-[var(--sf-surface)] disabled:opacity-35"
          >
            {busyId === (editing?.id || 'new') ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {editing ? '保存修改' : '创建标签'}
          </button>
        </div>
      </SectionCard>}

      <div className="mb-2 mt-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Layers3 size={13} className="text-[var(--sf-text-tertiary)]" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">标签层级</h2>
        </div>
        <button type="button" onClick={() => setShowArchived((value) => !value)} className="text-[10px] font-bold text-[var(--sf-text-secondary)]">
          {showArchived ? '隐藏已归档' : '显示已归档'}
        </button>
      </div>

      <SectionCard className="!p-2">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" /></div>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-xs text-[var(--sf-text-tertiary)]">还没有标签</p>
        ) : (
          <div>
            {visible.map((tag) => {
              const parent = tags.find((item) => item.id === tag.parentId);
              const childCount = tags.filter((item) => item.parentId === tag.id && !item.archived).length;
              return (
                <TagListRow
                  key={tag.id}
                  tag={tag}
                  parent={parent}
                  childCount={childCount}
                  busy={busyId === tag.id}
                  onEdit={startEdit}
                  onToggleArchive={(item) => void toggleArchive(item)}
                />
              );
            })}
          </div>
        )}
      </SectionCard>

      {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
    </div>
  );
}
