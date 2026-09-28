import { useState } from 'react';
import { ArrowUpRight, Clock3, RefreshCw } from 'lucide-react';
import type { InspirationRecord } from '../../api/inspirations';
import InspirationAttachmentList from './InspirationAttachmentList';
import { recordSourceLabel, recordText } from './recordPresentation';

export default function RecordCardsView({ records, loading, onOpen, onRefresh }: {
  records: InspirationRecord[];
  loading: boolean;
  onOpen: (record: InspirationRecord) => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const reflectionCount = records.reduce((total, record) => total + (record._count?.reflections || record.reflections?.length || 0), 0);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1 py-1 text-xs text-[var(--sf-text-tertiary)]">
        <span>{records.length} 条记录 · {reflectionCount} 次回顾</span>
        <button type="button" onClick={onRefresh} className="flex items-center gap-1 rounded-full px-2 py-1.5 hover:bg-white" aria-label="刷新记录"><RefreshCw size={13} /> 刷新</button>
      </div>
      {loading ? <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-4 text-sm text-[var(--sf-text-secondary)]">正在加载记录…</p> : null}
      {!loading && records.length === 0 ? <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-5 text-sm text-[var(--sf-text-secondary)]">还没有记录。想到什么就先写下来，不需要整理。</p> : null}
      {records.map((record) => {
        const body = record.contentText || record.description || (!record.title ? recordText(record) : '');
        const isExpanded = expanded.includes(record.id);
        const hasLongText = body.length > 140 || body.split('\n').length > 5;
        return <article key={record.id} className="sf-record-card">
          <div className="sf-record-accent" />
          <div className="sf-record-inner">
            <div className="sf-record-meta">
              <time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
              <span className="sf-record-source">{recordSourceLabel(record)}</span>
            </div>
            {record.title && <h3 className="sf-record-title">{record.title}</h3>}
            {body && <div className="sf-record-reading">
              <p className={isExpanded ? '' : 'sf-record-clamped'}>{body}</p>
              {hasLongText && <button type="button" onClick={() => setExpanded((current) => isExpanded ? current.filter((id) => id !== record.id) : [...current, record.id])}>{isExpanded ? '收起正文' : '展开全文'}</button>}
            </div>}
            {record.focusSession?.effectiveDurationSeconds ? <span className="sf-focus-duration"><Clock3 size={13} /> 专注 {Math.round(record.focusSession.effectiveDurationSeconds / 60)} 分钟</span> : null}
            {record.attachments?.length ? <InspirationAttachmentList inspirationId={record.id} attachments={record.attachments} variant="card" onCaptionSaved={onRefresh} /> : null}
            {record.tags?.length > 0 ? <div className="sf-record-tags">{record.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
            <div className="sf-record-footer">
              <span>{record.task ? `已转待办 · ${record.task.title}` : `${record._count?.reflections || record.reflections?.length || 0} 次回顾${record.nextReviewAt ? ` · 下次 ${new Date(record.nextReviewAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}` : ''}`}</span>
              <button type="button" onClick={() => onOpen(record)}>查看记录 <ArrowUpRight size={14} /></button>
            </div>
          </div>
        </article>;
      })}
    </section>
  );
}
