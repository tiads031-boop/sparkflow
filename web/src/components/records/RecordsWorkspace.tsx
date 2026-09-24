import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Spark } from '../../store/appStore';
import { useAppStore } from '../../store/appStore';
import {
  createTaskFromInspiration,
  extendTodayReviewBatch,
  getTodayReviewBatch,
  listInspirations,
  processReviewBatchItem,
  type InspirationRecord,
  type TodayReviewBatch,
} from '../../api/inspirations';
import InspirationDetailSheet from './InspirationDetailSheet';
import InsightsWorkspace from './InsightsWorkspace';
import RecordCardsView from './RecordCardsView';
import RecordToolbar, { type RecordPanel } from './RecordToolbar';
import ReviewWorkspace from './ReviewWorkspace';
const SceneCenter = lazy(() => import('./scenes/SceneCenter'));

export interface RecordsWorkspaceProps {
  sparks: Spark[];
  setSparks: (sparks: Spark[]) => void;
  onSparkClick: (spark: Spark) => void;
  onAddClick: () => void;
}

export default function RecordsWorkspace({ onAddClick }: RecordsWorkspaceProps) {
  const loadTasks = useAppStore((state) => state.loadTasks);
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '记录加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReviews = useCallback(async () => {
    try {
      const data = await getTodayReviewBatch();
      setReviewBatch(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '回顾列表加载失败');
    }
  }, []);

  const loadMoreReviews = useCallback(async () => {
    try {
      setReviewBusy(true);
      const data = await extendTodayReviewBatch();
      setReviewBatch(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '追加回顾失败');
    } finally {
      setReviewBusy(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void Promise.all([loadRecords(), loadReviews()]);
    }, 0);
    return () => window.clearTimeout(timeoutId);
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '回顾操作失败');
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reflection 保存失败');
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '转待办失败');
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="animate-page-enter space-y-4 pb-6">
      <header className="flex items-end justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">Records</p><h1 className="mt-1 text-[28px] font-black tracking-[-0.04em] text-[var(--sf-text-primary)]">记录</h1><p className="mt-1 text-xs text-[var(--sf-text-tertiary)]">随手记下来，之后再想清楚。</p></div>
        <button type="button" onClick={onAddClick} className="flex items-center gap-1 rounded-full bg-[var(--sf-graphite)] px-3 py-2 text-xs font-black text-[#cae393]"><Plus size={13} />记录</button>
      </header>

      <RecordToolbar
        panel={panel}
        pendingReviews={reviewBatch.pending}
        onPanelChange={(nextPanel) => {
          setPanel(nextPanel);
          if (nextPanel === 'review') void loadReviews();
        }}
      />

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
      {message && <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-4 py-3 text-xs text-[var(--sf-text-secondary)]">{message}</div>}

      {!panel ? <RecordCardsView records={records} loading={loading} onOpen={setSelectedRecord} onRefresh={() => void refreshAll()} /> : null}

      {panel === 'insights' ? <InsightsWorkspace recordCount={records.length} /> : null}
      {panel === 'scenes' ? <Suspense fallback={<p className="rounded-2xl bg-white p-4 text-sm">加载场景…</p>}><SceneCenter /></Suspense> : null}

      {panel === 'review' ? <ReviewWorkspace batch={reviewBatch} currentReview={currentReview} reviewText={reviewText} busy={reviewBusy} onReviewTextChange={setReviewText} onLoadMore={() => void loadMoreReviews()} onSaveReflection={() => void saveReflection()} onFinish={(action) => void finishReviewAction(action)} onConvertToTask={() => void convertCurrentToTask()} /> : null}

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
