import { useRef, useCallback, useEffect, useState } from 'react';
import { useAppStore, type Task } from '../store/appStore';
import { V4 } from '../v4config';

// ==================== 类型 ====================

interface DragState {
  type: 'move' | 'resize';
  taskId: string;
  startY: number;
  origTop: number;
  origHeight: number;
  origStart: string;
  origDuration: number;
  el: HTMLElement | null;
  pointerId: number;
}

// ==================== 工具函数 ====================

function pad(n: number) { return n.toString().padStart(2, '0'); }

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}

function formatHour(h: number): string {
  if (h === 24) return '00:00';
  return `${pad(h)}:00`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function snap(val: number, grain: number): number {
  return Math.round(val / grain) * grain;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay() || 7;
  if (day !== 1) date.setDate(date.getDate() - (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ==================== 日历头 ====================

function CalendarHeader({
  selectedDate,
  expanded,
  onSelectDate,
  onToggleExpand,
  onChangeMonth,
  onChangeWeek,
  tasks,
}: {
  selectedDate: Date;
  expanded: boolean;
  onSelectDate: (d: Date) => void;
  onToggleExpand: () => void;
  onChangeMonth: (dir: number) => void;
  onChangeWeek: (dir: number) => void;
  tasks: Task[];
}) {
  const today = new Date();
  const monthLabel = selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  const weekStart = getMonday(selectedDate);

  // 有日程的日期集合
  const eventDays = new Set<string>();
  tasks.forEach((t) => {
    if (t.dueDate || t.startTime) {
      const d = t.dueDate ? new Date(t.dueDate) : selectedDate;
      eventDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  });

  if (expanded) {
    // 月历网格
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) grid.push(null);
    for (let i = 1; i <= daysInMonth; i++) grid.push(i);

    return (
      <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-5 transition-all">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#242424]">{monthLabel}</h3>
          <div className="flex items-center gap-1">
            <button onClick={() => onChangeMonth(-1)} className="w-7 h-7 rounded-full bg-gray-50 text-xs flex items-center justify-center hover:bg-gray-100">‹</button>
            <button onClick={() => onChangeMonth(1)} className="w-7 h-7 rounded-full bg-gray-50 text-xs flex items-center justify-center hover:bg-gray-100">›</button>
            <button onClick={onToggleExpand} className="w-7 h-7 rounded-full bg-gray-50 text-xs flex items-center justify-center hover:bg-gray-100 ml-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 15 12 9 18 15"/></svg>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
            <span key={d} className="text-center text-[10px] text-gray-400 font-medium py-1">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} className="aspect-square" />;
            const date = new Date(year, month, day);
            const isToday = isSameDay(date, today);
            const isSel = isSameDay(date, selectedDate);
            const key = `${year}-${month}-${day}`;
            const hasEvent = eventDays.has(key);
            return (
              <div
                key={key}
                onClick={() => onSelectDate(date)}
                className={`aspect-square rounded-full flex items-center justify-center text-xs relative cursor-pointer ${
                  isToday && !isSel ? 'font-bold' : ''
                } ${
                  isSel ? 'text-white bg-[#b0a8db]' : day ? 'text-[#242424] hover:bg-gray-50' : ''
                }`}
              >
                {day}
                {hasEvent && !isSel && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#cae393]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 收缩：单行周历
  return (
    <div className="bg-white rounded-[2rem] p-4 shadow-sm mb-5 transition-all">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#242424]">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => onChangeWeek(-1)} className="w-7 h-7 rounded-full bg-gray-50 text-xs flex items-center justify-center hover:bg-gray-100">‹</button>
          <button onClick={() => onChangeWeek(1)} className="w-7 h-7 rounded-full bg-gray-50 text-xs flex items-center justify-center hover:bg-gray-100">›</button>
          <button onClick={onToggleExpand} className="w-7 h-7 rounded-full bg-gray-50 text-xs flex items-center justify-center hover:bg-gray-100 ml-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 9 12 15 6 9"/></svg>
          </button>
        </div>
      </div>
      <div className="flex justify-between">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const d = addDays(weekStart, i);
          const isToday = isSameDay(d, today);
          const isSel = isSameDay(d, selectedDate);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const hasEvent = eventDays.has(key);
          return (
            <div
              key={key}
              onClick={() => onSelectDate(d)}
              className={`flex flex-col items-center gap-1 cursor-pointer py-1 px-2 rounded-xl transition-colors ${
                isSel ? 'bg-[#b0a8db] text-white' : ''
              }`}
            >
              <span className={`text-[10px] ${isToday && !isSel ? 'font-bold text-[#b0a8db]' : 'text-gray-400'}`}>
                {['日', '一', '二', '三', '四', '五', '六'][i]}
              </span>
              <span className={`text-sm font-semibold ${isToday && !isSel ? 'text-[#242424]' : ''}`}>
                {d.getDate()}
              </span>
              {hasEvent ? (
                <span className={`w-1 h-1 rounded-full ${isSel ? 'bg-white' : 'bg-[#cae393]'}`} />
              ) : (
                <span className="w-1 h-1" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== 主组件 ====================

export default function CalendarView({ onTaskClick }: { onTaskClick?: (task: Task) => void }) {
  const tasks = useAppStore((s) => s.tasks);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const headerExpanded = useAppStore((s) => s.calendarHeaderExpanded);
  const setHeaderExpanded = useAppStore((s) => s.setCalendarHeaderExpanded);
  const updateTask = useAppStore((s) => s.updateTask);

  const timelineRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [currentTimeTop, setCurrentTimeTop] = useState<number | null>(null);

  const hourH = parseInt(V4.hourHeight, 10);
  const startH = V4.timelineStartHour;
  const endH = V4.timelineEndHour;

  // 更新当前时间线位置
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      if (isSameDay(now, selectedDate)) {
        const h = now.getHours() + now.getMinutes() / 60;
        if (h >= startH && h <= endH) {
          setCurrentTimeTop((h - startH) * hourH);
          return;
        }
      }
      setCurrentTimeTop(null);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [selectedDate, startH, endH, hourH]);

  // 获取选中日期的任务（含时间线任务）
  const dayTasks = tasks.filter((t) => {
    if (t.status === 'Cancelled') return false;
    // 如果任务有 startTime，用 dueDate 或 selectedDate 匹配
    const taskDate = t.dueDate ? new Date(t.dueDate) : null;
    if (taskDate && isSameDay(taskDate, selectedDate)) return true;
    // 无 dueDate 但有 startTime，假设是今天
    if (!taskDate && t.startTime && isSameDay(selectedDate, new Date())) return true;
    return false;
  });

  // 有时间安排的任务（按 startTime 排序）
  const timelineTasks = dayTasks
    .filter((t) => t.startTime)
    .sort((a, b) => parseTime(a.startTime!) - parseTime(b.startTime!));

  const timelineHeight = (endH - startH) * hourH;

  const handleChangeMonth = useCallback((dir: number) => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + dir);
    setSelectedDate(d);
  }, [selectedDate, setSelectedDate]);

  const handleChangeWeek = useCallback((dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir * 7);
    setSelectedDate(d);
  }, [selectedDate, setSelectedDate]);

  const handleToggleExpand = useCallback(() => {
    setHeaderExpanded(!headerExpanded);
  }, [headerExpanded, setHeaderExpanded]);

  const getTaskColor = (colorType: Task['colorType']) => {
    if (colorType === 'dark') return { bg: '#242424', text: 'white' };
    if (colorType === 'green') return { bg: '#cae393', text: '#242424' };
    return { bg: '#b0a8db', text: '#242424' };
  };

  // ==================== 拖拽 ====================

  const onTaskPointerDown = useCallback((e: React.PointerEvent, taskId: string, startTime: string, duration: number) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);
    dragRef.current = {
      type: 'move',
      taskId,
      startY: e.clientY,
      origTop: el.offsetTop,
      origHeight: el.offsetHeight,
      origStart: startTime,
      origDuration: duration,
      el,
      pointerId: e.pointerId,
    };

    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.type !== 'move' || !drag.el) return;
      const dy = ev.clientY - drag.startY;
      drag.el.style.top = `${drag.origTop + dy}px`;
    };

    const onUp = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !drag.el) return;
      const el2 = drag.el;
      el2.classList.remove('dragging');
      el2.releasePointerCapture(ev.pointerId);
      el2.onpointermove = null;
      el2.onpointerup = null;

      const rawTop = parseFloat(el2.style.top);
      const rawHour = rawTop / hourH + startH;
      const snappedH = snap(rawHour, V4.snapMinutes / 60);
      const newTop = (snappedH - startH) * hourH;
      el2.style.top = `${newTop}px`;

      const h = Math.floor(snappedH);
      const m = Math.round((snappedH - h) * 60);
      const newStart = `${pad(h)}:${pad(m)}`;
      updateTask(drag.taskId, { startTime: newStart });

      dragRef.current = null;
    };

    el.onpointermove = onMove as any;
    el.onpointerup = onUp as any;
  }, [hourH, startH, updateTask]);

  const onResizePointerDown = useCallback((e: React.PointerEvent, taskId: string, startTime: string, duration: number) => {
    e.stopPropagation();
    e.preventDefault();
    const el = (e.currentTarget as HTMLElement).closest('.task-block') as HTMLElement;
    if (!el) return;
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);
    dragRef.current = {
      type: 'resize',
      taskId,
      startY: e.clientY,
      origTop: el.offsetTop,
      origHeight: el.offsetHeight,
      origStart: startTime,
      origDuration: duration,
      el,
      pointerId: e.pointerId,
    };

    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.type !== 'resize' || !drag.el) return;
      const dy = ev.clientY - drag.startY;
      drag.el.style.height = `${Math.max(drag.origHeight + dy, 36)}px`;
    };

    const onUp = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !drag.el) return;
      const el2 = drag.el;
      el2.classList.remove('dragging');
      el2.releasePointerCapture(ev.pointerId);
      el2.onpointermove = null;
      el2.onpointerup = null;

      const rawH = parseFloat(el2.style.height);
      const rawDuration = (rawH / hourH) * 60;
      const snappedDur = Math.max(snap(rawDuration, V4.snapMinutes), 15);
      el2.style.height = `${(snappedDur / 60) * hourH}px`;

      updateTask(drag.taskId, { duration: snappedDur });

      dragRef.current = null;
    };

    el.onpointermove = onMove as any;
    el.onpointerup = onUp as any;
  }, [hourH, updateTask]);

  const formatDate = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

  return (
    <div className="animate-page-enter pb-24">
      <h1 className="text-xl font-bold mb-5 text-[#242424]">日程安排</h1>

      <CalendarHeader
        selectedDate={selectedDate}
        expanded={headerExpanded}
        onSelectDate={setSelectedDate}
        onToggleExpand={handleToggleExpand}
        onChangeMonth={handleChangeMonth}
        onChangeWeek={handleChangeWeek}
        tasks={tasks}
      />

      {/* 时间线卡片 */}
      <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden">
        <div className="p-4 pb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#242424]">
            {formatDate(selectedDate)} · {dayTasks.length} 项
          </h3>
          <span className="text-[10px] text-gray-400">拖拽调整时间</span>
        </div>

        <div
          ref={timelineRef}
          className="relative"
          style={{ height: `${timelineHeight}px` }}
        >
          {/* 时间刻度 */}
          {Array.from({ length: endH - startH + 1 }, (_, i) => {
            const h = startH + i;
            return (
              <div key={h}>
                <div
                  className="absolute left-12 right-0 h-px bg-black/6"
                  style={{ top: `${i * hourH}px` }}
                />
                <span
                  className="absolute left-0 w-10 text-right text-[10px] text-gray-400 -translate-y-1/2"
                  style={{ top: `${i * hourH}px` }}
                >
                  {formatHour(h)}
                </span>
              </div>
            );
          })}

          {/* 当前时间线 */}
          {currentTimeTop !== null && (
            <div
              className="absolute left-12 right-0 h-0.5 z-20 pointer-events-none"
              style={{
                top: `${currentTimeTop}px`,
                background: 'linear-gradient(90deg, #b0a8db 0%, transparent 100%)',
              }}
            >
              <div
                className="absolute -left-1.5 -top-1 w-2.5 h-2.5 rounded-full bg-[#b0a8db]"
              />
            </div>
          )}

          {/* 任务块 */}
          {timelineTasks.map((task) => {
            const st = parseTime(task.startTime!);
            const top = (st - startH) * hourH;
            const h = ((task.duration || 60) / 60) * hourH;
            const minH = Math.max(h, 36);
            const colors = getTaskColor(task.colorType);
            const priorityLabel =
              task.priority === 'High Priority' ? 'P0' : task.priority === 'Medium' ? 'P1' : 'P2';

            return (
              <div
                key={task.id}
                className="task-block absolute left-14 right-2 rounded-[11px] px-3 py-2 cursor-grab select-none touch-none border border-black/5 overflow-hidden"
                style={{
                  top: `${top}px`,
                  height: `${minH}px`,
                  background: colors.bg,
                  color: colors.text,
                }}
                onPointerDown={(e) => onTaskPointerDown(e, task.id, task.startTime!, task.duration || 60)}
                onDoubleClick={() => onTaskClick?.(task)}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${task.colorType === 'dark' ? 'bg-white/60' : ''}`}
                    style={{ background: task.colorType !== 'dark' ? '#242424' : undefined }}
                  />
                  <span className="text-xs font-semibold truncate">{task.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] opacity-70">
                    {task.startTime} · {task.duration || 60}min
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full opacity-70 ${
                      task.colorType === 'dark' ? 'bg-white/10' : 'bg-black/5'
                    }`}
                  >
                    {priorityLabel}
                  </span>
                </div>
                {/* 调整手柄 */}
                <div
                  className="resize-handle absolute bottom-0 left-0 right-0 h-3 flex items-end justify-center pb-0.5 cursor-ns-resize"
                  onPointerDown={(e) => onResizePointerDown(e, task.id, task.startTime!, task.duration || 60)}
                >
                  <div className="w-6 h-0.5 rounded-sm bg-black/12" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 仅截止日期任务（无 startTime，不在时间线上） */}
      {(() => {
        const dueOnlyTasks = dayTasks.filter((t) => t.dueDate && !t.startTime);
        if (dueOnlyTasks.length === 0) return null;
        return (
          <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden mt-4">
            <div className="p-4 pb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#242424]">
                截止任务 · {dueOnlyTasks.length} 项
              </h3>
              <span className="text-[10px] text-gray-400">截止日期已设定，未安排到时间线</span>
            </div>
            <div className="px-4 pb-4 space-y-2">
              {dueOnlyTasks.map((task) => {
                const colors = getTaskColor(task.colorType);
                const dueDateStr = task.dueDate
                  ? new Date(task.dueDate).toLocaleString('zh-CN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 cursor-pointer hover:shadow-sm transition-shadow"
                    style={{ background: colors.bg, color: colors.text }}
                    onClick={() => onTaskClick?.(task)}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: task.colorType === 'dark' ? 'white' : '#242424' }}
                    />
                    <span className="flex-1 text-xs font-medium truncate">{task.title}</span>
                    <span className="text-[10px] opacity-60 flex-shrink-0">{dueDateStr}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 空状态 */}
      {dayTasks.length === 0 && (
        <div className="bg-white rounded-[2rem] p-8 shadow-sm mt-4 text-center">
          <p className="text-sm text-gray-400">该日无日程安排</p>
        </div>
      )}
    </div>
  );
}
