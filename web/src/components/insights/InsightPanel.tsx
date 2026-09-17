import { useCallback, useEffect, useState } from 'react';
import { Archive, ChevronDown, ChevronUp, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import {
  archiveInsight,
  deleteInsight,
  generateInsights,
  listInsights,
  type InsightRecord,
  type InsightSourceRecord,
  type InsightType,
} from '../../api/insights';

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
  const [insights, setInsights] = useState<InsightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
              <div className="flex gap-2">
                <button type="button" onClick={() => archive(insight)} className="flex items-center gap-1 rounded-full bg-[var(--sf-bg)] px-3 py-2 text-[11px] font-semibold"><Archive size={12} /> 归档</button>
                <button type="button" aria-label="删除洞察" onClick={() => remove(insight)} className="rounded-full bg-[var(--sf-bg)] p-2"><Trash2 size={13} /></button>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
