import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Clock3, Image as ImageIcon, FileAudio, Loader2, Paperclip, Pencil, Tag, Trash2, Video, X } from 'lucide-react';
import {
  addInspirationAttachments, deleteInspirationAttachment, deleteInspiration, getInspiration, updateInspiration,
  type InspirationAttachment, type InspirationRecord,
} from '../../api/inspirations';
import InspirationAttachmentList from './InspirationAttachmentList';
import { useModalLifecycle } from '../ui/useModalLifecycle';
import TagSelector from '../tags/TagSelector';
import './records.css';

export default function InspirationDetailSheet({ record, onClose, onChanged }: {
  record: InspirationRecord | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  useModalLifecycle(Boolean(record), onClose, { isolateAppMain: true });
  if (!record) return null;
  return <InspirationDetailDialog key={record.id} record={record} onClose={onClose} onChanged={onChanged} />;
}

function InspirationDetailDialog({ record, onClose, onChanged }: {
  record: InspirationRecord;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [text, setText] = useState(record.contentText || record.description || '');
  const [title, setTitle] = useState(record.title || '');
  const [tags, setTags] = useState<string[]>(record.tags || []);
  const [attachments, setAttachments] = useState(record.attachments || []);
  const [editing, setEditing] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reflections, setReflections] = useState(record.reflections || []);
  useEffect(() => {
    let active = true;
    void getInspiration(record.id).then((detail) => { if (active) setReflections(detail.reflections || []); }).catch(() => {});
    return () => { active = false; };
  }, [record.id]);
  const fileRef = useRef<HTMLInputElement>(null);
  useModalLifecycle(tagOpen, () => setTagOpen(false));
  useModalLifecycle(mediaOpen, () => setMediaOpen(false));

  const save = async () => {
    if ((!text.trim() && !title.trim() && !attachments.length) || busy) return;
    setBusy(true); setError('');
    try {
      await updateInspiration(record.id, { contentText: text.trim(), title: title.trim(), tags });
      await onChanged();
      setEditing(false);
    } catch (err) { setError(err instanceof Error ? err.message : '保存失败'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy || !window.confirm('删除这条记录？回顾历史会一起删除，已转成的待办会保留。')) return;
    setBusy(true); setError('');
    try { await deleteInspiration(record.id); await onChanged(); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : '删除失败'); }
    finally { setBusy(false); }
  };
  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    if (files.length + attachments.length > 6 || files.some((file) => file.size > 25 * 1024 * 1024) ||
      files.reduce((sum, file) => sum + file.size, attachments.reduce((sum, item) => sum + item.sizeBytes, 0)) > 50 * 1024 * 1024) {
      setError('最多 6 个附件；单个不超过 25MB，总大小不超过 50MB。'); return;
    }
    setBusy(true); setError('');
    try { const updated = await addInspirationAttachments(record.id, files); setAttachments(updated.attachments || []); await onChanged(); }
    catch (err) { setError(err instanceof Error ? err.message : '添加附件失败'); }
    finally { setBusy(false); }
  };
  const removeAttachment = async (attachment: InspirationAttachment) => {
    if (busy || !window.confirm(`移除附件「${attachment.originalName || '未命名'}」？`)) return;
    setBusy(true); setError('');
    try { const updated = await deleteInspirationAttachment(record.id, attachment.id); setAttachments(updated.attachments || []); await onChanged(); }
    catch (err) { setError(err instanceof Error ? err.message : '移除附件失败'); }
    finally { setBusy(false); }
  };
  const chooseFile = (accept: string) => {
    setMediaOpen(false);
    if (!fileRef.current) return;
    fileRef.current.accept = accept;
    fileRef.current.click();
  };
  return createPortal(
    <div className="sf-detail-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="记录详情" className="sf-detail-sheet" onClick={(event) => event.stopPropagation()}>
        <header className="sf-detail-header"><button type="button" onClick={onClose} disabled={busy} className="sf-detail-back" aria-label="返回记录列表"><ArrowLeft size={20} /></button>
          <span>记录详情</span><button type="button" onClick={() => editing ? void save() : setEditing(true)} disabled={busy || (editing && !text.trim() && !title.trim() && !attachments.length)} className="sf-detail-header-action">{busy ? <Loader2 size={14} className="animate-spin" /> : editing ? <Check size={15} /> : <Pencil size={14} />}{editing ? '保存' : '编辑'}</button>
        </header>
        <div className="sf-detail-content">
          <p className="sf-detail-kicker"><i /> {new Date(record.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
          {editing ? <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="写下标题" className="sf-detail-title-input" aria-label="记录标题" /> : title && <h2 className="sf-detail-title">{title}</h2>}
          {editing ? <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="从这里开始记录……" className="sf-detail-text-input" aria-label="记录正文" /> : text && <p className="sf-detail-text">{text}</p>}
          {record.focusSession?.effectiveDurationSeconds ? <p className="sf-detail-focus"><Clock3 size={14} /> 本次专注 {Math.round(record.focusSession.effectiveDurationSeconds / 60)} 分钟</p> : null}
          {tags.length > 0 && <div className="sf-record-tags">{tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
          {attachments.length > 0 && <div className="sf-detail-media"><InspirationAttachmentList inspirationId={record.id} attachments={attachments} onCaptionSaved={(updated) => { setAttachments((current) => current.map((item) => item.id === updated.id ? updated : item)); void onChanged(); }} /></div>}
          {editing && attachments.length > 0 && <div className="sf-detail-attachment-removal">{attachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => void removeAttachment(attachment)} disabled={busy}><X size={13} /> 移除 {attachment.originalName || '附件'}</button>)}</div>}
          {reflections.length ? <section className="sf-detail-history"><h3>回顾历史 <span>{reflections.length} 次</span></h3>{reflections.slice(0, 8).map((reflection) => <div key={reflection.id}><time dateTime={reflection.createdAt}>{new Date(reflection.createdAt).toLocaleDateString('zh-CN')}</time><p>{reflection.body}</p></div>)}</section> : null}
          {error && <p role="alert" className="sf-note-error">{error}</p>}
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ''; void addFiles(files); }} />
        <footer className="sf-detail-footer">
          {editing ? <><button type="button" onClick={() => setTagOpen(true)}><Tag size={17} /> 标签</button><button type="button" onClick={() => setMediaOpen(true)} disabled={busy || attachments.length >= 6}><Paperclip size={17} /> 添加附件</button><button type="button" className="sf-detail-danger" onClick={() => void remove()} disabled={busy}><Trash2 size={17} /> 删除</button></> : <><span>原记录与回顾会一直保留</span><button type="button" onClick={() => setEditing(true)}><Pencil size={15} /> 编辑记录</button></>}
        </footer>
        {mediaOpen && <div className="sf-note-overlay" role="presentation"><button type="button" className="sf-note-overlay-dim" onClick={() => setMediaOpen(false)} aria-label="关闭附件选择" /><div role="dialog" aria-modal="true" aria-label="添加内容" className="sf-note-pick-sheet"><div className="sf-note-handle" /><header><div><strong>添加内容</strong><small>为这条记录留下一点细节</small></div><button type="button" onClick={() => setMediaOpen(false)} aria-label="关闭"><X size={16} /></button></header><div className="sf-note-pick-options"><button type="button" onClick={() => chooseFile('image/*')}><span className="sf-pick-icon sf-pick-photo"><ImageIcon size={20} /></span><span><strong>照片</strong><small>让这一刻看得见</small></span></button><button type="button" onClick={() => chooseFile('video/*')}><span className="sf-pick-icon sf-pick-video"><Video size={20} /></span><span><strong>视频</strong><small>记录正在发生的画面</small></span></button><button type="button" onClick={() => chooseFile('audio/*')}><span className="sf-pick-icon sf-pick-audio"><FileAudio size={20} /></span><span><strong>音频</strong><small>上传已有录音</small></span></button></div></div></div>}
        {tagOpen && <div className="sf-note-overlay" role="presentation"><button type="button" className="sf-note-overlay-dim" onClick={() => setTagOpen(false)} aria-label="关闭标签选择" /><div role="dialog" aria-modal="true" aria-label="选择标签" className="sf-note-pick-sheet sf-note-tag-sheet"><div className="sf-note-handle" /><header><div><strong>选择标签</strong><small>为记录整理一个线索</small></div><button type="button" onClick={() => setTagOpen(false)} aria-label="关闭"><X size={16} /></button></header><div className="sf-note-tag-content"><TagSelector value={tags} onChange={setTags} compact /></div><button type="button" className="sf-note-tag-done" onClick={() => setTagOpen(false)}>完成 · 已选 {tags.length}</button></div></div>}
      </section>
    </div>, document.body,
  );
}
