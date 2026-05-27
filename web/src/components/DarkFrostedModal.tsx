import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Check, ArrowRight,
  Play, Pause, RotateCcw, CheckCircle2,
} from 'lucide-react';
import type { Task } from '../store/appStore';

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
  column?: 'project' | 'personal';
}

interface Props {
  config: ModalConfig;
  onClose: () => void;
  onSave: (params: SaveParams) => void;
  onDelete: (id: string, context: string) => void;
}

const LAYERS = [
  { rot: 0, ty: 0, sc: 1, z: 10, op: 1, sh: '0 22px 65px rgba(0,0,0,0.72)' },
  { rot: -6.5, ty: 12, sc: 0.97, z: 9, op: 1, sh: '0 12px 38px rgba(0,0,0,0.54)' },
  { rot: 6.5, ty: 12, sc: 0.97, z: 8, op: 0.9, sh: '0 7px 24px rgba(0,0,0,0.4)' },
  { rot: 0, ty: 22, sc: 0.94, z: 7, op: 0 },
];

export default function DarkFrostedModal({ config, onClose, onSave, onDelete }: Props) {
  const isCreate = config.mode === 'create';
  const isTask = config.context === 'task';

  // ---- form state (shared between create and card 0 of edit) ----
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<Task['status']>('To do');
  const [priority, setPriority] = useState<Task['priority']>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [column, setColumn] = useState<'project' | 'personal'>('personal');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ---- 3D card state ----
  const [order, setOrder] = useState([0, 1, 2]);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(0);
  const isBusy = useRef(false);

  // ---- pomodoro state ----
  const [timerSec, setTimerSec] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (config.isOpen) {
      if (isCreate) {
        setTitle('');
        setContent('');
        setStatus('To do');
        setPriority('Medium');
        setDueDate('');
        setColumn('personal');
      } else if (config.data) {
        setTitle(config.data.title || '');
        setContent(config.data.description || config.data.text || '');
        setStatus(config.data.status || 'To do');
        setPriority(config.data.priority || 'Medium');
        setDueDate(config.data.dueDate || '');
        setColumn(config.data.column || 'personal');
      }
      setOrder([0, 1, 2]);
      setDragOffset(0);
      setTimerSec(25 * 60);
      setIsRunning(false);
      setShowDeleteConfirm(false);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [config.isOpen, isCreate, config.data]);

  useEffect(() => {
    if (isRunning && timerSec > 0) {
      timerRef.current = setInterval(() => setTimerSec((s) => s - 1), 1000);
    } else if (timerSec <= 0) {
      setIsRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning, timerSec]);

  if (!config.isOpen) return null;

  const handleSave = () => {
    if (!title.trim() && !content.trim()) return onClose();
    onSave({
      id: isCreate ? undefined : config.data?.id,
      title,
      content,
      context: config.context,
      status: isTask ? status : undefined,
      priority: isTask ? priority : undefined,
      dueDate: isTask ? (dueDate || undefined) : undefined,
      column: isTask ? column : undefined,
    });
    onClose();
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
        className="bg-transparent border-none text-white/80 text-sm outline-none placeholder:text-white/20 resize-none h-12 mb-4"
        placeholder="添加描述..."
      />

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

      {/* Column + Due Date row */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">分类</span>
          <div className="flex gap-1">
            {(['project', 'personal'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setColumn(c)}
                className={`px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                  column === c
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {c === 'project' ? '项目' : '个人'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">截止</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-white/10 text-white text-[10px] px-2 py-1 rounded-lg outline-none border border-white/10 focus:border-[#cae393]/50"
          />
        </div>
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
            onClick={() => setTimerSec(25 * 60)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="w-12 h-12 rounded-full bg-[#b0a8db] flex items-center justify-center text-[#242424] shadow-[0_0_20px_rgba(176,168,219,0.3)] hover:scale-105 transition-transform"
          >
            {isRunning ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>
          <button
            onClick={() => { setIsRunning(false); setTimerSec(25 * 60); }}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    );
  };

  const renderSubtaskCard = () => (
    <div className="flex flex-col h-full" data-no-drag>
      <span className="text-[10px] text-[#cae393] font-bold tracking-widest uppercase mb-3">
        Task Details
      </span>
      <h3 className="text-lg font-bold text-white leading-tight mb-4 truncate">
        {title || '任务详情'}
      </h3>
      <div className="space-y-3 overflow-y-auto hide-scrollbar flex-1">
        {isTask && config.data?.subtasks?.length > 0 ? (
          config.data.subtasks.map((sub: any) => (
            <div
              key={sub.id}
              className="flex items-start gap-3 cursor-pointer group"
              onClick={() => {
                // toggle locally for visual feedback only
                // real toggle requires passing handler from parent
              }}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 transition-colors ${
                  sub.completed
                    ? 'bg-[#cae393] text-[#242424]'
                    : 'border-2 border-white/30 text-transparent group-hover:border-white/60'
                }`}
              >
                <CheckCircle2 size={12} strokeWidth={3} />
              </div>
              <span
                className={`flex-1 text-sm ${
                  sub.completed ? 'text-white/40 line-through' : 'text-white/90'
                }`}
              >
                {sub.title}
              </span>
            </div>
          ))
        ) : (
          <div className="text-white/40 text-sm">暂无子任务详情</div>
        )}
      </div>
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
                  <div className="flex gap-1.5">
                    {(['project', 'personal'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setColumn(c)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                          column === c
                            ? 'bg-white/20 text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                      >
                        {c === 'project' ? '项目待办' : '个人待办'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase block mb-1.5">截止日期</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-white/10 text-white text-xs px-3 py-1.5 rounded-xl outline-none border border-white/10 focus:border-[#cae393]/50"
                  />
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
                : '查看和管理子任务进度。'}
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
            {order[0] === 0 && (
              <button
                onClick={handleSave}
                className="w-12 h-12 rounded-full bg-[#cae393] text-[#242424] flex items-center justify-center shadow-[0_10px_20px_rgba(202,227,147,0.2)] hover:scale-105 active:scale-95 transition-transform"
              >
                <Check size={22} />
              </button>
            )}
            {order[0] !== 0 && (
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
    </div>
  );
}
