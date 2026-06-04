import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useAppStore, type Task } from '../store/appStore';
import { V4 } from '../v4config';
import { api, DEFAULT_USER_ID } from '../api/client';

// ==================== 日历事件类型 & API ====================

interface CalendarApiEvent {
  id: string;
  taskId?: string | null;
  courseId?: string;
  title: string;
  eventType: string;
  startTime: string;
  endTime: string;
  color?: string;
  isOverride?: boolean;
}

const fetchCalendarEvents = (start: string, end: string) =>
  api.get<CalendarApiEvent[]>(
    `/calendar?userId=${DEFAULT_USER_ID}&start=${start}&end=${end}`,
    { fallback: [] },
  );

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

function getLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let current = el?.parentElement ?? null;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
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
  calendarEventDays,
}: {
  selectedDate: Date;
  expanded: boolean;
  onSelectDate: (d: Date) => void;
  onToggleExpand: () => void;
  onChangeMonth: (dir: number) => void;
  onChangeWeek: (dir: number) => void;
  tasks: Task[];
  calendarEventDays: Set<string>;
}) {
  const today = new Date();
  const monthLabel = selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  const weekStart = getMonday(selectedDate);

  // 有日程的日期集合（任务 + 日历事件合并）
  const eventDays = new Set<string>();
  tasks.forEach((t) => {
    if (t.dueDate || t.startTime) {
      const d = t.dueDate ? new Date(t.dueDate) : new Date();
      eventDays.add(getLocalDateKey(d));
    }
  });
  calendarEventDays.forEach((key) => eventDays.add(key));

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
            const key = getLocalDateKey(date);
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
          const key = getLocalDateKey(d);
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
  const addTask = useAppStore((s) => s.addTask);
  const isGoogleConnected = useAppStore((s) => s.isConnected);
  const lastGoogleSyncAt = useAppStore((s) => s.lastSyncAt);

  const timelineRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [currentTimeTop, setCurrentTimeTop] = useState<number | null>(null);

  // 长按创建状态
  const [creatingGhost, setCreatingGhost] = useState<{ startTime: string; duration: number; top: number; height: number } | null>(null);
  const [inlineCreating, setInlineCreating] = useState<{ startTime: string; duration: number; top: number; height: number } | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPos = useRef<{ x: number; y: number } | null>(null);
  const longPressPointerId = useRef<number | null>(null);
  const longPressRect = useRef<DOMRect | null>(null);
  const isLongPressing = useRef(false);
  const creatingGhostRef = useRef<typeof creatingGhost>(null);
  // 同步 creatingGhost 到 ref
  creatingGhostRef.current = creatingGhost;

  // 日历事件（课程 / Google / 本地 / 手动）
  const [calendarEvents, setCalendarEvents] = useState<CalendarApiEvent[]>([]);

  // 拉取日历事件（选中日期所在周）
  useEffect(() => {
    const weekStart = getMonday(selectedDate);
    const weekEnd = addDays(weekStart, 7);
    const startStr = weekStart.toISOString();
    const endStr = weekEnd.toISOString();
    fetchCalendarEvents(startStr, endStr).then((events) => {
      setCalendarEvents(events.filter((event) => !event.taskId));
    });
  }, [selectedDate, lastGoogleSyncAt]);

  // 日历事件日期集合（用于日历绿点）
  const calendarEventDays = useMemo(() => {
    const days = new Set<string>();
    calendarEvents.forEach((ev) => {
      const d = new Date(ev.startTime);
      days.add(getLocalDateKey(d));
    });
    return days;
  }, [calendarEvents]);

  // 截止任务快速安排状态
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null);
  const [scheduleStartTime, setScheduleStartTime] = useState('09:00');
  const [scheduleDuration, setScheduleDuration] = useState(60);

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

  // 内联输入自动聚焦
  useEffect(() => {
    if (inlineCreating && inlineInputRef.current) {
      inlineInputRef.current.focus();
    }
  }, [inlineCreating]);

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

  // 今日日历事件（Google / 本地 / manual / course）
  const dayCalendarEvents = calendarEvents.filter((ev) => {
    const evDate = new Date(ev.startTime);
    return isSameDay(evDate, selectedDate);
  });

  const timelineHeight = (endH - startH) * hourH;
  const earliestTimelineHour = useMemo(() => {
    const taskHours = timelineTasks.map((task) => parseTime(task.startTime!));
    const eventHours = dayCalendarEvents.map((ev) => {
      const st = new Date(ev.startTime);
      return st.getHours() + st.getMinutes() / 60;
    });
    const hours = [...taskHours, ...eventHours].filter((hour) => hour >= startH && hour <= endH);
    return hours.length > 0 ? Math.min(...hours) : null;
  }, [dayCalendarEvents, endH, startH, timelineTasks]);

  useEffect(() => {
    if (earliestTimelineHour === null) return;
    const timelineEl = timelineRef.current;
    if (!timelineEl) return;

    const top = Math.max((earliestTimelineHour - startH) * hourH - hourH * 0.5, 0);
    const id = window.requestAnimationFrame(() => {
      const scrollParent = getScrollParent(timelineEl);
      if (scrollParent) {
        const targetTop =
          scrollParent.scrollTop +
          timelineEl.getBoundingClientRect().top -
          scrollParent.getBoundingClientRect().top +
          top -
          scrollParent.clientHeight * 0.18;
        scrollParent.scrollTo({ top: Math.max(targetTop, 0), behavior: 'smooth' });
        return;
      }

      const pageTop = timelineEl.getBoundingClientRect().top + window.scrollY + top - 140;
      window.scrollTo({ top: Math.max(pageTop, 0), behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [earliestTimelineHour, hourH, selectedDate, startH]);

  // 计算日历事件块颜色（提取色值，按来源给默认色）
  const getCalendarBlockMeta = (eventType?: string, color?: string) => {
    const normalizedType = (eventType || 'manual').toLowerCase();
    const isCourse = normalizedType === 'course';
    const defaultColor =
      normalizedType.includes('google') ? '#4285f4'
      : normalizedType.includes('local') || normalizedType.includes('android') ? '#34a853'
      : isCourse ? '#0891b2'
      : '#fbbc04';
    const taskLikeCourseColors = new Set(['#cae393', '#b0a8db', '#34a853']);
    const normalizedColor = color?.toLowerCase();
    const c = isCourse && (!normalizedColor || taskLikeCourseColors.has(normalizedColor))
      ? defaultColor
      : color || defaultColor;
    const label =
      normalizedType.includes('google') ? 'Google'
      : normalizedType.includes('local') || normalizedType.includes('android') ? '本地'
      : normalizedType === 'course' ? '课程'
      : '日程';
    return {
      background: `${c}15`,
      borderColor: `${c}60`,
      textColor: '#242424',
      accent: c,
      label,
    };
  };

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

  // ==================== 长按创建 ====================

  // 原生事件 handler 的 ref（ghost 拖拽阶段使用，避免依赖 React 合成事件 + setPointerCapture）
  const nativeMoveHandler = useRef<((e: PointerEvent) => void) | null>(null);
  const nativeUpHandler = useRef<((e: PointerEvent) => void) | null>(null);

  const cleanupNativeListeners = useCallback(() => {
    if (nativeMoveHandler.current) {
      document.removeEventListener('pointermove', nativeMoveHandler.current);
      nativeMoveHandler.current = null;
    }
    if (nativeUpHandler.current) {
      document.removeEventListener('pointerup', nativeUpHandler.current);
      nativeUpHandler.current = null;
    }
  }, []);

  // 卸载时清理
  useEffect(() => {
    return () => {
      cleanupNativeListeners();
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [cleanupNativeListeners]);

  const handleTimelinePointerDown = useCallback((e: React.PointerEvent) => {
    // 不干扰已有任务块或内联创建卡片
    if ((e.target as HTMLElement).closest('.task-block')) return;
    if ((e.target as HTMLElement).closest('.inline-create-card')) return;

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 清理上一次可能残留的原生监听
    cleanupNativeListeners();

    // 将所有关键值存入 ref
    longPressPos.current = { x: e.clientX, y: e.clientY };
    longPressPointerId.current = e.pointerId;
    longPressRect.current = rect;

    // 清除之前的 timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    longPressTimer.current = setTimeout(() => {
      if (!longPressPos.current || !longPressRect.current) return;

      // 计算磁吸后的开始时间
      const relativeY = longPressPos.current.y - longPressRect.current.top;
      const rawHour = relativeY / hourH + startH;
      const snappedH = snap(rawHour, V4.snapMinutes / 60);
      const snappedTop = (snappedH - startH) * hourH;
      const defaultDurMin = V4.snapMinutes;
      const defaultHeight = (defaultDurMin / 60) * hourH;

      const hh = Math.floor(snappedH);
      const mm = Math.round((snappedH - hh) * 60);
      const startTime = `${pad(hh)}:${pad(mm)}`;

      isLongPressing.current = true;
      setCreatingGhost({
        startTime,
        duration: defaultDurMin,
        top: snappedTop,
        height: defaultHeight,
      });

      // 触觉反馈
      navigator.vibrate?.(10);

      // ---- 注册原生 document 监听（替代不可靠的 setPointerCapture）----
      const initialPos = { ...longPressPos.current };
      const initialRect = { ...longPressRect.current };

      nativeMoveHandler.current = (ev: PointerEvent) => {
        ev.preventDefault();
        // 只响应当前 ghost 的指针
        if (ev.pointerId !== longPressPointerId.current) return;

        const currentRect = timelineRef.current?.getBoundingClientRect();
        if (!currentRect) return;

        const pressR = initialPos.y - initialRect.top;
        const startRaw = pressR / hourH + startH;
        const snappedStartH = snap(startRaw, V4.snapMinutes / 60);
        const startTop = (snappedStartH - startH) * hourH;

        const relativeY = ev.clientY - currentRect.top;
        const rawHeight = relativeY - startTop;
        const minH = (V4.snapMinutes / 60) * hourH;
        const maxH = (endH - startH) * hourH - startTop;
        const clampedHeight = Math.max(minH, Math.min(rawHeight, maxH));
        const rawDuration = (clampedHeight / hourH) * 60;
        const snappedDur = Math.max(snap(rawDuration, V4.snapMinutes), V4.snapMinutes);
        const snappedHeight = (snappedDur / 60) * hourH;

        const hhh = Math.floor(snappedStartH);
        const mmm = Math.round((snappedStartH - hhh) * 60);
        setCreatingGhost({
          startTime: `${pad(hhh)}:${pad(mmm)}`,
          duration: snappedDur,
          top: startTop,
          height: snappedHeight,
        });
      };

      nativeUpHandler.current = (ev: PointerEvent) => {
        // 只响应当前 ghost 的指针，忽略其他手指
        if (ev.pointerId !== longPressPointerId.current) return;

        // 读取最新的 ghost 值
        const ghost = creatingGhostRef.current;
        if (ghost) {
          setInlineCreating(ghost);
          setInlineTitle('');
        }
        setCreatingGhost(null);
        isLongPressing.current = false;
        longPressPos.current = null;
        longPressPointerId.current = null;
        longPressRect.current = null;
        cleanupNativeListeners();
      };

      document.addEventListener('pointermove', nativeMoveHandler.current);
      document.addEventListener('pointerup', nativeUpHandler.current);
    }, 500);
  }, [hourH, startH, endH, cleanupNativeListeners]);

  // React 合成事件 handler：仅用于 pre-ghost 阶段的滚动检测
  // ghost 阶段由原生 document listener 接管（更可靠，不依赖 pointer capture）
  const handleTimelinePointerMove = useCallback((e: React.PointerEvent) => {
    if (!longPressPos.current || isLongPressing.current) return;

    const dx = Math.abs(e.clientX - longPressPos.current.x);
    const dy = Math.abs(e.clientY - longPressPos.current.y);

    // 长按未激活时移动超过阈值 → 取消（判定为滚动）
    if (dx > 10 || dy > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      longPressPos.current = null;
      longPressPointerId.current = null;
      longPressRect.current = null;
    }
  }, []);

  const handleTimelinePointerUp = useCallback((e: React.PointerEvent) => {
    // 仅在未进入 ghost 模式时处理（即短按取消）
    if (isLongPressing.current) return;

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressPos.current = null;
    longPressPointerId.current = null;
    longPressRect.current = null;

    try {
      timelineRef.current?.releasePointerCapture(e.pointerId);
    } catch { /* pointer may already be released */ }
  }, []);

  const confirmInlineCreate = useCallback(() => {
    if (!inlineCreating || !inlineTitle.trim()) {
      setInlineCreating(null);
      setInlineTitle('');
      return;
    }

    const newTask: Task = {
      id: `tl-${Date.now()}`,
      title: inlineTitle.trim(),
      status: 'To do',
      priority: 'Medium',
      colorType: 'green',
      comments: 0,
      subtasks: [],
      startTime: inlineCreating.startTime,
      duration: inlineCreating.duration,
      dueDate: selectedDate.toISOString(),
      section: 'personal',
    };

    addTask(newTask);
    setInlineCreating(null);
    setInlineTitle('');
  }, [inlineCreating, inlineTitle, selectedDate, addTask]);

  const cancelInlineCreate = useCallback(() => {
    if (inlineTitle.trim()) {
      confirmInlineCreate();
    } else {
      setInlineCreating(null);
      setInlineTitle('');
    }
  }, [inlineTitle, confirmInlineCreate]);

  // ==================== 截止任务快速安排 ====================

  const openSchedulePicker = useCallback((taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    // 默认开始时间：截止时间前 1 小时，或 09:00
    let defaultStart = '09:00';
    if (task?.dueDate) {
      const d = new Date(task.dueDate);
      const h = d.getHours();
      const m = d.getMinutes();
      // 截止时间 - 60min
      let adjustedH = h - 1;
      if (adjustedH < 0) adjustedH = 0;
      defaultStart = `${pad(adjustedH)}:${pad(m)}`;
    }
    setScheduleStartTime(defaultStart);
    setScheduleDuration(60);
    setSchedulingTaskId(taskId);
  }, [tasks]);

  const confirmSchedule = useCallback(() => {
    if (!schedulingTaskId) return;
    updateTask(schedulingTaskId, {
      startTime: scheduleStartTime,
      duration: scheduleDuration,
    });
    setSchedulingTaskId(null);
  }, [schedulingTaskId, scheduleStartTime, scheduleDuration, updateTask]);

  const cancelSchedule = useCallback(() => {
    setSchedulingTaskId(null);
  }, []);

  // ==================== ICS 导入 ====================

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', DEFAULT_USER_ID);

      const data = await api.post<{ created: any[]; updated: any[]; eventCount: number }>(
        '/courses/import-ics',
        formData,
        { throwOnError: true },
      );
      setImportResult(
        `✅ 新建 ${data.created?.length || 0} 门，更新 ${data.updated?.length || 0} 门，共 ${data.eventCount || 0} 次课`,
      );

      // 刷新日历事件
      const weekStart = getMonday(selectedDate);
      const weekEnd = addDays(weekStart, 7);
      const events = await fetchCalendarEvents(weekStart.toISOString(), weekEnd.toISOString());
      setCalendarEvents(events.filter((ev) => !ev.taskId));
    } catch (err: any) {
      setImportResult(`❌ ${err.message || '导入失败'}`);
    } finally {
      setImporting(false);
      // 清空 input 以便重复选择同一文件
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [selectedDate]);

  const formatDate = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;

  return (
    <div className="animate-page-enter pb-24">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-[#242424]">日程安排</h1>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="text-[11px] px-3 py-1.5 rounded-full bg-[#b0a8db]/10 text-[#b0a8db] font-medium hover:bg-[#b0a8db]/20 transition-colors disabled:opacity-50"
          >
            {importing ? '导入中…' : '📅 导入课表'}
          </button>
        </div>
      </div>
      {importResult && (
        <div className={`mb-4 text-xs px-4 py-2 rounded-xl ${importResult.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {importResult}
        </div>
      )}

      <CalendarHeader
        selectedDate={selectedDate}
        expanded={headerExpanded}
        onSelectDate={setSelectedDate}
        onToggleExpand={handleToggleExpand}
        onChangeMonth={handleChangeMonth}
        onChangeWeek={handleChangeWeek}
        tasks={tasks}
        calendarEventDays={calendarEventDays}
      />

      {/* 时间线卡片 */}
      <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden">
        <div className="p-4 pb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#242424]">
            {formatDate(selectedDate)} · {dayTasks.length} 项任务 · {dayCalendarEvents.length} 日程
          </h3>
          <span className="text-[10px] text-gray-400">长按空区创建 · 拖拽调整时间</span>
        </div>

        <div
          ref={timelineRef}
          className="relative"
          style={{
            height: `${timelineHeight}px`,
            touchAction: creatingGhost ? 'none' : undefined,
          }}
          onPointerDown={handleTimelinePointerDown}
          onPointerMove={handleTimelinePointerMove}
          onPointerUp={handleTimelinePointerUp}
        >
          {/* Ghost block：长按创建的预览块 */}
          {creatingGhost && (
            <div
              className="ghost-block absolute left-14 right-2 z-10 rounded-[11px] pointer-events-none"
              style={{
                top: `${creatingGhost.top}px`,
                height: `${creatingGhost.height}px`,
                background: 'rgba(176,168,219,0.25)',
                border: '2px dashed rgba(176,168,219,0.6)',
              }}
            >
              <div className="px-3 py-2">
                <span className="text-[10px] text-[#b0a8db] font-medium">
                  {creatingGhost.startTime} · {creatingGhost.duration}min
                </span>
              </div>
            </div>
          )}

          {/* 内联创建输入框 */}
          {inlineCreating && (
            <div
              className="inline-create-card absolute left-14 right-2 z-30"
              style={{
                top: `${inlineCreating.top}px`,
                height: `${Math.max(inlineCreating.height, 80)}px`,
              }}
            >
              <div className="bg-white border-2 border-[#b0a8db] rounded-[11px] p-2.5 h-full flex flex-col shadow-lg">
                <input
                  ref={inlineInputRef}
                  type="text"
                  placeholder="新任务标题..."
                  value={inlineTitle}
                  onChange={(e) => setInlineTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmInlineCreate();
                    if (e.key === 'Escape') {
                      setInlineCreating(null);
                      setInlineTitle('');
                    }
                  }}
                  onBlur={cancelInlineCreate}
                  className="flex-1 bg-transparent text-sm text-[#242424] outline-none placeholder:text-gray-300"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-gray-400">
                    {inlineCreating.startTime} · {inlineCreating.duration}min
                  </span>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={confirmInlineCreate}
                    className="text-xs bg-[#b0a8db] text-white px-3 py-1 rounded-full font-medium active:opacity-70"
                  >
                    创建
                  </button>
                </div>
              </div>
            </div>
          )}

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
            const isDone = task.status === 'Done';
            const priorityLabel =
              task.priority === 'High Priority' ? 'P0' : task.priority === 'Medium' ? 'P1' : 'P2';

            return (
              <div
                key={task.id}
                className="task-block absolute left-14 right-2 rounded-[11px] px-3 py-2 cursor-grab select-none touch-none border overflow-hidden"
                style={{
                  top: `${top}px`,
                  height: `${minH}px`,
                  background: isDone ? '#f1f3f5' : colors.bg,
                  borderColor: isDone ? '#d9dee3' : 'rgba(0,0,0,0.05)',
                  color: isDone ? '#5f6872' : colors.text,
                }}
                onPointerDown={(e) => onTaskPointerDown(e, task.id, task.startTime!, task.duration || 60)}
                onDoubleClick={() => onTaskClick?.(task)}
              >
                {/* 同步状态指示点 */}
                {isGoogleConnected && (
                  <span
                    className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#cae393]"
                    title="已同步到 Google 日历"
                  />
                )}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${task.colorType === 'dark' && !isDone ? 'bg-white/60' : ''}`}
                    style={{ background: isDone ? '#8b949e' : task.colorType !== 'dark' ? '#242424' : undefined }}
                  />
                  <span className="text-xs font-semibold truncate">{task.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] opacity-70">
                    {task.startTime} · {task.duration || 60}min
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full opacity-70 ${
                      task.colorType === 'dark' && !isDone ? 'bg-white/10' : 'bg-black/5'
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

          {/* 日历事件块（只读虚线） */}
          {dayCalendarEvents.map((ev) => {
            const st = new Date(ev.startTime);
            const et = new Date(ev.endTime);
            const startHr = st.getHours() + st.getMinutes() / 60;
            const endHr = et.getHours() + et.getMinutes() / 60;
            const durationMin = Math.round((endHr - startHr) * 60);
            const top = (startHr - startH) * hourH;
            const h = Math.max(((endHr - startHr) * hourH), 36);
            const style = getCalendarBlockMeta(ev.eventType, ev.color);

            return (
              <div
                key={`calendar-${ev.id}`}
                className="absolute left-14 right-2 rounded-[11px] px-3 py-2 select-none overflow-hidden z-5"
                style={{
                  top: `${top}px`,
                  height: `${h}px`,
                  background: style.background,
                  border: `1.5px dashed ${style.borderColor}`,
                  color: style.textColor,
                }}
                onClick={() => {
                  if (ev.courseId) {
                    console.log('[Calendar] navigate to course detail', ev.courseId);
                  }
                }}
              >
                {/* 同步状态指示点 */}
                {isGoogleConnected && (
                  <span
                    className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#cae393]"
                    title="已同步到 Google 日历"
                  />
                )}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: style.accent }}
                  />
                  <span className="text-xs font-semibold truncate">
                    {ev.title}
                    {ev.isOverride && (
                      <span className="ml-1 text-[9px] opacity-50">(已调)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] opacity-50">
                    {`${pad(st.getHours())}:${pad(st.getMinutes())} - ${pad(et.getHours())}:${pad(et.getMinutes())}`} · {durationMin}min
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-black/5 opacity-50">
                    {style.label}
                  </span>
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
              <div>
                <h3 className="text-sm font-bold text-[#242424]">
                  截止任务 · {dueOnlyTasks.length} 项
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  截止日期已设定，未安排到时间线 · 点击 ⏱ 快速安排
                </p>
              </div>
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
                const isScheduling = schedulingTaskId === task.id;
                return (
                  <div key={task.id}>
                    {/* 任务行 */}
                    <div
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isScheduling) {
                            cancelSchedule();
                          } else {
                            openSchedulePicker(task.id);
                          }
                        }}
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors ${
                          isScheduling
                            ? 'bg-white/30'
                            : 'bg-black/5 hover:bg-black/10'
                        }`}
                        title="安排到时间线"
                      >
                        ⏱
                      </button>
                    </div>
                    {/* 时间选择器：展开在卡片下方 */}
                    {isScheduling && (
                      <div className="mt-2 p-3 rounded-2xl border border-[#b0a8db]/40 bg-[#b0a8db]/5">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-[11px] text-gray-500 flex-shrink-0">开始</label>
                          <input
                            type="time"
                            value={scheduleStartTime}
                            onChange={(e) => setScheduleStartTime(e.target.value)}
                            className="flex-1 text-xs bg-white rounded-lg border border-gray-200 px-2 py-1.5 outline-none focus:border-[#b0a8db]"
                          />
                        </div>
                        <div className="mb-3">
                          <label className="text-[11px] text-gray-500 mb-1 block">时长</label>
                          <div className="flex gap-1.5">
                            {[30, 60, 90, 120].map((dur) => (
                              <button
                                key={dur}
                                onClick={() => setScheduleDuration(dur)}
                                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                                  scheduleDuration === dur
                                    ? 'bg-[#b0a8db] text-white'
                                    : 'bg-white text-gray-500 border border-gray-200 hover:border-[#b0a8db]'
                                }`}
                              >
                                {dur}min
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={cancelSchedule}
                            className="flex-1 text-xs py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            取消
                          </button>
                          <button
                            onClick={confirmSchedule}
                            className="flex-1 text-xs py-1.5 rounded-full bg-[#b0a8db] text-white font-medium hover:opacity-90 transition-opacity"
                          >
                            安排到时间线
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 空状态 */}
      {(dayTasks.length === 0 && dayCalendarEvents.length === 0) && (
        <div className="bg-white rounded-[2rem] p-8 shadow-sm mt-4 text-center">
          <p className="text-sm text-gray-400">该日无日程安排</p>
        </div>
      )}
    </div>
  );
}
