import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { createTag, listTags, type TagRecord } from '../../api/tags';
import { TagChip } from '../ui/foundation';

const DEFAULT_COLORS = ['#cae393', '#b0a8db', '#8fc7bb', '#f1c97b', '#df9f9f'];

export default function TagSelector({ value, onChange, label = '标签', compact = false }: {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  compact?: boolean;
}) {
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listTags()
      .then((items) => { if (active) setTags(items); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : '读取标签失败'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selected = useMemo(() => new Set(value), [value]);
  const toggle = (name: string) => {
    onChange(selected.has(name) ? value.filter((item) => item !== name) : [...value, name].slice(0, 30));
  };
  const add = async () => {
    const name = newName.replace(/^#+/, '').trim();
    if (!name || busy) return;
    const existing = tags.find((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) {
      if (!selected.has(existing.name)) onChange([...value, existing.name].slice(0, 30));
      setNewName('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await createTag({ name, color: DEFAULT_COLORS[tags.length % DEFAULT_COLORS.length], sortOrder: tags.length });
      setTags((current) => [...current, created]);
      onChange([...value, created.name].slice(0, 30));
      setNewName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建标签失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[var(--sf-text-secondary)]">{label}</span>
        {loading && <Loader2 size={12} className="animate-spin text-[var(--sf-text-tertiary)]" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => <TagChip key={tag.id} name={tag.name} color={tag.color} selected={selected.has(tag.name)} muted={!selected.has(tag.name)} onClick={() => toggle(tag.name)} />)}
        {!loading && tags.length === 0 && <span className="text-[10px] text-[var(--sf-text-tertiary)]">还没有标签，可在这里直接创建。</span>}
      </div>
      <div className={`mt-2 flex gap-2 ${compact ? '' : 'max-w-sm'}`}>
        <input value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void add(); } }} placeholder="新标签名称" className="min-w-0 flex-1 rounded-full border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2 text-xs outline-none focus:border-[var(--sf-text-primary)]" />
        <button type="button" onClick={() => void add()} disabled={!newName.trim() || busy} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--sf-text-primary)] text-[var(--sf-surface)] disabled:opacity-35" aria-label="创建标签">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        </button>
      </div>
      {error && <p className="mt-2 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
