import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BrainCircuit,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe2,
  Loader2,
  Mic,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { api } from '../../api/client';
import {
  applyPlanningActions,
  createPlanningThread,
  getPlanningThread,
  listPlanningThreads,
  sendPlanningTurn,
  updatePlanningContext,
  type PlanningActionProposal,
  type PlanningContextSnapshot,
  type PlanningReplanRequest,
  type PlanningEvidenceItem,
  type PlanningThreadDetail,
} from '../../api/planning';
import type { PlannerPreview, PlannerReplanPreview } from '../../types';
import { useModalLifecycle } from '../ui/useModalLifecycle';
import { usePlanningVoiceInput } from '../../hooks/usePlanningVoiceInput';
import PlanningContextEditor from './PlanningContextEditor';
import {
  applyCourseChange,
  applyCourseTemplateChange,
  previewCourseChange,
  previewCourseTemplateChange,
  undoCourseChange,
  undoCourseTemplateChange,
  type CourseChangePreview,
  type CourseChangeRequest,
  type CourseTemplateChangePreview,
  type CourseTemplateChangeRequest,
} from '../../api/courses';

const MarkdownMessage = lazy(() => import('./MarkdownMessage'));

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

function dateTimeLabel(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
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

type CourseChangeAction = Extract<PlanningActionProposal, { type: 'course_change' }>;
type CourseTemplateChangeAction = Extract<PlanningActionProposal, { type: 'course_template_change' }>;
type DirectPlanningAction = Exclude<PlanningActionProposal, CourseChangeAction | CourseTemplateChangeAction>;

function courseChangeTypeLabel(type: CourseChangeAction['change']['type']) {
  if (type === 'reschedule') return '调课';
  if (type === 'cancel') return '停课';
  if (type === 'swap') return '换课';
  return '补课';
}

function courseChangeRequest(action: CourseChangeAction): CourseChangeRequest {
  return action.change;
}

function courseTemplateRequest(action: CourseTemplateChangeAction): CourseTemplateChangeRequest {
  return {
    courseId: action.courseId,
    effectiveFrom: action.effectiveFrom,
    changes: action.changes,
  };
}

const courseDayLabels: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
};

function templateStateLabel(state: {
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  location: string | null;
}) {
  const day = state.dayOfWeek ? courseDayLabels[state.dayOfWeek] || `周${state.dayOfWeek}` : '日期未定';
  const time = state.startTime && state.endTime
    ? `${state.startTime}–${state.endTime}`
    : '时间未定';
  const place = state.room || state.location;
  return `${day} · ${time}${place ? ` · ${place}` : ''}`;
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
  initialPrompt = '',
  scopeType = 'general',
  scopeId,
  threadTitle,
  allowNewThread = true,
  autoStartVoice = false,
}: {
  open: boolean;
  selectedDate: Date;
  onClose: () => void;
  onApplied: () => Promise<void>;
  onPreviewChange?: (preview: PlannerPreview | null) => void;
  initialPrompt?: string;
  scopeType?: 'general' | 'goal' | 'day' | 'task' | 'course';
  scopeId?: string;
  threadTitle?: string;
  allowNewThread?: boolean;
  autoStartVoice?: boolean;
}) {
  const [thread, setThread] = useState<PlanningThreadDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [turnBusy, setTurnBusy] = useState(false);
  const [turnMessage, setTurnMessage] = useState('');
  const [readiness, setReadiness] = useState<'clarify' | 'ready' | null>(null);
  const [latestEvidence, setLatestEvidence] = useState<PlanningEvidenceItem[]>([]);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextEditing, setContextEditing] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);
  const [contextError, setContextError] = useState('');
  const [actionConversationId, setActionConversationId] = useState<string | null>(null);
  const [actionProposals, setActionProposals] = useState<PlanningActionProposal[]>([]);
  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const [activeCourseProposalId, setActiveCourseProposalId] = useState<string | null>(null);
  const [courseChangePreview, setCourseChangePreview] = useState<CourseChangePreview | null>(null);
  const [courseChangeBusy, setCourseChangeBusy] = useState(false);
  const [courseChangeMessage, setCourseChangeMessage] = useState('');
  const [courseChangePlanId, setCourseChangePlanId] = useState<string | null>(null);
  const [lastAppliedCourseAction, setLastAppliedCourseAction] = useState<CourseChangeAction | null>(null);

  const [activeTemplateProposalId, setActiveTemplateProposalId] = useState<string | null>(null);
  const [templateChangePreview, setTemplateChangePreview] = useState<CourseTemplateChangePreview | null>(null);
  const [templateChangeBusy, setTemplateChangeBusy] = useState(false);
  const [templateChangeMessage, setTemplateChangeMessage] = useState('');
  const [templateChangePlanId, setTemplateChangePlanId] = useState<string | null>(null);
  const [lastAppliedTemplateAction, setLastAppliedTemplateAction] = useState<CourseTemplateChangeAction | null>(null);

  const [replanRequests, setReplanRequests] = useState<PlanningReplanRequest[]>([]);
  const [activeReplanRequestId, setActiveReplanRequestId] = useState<string | null>(null);
  const [replanPreview, setReplanPreview] = useState<PlannerReplanPreview | null>(null);
  const [replanBusy, setReplanBusy] = useState(false);
  const [replanMessage, setReplanMessage] = useState('');
  const [replanPlanId, setReplanPlanId] = useState<string | null>(null);

  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [date, setDate] = useState(dateInput(selectedDate));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('22:00');
  const [preview, setPreview] = useState<PlannerPreview | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoVoiceStartedRef = useRef(false);
  const close = useCallback(() => onClose(), [onClose]);
  const handleVoiceTranscript = useCallback((text: string) => {
    setMessageInput((current) => current.trim() ? `${current.trim()} ${text}` : text);
    setTurnMessage('语音已转写，可以先修改文字，再发送给 AI。');
  }, []);
  const voice = usePlanningVoiceInput(handleVoiceTranscript);
  const {
    state: voiceState,
    configured: voiceConfigured,
    supported: voiceSupported,
    start: startVoice,
    cancel: cancelVoice,
  } = voice;
  useModalLifecycle(open, close);

  const loadLatestThread = useCallback(async () => {
    setLoadingThread(true);
    setTurnMessage('');
    try {
      const threads = await listPlanningThreads(scopeType, scopeId);
      if (!threads.length) {
        setThread(null);
        setReadiness(null);
        setLatestEvidence([]);
        setActionConversationId(null);
        setActionProposals([]);
        setSelectedActionIds([]);
        setActiveCourseProposalId(null);
        setCourseChangePreview(null);
        setCourseChangePlanId(null);
        setCourseChangeMessage('');
        setLastAppliedCourseAction(null);
        setActiveTemplateProposalId(null);
        setTemplateChangePreview(null);
        setTemplateChangePlanId(null);
        setTemplateChangeMessage('');
        setLastAppliedTemplateAction(null);
        setReplanRequests([]);
        setActiveReplanRequestId(null);
        setReplanPreview(null);
        setReplanPlanId(null);
        return;
      }
      const detail = await getPlanningThread(threads[0].id);
      setThread(detail);
      const latestConversation = detail.conversations.at(-1);
      const latestContext = latestConversation?.context;
      setReadiness(latestContext?.readiness || null);
      setLatestEvidence(detail.evidence || []);
      const appliedIds = new Set(latestContext?.appliedActionIds || []);
      const pendingActions = (latestContext?.actions || []).filter(
        (action) => !appliedIds.has(action.proposalId),
      );
      setActionConversationId(pendingActions.length ? latestConversation?.id || null : null);
      setActionProposals(pendingActions);
      setSelectedActionIds(
        pendingActions
          .filter((action) => action.type !== 'course_change' && action.type !== 'course_template_change')
          .map((action) => action.proposalId),
      );
      setActiveCourseProposalId(null);
      setCourseChangePreview(null);
      setCourseChangePlanId(null);
      setCourseChangeMessage('');
      setLastAppliedCourseAction(null);
      setActiveTemplateProposalId(null);
      setTemplateChangePreview(null);
      setTemplateChangePlanId(null);
      setTemplateChangeMessage('');
      setLastAppliedTemplateAction(null);
      setReplanRequests(latestContext?.replanRequests || []);
      setActiveReplanRequestId(null);
      setReplanPreview(null);
      setReplanPlanId(null);
    } catch (error) {
      setTurnMessage(error instanceof Error ? error.message : '读取规划上下文失败');
    } finally {
      setLoadingThread(false);
    }
  }, [scopeType, scopeId]);

  useEffect(() => {
    if (!open) return;
    setDate(dateInput(selectedDate));
    setMessageInput(initialPrompt);
    setPreview(null);
    setPlanId(null);
    setSchedulerOpen(false);
    setScheduleMessage('');
    setActionMessage('');
    setActiveCourseProposalId(null);
    setCourseChangePreview(null);
    setCourseChangePlanId(null);
    setCourseChangeMessage('');
    setLastAppliedCourseAction(null);
    setActiveTemplateProposalId(null);
    setTemplateChangePreview(null);
    setTemplateChangePlanId(null);
    setTemplateChangeMessage('');
    setLastAppliedTemplateAction(null);
    setReplanMessage('');
    setActiveReplanRequestId(null);
    setReplanPreview(null);
    setReplanPlanId(null);
    setContextEditing(false);
    setContextError('');
    onPreviewChange?.(null);
    void loadLatestThread();
  }, [open, selectedDate, initialPrompt, loadLatestThread, onPreviewChange]);

  useEffect(() => {
    if (!open && voiceState === 'recording') cancelVoice();
  }, [open, voiceState, cancelVoice]);

  useEffect(() => {
    if (!open) {
      autoVoiceStartedRef.current = false;
      return;
    }
    if (!autoStartVoice || autoVoiceStartedRef.current || voiceConfigured === null) return;
    autoVoiceStartedRef.current = true;
    if (voiceSupported) void startVoice();
  }, [open, autoStartVoice, voiceConfigured, voiceSupported, startVoice]);

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

  const directActionProposals = actionProposals.filter(
    (action): action is DirectPlanningAction => (
      action.type !== 'course_change' &&
      action.type !== 'course_template_change'
    ),
  );
  const courseChangeProposals = actionProposals.filter(
    (action): action is CourseChangeAction => action.type === 'course_change',
  );
  const templateChangeProposals = actionProposals.filter(
    (action): action is CourseTemplateChangeAction => action.type === 'course_template_change',
  );

  const clearPreview = () => {
    setPreview(null);
    setPlanId(null);
    setScheduleMessage('');
    onPreviewChange?.(null);
  };

  const ensureThread = async (seed: string) => {
    if (thread) return thread;
    const created = await createPlanningThread(
      threadTitle || seed.slice(0, 36),
      scopeType,
      scopeId,
    );
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
    setActiveReplanRequestId(null);
    setReplanPreview(null);
    setReplanPlanId(null);
    setReplanMessage('');
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
      setActionConversationId(result.actions.length ? result.conversationId : null);
      setActionProposals(result.actions);
      setSelectedActionIds(
        result.actions
          .filter((action) => action.type !== 'course_change' && action.type !== 'course_template_change')
          .map((action) => action.proposalId),
      );
      setActionMessage('');
      setActiveCourseProposalId(null);
      setCourseChangePreview(null);
      setCourseChangePlanId(null);
      setCourseChangeMessage('');
      setLastAppliedCourseAction(null);
      setActiveTemplateProposalId(null);
      setTemplateChangePreview(null);
      setTemplateChangePlanId(null);
      setTemplateChangeMessage('');
      setLastAppliedTemplateAction(null);
      setReplanRequests(result.replanRequests || []);
      setActiveReplanRequestId(null);
      setReplanPreview(null);
      setReplanPlanId(null);
      setReplanMessage('');

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
      const created = await createPlanningThread(
        threadTitle || '新的规划',
        scopeType,
        scopeId,
      );
      const detail = await getPlanningThread(created.id);
      setThread(detail);
      setReadiness(null);
      setLatestEvidence([]);
      setActionConversationId(null);
      setActionProposals([]);
      setSelectedActionIds([]);
      setActionMessage('');
      setActiveCourseProposalId(null);
      setCourseChangePreview(null);
      setCourseChangePlanId(null);
      setCourseChangeMessage('');
      setLastAppliedCourseAction(null);
      setActiveTemplateProposalId(null);
      setTemplateChangePreview(null);
      setTemplateChangePlanId(null);
      setTemplateChangeMessage('');
      setLastAppliedTemplateAction(null);
      setReplanRequests([]);
      setActiveReplanRequestId(null);
      setReplanPreview(null);
      setReplanPlanId(null);
      setReplanMessage('');
      setMessageInput('');
      setTurnMessage('');
      clearPreview();
    } catch (error) {
      setTurnMessage(error instanceof Error ? error.message : '创建新规划失败');
    } finally {
      setLoadingThread(false);
    }
  };

  const savePlanningContext = async (
    draft: Pick<
      PlanningContextSnapshot,
      'brief' | 'constraints' | 'preferences' | 'strategy' | 'assumptions'
    >,
  ) => {
    if (!thread || contextSaving) return;
    setContextSaving(true);
    setContextError('');
    try {
      const updated = await updatePlanningContext(thread.id, thread.revision, draft);
      setThread(updated);
      setContextEditing(false);
      clearPreview();
      setSchedulerOpen(false);
      setTurnMessage('规划依据已更新。后续 AI 会沿用这份修正后的上下文。');
    } catch (error) {
      setContextError(error instanceof Error ? error.message : '保存规划依据失败');
      try {
        const latest = await getPlanningThread(thread.id);
        setThread(latest);
      } catch {
        // keep the current view if refresh also fails
      }
    } finally {
      setContextSaving(false);
    }
  };

  const toggleAction = (proposalId: string) => {
    setSelectedActionIds((current) => (
      current.includes(proposalId)
        ? current.filter((id) => id !== proposalId)
        : [...current, proposalId]
    ));
  };

  const applyActions = async () => {
    if (!thread || !actionConversationId || !selectedActionIds.length || actionBusy) return;
    setActionBusy(true);
    setActionMessage('');
    try {
      const result = await applyPlanningActions(
        thread.id,
        actionConversationId,
        selectedActionIds,
      );
      setActionProposals((current) => current.filter(
        (action) => !result.appliedActionIds.includes(action.proposalId),
      ));
      setSelectedActionIds([]);
      setActionMessage(
        `已应用 ${result.appliedActionIds.length} 项操作：新增 ${result.createdTaskIds.length} 个任务，更新 ${result.updatedTaskIds.length} 个任务，修改 ${result.updatedGoalIds.length} 个学习目标。`,
      );
      await onApplied();
      const refreshed = await getPlanningThread(thread.id);
      setThread(refreshed);
      if (result.createdTaskIds.length > 0) {
        setSchedulerOpen(true);
        setScheduleMessage('新任务已进入任务池，可以继续生成时间块预览。');
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '应用任务操作失败');
    } finally {
      setActionBusy(false);
    }
  };

  const generateCourseChangePreview = async (action: CourseChangeAction) => {
    if (courseChangeBusy || courseChangePlanId || templateChangePlanId) return;
    setCourseChangeBusy(true);
    setCourseChangeMessage('');
    setActiveCourseProposalId(action.proposalId);
    setCourseChangePreview(null);
    try {
      const result = await previewCourseChange(courseChangeRequest(action));
      setCourseChangePreview(result);
      if (result.conflicts.length > 0) {
        setCourseChangeMessage(
          `发现 ${result.conflicts.length} 个真实日程冲突。当前不会强行应用，请先让 AI 或手动调整目标时间。`,
        );
      }
    } catch (error) {
      setCourseChangePreview(null);
      setCourseChangeMessage(error instanceof Error ? error.message : '生成课程变动预览失败');
    } finally {
      setCourseChangeBusy(false);
    }
  };

  const applyCourseChangeProposal = async (action: CourseChangeAction) => {
    if (
      !thread ||
      !actionConversationId ||
      activeCourseProposalId !== action.proposalId ||
      !courseChangePreview ||
      courseChangePreview.conflicts.length > 0 ||
      courseChangeBusy
    ) return;

    setCourseChangeBusy(true);
    setCourseChangeMessage('');
    try {
      const result = await applyCourseChange(courseChangeRequest(action));
      setCourseChangePlanId(result.planId);
      setLastAppliedCourseAction(action);
      setActionProposals((current) => current.filter(
        (proposal) => proposal.proposalId !== action.proposalId,
      ));
      setActiveCourseProposalId(null);
      setCourseChangePreview(null);
      setCourseChangeMessage(
        `已应用 ${courseChangeTypeLabel(action.change.type)}，共更新 ${result.appliedCount} 个课程实例。关闭前可以撤销。`,
      );
      await onApplied();

      try {
        await applyPlanningActions(
          thread.id,
          actionConversationId,
          [action.proposalId],
        );
        const refreshed = await getPlanningThread(thread.id);
        setThread(refreshed);
      } catch {
        setCourseChangeMessage(
          `课程变动已经成功应用，但 AI 草案状态同步失败。请不要重复确认同一条草案；重新对话后会重新读取真实课表。`,
        );
      }
    } catch (error) {
      setCourseChangeMessage(error instanceof Error ? error.message : '应用课程变动失败');
    } finally {
      setCourseChangeBusy(false);
    }
  };

  const undoAppliedCourseChange = async () => {
    if (!courseChangePlanId || courseChangeBusy) return;
    setCourseChangeBusy(true);
    setCourseChangeMessage('');
    try {
      const result = await undoCourseChange(courseChangePlanId);
      setCourseChangePlanId(null);
      setLastAppliedCourseAction(null);
      setCourseChangeMessage(`已撤销本次课程变动，恢复 ${result.restoredCount} 个课程实例。`);
      await onApplied();
    } catch (error) {
      setCourseChangeMessage(error instanceof Error ? error.message : '撤销课程变动失败');
    } finally {
      setCourseChangeBusy(false);
    }
  };

  const generateTemplateChangePreview = async (action: CourseTemplateChangeAction) => {
    if (templateChangeBusy || templateChangePlanId || courseChangePlanId) return;
    setTemplateChangeBusy(true);
    setTemplateChangeMessage('');
    setActiveTemplateProposalId(action.proposalId);
    setTemplateChangePreview(null);
    try {
      const result = await previewCourseTemplateChange(courseTemplateRequest(action));
      setTemplateChangePreview(result);
      if (result.conflicts.length > 0) {
        setTemplateChangeMessage(
          `新周期规则会产生 ${result.conflicts.length} 个日程冲突。不会强行应用，请先调整规则或处理冲突。`,
        );
      }
    } catch (error) {
      setTemplateChangePreview(null);
      setTemplateChangeMessage(error instanceof Error ? error.message : '生成课程模板预览失败');
    } finally {
      setTemplateChangeBusy(false);
    }
  };

  const applyTemplateChangeProposal = async (action: CourseTemplateChangeAction) => {
    if (
      !thread ||
      !actionConversationId ||
      activeTemplateProposalId !== action.proposalId ||
      !templateChangePreview ||
      templateChangePreview.conflicts.length > 0 ||
      templateChangeBusy
    ) return;

    setTemplateChangeBusy(true);
    setTemplateChangeMessage('');
    try {
      const result = await applyCourseTemplateChange(courseTemplateRequest(action));
      setTemplateChangePlanId(result.planId);
      setLastAppliedTemplateAction(action);
      setActionProposals((current) => current.filter(
        (proposal) => proposal.proposalId !== action.proposalId,
      ));
      setActiveTemplateProposalId(null);
      setTemplateChangePreview(null);
      setTemplateChangeMessage(
        `周期课表已更新：替换 ${result.replacedCount} 个未来普通课次，生成 ${result.generatedCount} 个新课次。已有单次 override 保持不动。`,
      );
      await onApplied();

      try {
        await applyPlanningActions(
          thread.id,
          actionConversationId,
          [action.proposalId],
        );
        const refreshed = await getPlanningThread(thread.id);
        setThread(refreshed);
      } catch {
        setTemplateChangeMessage(
          '课程模板已经成功应用，但 AI 草案状态同步失败。请不要重复确认同一条模板草案。',
        );
      }
    } catch (error) {
      setTemplateChangeMessage(error instanceof Error ? error.message : '应用课程模板修改失败');
    } finally {
      setTemplateChangeBusy(false);
    }
  };

  const undoAppliedTemplateChange = async () => {
    if (!templateChangePlanId || templateChangeBusy) return;
    setTemplateChangeBusy(true);
    setTemplateChangeMessage('');
    try {
      const result = await undoCourseTemplateChange(templateChangePlanId);
      setTemplateChangePlanId(null);
      setLastAppliedTemplateAction(null);
      setTemplateChangeMessage(
        `已撤销周期课表修改，恢复 ${result.restoredCount} 个原未来课次。`,
      );
      await onApplied();
    } catch (error) {
      setTemplateChangeMessage(error instanceof Error ? error.message : '撤销课程模板修改失败');
    } finally {
      setTemplateChangeBusy(false);
    }
  };

  const generateReplanPreview = async (request: PlanningReplanRequest) => {
    if (replanBusy) return;
    setReplanBusy(true);
    setReplanMessage('');
    setReplanPlanId(null);
    setActiveReplanRequestId(request.requestId);
    try {
      const result = await api.post<PlannerReplanPreview>(
        '/planner/replan/preview',
        {
          blockedStart: request.blockedStart,
          blockedEnd: request.blockedEnd,
          planningStart: request.planningStart,
          planningEnd: request.planningEnd,
        },
        { throwOnError: true, timeoutMs: 45_000 },
      );
      setReplanPreview(result);
      onPreviewChange?.(result);
      if (!result.affectedTaskIds.length) {
        setReplanMessage('这个冲突时段没有压到可移动任务，当前日程无需重排。');
      } else if (!result.proposals.length) {
        setReplanMessage(
          `有 ${result.affectedTaskIds.length} 项任务受影响，但当前可用范围没有足够空档。`,
        );
      } else if (result.unscheduledTaskIds.length) {
        setReplanMessage(
          `已找到 ${result.proposals.length} 项新位置，另有 ${result.unscheduledTaskIds.length} 项暂时放不下。`,
        );
      }
    } catch (error) {
      setReplanPreview(null);
      onPreviewChange?.(null);
      setReplanMessage(error instanceof Error ? error.message : '生成重排预览失败');
    } finally {
      setReplanBusy(false);
    }
  };

  const applyReplan = async (request: PlanningReplanRequest) => {
    if (
      !thread ||
      !replanPreview?.proposals.length ||
      activeReplanRequestId !== request.requestId ||
      replanBusy
    ) return;
    setReplanBusy(true);
    setReplanMessage('');
    try {
      const result = await api.post<{ planId: string; appliedCount: number }>(
        '/planner/apply',
        {
          proposals: replanPreview.proposals,
          planningThreadId: thread.id,
          planningThreadRevision: thread.revision,
          blockedIntervals: [replanPreview.blockedRange],
        },
        { throwOnError: true },
      );
      setReplanPlanId(result.planId);
      setReplanMessage(`已移动 ${result.appliedCount} 项任务；固定课程、日历事件和锁定任务保持不动。`);
      await onApplied();
      onPreviewChange?.(null);
    } catch (error) {
      setReplanMessage(error instanceof Error ? error.message : '应用重排失败');
    } finally {
      setReplanBusy(false);
    }
  };

  const undoReplan = async () => {
    if (!replanPlanId || replanBusy) return;
    setReplanBusy(true);
    setReplanMessage('');
    try {
      const result = await api.post<{ restoredCount: number }>(
        `/planner/${replanPlanId}/undo`,
        undefined,
        { throwOnError: true },
      );
      setReplanPlanId(null);
      setReplanPreview(null);
      onPreviewChange?.(null);
      setReplanMessage(`已撤销这次重排，恢复 ${result.restoredCount} 项任务原时间。`);
      await onApplied();
    } catch (error) {
      setReplanMessage(error instanceof Error ? error.message : '撤销重排失败');
    } finally {
      setReplanBusy(false);
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
                {thread?.title || threadTitle || (scopeType === 'goal' ? 'AI 学习目标规划' : 'AI 规划与调整')}
              </h2>
            </div>
            {allowNewThread && (
              <button
                type="button"
                onClick={() => void startNewPlanning()}
                disabled={loadingThread || turnBusy}
                className="flex h-9 items-center gap-1 rounded-full bg-[var(--sf-bg)] px-3 text-[10px] font-bold disabled:opacity-40"
              >
                <Plus size={13} /> 新规划
              </button>
            )}
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
              <h3 className="mt-5 text-center text-2xl font-black">
                {scopeType === 'goal' ? '把目标讲清楚，再一起拆成能执行的计划。' : '先告诉我你想解决什么。'}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-[var(--sf-text-secondary)]">
                {scopeType === 'goal'
                  ? '我会尽量了解你的成功标准、当前水平、资源、时间预算、偏好与取舍；需要考试规则或最新要求时，会先联网核实。'
                  : '我会根据你的回答继续追问真正影响计划的问题；需要当前外部信息时，会先联网核实，再形成规划依据。'}
              </p>
              <div className="mx-auto mt-6 grid max-w-sm gap-2">
                {(scopeType === 'goal'
                  ? [
                      '先问我需要了解的问题，不要急着生成计划',
                      '帮我检查这个目标有没有遗漏的重要约束',
                      '根据现在的信息先给出阶段和可执行任务',
                    ]
                  : [
                      '我想准备一项考试，帮我从现在开始规划',
                      '这周突然多了几件事，帮我重新安排',
                      '我有个长期目标，但不知道应该怎么拆',
                    ]).map((example) => (
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
                    {item.role === 'assistant' ? (
                      <Suspense fallback={<p className="whitespace-pre-wrap">{item.content}</p>}>
                        <MarkdownMessage content={item.content} />
                      </Suspense>
                    ) : (
                      <p className="whitespace-pre-wrap">{item.content}</p>
                    )}
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
                  {contextEditing ? (
                    <PlanningContextEditor
                      context={thread.planningContext}
                      saving={contextSaving}
                      onSave={(draft) => void savePlanningContext(draft)}
                      onCancel={() => {
                        setContextEditing(false);
                        setContextError('');
                      }}
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] leading-4 text-[var(--sf-text-tertiary)]">
                          这里是 AI 后续调整计划时会继续沿用的依据。
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setContextEditing(true);
                            setContextError('');
                          }}
                          className="ml-3 flex shrink-0 items-center gap-1 rounded-full bg-[var(--sf-bg)] px-3 py-1.5 text-[9px] font-bold"
                        >
                          <Pencil size={10} /> 编辑
                        </button>
                      </div>
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
                    </>
                  )}
                  {contextError && (
                    <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-600">{contextError}</p>
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

          {replanRequests.length > 0 && (
            <div className="mt-5 space-y-3">
              {replanRequests.map((request) => {
                const active = activeReplanRequestId === request.requestId;
                return (
                  <div
                    key={request.requestId}
                    className="rounded-[1.7rem] border border-[#b0a8db]/35 bg-[#f7f5fc] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#756aa8]">
                          增量重排
                        </span>
                        <h3 className="mt-1 text-sm font-black text-[#2d2940]">{request.title}</h3>
                        <p className="mt-1 text-[10px] leading-4 text-[#756f8d]">{request.reason}</p>
                      </div>
                      <Sparkles size={16} className="mt-0.5 shrink-0 text-[#756aa8]" />
                    </div>

                    <div className="mt-3 grid gap-2 rounded-2xl bg-white p-3 text-[10px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-400">临时冲突</span>
                        <strong className="text-right text-[#2d2940]">
                          {dateTimeLabel(request.blockedStart)} → {dateTimeLabel(request.blockedEnd)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-400">允许重排范围</span>
                        <strong className="text-right text-[#2d2940]">
                          {dateTimeLabel(request.planningStart)} → {dateTimeLabel(request.planningEnd)}
                        </strong>
                      </div>
                    </div>

                    {!active && (
                      <button
                        type="button"
                        onClick={() => void generateReplanPreview(request)}
                        disabled={replanBusy}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#2d2940] py-3 text-xs font-bold text-white disabled:opacity-40"
                      >
                        {replanBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        计算重排预览
                      </button>
                    )}

                    {active && replanPreview && (
                      <div className="mt-3 space-y-2">
                        {replanPreview.proposals.map((proposal) => (
                          <article key={proposal.taskId} className="rounded-2xl bg-white px-3 py-3">
                            <strong className="block text-xs text-[#2d2940]">{proposal.title}</strong>
                            <div className="mt-1.5 grid gap-1 text-[10px]">
                              <span className="text-gray-400">
                                原时间：{proposal.originalStart ? dateTimeLabel(proposal.originalStart) : '未记录'}
                                {proposal.originalEnd ? ` → ${dateTimeLabel(proposal.originalEnd)}` : ''}
                              </span>
                              <span className="font-bold text-[#756aa8]">
                                新时间：{dateTimeLabel(proposal.start)} → {dateTimeLabel(proposal.end)}
                              </span>
                            </div>
                            <p className="mt-1 text-[9px] text-gray-400">{proposal.reason}</p>
                          </article>
                        ))}

                        {replanPreview.unscheduledTaskIds.length > 0 && (
                          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
                            {replanPreview.unscheduledTaskIds.length} 项受影响任务当前无法放入允许范围。
                          </p>
                        )}

                        {!replanPlanId && replanPreview.proposals.length > 0 && (
                          <button
                            type="button"
                            onClick={() => void applyReplan(request)}
                            disabled={replanBusy}
                            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#b0a8db] py-3 text-xs font-black text-white disabled:opacity-40"
                          >
                            {replanBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            确认移动 {replanPreview.proposals.length} 项
                          </button>
                        )}

                        {replanPlanId && (
                          <button
                            type="button"
                            onClick={() => void undoReplan()}
                            disabled={replanBusy}
                            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-xs font-bold text-[#5f5687] disabled:opacity-40"
                          >
                            <RotateCcw size={14} /> 撤销本次重排
                          </button>
                        )}
                      </div>
                    )}

                    {active && replanMessage && (
                      <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-[#625a82]">{replanMessage}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {courseChangeProposals.length > 0 && (
            <div className="mt-5 rounded-[1.7rem] border border-[#b0a8db]/40 bg-[#f7f5fc] p-4">
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <CalendarClock size={15} className="text-[#6f63a8]" />
                  <h3 className="text-sm font-black text-[#2d2940]">待确认的课程变动</h3>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-[#756f8d]">
                  AI 只定位具体课次。真实写入仍经过 Course Preview → Apply → Undo，单次变动不会修改后续固定课表。
                </p>
              </div>

              <div className="space-y-3">
                {courseChangeProposals.map((action) => {
                  const active = activeCourseProposalId === action.proposalId;
                  const change = action.change;
                  const targetDetail = change.type === 'reschedule' || change.type === 'extra'
                    ? `${dateTimeLabel(change.startTime)} → ${dateTimeLabel(change.endTime)}${change.location ? ` · ${change.location}` : ''}`
                    : change.type === 'swap'
                      ? `${action.courseName} ↔ ${action.otherCourseName || '另一节课程'}`
                      : '仅取消这一次 occurrence';

                  return (
                    <article
                      key={action.proposalId}
                      className="rounded-[1.5rem] border border-black/[0.05] bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#756aa8]">
                            {courseChangeTypeLabel(change.type)}
                          </span>
                          <strong className="mt-1 block truncate text-sm text-[#2d2940]">
                            {action.courseName}
                            {change.type === 'swap' && action.otherCourseName ? ` ↔ ${action.otherCourseName}` : ''}
                          </strong>
                          <span className="mt-1 block text-[10px] leading-4 text-gray-400">
                            {targetDetail}
                          </span>
                        </div>
                        <Sparkles size={15} className="mt-0.5 shrink-0 text-[#756aa8]" />
                      </div>

                      {!active && (
                        <button
                          type="button"
                          onClick={() => void generateCourseChangePreview(action)}
                          disabled={courseChangeBusy || Boolean(courseChangePlanId) || Boolean(templateChangePlanId)}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#2d2940] py-3 text-xs font-bold text-white disabled:opacity-40"
                        >
                          {courseChangeBusy ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
                          检查冲突并生成预览
                        </button>
                      )}

                      {active && courseChangePreview && (
                        <div className="mt-3 space-y-2">
                          {courseChangePreview.changes.map((item, index) => (
                            <div
                              key={`${item.eventId || 'new'}-${index}`}
                              className="rounded-2xl bg-[#f7f5fc] px-3 py-3"
                            >
                              <strong className="block text-xs text-[#2d2940]">
                                {item.courseName} · {item.title}
                              </strong>
                              {item.from && (
                                <span className="mt-1 block text-[10px] text-gray-400">
                                  原：{dateTimeLabel(item.from.startTime)} → {dateTimeLabel(item.from.endTime)}
                                  {item.from.location ? ` · ${item.from.location}` : ''}
                                </span>
                              )}
                              <span className={`mt-1 block text-[10px] font-bold ${
                                item.action === 'cancel' ? 'text-red-500' : 'text-[#756aa8]'
                              }`}>
                                {item.action === 'cancel'
                                  ? '新：本次停课'
                                  : `新：${dateTimeLabel(item.to!.startTime)} → ${dateTimeLabel(item.to!.endTime)}${item.to!.location ? ` · ${item.to!.location}` : ''}`}
                              </span>
                            </div>
                          ))}

                          {courseChangePreview.conflicts.length > 0 && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3">
                              <strong className="text-[10px] text-red-700">发现冲突</strong>
                              <div className="mt-1.5 space-y-1">
                                {courseChangePreview.conflicts.map((item, index) => (
                                  <p
                                    key={`${item.sourceType}-${item.id}-${index}`}
                                    className="text-[10px] leading-4 text-red-600"
                                  >
                                    {item.title} · {dateTimeLabel(item.startTime)} → {dateTimeLabel(item.endTime)}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCourseProposalId(null);
                                setCourseChangePreview(null);
                                setCourseChangeMessage('');
                              }}
                              disabled={courseChangeBusy}
                              className="rounded-full bg-[#f4f4f6] py-3 text-xs font-bold text-gray-500 disabled:opacity-40"
                            >
                              暂不处理
                            </button>
                            <button
                              type="button"
                              onClick={() => void applyCourseChangeProposal(action)}
                              disabled={courseChangeBusy || courseChangePreview.conflicts.length > 0}
                              className="flex items-center justify-center gap-2 rounded-full bg-[#b0a8db] py-3 text-xs font-black text-white disabled:opacity-40"
                            >
                              {courseChangeBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              确认应用
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {courseChangeMessage && !courseChangePlanId && (
                <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-[#625a82]">
                  {courseChangeMessage}
                </p>
              )}
            </div>
          )}

          {courseChangePlanId && lastAppliedCourseAction && (
            <div className="mt-4 rounded-[1.6rem] border border-[#cae393]/60 bg-[#f7faef] p-4">
              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#72804f]">
                课程变动已应用
              </span>
              <strong className="mt-1 block text-sm text-[#242424]">
                {courseChangeTypeLabel(lastAppliedCourseAction.change.type)} · {lastAppliedCourseAction.courseName}
              </strong>
              {courseChangeMessage && (
                <p className="mt-1 text-[10px] leading-4 text-[#667252]">{courseChangeMessage}</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void undoAppliedCourseChange()}
                  disabled={courseChangeBusy}
                  className="flex items-center justify-center gap-2 rounded-full bg-white py-3 text-xs font-bold text-[#5f5687] disabled:opacity-40"
                >
                  {courseChangeBusy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  撤销本次变动
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCourseChangePlanId(null);
                    setLastAppliedCourseAction(null);
                    setCourseChangeMessage('');
                  }}
                  disabled={courseChangeBusy}
                  className="rounded-full bg-[#242424] py-3 text-xs font-black text-[#cae393] disabled:opacity-40"
                >
                  保留变动
                </button>
              </div>
            </div>
          )}

          {templateChangeProposals.length > 0 && (
            <div className="mt-5 rounded-[1.7rem] border border-[#f1c97b]/55 bg-[#fffaf0] p-4">
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <CalendarClock size={15} className="text-[#9a6c23]" />
                  <h3 className="text-sm font-black text-[#3d3221]">周期课表修改</h3>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-[#826f51]">
                  这是“以后都这样”的 Course 模板修改，不是本周单次调课。只重建生效时间之后的普通周期课次，历史课次和单次 override 保留。
                </p>
              </div>

              <div className="space-y-3">
                {templateChangeProposals.map((action) => {
                  const active = activeTemplateProposalId === action.proposalId;
                  const requested = [
                    action.changes.dayOfWeek
                      ? `星期 → ${courseDayLabels[action.changes.dayOfWeek] || action.changes.dayOfWeek}`
                      : null,
                    action.changes.startTime ? `开始 → ${action.changes.startTime}` : null,
                    action.changes.endTime ? `结束 → ${action.changes.endTime}` : null,
                    action.changes.room !== undefined ? `教室 → ${action.changes.room || '清空'}` : null,
                    action.changes.location !== undefined ? `地点 → ${action.changes.location || '清空'}` : null,
                  ].filter(Boolean);

                  return (
                    <article
                      key={action.proposalId}
                      className="rounded-[1.5rem] border border-black/[0.05] bg-white p-4"
                    >
                      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9a6c23]">
                        Recurring Course Template
                      </span>
                      <strong className="mt-1 block text-sm text-[#3d3221]">{action.courseName}</strong>
                      <span className="mt-1 block text-[10px] leading-4 text-gray-400">
                        从 {dateTimeLabel(action.effectiveFrom)} 生效
                      </span>
                      {requested.length > 0 && (
                        <span className="mt-1 block text-[10px] leading-4 text-[#826f51]">
                          {requested.join(' · ')}
                        </span>
                      )}

                      {!active && (
                        <button
                          type="button"
                          onClick={() => void generateTemplateChangePreview(action)}
                          disabled={templateChangeBusy || Boolean(templateChangePlanId) || Boolean(courseChangePlanId)}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#3d3221] py-3 text-xs font-bold text-white disabled:opacity-40"
                        >
                          {templateChangeBusy ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
                          预览未来周期变化
                        </button>
                      )}

                      {active && templateChangePreview && (
                        <div className="mt-3 space-y-2">
                          <div className="rounded-2xl bg-[#fffaf0] px-3 py-3 text-[10px] leading-5">
                            <span className="block text-gray-400">
                              原规则：{templateStateLabel(templateChangePreview.before)}
                            </span>
                            <strong className="block text-[#8a611f]">
                              新规则：{templateStateLabel(templateChangePreview.after)}
                            </strong>
                            <span className="block text-gray-400">
                              将生成 {templateChangePreview.generatedOccurrences.length} 个未来普通课次
                              {templateChangePreview.preservedOverrideCount
                                ? ` · 保留 ${templateChangePreview.preservedOverrideCount} 个单次 override`
                                : ''}
                            </span>
                          </div>

                          {templateChangePreview.generatedOccurrences.length > 0 && (
                            <div className="space-y-1 rounded-2xl bg-[#f8f8f8] px-3 py-3">
                              {templateChangePreview.generatedOccurrences.slice(0, 4).map((item) => (
                                <p key={`${item.week}-${item.startTime}`} className="text-[10px] text-gray-500">
                                  第 {item.week} 周 · {dateTimeLabel(item.startTime)} → {dateTimeLabel(item.endTime)}
                                  {item.location ? ` · ${item.location}` : ''}
                                </p>
                              ))}
                              {templateChangePreview.generatedOccurrences.length > 4 && (
                                <p className="text-[9px] text-gray-400">
                                  另有 {templateChangePreview.generatedOccurrences.length - 4} 个未来课次
                                </p>
                              )}
                            </div>
                          )}

                          {templateChangePreview.conflicts.length > 0 && (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3">
                              <strong className="text-[10px] text-red-700">新周期规则存在冲突</strong>
                              <div className="mt-1.5 space-y-1">
                                {templateChangePreview.conflicts.slice(0, 8).map((item, index) => (
                                  <p
                                    key={`${item.sourceType}-${item.id}-${index}`}
                                    className="text-[10px] leading-4 text-red-600"
                                  >
                                    {item.title} · {dateTimeLabel(item.startTime)} → {dateTimeLabel(item.endTime)}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTemplateProposalId(null);
                                setTemplateChangePreview(null);
                                setTemplateChangeMessage('');
                              }}
                              disabled={templateChangeBusy}
                              className="rounded-full bg-[#f4f4f6] py-3 text-xs font-bold text-gray-500 disabled:opacity-40"
                            >
                              暂不处理
                            </button>
                            <button
                              type="button"
                              onClick={() => void applyTemplateChangeProposal(action)}
                              disabled={templateChangeBusy || templateChangePreview.conflicts.length > 0}
                              className="flex items-center justify-center gap-2 rounded-full bg-[#f1c97b] py-3 text-xs font-black text-[#3d3221] disabled:opacity-40"
                            >
                              {templateChangeBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              确认修改周期
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {templateChangeMessage && !templateChangePlanId && (
                <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-[#826f51]">
                  {templateChangeMessage}
                </p>
              )}
            </div>
          )}

          {templateChangePlanId && lastAppliedTemplateAction && (
            <div className="mt-4 rounded-[1.6rem] border border-[#f1c97b]/60 bg-[#fffaf0] p-4">
              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#9a6c23]">
                周期课表已修改
              </span>
              <strong className="mt-1 block text-sm text-[#3d3221]">
                {lastAppliedTemplateAction.courseName}
              </strong>
              {templateChangeMessage && (
                <p className="mt-1 text-[10px] leading-4 text-[#826f51]">{templateChangeMessage}</p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void undoAppliedTemplateChange()}
                  disabled={templateChangeBusy}
                  className="flex items-center justify-center gap-2 rounded-full bg-white py-3 text-xs font-bold text-[#8a611f] disabled:opacity-40"
                >
                  {templateChangeBusy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  撤销周期修改
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTemplateChangePlanId(null);
                    setLastAppliedTemplateAction(null);
                    setTemplateChangeMessage('');
                  }}
                  disabled={templateChangeBusy}
                  className="rounded-full bg-[#3d3221] py-3 text-xs font-black text-white disabled:opacity-40"
                >
                  保留新周期
                </button>
              </div>
            </div>
          )}

          {directActionProposals.length > 0 && (
            <div className="mt-5 rounded-[1.7rem] border border-[#cae393]/60 bg-[#f7faef] p-4">
              <div className="mb-3">
                <h3 className="text-sm font-black text-[#242424]">待确认的任务 / 目标操作</h3>
                <p className="mt-1 text-[10px] leading-4 text-[#667252]">
                  AI 只是提出草案。你可以取消任意一项，确认后才会写入 Task 或学习目标。
                </p>
              </div>
              <div className="space-y-2">
                {directActionProposals.map((action) => {
                  const selected = selectedActionIds.includes(action.proposalId);
                  const details = action.type === 'create_task'
                    ? [
                        action.milestoneTitle ? `阶段：${action.milestoneTitle}` : null,
                        action.priority ? `优先级：${action.priority}` : null,
                        action.estimatedMinutes ? `${action.estimatedMinutes} 分钟` : null,
                        action.dueDate ? `截止：${new Date(action.dueDate).toLocaleString('zh-CN')}` : null,
                      ].filter(Boolean)
                    : action.type === 'update_task'
                      ? [
                          action.changes.milestoneTitle !== undefined
                            ? `阶段 → ${action.changes.milestoneTitle || '待整理'}`
                            : null,
                          action.changes.priority ? `优先级 → ${action.changes.priority}` : null,
                          action.changes.estimatedMinutes !== undefined ? `时长 → ${action.changes.estimatedMinutes ?? '未设置'} 分钟` : null,
                          action.changes.dueDate !== undefined
                            ? `截止 → ${action.changes.dueDate ? new Date(action.changes.dueDate).toLocaleString('zh-CN') : '清除'}`
                            : null,
                        ].filter(Boolean)
                      : [
                          action.changes.name ? `目标 → ${action.changes.name}` : null,
                          action.changes.description !== undefined
                            ? `目标说明 → ${action.changes.description || '清空'}`
                            : null,
                        ].filter(Boolean);
                  const actionLabel = action.type === 'create_task'
                    ? '新增任务'
                    : action.type === 'update_task'
                      ? '修改任务'
                      : '修改学习目标';
                  const actionTitle = action.type === 'create_task'
                    ? action.title
                    : action.type === 'update_task'
                      ? action.taskTitle
                      : action.goalTitle;
                  return (
                    <button
                      type="button"
                      key={action.proposalId}
                      onClick={() => toggleAction(action.proposalId)}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left ${
                        selected ? 'border-[#9fbd61] bg-white' : 'border-black/[0.05] bg-white/60 opacity-60'
                      }`}
                    >
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${
                        selected ? 'border-[#9fbd61] bg-[#cae393]' : 'border-gray-300'
                      }`}>
                        {selected && <Check size={11} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#72804f]">
                          {actionLabel}
                        </span>
                        <strong className="mt-0.5 block text-xs text-[#242424]">
                          {actionTitle}
                        </strong>
                        {action.type === 'create_task' && action.description && (
                          <span className="mt-1 block text-[10px] leading-4 text-gray-500">{action.description}</span>
                        )}
                        {action.type === 'update_task' && action.changes.title && (
                          <span className="mt-1 block text-[10px] text-gray-500">标题 → {action.changes.title}</span>
                        )}
                        {details.length > 0 && (
                          <span className="mt-1.5 block text-[9px] leading-4 text-gray-400">
                            {details.join(' · ')}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => void applyActions()}
                disabled={!selectedActionIds.length || actionBusy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#242424] py-3 text-xs font-black text-[#cae393] disabled:opacity-35"
              >
                {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                确认应用 {selectedActionIds.length} 项
              </button>
              {actionMessage && (
                <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-[#56613f]">{actionMessage}</p>
              )}
            </div>
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
          {voice.state === 'recording' && (
            <div className="mb-2 flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2.5">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="flex-1 text-xs font-bold text-red-700">
                正在录音 · {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={voice.cancel}
                className="grid h-8 w-8 place-items-center rounded-full bg-white text-red-400"
                aria-label="取消录音"
              >
                <X size={13} />
              </button>
              <button
                type="button"
                onClick={voice.stop}
                className="flex h-8 items-center gap-1 rounded-full bg-red-600 px-3 text-[10px] font-bold text-white"
              >
                <Square size={10} fill="currentColor" /> 完成
              </button>
            </div>
          )}
          {voice.state === 'transcribing' && (
            <div className="mb-2 flex items-center gap-2 rounded-2xl bg-[#f4f2fb] px-3 py-2.5 text-xs font-bold text-[#62578f]">
              <Loader2 size={13} className="animate-spin" /> 正在转写语音，完成后会放回输入框供你修改…
            </div>
          )}
          {voice.error && (
            <button
              type="button"
              onClick={voice.clearError}
              className="mb-2 w-full rounded-2xl bg-amber-50 px-3 py-2.5 text-left text-xs text-amber-800"
            >
              {voice.error}
            </button>
          )}
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
              onClick={() => void voice.start()}
              disabled={!voice.supported || voice.state !== 'idle' || turnBusy || loadingThread}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[var(--sf-text-secondary)] disabled:opacity-30"
              aria-label={voice.supported ? '语音输入' : '当前环境未配置语音输入'}
              title={voice.supported ? '语音输入' : '当前环境未配置语音输入'}
            >
              <Mic size={16} />
            </button>
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!messageInput.trim() || turnBusy || loadingThread || voice.state !== 'idle'}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#242424] text-[#cae393] disabled:opacity-30"
              aria-label="发送给 AI"
            >
              {turnBusy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="mt-2 text-center text-[9px] text-[var(--sf-text-tertiary)]">
            语音只用于本次转写，不保存原录音；发送前可编辑文字。AI 会继续沿用已确认的规划依据。
          </p>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
