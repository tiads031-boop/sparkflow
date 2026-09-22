import { ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import type { InspirationRecord, TodayReviewBatch } from '../../api/inspirations';
import InspirationAttachmentList from './InspirationAttachmentList';
import { recordText } from './recordPresentation';

export default function ReviewWorkspace({ batch, currentReview, reviewText, busy, onReviewTextChange, onLoadMore, onSaveReflection, onFinish, onConvertToTask }: {
  batch: TodayReviewBatch;
  currentReview?: InspirationRecord;
  reviewText: string;
  busy: boolean;
  onReviewTextChange: (value: string) => void;
  onLoadMore: () => void;
  onSaveReflection: () => void;
  onFinish: (action: 'later' | 'digested') => void;
  onConvertToTask: () => void;
}) {
  if (!currentReview) {
    return <section className="rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-6 text-center"><CheckCircle2 className="mx-auto mb-3 text-[var(--sf-text-secondary)]" size={30} /><h2 className="text-base font-bold">今天这批回顾完成了</h2><p className="mt-1 text-xs text-[var(--sf-text-tertiary)]">今日已固定抽取 {batch.total} 张；同一账号在其他设备会看到同一批和同一进度。</p><button type="button" disabled={busy} onClick={onLoadMore} className="mt-4 rounded-full bg-[var(--sf-graphite)] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40">再抽 3 张</button></section>;
  }
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between text-xs text-[var(--sf-text-tertiary)]"><span>今日批次 {batch.total} 张 · 待回顾 {batch.pending} 张</span><span>{new Date(currentReview.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</span></div>
      <article className="rounded-[2rem] bg-[#f2f0e8] p-6 shadow-sm"><Clock3 size={15} className="mb-4 opacity-40" /><p className="whitespace-pre-wrap text-base font-medium leading-7 text-[#242424]">{recordText(currentReview)}</p><InspirationAttachmentList inspirationId={currentReview.id} attachments={currentReview.attachments} />{currentReview.reflections?.length ? <div className="mt-5 border-t border-black/10 pt-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-black/40">之前的想法</p>{currentReview.reflections.slice(0, 3).map((reflection) => <p key={reflection.id} className="mb-2 text-xs leading-5 text-black/60">{new Date(reflection.createdAt).toLocaleDateString('zh-CN')} · {reflection.body}</p>)}</div> : null}</article>
      <textarea value={reviewText} onChange={(event) => onReviewTextChange(event.target.value)} placeholder="现在再看这条记录，你有什么新的理解？" className="min-h-28 w-full resize-none rounded-[var(--sf-radius-md)] border border-[var(--sf-border)] bg-[var(--sf-surface)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--sf-text-primary)]" />
      <button type="button" disabled={!reviewText.trim() || busy} onClick={onSaveReflection} className="w-full rounded-full bg-[var(--sf-graphite)] py-3 text-sm font-bold text-white disabled:opacity-40">保存 Reflection</button>
      <div className="grid grid-cols-3 gap-2"><button type="button" disabled={busy} onClick={() => onFinish('later')} className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-2 py-3 text-xs font-semibold">稍后再看</button><button type="button" disabled={busy} onClick={() => onFinish('digested')} className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-2 py-3 text-xs font-semibold">已消化</button><button type="button" disabled={busy} onClick={onConvertToTask} className="flex items-center justify-center gap-1 rounded-2xl bg-[#cae393] px-2 py-3 text-xs font-bold text-[#242424]">转待办 <ArrowRight size={12} /></button></div>
    </section>
  );
}
