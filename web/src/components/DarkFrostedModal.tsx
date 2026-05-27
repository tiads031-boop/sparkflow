import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, Check, ArrowRight, Trash2,
  Play, Pause, RotateCcw, CalendarDays, Bell, Zap,
} from 'lucide-react';

interface ModalConfig {
  isOpen: boolean;
  mode: 'view' | 'create';
  context: 'task' | 'spark';
  data: any;
}

interface Props {
  config: ModalConfig;
  onClose: () => void;
  onSave: (params: { title: string; content: string; context: string }) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDelete: (id: string, context: string) => void;
}

// 3D layer config
const LAYERS = [
  { rot: 0, ty: 0, sc: 1, z: 10, op: 1, sh: '0 22px 65px rgba(0,0,0,0.72)' },
  { rot: -6.5, ty: 12, sc: 0.97, z: 9, op: 1, sh: '0 12px 38px rgba(0,0,0,0.54)' },
  { rot: 6.5, ty: 12, sc: 0.97, z: 8, op: 0.9, sh: '0 7px 24px rgba(0,0,0,0.4)' },
  { rot: 0, ty: 22, sc: 0.94, z: 7, op: 0 },
];

export default function DarkFrostedModal({ config, onClose, onSave, onToggleSubtask, onDelete }: Props) {
  const isCreate = config.mode === 'create';
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const [order, setOrder] = useState([0, 1, 2]);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(0);
  const isBusy = useRef(false);

  // Pomodoro simulation
  const [timerSec, setTimerSec] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (config.isOpen) {
      setTitle(isCreate ? '' : config.data?.title || '');
      setContent(isCreate ? '' : config.data?.text || '');
      setOrder([0, 1, 2]);
      setDragOffset(0);
      setTimerSec(25 * 60);
      setIsRunning(false);
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

  const handleAction = () => {
    if (isCreate) {
      if (!title.trim() && !content.trim()) return onClose();
      onSave({ title, content, context: config.context });
    }
    onClose();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const timerProgress = timerSec / (25 * 60);
  const timerCircumference = 2 * Math.PI * 72;
  const timerOffset = timerCircumference * (1 - timerProgress);

  // --- Pointer handlers for 3D card stack ---
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isCreate || isBusy.current) return;
    setIsDragging(true);
    dragStart.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
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

    // Card content by index
    let contentNode: React.ReactNode;
    if (cardIndex === 0) {
      // Schedule card
      contentNode = (
        <div className="flex flex-col h-full">
          <span className="text-[10px] text-[#cae393] font-bold tracking-widest uppercase mb-8">Schedule</span>
          <h3 className="text-lg font-bold text-white leading-tight mb-5">日程设定</h3>
          <div className="bg-white/5 rounded-3xl p-4 border border-white/10 mb-3">
            <div className="flex items-center gap-3 mb-1.5 text-white">
              <CalendarDays size={18} className="text-[#cae393]" />
              <span className="font-semibold tracking-wide text-sm">
                {config.data?.dueDate || '未设置'}
              </span>
            </div>
            <p className="text-xs text-white/50 ml-8">点击设置截止日期</p>
          </div>
          <div className="bg-white/5 rounded-3xl p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-1.5 text-white">
              <Bell size={18} className="text-[#b0a8db]" />
              <span className="font-semibold tracking-wide text-sm">09:00 AM</span>
            </div>
            <p className="text-xs text-white/50 ml-8">提前 30 分钟提醒</p>
          </div>
        </div>
      );
    } else if (cardIndex === 1) {
      // Focus Timer card
      contentNode = (
        <div className="flex flex-col items-center justify-center h-full">
          <span className="text-[10px] text-[#b0a8db] font-bold tracking-widest uppercase mb-5 self-start">
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
              <Zap size={16} />
            </button>
          </div>
        </div>
      );
    } else {
      // Task Details card
      contentNode = (
        <div className="flex flex-col h-full">
          <span className="text-[10px] text-[#cae393] font-bold tracking-widest uppercase mb-3">
            Task Details
          </span>
          <h3 className="text-lg font-bold text-white leading-tight mb-4 truncate">
            {config.data?.title || config.data?.text || '任务详情'}
          </h3>
          <div className="space-y-3 overflow-y-auto hide-scrollbar flex-1">
            {config.context === 'task' && config.data?.subtasks?.length > 0 ? (
              config.data.subtasks.map((sub: any) => (
                <div
                  key={sub.id}
                  className="flex items-start gap-3 cursor-pointer group"
                  onClick={() => onToggleSubtask(config.data.id, sub.id)}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 transition-colors ${
                      sub.completed
                        ? 'bg-[#cae393] text-[#242424]'
                        : 'border-2 border-white/30 text-transparent group-hover:border-white/60'
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
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
    }

    return (
      <div
        key={cardIndex}
        className="absolute w-full h-full bg-[#272727] backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-7 flex flex-col overflow-hidden will-change-transform"
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
          {isCreate ? `新建${config.context === 'task' ? '任务' : '灵感'}` : 'FOCUS MODE'}
        </span>
        {!isCreate ? (
          <button
            onClick={() => {
              onDelete(config.data.id, config.context);
              onClose();
            }}
            className="p-2 bg-red-500/20 text-red-400 rounded-full backdrop-blur-md border border-red-500/20 hover:bg-red-500/40 transition-colors z-50"
          >
            <Trash2 size={18} />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Center card area */}
      <div className="relative z-20 flex flex-col items-center justify-center h-[60%] w-full">
        {isCreate ? (
          <div className="w-[85%] max-w-[340px] h-full max-h-[480px] bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-7 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            <div className="flex-1 flex flex-col mt-4 space-y-4">
              <span className="text-[10px] text-[#cae393] font-bold tracking-widest uppercase">Content</span>
              <input
                autoFocus
                type="text"
                placeholder={config.context === 'task' ? '任务名称...' : '灵感关键字...'}
                className="bg-transparent border-b border-white/20 text-white text-xl font-bold outline-none placeholder:text-white/30 pb-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                placeholder={config.context === 'task' ? '添加细节描述或子任务...' : '记录此刻闪过的想法...'}
                className="bg-transparent border-none text-white/80 text-sm outline-none placeholder:text-white/20 flex-1 resize-none mt-3"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div
            className="relative w-[85%] max-w-[340px] h-full max-h-[480px] touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {order.map((cardIndex, logicIndex) => renderCard(cardIndex, logicIndex))}
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="absolute bottom-0 left-0 w-full p-7 bg-gradient-to-t from-[#080808] via-[#0F0F0F]/90 to-transparent z-10 pb-10 pointer-events-none">
        <div className="pointer-events-auto">
          <h2 className="text-2xl font-bold text-white mb-2 leading-tight">
            {isCreate ? 'Capture It.' : 'Stay Focused.'}
          </h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed max-w-[85%]">
            {isCreate
              ? '记录下稍纵即逝的灵感或亟待解决的任务。'
              : '左右滑动飞出卡片，沉浸式管理你的专注配置。'}
          </p>
          <div
            className="flex justify-between items-center cursor-pointer group"
            onClick={handleAction}
          >
            <span className="text-white/50 text-sm font-medium ml-2 uppercase tracking-wider group-hover:text-white transition-colors">
              {isCreate ? '保存并继续' : '退出专注'}
            </span>
            <button className="w-12 h-12 rounded-full bg-[#cae393] text-[#242424] flex items-center justify-center shadow-[0_10px_20px_rgba(202,227,147,0.2)] hover:scale-105 active:scale-95 transition-transform">
              {isCreate ? <Check size={22} /> : <ArrowRight size={22} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
