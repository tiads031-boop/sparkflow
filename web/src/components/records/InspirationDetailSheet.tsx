import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Save, Trash2, X, Plus } from 'lucide-react';
import {
  addInspirationAttachments,
  deleteInspirationAttachment,
  updateInspirationAttachmentCaption,
  type InspirationAttachment,
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
  const [title, setTitle] = useState(record.title || '');
  const [attachments, setAttachments] = useState(record.attachments || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if ((!text.trim() && !title.trim() && !attachments.length) || busy) return;
    setBusy(true);
    setError('');
    try {
      await updateInspiration(record.id, {
        contentText: text.trim(),
        title: title.trim(),
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
            <span className="text-xs font-bold text-[var(--sf-text-secondary)]">标题（可选）</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)}
              placeholder="给这段记录起个名字"
              className="mt-2 w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--sf-text-primary)]" />
          </label>
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

          <div>
            <div className="flex items-center justify-between">
              <strong className="text-xs text-[var(--sf-text-secondary)]">照片与附件 · {attachments.length}/6</strong>
              <label className={`flex items-center gap-1 rounded-full bg-[var(--sf-bg)] px-3 py-2 text-xs font-bold ${busy || attachments.length >= 6 ? 'pointer-events-none opacity-40' : 'cursor-pointer'}`}>
                <Plus size={13} /> 添加
                <input type="file" accept="image/*,video/*,audio/*" multiple className="sr-only" disabled={busy || attachments.length >= 6}
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = '';
                    if (!files.length) return;
                    if (files.length + attachments.length > 6 || files.some((file) => file.size > 25 * 1024 * 1024) ||
                      files.reduce((sum, file) => sum + file.size, attachments.reduce((sum, item) => sum + item.sizeBytes, 0)) > 50 * 1024 * 1024) {
                      setError('最多 6 个附件；单个不超过 25MB，总大小不超过 50MB。');
                      return;
                    }
                    setBusy(true); setError('');
                    void addInspirationAttachments(record.id, files).then(async (updated) => {
                      setAttachments(updated.attachments || []);
                      await onChanged();
                    }).catch((err: unknown) => setError(err instanceof Error ? err.message : '添加附件失败'))
                      .finally(() => setBusy(false));
                  }} />
              </label>
            </div>
            <InspirationAttachmentList inspirationId={record.id} attachments={attachments} />
            {attachments.length > 0 && <div className="mt-3 space-y-2">
              {attachments.map((attachment) => <div key={attachment.id} className="rounded-xl bg-[var(--sf-bg)] p-3">
                {attachment.kind === 'image' && <PhotoStoryEditor attachment={attachment} disabled={busy}
                  onSave={async (caption) => {
                    const updated = await updateInspirationAttachmentCaption(record.id, attachment.id, caption);
                    setAttachments((current) => current.map((item) => item.id === updated.id ? updated : item));
                    await onChanged();
                  }} />}
                <button type="button" disabled={busy}
                onClick={() => {
                  if (!window.confirm(`移除附件「${attachment.originalName || '未命名'}」？`)) return;
                  setBusy(true); setError('');
                  void deleteInspirationAttachment(record.id, attachment.id).then(async (updated) => {
                    setAttachments(updated.attachments || []);
                    await onChanged();
                  }).catch((err: unknown) => setError(err instanceof Error ? err.message : '移除失败'))
                    .finally(() => setBusy(false));
                }}
                className="mt-2 rounded-full bg-red-50 px-3 py-1.5 text-[10px] text-red-700 disabled:opacity-40">
                移除 {attachment.originalName || '附件'}
              </button></div>)}
            </div>}
          </div>

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
          <button type="button" disabled={busy || (!text.trim() && !title.trim() && !attachments.length)} onClick={() => void save()} className="flex items-center justify-center gap-2 rounded-full bg-[var(--sf-text-primary)] py-3 text-xs font-black text-[var(--sf-surface)] disabled:opacity-40">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} 保存
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function PhotoStoryEditor({ attachment, disabled, onSave }: {
  attachment: InspirationAttachment;
  disabled: boolean;
  onSave: (caption: string) => Promise<void>;
}) {
  const [caption, setCaption] = useState(attachment.caption || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return <div>
    <label className="block text-xs font-bold text-[var(--sf-text-secondary)]">
      {attachment.originalName || '照片'} · 这张照片的故事
      <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2000}
        placeholder="这一刻发生了什么？" disabled={disabled || saving}
        className="mt-2 min-h-16 w-full resize-y rounded-xl border border-[var(--sf-border)] bg-[var(--sf-surface)] p-3 text-xs font-normal outline-none" />
    </label>
    <button type="button" disabled={disabled || saving || caption.trim() === (attachment.caption || '')}
      onClick={() => { setSaving(true); setError(''); void onSave(caption).catch((err: unknown) =>
        setError(err instanceof Error ? err.message : '保存故事失败')).finally(() => setSaving(false)); }}
      className="rounded-full bg-[var(--sf-surface)] px-3 py-1.5 text-[10px] font-bold disabled:opacity-40">
      {saving ? '保存中…' : '保存这张照片的故事'}
    </button>
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </div>;
}
