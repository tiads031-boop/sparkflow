import { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Check, ArrowRight, Plus, Trash2,
  Play, Pause, RotateCcw, CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { Task, Subtask } from '../store/appStore';
import { resolveMentions } from '../utils/mentionUtils';

interface ModalConfig {
  isOpen: boolean;
  mode: 'create' | 'edit';
  context: 'task' | 'spark';
  data: any;
}

export interface SaveParams {
  id?: string;
  title: string;
  content: string;
  context: string;
  status?: Task['status'];
  priority?: Task['priority'];
  dueDate?: string;
  section?: 'project' | 'personal';
  subtasks?: Subtask[];
  project?: string;
}

interface Props {
  config: ModalConfig;
  onClose: () => void;
  onSave: (params: SaveParams) => void;
  onDelete: (id: string, context: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
}

const LAYERS = [
  { rot: 0, ty: 0, sc: 1, z: 10, op: 1, sh: '0 22px 65px rgba(0,0,0,0.72)' },
  { rot: -6.5, ty: 12, sc: 0.97, z: 9, op: 1, sh: '0 12px 38px rgba(0,0,0,0.54)' },
  { rot: 6.5, ty: 12, sc: 0.97, z: 8, op: 0.9, sh: '0 7px 24px rgba(0,0,0,0.4)' },
  { rot: 0, ty: 22, sc: 0.94, z: 7, op: 0 },
];

export default function DarkFrostedModal({ config, onClose, onSave, onDelete, onToggleSubtask }: Props) {
  const isCreate = config.mode === 'create';
  const isTask = config.context === 'task';

  // ---- form state (shared between create and card 0 of edit) ----
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<Task['status']>('To do');
  const [priority, setPriority] = useState<Task['priority']>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [section, setSection] = useState<'project' | 'personal'>('personal');
  const [folder, setFolder] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ---- subtask state (edit mode only) ----
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // ---- deadline toggle & notification confirm ----
  const [hasDueDate, setHasDueDate] = useState(false);
  const [showNotifyConfirm, setShowNotifyConfirm] = useState(false);

  // ---- 3D card state ----
  const [order, setOrder] = useState([0, 1, 2]);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(0);
  const isBusy = useRef(false);

  // ---- pomodoro from store ----
  const pomodoro = useAppStore((s) => s.pomodoro);
  const startPomodoroStore = useAppStore((s) => s.startPomodoro);
  const pausePomodoroStore = useAppStore((s) => s.pausePomodoro);
  const resumePomodoroStore = useAppStore((s) => s.resumePomodoro);
  const stopPomodoroStore = useAppStore((s) => s.stopPomodoro);
  const completePomodoroStore = useAppStore((s) => s.completePomodoro);
  const tasks = useAppStore((s) => s.tasks);

  const contentMentions = useMemo(() => {
    if (!content) return { projectMentions: [] as string[], taskMentions: [] as { id: string; title: string }[] };
    const mentions = content.match(/@([^\s@]+)/g);
    if (!mentions) return { projectMentions: [] as string[], taskMentions: [] as { id: string; title: string }[] };
    return resolveMentions(mentions, tasks, config.data?.id);
  }, [content, tasks, config.data?.id]);

  const hasMentionMatches = contentMentions.projectMentions.length > 0 || contentMentions.taskMentions.length > 0;

  useEffect(() => {
    if (config.isOpen) {
      if (isCreate) {
        setTitle('');
        setContent('');
        setStatus('To do');
        setPriority('Medium');
        setDueDate('');
        setSection('personal');
        setFolder('');
        setHasDueDate(false);
      } else if (config.data) {
        const hasExistingDueDate = !!config.data.dueDate;
        // 将 UTC ISO 字符串还原为本地时间格式供 datetime-local 输入框使用
        let localDueDate = '';
        if (config.data.dueDate) {
          const d = new Date(config.data.dueDate);
          localDueDate = d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + 'T' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
        }
        setTitle(config.data.title || '');
        setContent(config.data.description || config.data.text || '');
        setStatus(config.data.status || 'To do');
        setPriority(config.data.priority || 'Medium');
        setDueDate(localDueDate);
        setSection(config.data.section || 'personal');
        setFolder(config.data.project || '');
        setSubtasks(config.data.subtasks || []);
        setHasDueDate(hasExistingDueDate);
      }
      setOrder([0, 1, 2]);
      setDragOffset(0);
      setShowDeleteConfirm(false);
      setShowNotifyConfirm(false);
    }
  }, [config.isOpen, isCreate, config.data]);

  if (!config.isOpen) return null;

  const doSave = (_notifyBeforeDeadline = false) => {
    if (!title.trim() && !content.trim()) return onClose();
    const saveParams: SaveParams = {
      id: isCreate ? undefined : config.data?.id,
      title,
      content,
      context: config.context,
      status: isTask ? status : undefined,
      priority: isTask ? priority : undefined,
      dueDate: isTask ? (hasDueDate && dueDate ? dueDate : undefined) : undefined,
      section: isTask ? section : undefined,
      project: isTask ? (folder || undefined) : undefined,
      subtasks: isTask && !isCreate ? subtasks : undefined,
    };
    onSave(saveParams);
    // notifyBeforeDeadline 标记可在后续版本中扩展存入 task
    onClose();
  };

  const handleSave = () => {
    // 如果设置了截止时间且尚未确认通知，弹出确认弹窗
    if (isTask && hasDueDate && dueDate && !showNotifyConfirm) {
      setShowNotifyConfirm(true);
      return;
    }
    doSave();
  };

  const handleDelete = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    onDelete(config.data.id, config.context);
    setShowDeleteConfirm(false);
    onClose();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // ---- pointer handlers for 3D card stack ----
  const isInteractive = (target: EventTarget | null) => {
    const el = target as HTMLElement;
    return !!(
      el.closest('button') ||
      el.closest('input') ||
      el.closest('textarea') ||
      el.closest('select') ||
      el.closest('label') ||
      el.closest('[data-no-drag]')
    );
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCreate || isBusy.current || isInteractive(e.target)) return;
    setIsDragging(true);
    dragStart.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isCreate || isBusy.current) return;
    setDragOffset(e.clientX - dragStart.current);
  };

  const handlePointerUp = () => {
    if (!isDragging || isCreate || isBusy.current) return;
    setIsDragging(false);
    if (Math.abs(dragOffset) > 88) {
      isBusy.current = true;
      const flyOutOffset = dragOffset > 0 ? 500 : -500;
      setDragOffset(flyOutOffset);
      setTimeout(() => {
        setOrder((prev) => [prev[1], prev[2], prev[0]]);
        setDragOffset(0);
        isBusy.current = false;
      }, 350);
    } else {
      setDragOffset(0);
    }
  };

  // ---- card content renderers ----
  const cardLabels = ['编辑', '专注', '子任务'];

  const renderEditCard = () => (
    <div className="flex flex-col h-full" data-no-drag>
      <span className="text-[10px] text-[#cae393] font-bold tracking-widest uppercase mb-4">Edit</span>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="bg-transparent border-b border-white/20 text-white text-lg font-bold outline-none placeholder:text-white/30 pb-2 mb-3"
        placeholder="任务名称..."
      />

      {/* Description */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="bg-transparent border-none text-white/80 text-sm outline-none placeholder:text-white/20 resize-none h-12 mb-2"
        placeholder="添加描述..."
      />

      {/* @mention preview */}
      {hasMentionMatches && (
        <div className="mb-3 max-h-[60px] overflow-y-auto rounded-lg bg-white/5 p-2 space-y-0.5">
          {contentMentions.projectMentions.map((p) => (
            <div key={`p-${p}`} className="flex items-center gap-1.5 text-[10px] text-white/60">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#b0a8db' }} />
              <span className="truncate">{p}</span>
              <span className="text-[8px] text-white/25 flex-shrink-0 ml-auto">项目</span>
            </div>
          ))}
          {contentMentions.taskMentions.map((t) => (
            <div key={`t-${t.id}`} className="flex items-center gap-1.5 text-[10px] text-white/60">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#cae393' }} />
              <span className="truncate">{t.title}</span>
              <span className="text-[8px] text-white/25 flex-shrink-0 ml-auto">任务</span>
            </div>
          ))}
        </div>
      )}

      {/* Status */}
      <div className="mb-3">
        <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">状态</span>
        <div className="flex gap-1 flex-wrap">
          {(['To do', 'In progress', 'In review', 'Done', 'Cancelled'] as Task['status'][]).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                status === s
                  ? 'bg-[#cae393] text-[#242424]'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div className="mb-3">
        <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">优先级</span>
        <div className="flex gap-1.5">
          {(['High Priority', 'Medium', 'Low'] as Task['priority'][]).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                priority === p
                  ? p === 'High Priority' ? 'bg-[#242424] text-white' :
                    p === 'Medium' ? 'bg-[#cae393] text-[#242424]' : 'bg-[#b0a8db] text-[#242424]'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              {p === 'High Priority' ? 'P0' : p === 'Medium' ? 'P1' : 'P2'}
            </button>
          ))}
        </div>
      </div>

      {/* Section + Folder row */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">分类</span>
          <div className="flex gap-1 mb-2">
            {(['project', 'personal'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setSection(c)}
                className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                  section === c
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {c === 'project' ? '项目' : '个人'}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder={section === 'project' ? '项目名称（可选）' : '文件夹名称（可选）'}
            className="w-full bg-white/10 text-white text-[10px] px-2 py-1 rounded-lg outline-none border border-white/10 focus:border-[#cae393]/50 placeholder:text-white/20 transition-all"
          />
        </div>
      </div>

      {/* Deadline toggle */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase">
            截止时间
          </span>
          <button
            onClick={() => { setHasDueDate(!hasDueDate); if (!hasDueDate) setDueDate(''); }}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              hasDueDate ? 'bg-[#cae393]' : 'bg-white/15'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                hasDueDate ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
        {hasDueDate && (
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-white/10 text-white text-[10px] px-2 py-1 rounded-lg outline-none border border-white/10 focus:border-[#cae393]/50 w-full animate-in fade-in"
          />
        )}
        {!hasDueDate && (
          <p className="text-[10px] text-white/20 italic">不设置截止时间</p>
        )}
      </div>

      {/* Delete */}
      {!isCreate && (
        <div className="mt-auto">
          <button
            onClick={handleDelete}
            className={`w-full py-2 rounded-xl text-xs font-medium transition-all ${
              showDeleteConfirm
                ? 'bg-red-500 text-white'
                : 'bg-red-500/20 text-red-400 hover:bg-red-500/40'
            }`}
          >
            {showDeleteConfirm ? '再点一次确认删除' : '删除任务'}
          </button>
        </div>
      )}
    </div>
  );

  const renderPomodoroCard = () => {
    const timerSec = pomodoro.timeLeft;
    const isRunning = pomodoro.isRunning;
    const isPaused = pomodoro.isPaused;
    const timerProgress = timerSec / (25 * 60);
    const timerCircumference = 2 * Math.PI * 72;
    const timerOffset = timerCircumference * (1 - timerProgress);

    return (
      <div className="flex flex-col items-center justify-center h-full" data-no-drag>
        <span className="text-[10px] text-[#b0a8db] font-bold tracking-widest uppercase mb-4 self-start">
          Focus Timer
        </span>
        <div className="relative w-[130px] h-[130px] rounded-full border-[5px] border-white/10 flex items-center justify-center mb-5">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="65" cy="65" r="58"
              stroke="#b0a8db" strokeWidth="5"
              fill="transparent"
              strokeDasharray={timerCircumference}
              strokeDashoffset={timerOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <span className="text-3xl font-light text-white tracking-tighter">
            {formatTime(timerSec)}
          </span>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => stopPomodoroStore()}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={() => {
              if (isRunning) {
                if (isPaused) resumePomodoroStore(); else pausePomodoroStore();
              } else {
                if (timerSec <= 0 || timerSec === 25 * 60) {
                  startPomodoroStore(config.data?.id);
                } else {
                  resumePomodoroStore();
                }
              }
            }}
            className="w-12 h-12 rounded-full bg-[#b0a8db] flex items-center justify-center text-[#242424] shadow-[0_0_20px_rgba(176,168,219,0.3)] hover:scale-105 transition-transform"
          >
            {isRunning && !isPaused ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <button
            onClick={() => {
              if (timerSec <= 0 || !isRunning) {
                completePomodoroStore();
              } else {
                stopPomodoroStore();
              }
            }}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
          >
            <Check size={16} />
          </button>
        </div>
      </div>
    );
  };

  const handleToggleSubtaskLocal = (subtaskId: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s))
    );
    if (onToggleSubtask && config.data?.id) {
      onToggleSubtask(config.data.id, subtaskId);
    }
  };

  const handleAddSubtask = () => {
    const t = newSubtaskTitle.trim();
    if (!t) return;
    const id = `${config.data?.id || 'new'}-sub-${Date.now()}`;
    setSubtasks((prev) => [...prev, { id, title: t, completed: false }]);
    setNewSubtaskTitle('');
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
  };

  const renderSubtaskCard = () => (
    <div className="flex flex-col h-full" data-no-drag>
      <span className="text-[10px] text-[#cae393] font-bold tracking-widest uppercase mb-3">
        子任务
      </span>
      <h3 className="text-lg font-bold text-white leading-tight mb-4 truncate">
        {title || '任务详情'}
      </h3>
      <div className="space-y-3 overflow-y-auto hide-scrollbar flex-1">
        {isTask && subtasks.length > 0 ? (
          subtasks.map((sub) => (
            <div key={sub.id} className="flex items-start gap-3 group">
              <button
                onClick={() => handleToggleSubtaskLocal(sub.id)}
                className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 transition-colors shrink-0 ${
                  sub.completed
                    ? 'bg-[#cae393] text-[#242424]'
                    : 'border-2 border-white/30 text-transparent group-hover:border-white/60'
                }`}
              >
                <CheckCircle2 size={12} strokeWidth={3} />
              </button>
              <span
                className={`flex-1 text-sm leading-snug pt-0.5 ${
                  sub.completed ? 'text-white/40 line-through' : 'text-white/90'
                }`}
              >
                {sub.title}
              </span>
              <button
                onClick={() => handleDeleteSubtask(sub.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-white/30 hover:text-red-400 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <div className="text-white/40 text-sm">暂无子任务，点击下方添加</div>
        )}
      </div>

      {/* Add subtask input */}
      {isTask && (
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(); }}
            placeholder="新子任务..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-[#cae393]/40"
          />
          <button
            onClick={handleAddSubtask}
            className="w-9 h-9 rounded-xl bg-[#cae393]/20 text-[#cae393] flex items-center justify-center hover:bg-[#cae393]/30 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );

  const renderCard = (cardIndex: number, logicIndex: number) => {
    const isTop = logicIndex === 0;
    const L = LAYERS[logicIndex] || LAYERS[3];

    let currentTransform = `rotate(${L.rot}deg) translateY(${L.ty}px) scale(${L.sc})`;
    let currentOpacity = L.op;

    if (isDragging && !isCreate) {
      const prog = Math.min(Math.abs(dragOffset) / 100, 1);
      if (isTop) {
        currentTransform = `translateX(${dragOffset}px) translateY(${Math.abs(dragOffset) * 0.07}px) rotate(${dragOffset * 0.075}deg)`;
      } else {
        const prevL = LAYERS[logicIndex - 1];
        const r = L.rot + (prevL.rot - L.rot) * prog;
        const ty = L.ty + (prevL.ty - L.ty) * prog;
        const sc = L.sc + (prevL.sc - L.sc) * prog;
        const op = L.op + (prevL.op - L.op) * prog;
        currentTransform = `rotate(${r}deg) translateY(${ty}px) scale(${sc})`;
        currentOpacity = op;
      }
    }

    let transitionStyle = isDragging
      ? 'none'
      : 'transform 0.4s cubic-bezier(0.34,1.18,0.64,1), opacity 0.38s ease, box-shadow 0.38s ease';

    if (Math.abs(dragOffset) === 500 && isTop) {
      transitionStyle = 'transform 0.4s cubic-bezier(0.4,0,1,1), opacity 0.3s ease';
      currentTransform = `translateX(${dragOffset}px) rotate(${dragOffset > 0 ? 28 : -28}deg)`;
      currentOpacity = 0;
    }

    const contentNode =
      cardIndex === 0 ? renderEditCard() :
      cardIndex === 1 ? renderPomodoroCard() :
      renderSubtaskCard();

    return (
      <div
        key={cardIndex}
        className="absolute w-full h-full bg-[#272727] backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 flex flex-col overflow-hidden will-change-transform"
        style={{
          transform: currentTransform,
          opacity: currentOpacity,
          zIndex: L.z,
          boxShadow: L.sh,
          transition: transitionStyle,
          transformOrigin: 'center 105%',
        }}
      >
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        {contentNode}
      </div>
    );
  };

  // ---- CREATE MODE: simple form (no 3D) ----
  if (isCreate) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0F0F0F] overflow-hidden" style={{ animation: 'fade-in 0.3s ease' }}>
        <div className="absolute inset-0 noise-bg opacity-[0.25] mix-blend-overlay pointer-events-none z-0" />

        {/* Top bar */}
        <div className="relative z-20 flex justify-between items-center p-5 text-white">
          <button
            onClick={onClose}
            className="p-2 bg-white/10 rounded-full backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors z-50"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="font-medium tracking-wider text-sm opacity-60">
            新建{isTask ? '任务' : '灵感'}
          </span>
          <div className="w-10" />
        </div>

        {/* Form */}
        <div className="relative z-20 flex flex-col items-center justify-start pt-4 h-[calc(100%-140px)] overflow-y-auto">
          <div className="w-[90%] max-w-[360px] space-y-4 pb-8">
            <div>
              <span className="text-[10px] text-[#cae393] font-bold tracking-widest uppercase block mb-1.5">
                {isTask ? '任务名称' : '灵感内容'}
              </span>
              <input
                autoFocus
                type="text"
                placeholder={isTask ? '输入任务名称...' : '记录灵感...'}
                className="w-full bg-transparent border-b border-white/20 text-white text-lg font-bold outline-none placeholder:text-white/30 pb-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">描述</span>
              <textarea
                placeholder="添加细节描述..."
                className="w-full bg-transparent border-none text-white/80 text-sm outline-none placeholder:text-white/20 resize-none h-16"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              {/* @mention preview */}
              {hasMentionMatches && (
                <div className="mt-2 max-h-[60px] overflow-y-auto rounded-lg bg-white/5 p-2 space-y-0.5">
                  {contentMentions.projectMentions.map((p) => (
                    <div key={`cp-${p}`} className="flex items-center gap-1.5 text-[10px] text-white/60">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#b0a8db' }} />
                      <span className="truncate">{p}</span>
                      <span className="text-[8px] text-white/25 flex-shrink-0 ml-auto">项目</span>
                    </div>
                  ))}
                  {contentMentions.taskMentions.map((t) => (
                    <div key={`ct-${t.id}`} className="flex items-center gap-1.5 text-[10px] text-white/60">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#cae393' }} />
                      <span className="truncate">{t.title}</span>
                      <span className="text-[8px] text-white/25 flex-shrink-0 ml-auto">任务</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isTask && (
              <>
                <div>
                  <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">状态</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['To do', 'In progress', 'In review', 'Done', 'Cancelled'] as Task['status'][]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                          status === s
                            ? 'bg-[#cae393] text-[#242424]'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">优先级</span>
                  <div className="flex gap-1.5">
                    {(['High Priority', 'Medium', 'Low'] as Task['priority'][]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                          priority === p
                            ? p === 'High Priority' ? 'bg-[#242424] text-white' :
                              p === 'Medium' ? 'bg-[#cae393] text-[#242424]' : 'bg-[#b0a8db] text-[#242424]'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                      >
                        {p === 'High Priority' ? 'P0' : p === 'Medium' ? 'P1' : 'P2'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">分类</span>
                  <div className="flex gap-1.5 mb-2">
                    {(['project', 'personal'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setSection(c)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                          section === c
                            ? 'bg-white/20 text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                      >
                        {c === 'project' ? '项目待办' : '个人待办'}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    placeholder={section === 'project' ? '项目名称（可选）' : '文件夹名称（可选）'}
                    className="w-full bg-white/10 text-white text-[11px] px-3 py-1.5 rounded-xl outline-none border border-white/10 focus:border-[#cae393]/50 placeholder:text-white/20 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase">
                      截止时间
                    </span>
                    <button
                      onClick={() => { setHasDueDate(!hasDueDate); if (!hasDueDate) setDueDate(''); }}
                      className={`relative w-9 h-5 rounded-full transition-colors ${
                        hasDueDate ? 'bg-[#cae393]' : 'bg-white/15'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          hasDueDate ? 'left-[18px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  {hasDueDate && (
                    <input
                      type="datetime-local"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="bg-white/10 text-white text-xs px-3 py-1.5 rounded-xl outline-none border border-white/10 focus:border-[#cae393]/50 w-full animate-in fade-in"
                    />
                  )}
                  {!hasDueDate && (
                    <p className="text-[10px] text-white/20 italic">不设置截止时间</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom action */}
        <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#080808] via-[#0F0F0F]/90 to-transparent z-10">
          <div
            className="flex justify-between items-center cursor-pointer group"
            onClick={handleSave}
          >
            <span className="text-white/50 text-sm font-medium ml-2 uppercase tracking-wider group-hover:text-white transition-colors">
              保存
            </span>
            <button className="w-12 h-12 rounded-full bg-[#cae393] text-[#242424] flex items-center justify-center shadow-[0_10px_20px_rgba(202,227,147,0.2)] hover:scale-105 active:scale-95 transition-transform">
              <Check size={22} />
            </button>
          </div>
        </div>

        {/* Notification confirmation overlay (create mode) */}
        {showNotifyConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ animation: 'fade-in 0.2s ease' }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => { setShowNotifyConfirm(false); doSave(); }} />
            <div className="relative bg-[#1e1e1e] border border-white/10 rounded-[2rem] p-6 mx-6 w-full max-w-[300px] shadow-2xl" style={{ animation: 'zoom-in-95 0.25s ease' }}>
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-[#cae393]/20 flex items-center justify-center mx-auto mb-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cae393" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">截止前提醒</h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  已设置截止时间为<br />
                  <span className="text-[#cae393] font-medium">
                    {dueDate ? new Date(dueDate).toLocaleString('zh-CN', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    }) : ''}
                  </span>
                  <br />
                  是否需要截止前提醒？
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowNotifyConfirm(false); doSave(); }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/10 text-white/60 hover:bg-white/15 transition-colors"
                >
                  不需要
                </button>
                <button
                  onClick={() => { setShowNotifyConfirm(false); doSave(true); }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-[#cae393] text-[#242424] hover:bg-[#b8d481] transition-colors"
                >
                  需要提醒
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- EDIT MODE: 3D card stack ----
  return (
    <div className="fixed inset-0 z-[100] bg-[#0F0F0F] overflow-hidden" style={{ animation: 'fade-in 0.3s ease' }}>
      <div className="absolute inset-0 noise-bg opacity-[0.25] mix-blend-overlay pointer-events-none z-0" />

      {/* Top bar */}
      <div className="relative z-20 flex justify-between items-center p-5 text-white">
        <button
          onClick={onClose}
          className="p-2 bg-white/10 rounded-full backdrop-blur-md border border-white/10 hover:bg-white/20 transition-colors z-50"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="font-medium tracking-wider text-sm opacity-60">
          {cardLabels[order[0]]} · {title || '任务'}
        </span>
        <div className="w-10" />
      </div>

      {/* Center card area */}
      <div className="relative z-20 flex flex-col items-center justify-center h-[60%] w-full">
        <div
          className="relative w-[85%] max-w-[340px] h-full max-h-[480px] touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {order.map((cardIndex, logicIndex) => renderCard(cardIndex, logicIndex))}
        </div>
      </div>

      {/* Bottom action */}
      <div className="absolute bottom-0 left-0 w-full p-7 bg-gradient-to-t from-[#080808] via-[#0F0F0F]/90 to-transparent z-10 pb-10 pointer-events-none">
        <div className="pointer-events-auto">
          <h2 className="text-2xl font-bold text-white mb-2 leading-tight">
            {cardLabels[order[0]]}
          </h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed max-w-[85%]">
            {order[0] === 0
              ? '左右滑动切换卡片，在此编辑任务信息。'
              : order[0] === 1
                ? '开始一个 25 分钟的专注时段。'
                : '在此添加、勾选或删除子任务，点击保存提交。'}
          </p>
          <div className="flex justify-between items-center">
            {/* Dot indicators */}
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    order[0] === i ? 'bg-[#cae393] w-4' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
            {/* Save button (only on edit card) */}
            {(order[0] === 0 || order[0] === 2) && (
              <button
                onClick={handleSave}
                className="w-12 h-12 rounded-full bg-[#cae393] text-[#242424] flex items-center justify-center shadow-[0_10px_20px_rgba(202,227,147,0.2)] hover:scale-105 active:scale-95 transition-transform"
              >
                <Check size={22} />
              </button>
            )}
            {order[0] === 1 && (
              <button
                onClick={() => {
                  setOrder((prev) => [prev[1], prev[2], prev[0]]);
                }}
                className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-transform"
              >
                <ArrowRight size={22} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notification confirmation overlay (edit mode) */}
      {showNotifyConfirm && (
        <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ animation: 'fade-in 0.2s ease' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowNotifyConfirm(false); doSave(); }} />
          <div className="relative bg-[#1e1e1e] border border-white/10 rounded-[2rem] p-6 mx-6 w-full max-w-[300px] shadow-2xl" style={{ animation: 'zoom-in-95 0.25s ease' }}>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-[#cae393]/20 flex items-center justify-center mx-auto mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cae393" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white mb-1">截止前提醒</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                已设置截止时间为<br />
                <span className="text-[#cae393] font-medium">
                  {dueDate ? new Date(dueDate).toLocaleString('zh-CN', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  }) : ''}
                </span>
                <br />
                是否需要截止前提醒？
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNotifyConfirm(false); doSave(); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/10 text-white/60 hover:bg-white/15 transition-colors"
              >
                不需要
              </button>
              <button
                onClick={() => { setShowNotifyConfirm(false); doSave(true); }}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-[#cae393] text-[#242424] hover:bg-[#b8d481] transition-colors"
              >
                需要提醒
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
