import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Save, Trash2, X } from 'lucide-react';
import {
  deleteInspiration,
  updateInspiration,
  type InspirationRecord,
} from '../../api/inspirations';
import InspirationAttachmentList from './InspirationAttachmentList';
import { useModalLifecycle } from '../ui/useModalLifecycle';
import TagSelector from '../tags/TagSelector';

export default function InspirationDetailSheet({
  record,
  onClose,
  onChanged,
}: {
  record: InspirationRecord | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const open = Boolean(record);
  useModalLifecycle(open, onClose, { isolateAppMain: true });

  if (!record) return null;

  return (
    <InspirationDetailDialog
      key={record.id}
      record={record}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function InspirationDetailDialog({
  record,
  onClose,
  onChanged,
}: {
  record: InspirationRecord;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [text, setText] = useState(
    () => record.contentText || record.description || record.title || '',
  );
  const [tags, setTags] = useState<string[]>(() => record.tags);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await updateInspiration(record.id, {
        contentText: text.trim(),
        tags,
      });
      await onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !window.confirm('删除这条记录？Reflection 会一起删除，已转成的待办会保留并断开来源。')) return;
    setBusy(true);
    setError('');
    try {
      await deleteInspiration(record.id);
      await onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/30" role="presentation" onClick={() => !busy && onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="记录详情"
        className="flex max-h-[min(92dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] bg-[var(--sf-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--sf-border)]" aria-hidden="true" />
        <header className="flex shrink-0 items-center justify-between px-5 pb-4 pt-3">
          <div>
            <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--sf-accent)]">Record</p>
            <h2 className="text-base font-black text-[var(--sf-text-primary)]">记录详情</h2>
            <p className="mt-0.5 text-[10px] text-[var(--sf-text-tertiary)]">
              {new Date(record.createdAt).toLocaleString('zh-CN')}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="关闭" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sf-bg)] disabled:opacity-40">
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain border-t border-[var(--sf-divider)] px-5 py-4">
          <label className="block">
            <span className="text-xs font-bold text-[var(--sf-text-secondary)]">内容</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="mt-2 min-h-36 w-full resize-none rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--sf-text-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--sf-accent)_28%,transparent)]"
            />
          </label>

          <div className="rounded-2xl border border-[var(--sf-border)] p-3">
            <TagSelector value={tags} onChange={setTags} compact />
          </div>

          <InspirationAttachmentList inspirationId={record.id} attachments={record.attachments} />

          {record.reflections?.length ? (
            <div className="rounded-2xl bg-[var(--sf-bg)] p-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sf-text-tertiary)]">Reflection</p>
              <div className="space-y-2">
                {record.reflections.slice(0, 8).map((reflection) => (
                  <p key={reflection.id} className="text-xs leading-5 text-[var(--sf-text-secondary)]">
                    {new Date(reflection.createdAt).toLocaleDateString('zh-CN')} · {reflection.body}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
        </div>

        <footer className="grid shrink-0 grid-cols-[auto_1fr] gap-2 border-t border-[var(--sf-divider)] bg-[var(--sf-surface)] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3">
          <button type="button" disabled={busy} onClick={() => void remove()} className="flex items-center justify-center gap-1.5 rounded-full bg-red-50 px-4 py-3 text-xs font-bold text-red-700 disabled:opacity-40">
            <Trash2 size={13} /> 删除
          </button>
          <button type="button" disabled={busy || !text.trim()} onClick={() => void save()} className="flex items-center justify-center gap-2 rounded-full bg-[var(--sf-text-primary)] py-3 text-xs font-black text-[var(--sf-surface)] disabled:opacity-40">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 保存
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
