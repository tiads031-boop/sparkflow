import { RefreshCw } from 'lucide-react';
import type { InspirationRecord } from '../../api/inspirations';
import InspirationAttachmentList from './InspirationAttachmentList';
import { recordSourceLabel, recordText } from './recordPresentation';

export default function RecordCardsView({ records, loading, onOpen, onRefresh }: {
  records: InspirationRecord[];
  loading: boolean;
  onOpen: (record: InspirationRecord) => void;
  onRefresh: () => void;
}) {
  const reflectionCount = records.reduce((total, record) => total + (record._count?.reflections || record.reflections?.length || 0), 0);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1 py-1 text-xs text-[var(--sf-text-tertiary)]"><span>{records.length} 条记录 · {reflectionCount} 次回顾</span><button type="button" onClick={onRefresh} className="flex items-center gap-1"><RefreshCw size={12} /> 刷新</button></div>
      {loading ? <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-4 text-sm text-[var(--sf-text-secondary)]">正在加载记录…</p> : null}
      {!loading && records.length === 0 ? <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-5 text-sm text-[var(--sf-text-secondary)]">还没有记录。想到什么就先写下来，不需要整理。</p> : null}
      {records.map((record) => (
        <article key={record.id} className="min-w-0 overflow-hidden rounded-[28px] border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-[0_16px_40px_rgba(31,37,34,0.06)]">
          <div className="h-1 bg-gradient-to-r from-[#cae393] via-[#b8d4ee] to-[#e5e2f3]" />
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <time dateTime={record.createdAt} className="text-[10px] font-bold tracking-wide text-[var(--sf-text-tertiary)]">{new Date(record.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
              <span className="rounded-full bg-[var(--sf-bg)] px-2.5 py-1 text-[10px] font-semibold text-[var(--sf-text-secondary)]">{recordSourceLabel(record)}</span>
            </div>
            {record.contentText || record.description || record.title || !record.attachments?.some((attachment) => attachment.kind === 'image') ? <p className="mt-3 whitespace-pre-wrap break-words text-[15px] font-bold leading-6 text-[var(--sf-text-primary)]">{recordText(record)}</p> : null}
            {record.attachments?.length ? <div className="mt-3"><InspirationAttachmentList inspirationId={record.id} attachments={record.attachments} variant="card" /></div> : null}
            {record.tags?.length > 0 ? <div className="mt-3 flex flex-wrap gap-1.5">{record.tags.map((tag) => <span key={tag} className="rounded-full bg-[#eef3e7] px-2.5 py-1 text-[10px] font-semibold text-[#536a42]">#{tag}</span>)}</div> : null}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--sf-divider)] pt-3">
              <div className="min-w-0 text-[10px] text-[var(--sf-text-tertiary)]">{record.task ? <span className="block truncate">已转待办 · {record.task.title}</span> : <span>{record._count?.reflections || record.reflections?.length || 0} 次回顾{record.nextReviewAt ? ` · 下次 ${new Date(record.nextReviewAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}` : ''}</span>}</div>
              <button type="button" onClick={() => onOpen(record)} className="shrink-0 rounded-full bg-[var(--sf-graphite)] px-3 py-1.5 text-[10px] font-bold text-white">查看记录 →</button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
