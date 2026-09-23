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
    <section className="overflow-hidden rounded-[var(--sf-radius-lg)] border border-[var(--sf-border)] bg-[var(--sf-surface)] shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 text-xs text-[var(--sf-text-tertiary)]"><span>{records.length} 条记录 · {reflectionCount} 条 Reflection</span><button type="button" onClick={onRefresh} className="flex items-center gap-1"><RefreshCw size={12} /> 刷新</button></div>
      {loading ? <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-4 text-sm text-[var(--sf-text-secondary)]">正在加载记录…</p> : null}
      {!loading && records.length === 0 ? <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-5 text-sm text-[var(--sf-text-secondary)]">还没有记录。想到什么就先写下来，不需要整理。</p> : null}
      {records.map((record) => (
        <article key={record.id} className="border-b border-[var(--sf-border)] bg-[var(--sf-surface)] px-4 py-5 last:border-b-0">
          <div className="mb-3 flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] text-[var(--sf-text-tertiary)]">{new Date(record.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · {recordSourceLabel(record)}</p><p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-[var(--sf-text-primary)]">{recordText(record)}</p></div><button type="button" onClick={() => onOpen(record)} className="shrink-0 rounded-full bg-[var(--sf-bg)] px-3 py-2 text-[10px] font-bold text-[var(--sf-text-secondary)]">查看</button></div>
          <InspirationAttachmentList inspirationId={record.id} attachments={record.attachments} />
          {record.tags?.length > 0 ? <div className="mb-3 flex flex-wrap gap-1.5">{record.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--sf-bg)] px-2 py-1 text-[10px] text-[var(--sf-text-secondary)]">#{tag}</span>)}</div> : null}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--sf-text-tertiary)]"><span>{record._count?.reflections || record.reflections?.length || 0} 次回顾</span>{record.task ? <span className="rounded-full bg-[#cae393]/60 px-2 py-1 text-[#242424]">已转待办 · {record.task.title}</span> : null}{record.nextReviewAt ? <span>下次候选 {new Date(record.nextReviewAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span> : null}</div>
        </article>
      ))}
    </section>
  );
}
