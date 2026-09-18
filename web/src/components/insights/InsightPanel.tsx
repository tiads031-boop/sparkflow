import { useCallback, useEffect, useState } from 'react';
import { Archive, ArrowRight, ChevronDown, ChevronUp, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import {
  archiveInsight,
  createTaskFromInsight,
  deleteInsight,
  generateInsights,
  listInsights,
  type InsightRecord,
  type InsightSourceRecord,
  type InsightType,
} from '../../api/insights';
import { useAppStore } from '../../store/appStore';

const typeLabels: Record<InsightType, string> = {
  theme: '主题',
  evolution: '观点变化',
  action: '行动机会',
};

function sourceText(source: InsightSourceRecord) {
  return source.contentText || source.description || source.title || '未命名记录';
}

interface InsightPanelProps {
  recordCount: number;
}

export function InsightPanel({ recordCount }: InsightPanelProps) {
  const loadTasks = useAppStore((state) => state.loadTasks);
  const [insights, setInsights] = useState<InsightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [taskInsight, setTaskInsight] = useState<InsightRecord | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskMinutes, setTaskMinutes] = useState('45');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskBusy, setTaskBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setInsights(await listInsights());
    } catch (err: any) {
      setError(err?.message || '洞察加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const discover = async () => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const created = await generateInsights(30);
      if (created.length === 0) {
        setMessage('这批记录暂时没有足够明确的共同主题。多记几条或回顾后再试。');
      } else {
        setMessage(`发现了 ${created.length} 条近期洞察。每条都可以展开核对来源。`);
      }
      await load();
    } catch (err: any) {
      setError(err?.message || 'AI 洞察暂时不可用，请稍后再试');
    } finally {
      setGenerating(false);
    }
  };

  const archive = async (insight: InsightRecord) => {
    try {
      await archiveInsight(insight.id);
      if (expandedId === insight.id) setExpandedId(null);
      setMessage(`已归档洞察「${insight.title}」。`);
      await load();
    } catch (err: any) {
      setError(err?.message || '归档失败');
    }
  };

  const openTaskSheet = (insight: InsightRecord) => {
    setTaskInsight(insight);
    setTaskTitle(insight.title);
    setTaskDescription(insight.body);
    setTaskMinutes('45');
    setTaskDueDate('');
    setTaskPriority('medium');
    setError(null);
  };

  const confirmTask = async () => {
    if (!taskInsight || !taskTitle.trim() || taskBusy) return;
    setTaskBusy(true);
    setError(null);
    try {
      const minutes = Number(taskMinutes);
      const task = await createTaskFromInsight(taskInsight.id, {
        title: taskTitle.trim(),
        description: taskDescription.trim() || taskInsight.body,
        estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : undefined,
        dueDate: taskDueDate ? new Date(`${taskDueDate}T23:59:00`).toISOString() : undefined,
        priority: taskPriority,
      });
      setTaskInsight(null);
      setMessage(`已创建待办「${task.title}」，洞察和来源记录都会保留。`);
      await Promise.all([load(), loadTasks()]);
    } catch (err: any) {
      setError(err?.message || '创建待办失败');
    } finally {
      setTaskBusy(false);
    }
  };

  const remove = async (insight: InsightRecord) => {
    if (!window.confirm(`删除洞察「${insight.title}」？来源记录不会被删除。`)) return;
    try {
      await deleteInsight(insight.id);
      if (expandedId === insight.id) setExpandedId(null);
      await load();
    } catch (err: any) {
      setError(err?.message || '删除失败');
    }
  };

  return (
    <section className="space-y-3">
      <div className="rounded-[var(--sf-radius-lg)] bg-[#f2f0e8] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#242424]">
              <Sparkles size={16} /> 发现近期洞察
            </div>
            <p className="mt-2 text-xs leading-5 text-[#242424]/55">
              AI 只分析你最近 30 天的 active 记录和 Reflection，寻找主题、观点变化和行动机会。不会修改原记录，也不会自动创建待办。
            </p>
          </div>
          <button
            type="button"
            onClick={discover}
            disabled={generating || recordCount < 2}
            className="shrink-0 rounded-full bg-[#242424] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {generating ? '分析中…' : '发现洞察'}
          </button>
        </div>
        {recordCount < 2 && <p className="mt-3 text-[11px] text-[#242424]/45">至少需要 2 条近期记录。</p>}
      </div>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}
      {message && <div className="rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-surface)] px-4 py-3 text-xs text-[var(--sf-text-secondary)]">{message}</div>}

      <div className="flex items-center justify-between text-xs text-[var(--sf-text-tertiary)]">
        <span>{insights.length} 条保留中的洞察</span>
        <button type="button" onClick={load} className="flex items-center gap-1"><RefreshCw size={12} /> 刷新</button>
      </div>

      {loading && <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-4 text-sm text-[var(--sf-text-secondary)]">正在加载洞察…</p>}
      {!loading && insights.length === 0 && (
        <div className="rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-5 text-sm text-[var(--sf-text-secondary)]">
          还没有洞察。这里不会自动分析；需要时再点一次“发现洞察”。
        </div>
      )}

      {insights.map((insight) => {
        const expanded = expandedId === insight.id;
        return (
          <article key={insight.id} className="rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="rounded-full bg-[#b0a8db]/35 px-2 py-1 text-[10px] font-bold text-[var(--sf-text-secondary)]">{typeLabels[insight.type]}</span>
                <h3 className="mt-3 text-base font-bold text-[var(--sf-text-primary)]">{insight.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--sf-text-secondary)]">{insight.body}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : insight.id)}
              className="mt-4 flex w-full items-center justify-between rounded-2xl bg-[var(--sf-bg)] px-3 py-2.5 text-xs font-semibold text-[var(--sf-text-secondary)]"
            >
              <span>来自 {insight.sources.length} 张卡片</span>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {expanded && (
              <div className="mt-3 space-y-2">
                {insight.sources.map(({ inspiration }) => (
                  <div key={inspiration.id} className="rounded-2xl border border-[var(--sf-border)] bg-[#f2f0e8] px-4 py-3">
                    <p className="text-[10px] text-[#242424]/40">{new Date(inspiration.createdAt).toLocaleDateString('zh-CN')} · {inspiration.sourceType === 'manual' ? '手动记录' : inspiration.sourceType}</p>
                    <p className="mt-1.5 text-xs leading-5 text-[#242424]/75">{sourceText(inspiration)}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-[var(--sf-border)] pt-3">
              <span className="text-[10px] text-[var(--sf-text-tertiary)]">{new Date(insight.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <div className="flex flex-wrap justify-end gap-2">
                {insight.type === 'action' && (
                  <button type="button" onClick={() => openTaskSheet(insight)} className="flex items-center gap-1 rounded-full bg-[#cae393] px-3 py-2 text-[11px] font-bold text-[#242424]">
                    加入待办 <ArrowRight size={12} />
                  </button>
                )}
                <button type="button" onClick={() => archive(insight)} className="flex items-center gap-1 rounded-full bg-[var(--sf-bg)] px-3 py-2 text-[11px] font-semibold"><Archive size={12} /> 归档</button>
                <button type="button" aria-label="删除洞察" onClick={() => remove(insight)} className="rounded-full bg-[var(--sf-bg)] p-2"><Trash2 size={13} /></button>
              </div>
            </div>

            {(insight.tasks?.length || 0) > 0 && (
              <div className="mt-3 rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sf-text-tertiary)]">产生的行动</p>
                <div className="mt-2 space-y-1.5">
                  {insight.tasks!.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-[var(--sf-text-secondary)]">{task.title}</span>
                      <span className="shrink-0 text-[10px] text-[var(--sf-text-tertiary)]">{task.status === 'done' ? '已完成' : '待处理'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        );
      })}

      {taskInsight && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" role="presentation" onClick={() => !taskBusy && setTaskInsight(null)}>
          <section className="w-full max-w-lg rounded-t-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--sf-text-primary)]">创建待办</h2>
                <p className="mt-1 text-xs text-[var(--sf-text-tertiary)]">来自洞察「{taskInsight.title}」，确认后才会写入 Task。</p>
              </div>
              <button type="button" aria-label="关闭" disabled={taskBusy} onClick={() => setTaskInsight(null)} className="rounded-full bg-[var(--sf-bg)] p-2"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[var(--sf-text-secondary)]">标题
                <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="mt-1.5 w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm outline-none" />
              </label>
              <label className="block text-xs font-semibold text-[var(--sf-text-secondary)]">说明
                <textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} className="mt-1.5 min-h-20 w-full resize-none rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm leading-5 outline-none" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-[var(--sf-text-secondary)]">预计时长（分钟）
                  <input type="number" min="5" max="1440" step="5" value={taskMinutes} onChange={(e) => setTaskMinutes(e.target.value)} className="mt-1.5 w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-3 text-sm outline-none" />
                </label>
                <label className="block text-xs font-semibold text-[var(--sf-text-secondary)]">截止日期
                  <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="mt-1.5 w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-3 text-sm outline-none" />
                </label>
              </div>
              <label className="block text-xs font-semibold text-[var(--sf-text-secondary)]">优先级
                <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value as 'low' | 'medium' | 'high')} className="mt-1.5 w-full rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-3 py-3 text-sm outline-none">
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </label>
            </div>

            <button type="button" disabled={taskBusy || !taskTitle.trim()} onClick={confirmTask} className="mt-4 w-full rounded-full bg-[var(--sf-text-primary)] py-3 text-sm font-bold text-[var(--sf-surface)] disabled:opacity-40">
              {taskBusy ? '创建中…' : '确认创建待办'}
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
