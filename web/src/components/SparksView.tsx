import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  LayoutGrid,
  List,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { Spark } from '../store/appStore';
import { useAppStore } from '../store/appStore';
import {
  createTaskFromInspiration,
  extendTodayReviewBatch,
  getTodayReviewBatch,
  listInspirations,
  processReviewBatchItem,
  type InspirationRecord,
  type TodayReviewBatch,
} from '../api/inspirations';
import { InsightPanel } from './insights/InsightPanel';
import InspirationAttachmentList from './records/InspirationAttachmentList';
import InspirationWall from './records/InspirationWall';
import InspirationDetailSheet from './records/InspirationDetailSheet';

interface SparksViewProps {
  sparks: Spark[];
  setSparks: (sparks: Spark[]) => void;
  onSparkClick: (spark: Spark) => void;
  onAddClick: () => void;
}

type RecordViewMode = 'cards' | 'wall';
type RecordPanel = 'review' | 'insights' | null;

function recordText(record: InspirationRecord) {
  if (record.contentText || record.description || record.title) {
    return record.contentText || record.description || record.title || '未命名记录';
  }
  const attachments = record.attachments || [];
  if (!attachments.length) return '未命名记录';
  const imageCount = attachments.filter((item) => item.kind === 'image').length;
  const audioCount = attachments.filter((item) => item.kind === 'audio').length;
  const videoCount = attachments.filter((item) => item.kind === 'video').length;
  return [
    imageCount ? `${imageCount} 张图片` : null,
    audioCount ? `${audioCount} 段语音/音频` : null,
    videoCount ? `${videoCount} 个视频` : null,
  ].filter(Boolean).join(' · ');
}

function sourceLabel(record: InspirationRecord) {
  return record.sourceType === 'manual' ? '手动记录' : record.sourceType || '记录';
}

export default function SparksView(_props: SparksViewProps) {
  const loadTasks = useAppStore((state) => state.loadTasks);
  const [mode, setMode] = useState<RecordViewMode>('cards');
  const [panel, setPanel] = useState<RecordPanel>(null);
  const [selectedRecord, setSelectedRecord] = useState<InspirationRecord | null>(null);
  const [records, setRecords] = useState<InspirationRecord[]>([]);
  const [reviewBatch, setReviewBatch] = useState<TodayReviewBatch>({ id: '', localDate: '', timeZone: 'UTC', total: 0, pending: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      setError(null);
      const data = await listInspirations();
      setRecords(data);
    } catch (err: any) {
      setError(err?.message || '记录加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReviews = useCallback(async () => {
    try {
      const data = await getTodayReviewBatch();
      setReviewBatch(data);
    } catch (err: any) {
      setError(err?.message || '回顾列表加载失败');
    }
  }, []);

  const loadMoreReviews = useCallback(async () => {
    try {
      setReviewBusy(true);
      const data = await extendTodayReviewBatch();
      setReviewBatch(data);
    } catch (err: any) {
      setError(err?.message || '追加回顾失败');
    } finally {
      setReviewBusy(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
    loadReviews();
  }, [loadRecords, loadReviews]);

  useEffect(() => {
    const refresh = () => {
      loadRecords();
      loadReviews();
    };
    const startReview = () => {
      setPanel('review');
      loadReviews();
    };
    window.addEventListener('sparkflow:records-changed', refresh);
    window.addEventListener('sparkflow:start-review', startReview);
    return () => {
      window.removeEventListener('sparkflow:records-changed', refresh);
      window.removeEventListener('sparkflow:start-review', startReview);
    };
  }, [loadRecords, loadReviews]);

  const currentReviewItem = reviewBatch.items.find((item) => item.state === 'pending');
  const currentReview = currentReviewItem?.inspiration;
  const reflectionCount = useMemo(
    () => records.reduce((total, record) => total + (record._count?.reflections || record.reflections?.length || 0), 0),
    [records],
  );

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([loadRecords(), loadReviews()]);
  };

  const finishReviewAction = async (action: 'later' | 'digested') => {
    if (!currentReview || reviewBusy) return;
    setReviewBusy(true);
    try {
      await processReviewBatchItem(currentReviewItem!.id, action, { requestId: crypto.randomUUID() });
      setReviewText('');
      setMessage(action === 'later' ? '明天再看看这条记录。' : '已消化，14 天后才会重新进入候选。');
      await Promise.all([loadReviews(), loadRecords()]);
    } catch (err: any) {
      setError(err?.message || '回顾操作失败');
    } finally {
      setReviewBusy(false);
    }
  };

  const saveReflection = async () => {
    if (!currentReview || !reviewText.trim() || reviewBusy) return;
    setReviewBusy(true);
    try {
      await processReviewBatchItem(currentReviewItem!.id, 'reflection', {
        requestId: crypto.randomUUID(),
        body: reviewText.trim(),
      });
      setReviewText('');
      setMessage('新的理解已作为 Reflection 保存，不会覆盖原记录。');
      await Promise.all([loadReviews(), loadRecords()]);
    } catch (err: any) {
      setError(err?.message || 'Reflection 保存失败');
    } finally {
      setReviewBusy(false);
    }
  };

  const convertCurrentToTask = async () => {
    if (!currentReview || reviewBusy) return;
    setReviewBusy(true);
    try {
      const task = await createTaskFromInspiration(currentReview.id);
      await processReviewBatchItem(currentReviewItem!.id, 'digested', { requestId: crypto.randomUUID() });
      await loadTasks();
      setMessage(`已创建待办「${task.title}」，来源记录已保留。`);
      setReviewText('');
      await Promise.all([loadReviews(), loadRecords()]);
    } catch (err: any) {
      setError(err?.message || '转待办失败');
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="animate-page-enter space-y-4 pb-6">
      <header>
        <h1 className="text-xl font-bold text-[var(--sf-text-primary)]">记录</h1>
        <p className="mt-1 text-xs text-[var(--sf-text-tertiary)]">随手记下来，之后再想清楚。</p>
      </header>

      {panel ? (
        <div className="flex items-center justify-between rounded-2xl bg-[var(--sf-surface)] px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={() => setPanel(null)}
            className="flex items-center gap-1 rounded-full bg-[var(--sf-bg)] px-3 py-2 text-[11px] font-bold"
          >
            <ChevronLeft size={13} /> 返回记录
          </button>
          <strong className="text-xs text-[var(--sf-text-primary)]">
            {panel === 'review' ? '每日回顾' : '周期洞察'}
          </strong>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 rounded-full bg-[var(--sf-surface)] p-1 shadow-sm" aria-label="记录视图">
            <button type="button" onClick={() => setMode('cards')} className={`flex items-center justify-center gap-1 rounded-full py-2 text-[11px] font-semibold ${mode === 'cards' ? 'bg-[var(--sf-text-primary)] text-[var(--sf-surface)]' : 'text-[var(--sf-text-secondary)]'}`}><List size={12} /> 卡片</button>
            <button type="button" onClick={() => setMode('wall')} className={`flex items-center justify-center gap-1 rounded-full py-2 text-[11px] font-semibold ${mode === 'wall' ? 'bg-[var(--sf-text-primary)] text-[var(--sf-surface)]' : 'text-[var(--sf-text-secondary)]'}`}><LayoutGrid size={12} /> 自由墙</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setPanel('review'); void loadReviews(); }}
              className="flex items-center justify-between rounded-2xl bg-[var(--sf-surface)] px-4 py-3 text-left shadow-sm"
            >
              <span>
                <strong className="block text-xs">每日回顾</strong>
                <span className="mt-0.5 block text-[10px] text-[var(--sf-text-tertiary)]">固定抽取 · 跨端同步</span>
              </span>
              {reviewBatch.pending > 0 && <span className="rounded-full bg-[#cae393] px-2 py-1 text-[10px] font-black text-[#242424]">{reviewBatch.pending}</span>}
            </button>
            <button
              type="button"
              onClick={() => setPanel('insights')}
              className="flex items-center justify-between rounded-2xl bg-[var(--sf-surface)] px-4 py-3 text-left shadow-sm"
            >
              <span>
                <strong className="block text-xs">周期洞察</strong>
                <span className="mt-0.5 block text-[10px] text-[var(--sf-text-tertiary)]">回看变化与行动</span>
              </span>
              <Sparkles size={14} className="text-[var(--sf-marker-purple)]" />
            </button>
          </div>
        </>
      )}

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
      {message && <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-4 py-3 text-xs text-[var(--sf-text-secondary)]">{message}</div>}

      {!panel && mode === 'cards' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[var(--sf-text-tertiary)]">
            <span>{records.length} 条记录 · {reflectionCount} 条 Reflection</span>
            <button type="button" onClick={refreshAll} className="flex items-center gap-1"><RefreshCw size={12} /> 刷新</button>
          </div>
          {loading && <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-4 text-sm text-[var(--sf-text-secondary)]">正在加载记录…</p>}
          {!loading && records.length === 0 && <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-5 text-sm text-[var(--sf-text-secondary)]">还没有记录。想到什么就先写下来，不需要整理。</p>}
          {records.map((record) => (
            <article key={record.id} className="rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-[var(--sf-text-tertiary)]">{new Date(record.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · {sourceLabel(record)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-[var(--sf-text-primary)]">{recordText(record)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(record)}
                  className="shrink-0 rounded-full bg-[var(--sf-bg)] px-3 py-2 text-[10px] font-bold text-[var(--sf-text-secondary)]"
                >
                  查看
                </button>
              </div>
              <InspirationAttachmentList
                inspirationId={record.id}
                attachments={record.attachments}
              />
              {record.tags?.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{record.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--sf-bg)] px-2 py-1 text-[10px] text-[var(--sf-text-secondary)]">#{tag}</span>)}</div>}
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--sf-text-tertiary)]">
                <span>{record._count?.reflections || record.reflections?.length || 0} 次回顾</span>
                {record.task && <span className="rounded-full bg-[#cae393]/60 px-2 py-1 text-[#242424]">已转待办 · {record.task.title}</span>}
                {record.nextReviewAt && <span>下次候选 {new Date(record.nextReviewAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</span>}
              </div>
            </article>
          ))}
        </section>
      )}

      {panel === 'insights' && <InsightPanel recordCount={records.length} />}

      {!panel && mode === 'wall' && (
        records.length === 0 ? (
          <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-5 text-sm text-[var(--sf-text-secondary)]">自由墙会使用同一份记录数据，不维护第二套正文。</p>
        ) : (
          <InspirationWall records={records} onOpen={setSelectedRecord} />
        )
      )}

      {panel === 'review' && (
        <section className="space-y-4">
          {!currentReview ? (
            <div className="rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 text-[var(--sf-text-secondary)]" size={30} />
              <h2 className="text-base font-bold">今天这批回顾完成了</h2>
              <p className="mt-1 text-xs text-[var(--sf-text-tertiary)]">
                今日已固定抽取 {reviewBatch.total} 张；同一账号在其他设备会看到同一批和同一进度。
              </p>
              <button
                type="button"
                disabled={reviewBusy}
                onClick={() => void loadMoreReviews()}
                className="mt-4 rounded-full bg-[var(--sf-text-primary)] px-5 py-2.5 text-xs font-bold text-[var(--sf-surface)] disabled:opacity-40"
              >
                再抽 3 张
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-[var(--sf-text-tertiary)]">
                <span>今日批次 {reviewBatch.total} 张 · 待回顾 {reviewBatch.pending} 张</span>
                <span>{new Date(currentReview.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</span>
              </div>
              <article className="rounded-[2rem] bg-[#f2f0e8] p-6 shadow-sm">
                <Clock3 size={15} className="mb-4 opacity-40" />
                <p className="whitespace-pre-wrap text-base font-medium leading-7 text-[#242424]">{recordText(currentReview)}</p>
                <InspirationAttachmentList
                  inspirationId={currentReview.id}
                  attachments={currentReview.attachments}
                />
                {currentReview.reflections && currentReview.reflections.length > 0 && (
                  <div className="mt-5 border-t border-black/10 pt-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-black/40">之前的想法</p>
                    {currentReview.reflections.slice(0, 3).map((reflection) => (
                      <p key={reflection.id} className="mb-2 text-xs leading-5 text-black/60">{new Date(reflection.createdAt).toLocaleDateString('zh-CN')} · {reflection.body}</p>
                    ))}
                  </div>
                )}
              </article>

              <textarea
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                placeholder="现在再看这条记录，你有什么新的理解？"
                className="min-h-28 w-full resize-none rounded-[var(--sf-radius-md)] border border-[var(--sf-border)] bg-[var(--sf-surface)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--sf-text-primary)]"
              />
              <button type="button" disabled={!reviewText.trim() || reviewBusy} onClick={saveReflection} className="w-full rounded-full bg-[var(--sf-text-primary)] py-3 text-sm font-bold text-[var(--sf-surface)] disabled:opacity-40">保存 Reflection</button>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" disabled={reviewBusy} onClick={() => finishReviewAction('later')} className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-2 py-3 text-xs font-semibold">稍后再看</button>
                <button type="button" disabled={reviewBusy} onClick={() => finishReviewAction('digested')} className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-2 py-3 text-xs font-semibold">已消化</button>
                <button type="button" disabled={reviewBusy} onClick={convertCurrentToTask} className="flex items-center justify-center gap-1 rounded-2xl bg-[#cae393] px-2 py-3 text-xs font-bold text-[#242424]">转待办 <ArrowRight size={12} /></button>
              </div>
            </>
          )}
        </section>
      )}

      <InspirationDetailSheet
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onChanged={async () => {
          await Promise.all([loadRecords(), loadReviews()]);
          window.dispatchEvent(new CustomEvent('sparkflow:records-changed'));
        }}
      />
    </div>
  );
}
