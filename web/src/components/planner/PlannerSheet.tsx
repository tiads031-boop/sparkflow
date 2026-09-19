import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe2,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api/client';
import {
  createPlanningThread,
  getPlanningThread,
  listPlanningThreads,
  sendPlanningTurn,
  type PlanningContextSnapshot,
  type PlanningEvidenceItem,
  type PlanningThreadDetail,
} from '../../api/planning';
import type { PlannerPreview } from '../../types';
import { useModalLifecycle } from '../ui/useModalLifecycle';

function dateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function statusLabel(status: 'confirmed' | 'inferred' | 'assumed') {
  if (status === 'confirmed') return '已确认';
  if (status === 'inferred') return 'AI 推断';
  return '暂时假设';
}

function ContextSection({
  title,
  items,
}: {
  title: string;
  items: PlanningContextSnapshot['brief'];
}) {
  if (!items.length) return null;
  return (
    <section>
      <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sf-text-tertiary)]">
        {title}
      </h4>
      <div className="space-y-1.5">
        {items.map((item, index) => (
          <div
            key={`${item.key}-${index}`}
            className="rounded-2xl bg-[var(--sf-bg)] px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <strong className="text-xs text-[var(--sf-text-primary)]">{item.key}</strong>
              <span className="shrink-0 rounded-full bg-[var(--sf-surface)] px-2 py-0.5 text-[9px] font-bold text-[var(--sf-text-tertiary)]">
                {statusLabel(item.status)}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--sf-text-secondary)]">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PlannerSheet({
  open,
  selectedDate,
  onClose,
  onApplied,
  onPreviewChange,
}: {
  open: boolean;
  selectedDate: Date;
  onClose: () => void;
  onApplied: () => Promise<void>;
  onPreviewChange?: (preview: PlannerPreview | null) => void;
}) {
  const [thread, setThread] = useState<PlanningThreadDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [turnBusy, setTurnBusy] = useState(false);
  const [turnMessage, setTurnMessage] = useState('');
  const [readiness, setReadiness] = useState<'clarify' | 'ready' | null>(null);
  const [latestEvidence, setLatestEvidence] = useState<PlanningEvidenceItem[]>([]);
  const [contextOpen, setContextOpen] = useState(false);

  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [date, setDate] = useState(dateInput(selectedDate));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('22:00');
  const [preview, setPreview] = useState<PlannerPreview | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onClose(), [onClose]);
  useModalLifecycle(open, close);

  const loadLatestThread = useCallback(async () => {
    setLoadingThread(true);
    setTurnMessage('');
    try {
      const threads = await listPlanningThreads();
      if (!threads.length) {
        setThread(null);
        setReadiness(null);
        setLatestEvidence([]);
        return;
      }
      const detail = await getPlanningThread(threads[0].id);
      setThread(detail);
      const latestContext = detail.conversations.at(-1)?.context;
      setReadiness(latestContext?.readiness || null);
      setLatestEvidence(detail.evidence || []);
    } catch (error) {
      setTurnMessage(error instanceof Error ? error.message : '读取规划上下文失败');
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setDate(dateInput(selectedDate));
    setPreview(null);
    setPlanId(null);
    setSchedulerOpen(false);
    setScheduleMessage('');
    onPreviewChange?.(null);
    void loadLatestThread();
  }, [open, selectedDate, loadLatestThread, onPreviewChange]);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, [open, thread?.conversations.length, turnBusy]);

  const messages = useMemo(() => (
    thread?.conversations.flatMap((row) => [
      { id: `${row.id}-user`, role: 'user' as const, content: row.userMessage },
      { id: `${row.id}-assistant`, role: 'assistant' as const, content: row.aiResponse },
    ]) || []
  ), [thread]);

  if (!open) return null;

  const clearPreview = () => {
    setPreview(null);
    setPlanId(null);
    setScheduleMessage('');
    onPreviewChange?.(null);
  };

  const ensureThread = async (seed: string) => {
    if (thread) return thread;
    const created = await createPlanningThread(seed.slice(0, 36));
    const detail = await getPlanningThread(created.id);
    setThread(detail);
    return detail;
  };

  const sendMessage = async () => {
    const message = messageInput.trim();
    if (!message || turnBusy) return;

    setTurnBusy(true);
    setTurnMessage('');
    clearPreview();
    setSchedulerOpen(false);

    try {
      const activeThread = await ensureThread(message);
      setMessageInput('');
      const result = await sendPlanningTurn(
        activeThread.id,
        message,
        activeThread.revision,
      );
      const detail = await getPlanningThread(activeThread.id);
      setThread(detail);
      setReadiness(result.readiness);
      setLatestEvidence(result.research.evidence.length
        ? result.research.evidence
        : detail.evidence || []);

      if (result.research.status === 'used') {
        setTurnMessage(`已联网核实 ${result.research.evidence.length} 个来源。`);
      } else if (result.research.status === 'unavailable') {
        setTurnMessage('这轮需要外部核验，但搜索服务尚未配置；AI 已按未核验状态继续。');
      } else if (result.research.status === 'failed') {
        setTurnMessage('这轮联网核验没有成功，AI 已明确按未核验状态继续。');
      }
    } catch (error) {
      setTurnMessage(error instanceof Error ? error.message : 'AI 规划暂时不可用');
    } finally {
      setTurnBusy(false);
    }
  };

  const startNewPlanning = async () => {
    if (turnBusy) return;
    setLoadingThread(true);
    try {
      const created = await createPlanningThread('新的规划');
      const detail = await getPlanningThread(created.id);
      setThread(detail);
      setReadiness(null);
      setLatestEvidence([]);
      setMessageInput('');
      setTurnMessage('');
      clearPreview();
    } catch (error) {
      setTurnMessage(error instanceof Error ? error.message : '创建新规划失败');
    } finally {
      setLoadingThread(false);
    }
  };

  const generateSchedule = async () => {
    setScheduleBusy(true);
    setScheduleMessage('');
    setPlanId(null);
    try {
      const result = await api.post<PlannerPreview>(
        '/planner/preview',
        {
          availabilityStart: localIso(date, startTime),
          availabilityEnd: localIso(date, endTime),
        },
        { throwOnError: true, timeoutMs: 45_000 },
      );
      setPreview(result);
      onPreviewChange?.(result);
      if (!result.proposals.length) {
        setScheduleMessage('当前范围内没有可自动安排的未排期任务。');
      }
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : '生成安排失败');
    } finally {
      setScheduleBusy(false);
    }
  };

  const applySchedule = async () => {
    if (!preview?.proposals.length) return;
    setScheduleBusy(true);
    setScheduleMessage('');
    try {
      const result = await api.post<{ planId: string; appliedCount: number }>(
        '/planner/apply',
        {
          proposals: preview.proposals,
          planningThreadId: thread?.id,
          planningThreadRevision: thread?.revision,
        },
        { throwOnError: true },
      );
      setPlanId(result.planId);
      setScheduleMessage(`已安排 ${result.appliedCount} 项任务，本次排程已关联当前规划依据。`);
      await onApplied();
      onPreviewChange?.(null);
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : '应用安排失败');
    } finally {
      setScheduleBusy(false);
    }
  };

  const undoSchedule = async () => {
    if (!planId) return;
    setScheduleBusy(true);
    setScheduleMessage('');
    try {
      const result = await api.post<{ restoredCount: number }>(
        `/planner/${planId}/undo`,
        undefined,
        { throwOnError: true },
      );
      setPlanId(null);
      clearPreview();
      setScheduleMessage(`已撤销，恢复 ${result.restoredCount} 项任务。`);
      await onApplied();
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : '撤销失败');
    } finally {
      setScheduleBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex justify-center bg-[var(--sf-surface)]">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="AI 规划与调整"
        className="flex h-dvh w-full max-w-xl flex-col bg-[var(--sf-surface)]"
      >
        <header className="shrink-0 border-b border-black/[0.05] px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+14px)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sf-bg)]"
              aria-label="关闭"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[var(--sf-marker-purple)]">
                <BrainCircuit size={14} />
                <span className="text-[9px] font-black uppercase tracking-[0.16em]">AI Planning</span>
              </div>
              <h2 className="truncate text-base font-black text-[var(--sf-text-primary)]">
                {thread?.title || 'AI 规划与调整'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void startNewPlanning()}
              disabled={loadingThread || turnBusy}
              className="flex h-9 items-center gap-1 rounded-full bg-[var(--sf-bg)] px-3 text-[10px] font-bold disabled:opacity-40"
            >
              <Plus size={13} /> 新规划
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {loadingThread ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-[var(--sf-text-tertiary)]">
              <Loader2 size={16} className="animate-spin" /> 正在读取规划上下文…
            </div>
          ) : messages.length === 0 ? (
            <div className="py-10">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-[1.4rem] bg-[#f1eefb] text-[#6f63a8]">
                <Sparkles size={24} />
              </div>
              <h3 className="mt-5 text-center text-2xl font-black">先告诉我你想解决什么。</h3>
              <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-[var(--sf-text-secondary)]">
                我会根据你的回答继续追问真正影响计划的问题；需要当前外部信息时，会先联网核实，再形成规划依据。
              </p>
              <div className="mx-auto mt-6 grid max-w-sm gap-2">
                {[
                  '我想准备一项考试，帮我从现在开始规划',
                  '这周突然多了几件事，帮我重新安排',
                  '我有个长期目标，但不知道应该怎么拆',
                ].map((example) => (
                  <button
                    type="button"
                    key={example}
                    onClick={() => setMessageInput(example)}
                    className="rounded-2xl bg-[var(--sf-bg)] px-4 py-3 text-left text-xs font-medium text-[var(--sf-text-secondary)]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((item) => (
                <div
                  key={item.id}
                  className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-[1.4rem] px-4 py-3 text-sm leading-6 ${
                      item.role === 'user'
                        ? 'rounded-br-md bg-[#242424] text-white'
                        : 'rounded-bl-md bg-[var(--sf-bg)] text-[var(--sf-text-primary)]'
                    }`}
                  >
                    {item.content}
                  </div>
                </div>
              ))}
              {turnBusy && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-[1.4rem] rounded-bl-md bg-[var(--sf-bg)] px-4 py-3 text-xs text-[var(--sf-text-secondary)]">
                    <Loader2 size={14} className="animate-spin" />
                    正在理解你的需求，必要时会联网核实…
                  </div>
                </div>
              )}
            </div>
          )}

          {thread && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setContextOpen((value) => !value)}
                className="flex w-full items-center justify-between rounded-2xl border border-black/[0.06] bg-white px-4 py-3 text-left"
              >
                <span>
                  <strong className="block text-xs">当前规划依据</strong>
                  <span className="mt-0.5 block text-[10px] text-[var(--sf-text-tertiary)]">
                    revision {thread.revision} · 目标、约束、偏好、策略与假设
                  </span>
                </span>
                {contextOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {contextOpen && (
                <div className="mt-2 space-y-4 rounded-[1.5rem] border border-black/[0.05] bg-white p-4">
                  <ContextSection title="目标 / 当前状态" items={thread.planningContext.brief} />
                  <ContextSection title="硬约束 / 软约束" items={thread.planningContext.constraints} />
                  <ContextSection title="偏好" items={thread.planningContext.preferences} />
                  <ContextSection title="当前策略" items={thread.planningContext.strategy} />
                  <ContextSection title="暂时假设" items={thread.planningContext.assumptions} />
                  {![
                    ...thread.planningContext.brief,
                    ...thread.planningContext.constraints,
                    ...thread.planningContext.preferences,
                    ...thread.planningContext.strategy,
                    ...thread.planningContext.assumptions,
                  ].length && (
                    <p className="text-xs text-[var(--sf-text-tertiary)]">继续对话后，这里会逐步形成可持续的规划上下文。</p>
                  )}
                </div>
              )}
            </div>
          )}

          {latestEvidence.length > 0 && (
            <div className="mt-4 rounded-[1.5rem] border border-[#b0a8db]/30 bg-[#f7f5fc] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Globe2 size={14} className="text-[#6f63a8]" />
                <strong className="text-xs text-[#4f4675]">已核实的外部来源</strong>
              </div>
              <div className="space-y-2">
                {latestEvidence.slice(0, 6).map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl bg-white px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-[11px] text-[#242424]">{item.title}</strong>
                        <span className="mt-0.5 block truncate text-[9px] text-gray-400">
                          {item.domain} · {new Date(item.fetchedAt).toLocaleDateString('zh-CN')}
                        </span>
                      </span>
                      <ExternalLink size={11} className="mt-0.5 shrink-0 text-gray-400" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {turnMessage && (
            <p className="mt-4 rounded-2xl bg-[var(--sf-bg)] px-4 py-3 text-xs text-[var(--sf-text-secondary)]">
              {turnMessage}
            </p>
          )}

          {thread && (readiness === 'ready' || schedulerOpen) && (
            <div className="mt-5 rounded-[1.7rem] border border-black/[0.06] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black">日程预览</h3>
                  <p className="mt-1 text-[10px] leading-4 text-[var(--sf-text-tertiary)]">
                    AI 已经形成规划依据。排程仍由确定性 Scheduler 生成，确认前不会改真实日程。
                  </p>
                </div>
                {!schedulerOpen && (
                  <button
                    type="button"
                    onClick={() => setSchedulerOpen(true)}
                    className="shrink-0 rounded-full bg-[#242424] px-3 py-2 text-[10px] font-bold text-[#cae393]"
                  >
                    生成预览
                  </button>
                )}
              </div>

              {schedulerOpen && (
                <div className="mt-4">
                  <div className="grid grid-cols-3 gap-2">
                    <input type="date" value={date} onChange={(event) => { setDate(event.target.value); clearPreview(); }} className="min-w-0 rounded-xl bg-[var(--sf-bg)] px-2 py-2 text-[10px] outline-none" />
                    <input type="time" value={startTime} onChange={(event) => { setStartTime(event.target.value); clearPreview(); }} className="min-w-0 rounded-xl bg-[var(--sf-bg)] px-2 py-2 text-[10px] outline-none" />
                    <input type="time" value={endTime} onChange={(event) => { setEndTime(event.target.value); clearPreview(); }} className="min-w-0 rounded-xl bg-[var(--sf-bg)] px-2 py-2 text-[10px] outline-none" />
                  </div>
                  <button
                    type="button"
                    disabled={scheduleBusy || !date || startTime >= endTime}
                    onClick={() => void generateSchedule()}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#242424] py-3 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {scheduleBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {preview ? '重新生成时间块' : '生成时间块预览'}
                  </button>

                  {preview?.proposals.length ? (
                    <div className="mt-3 space-y-2">
                      {preview.proposals.map((proposal) => (
                        <article key={proposal.taskId} className="rounded-2xl bg-[var(--sf-bg)] px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <strong className="block truncate text-xs">{proposal.title}</strong>
                              <span className="mt-0.5 block text-[10px] text-[var(--sf-text-secondary)]">
                                {timeLabel(proposal.start)}–{timeLabel(proposal.end)} · {proposal.durationMinutes} 分钟
                              </span>
                            </span>
                            <Check size={13} className="mt-0.5 shrink-0 text-[var(--sf-marker-green)]" />
                          </div>
                          <p className="mt-1 text-[9px] text-[var(--sf-text-tertiary)]">{proposal.reason}</p>
                        </article>
                      ))}
                      {preview.unscheduledTaskIds.length > 0 && (
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
                          另有 {preview.unscheduledTaskIds.length} 项未能放入当前时间范围。
                        </p>
                      )}
                      {!planId && (
                        <button
                          type="button"
                          onClick={() => void applySchedule()}
                          disabled={scheduleBusy}
                          className="w-full rounded-full bg-[#cae393] py-3 text-xs font-black text-[#242424] disabled:opacity-40"
                        >
                          确认并应用
                        </button>
                      )}
                    </div>
                  ) : null}

                  {scheduleMessage && <p className="mt-3 rounded-xl bg-[var(--sf-bg)] px-3 py-2 text-xs">{scheduleMessage}</p>}
                  {planId && (
                    <button
                      type="button"
                      onClick={() => void undoSchedule()}
                      disabled={scheduleBusy}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sf-bg)] py-3 text-xs font-bold disabled:opacity-40"
                    >
                      <RotateCcw size={14} /> 撤销本次安排
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-black/[0.05] bg-[var(--sf-surface)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3">
          <div className="flex items-end gap-2 rounded-[1.5rem] bg-[var(--sf-bg)] p-2">
            <textarea
              rows={1}
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="说说你的目标、变化、冲突或临时安排…"
              className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none placeholder:text-[var(--sf-text-tertiary)]"
            />
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!messageInput.trim() || turnBusy || loadingThread}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#242424] text-[#cae393] disabled:opacity-30"
              aria-label="发送给 AI"
            >
              {turnBusy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="mt-2 text-center text-[9px] text-[var(--sf-text-tertiary)]">
            AI 会保留已确认的规划依据；外部事实可能变化，必要时会重新核实。
          </p>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
