import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeftRight,
  Ban,
  CalendarClock,
  Check,
  Loader2,
  PlusCircle,
  RotateCcw,
  X,
} from 'lucide-react';
import type { CalendarEvent, CourseDetail } from '../types';
import {
  applyCourseChange,
  fetchCourseChangeCandidates,
  previewCourseChange,
  undoCourseChange,
  type CourseChangeCandidate,
  type CourseChangePreview,
  type CourseChangeRequest,
} from '../api/courses';

type ChangeMode = CourseChangeRequest['type'];

function toLocalInput(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoFromLocalInput(value: string) {
  return new Date(value).toISOString();
}

function dateTimeLabel(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function defaultExtraRange(course: CourseDetail) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  const [hour, minute] = (course.startTime || '09:00').split(':').map(Number);
  start.setHours(hour || 9, minute || 0, 0, 0);
  const end = new Date(start);
  if (course.startTime && course.endTime) {
    const [endHour, endMinute] = course.endTime.split(':').map(Number);
    end.setHours(endHour || hour + 1, endMinute || minute, 0, 0);
    if (end <= start) end.setTime(start.getTime() + 90 * 60_000);
  } else {
    end.setTime(start.getTime() + 90 * 60_000);
  }
  return { start, end };
}

export default function CourseChangeSheet({
  course,
  event,
  initialMode,
  onClose,
  onApplied,
}: {
  course: CourseDetail;
  event?: CalendarEvent | null;
  initialMode?: ChangeMode;
  onClose: () => void;
  onApplied: () => Promise<void> | void;
}) {
  const extraDefault = useMemo(() => defaultExtraRange(course), [course]);
  const [mode, setMode] = useState<ChangeMode>(
    initialMode || (event ? 'reschedule' : 'extra'),
  );
  const [startTime, setStartTime] = useState(
    toLocalInput(event?.startTime || extraDefault.start),
  );
  const [endTime, setEndTime] = useState(
    toLocalInput(event?.endTime || extraDefault.end),
  );
  const [location, setLocation] = useState(
    event?.location || course.room || course.location || '',
  );
  const [otherEventId, setOtherEventId] = useState('');
  const [candidates, setCandidates] = useState<CourseChangeCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [preview, setPreview] = useState<CourseChangePreview | null>(null);
  const [appliedPlanId, setAppliedPlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPreview(null);
    setMessage('');
  }, [mode, startTime, endTime, location, otherEventId]);

  useEffect(() => {
    if (mode !== 'swap' || !event) return;
    let active = true;
    setLoadingCandidates(true);
    const anchor = new Date(event.startTime);
    const rangeStart = new Date(anchor);
    rangeStart.setDate(rangeStart.getDate() - 14);
    const rangeEnd = new Date(anchor);
    rangeEnd.setDate(rangeEnd.getDate() + 31);

    void fetchCourseChangeCandidates(rangeStart.toISOString(), rangeEnd.toISOString())
      .then((items) => {
        if (!active) return;
        setCandidates(items.filter((item) => (
          item.id !== event.id &&
          item.overrideType !== 'cancel'
        )));
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : '读取换课候选失败');
      })
      .finally(() => {
        if (active) setLoadingCandidates(false);
      });

    return () => {
      active = false;
    };
  }, [mode, event]);

  const buildRequest = (): CourseChangeRequest => {
    if (mode === 'extra') {
      return {
        type: 'extra',
        courseId: course.id,
        startTime: isoFromLocalInput(startTime),
        endTime: isoFromLocalInput(endTime),
        location: location.trim() || null,
      };
    }
    if (!event) throw new Error('请先选择要调整的课程实例');
    if (mode === 'cancel') {
      return { type: 'cancel', eventId: event.id };
    }
    if (mode === 'swap') {
      if (!otherEventId) throw new Error('请选择要交换的另一节课程');
      return { type: 'swap', eventId: event.id, otherEventId };
    }
    return {
      type: 'reschedule',
      eventId: event.id,
      startTime: isoFromLocalInput(startTime),
      endTime: isoFromLocalInput(endTime),
      location: location.trim() || null,
    };
  };

  const runPreview = async () => {
    setBusy(true);
    setMessage('');
    try {
      setPreview(await previewCourseChange(buildRequest()));
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : '生成预览失败');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview || preview.conflicts.length || busy || appliedPlanId) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await applyCourseChange(buildRequest());
      setAppliedPlanId(result.planId);
      setMessage(`已应用 ${result.appliedCount} 个课程实例变动。你可以在关闭前撤销这次变动。`);
      await onApplied();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '应用课程变动失败');
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!appliedPlanId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await undoCourseChange(appliedPlanId);
      setAppliedPlanId(null);
      setPreview(null);
      setMessage(`已撤销本次课程变动，恢复 ${result.restoredCount} 个课程实例。`);
      await onApplied();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '撤销课程变动失败');
    } finally {
      setBusy(false);
    }
  };

  const modes: Array<{ id: ChangeMode; label: string; icon: typeof CalendarClock }> = event
    ? [
        { id: 'reschedule', label: '调课', icon: CalendarClock },
        { id: 'swap', label: '换课', icon: ArrowLeftRight },
        { id: 'cancel', label: '停课', icon: Ban },
      ]
    : [{ id: 'extra', label: '补课', icon: PlusCircle }];

  return createPortal(
    <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/30 px-3 sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="课程变动"
        className="mb-[env(safe-area-inset-bottom,0px)] max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem]"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#766aa8]">
              Course Change
            </p>
            <h2 className="mt-1 text-xl font-black text-[#242424]">
              {event ? event.title : course.name}
            </h2>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              单次变动只写本次 occurrence，不会改以后每周的课程模板。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f4f4f6]"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </header>

        <div className="grid grid-cols-3 gap-2">
          {modes.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                disabled={Boolean(appliedPlanId)}
                className={`flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-xs font-bold ${
                  mode === item.id
                    ? 'bg-[#242424] text-white'
                    : 'bg-[#f4f4f6] text-gray-500'
                }`}
              >
                <Icon size={13} /> {item.label}
              </button>
            );
          })}
        </div>

        {event && (
          <div className="mt-4 rounded-2xl bg-[#f7f5fc] px-4 py-3 text-xs text-[#5d557b]">
            <strong className="block">当前实例</strong>
            <span className="mt-1 block">
              {dateTimeLabel(event.startTime)} → {dateTimeLabel(event.endTime)}
              {event.location ? ` · ${event.location}` : ''}
            </span>
          </div>
        )}

        {(mode === 'reschedule' || mode === 'extra') && (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-bold text-[#242424]">
              开始时间
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={Boolean(appliedPlanId)}
                className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm outline-none"
              />
            </label>
            <label className="block text-xs font-bold text-[#242424]">
              结束时间
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={Boolean(appliedPlanId)}
                className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm outline-none"
              />
            </label>
            <label className="block text-xs font-bold text-[#242424]">
              地点
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={Boolean(appliedPlanId)}
                placeholder="教室 / 地点"
                className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm outline-none"
              />
            </label>
          </div>
        )}

        {mode === 'swap' && event && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-bold text-[#242424]">与哪一节交换</p>
            {loadingCandidates ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#f4f4f6] py-6 text-xs text-gray-400">
                <Loader2 size={14} className="animate-spin" /> 正在读取候选课程…
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {candidates.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setOtherEventId(item.id)}
                    disabled={Boolean(appliedPlanId)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left ${
                      otherEventId === item.id
                        ? 'border-[#9fbd61] bg-[#f7faef]'
                        : 'border-black/[0.05] bg-[#f4f4f6]'
                    }`}
                  >
                    <strong className="block text-xs text-[#242424]">{item.course?.name || item.title}</strong>
                    <span className="mt-1 block text-[10px] text-gray-400">
                      {dateTimeLabel(item.startTime)} → {dateTimeLabel(item.endTime)}
                      {item.location ? ` · ${item.location}` : ''}
                    </span>
                  </button>
                ))}
                {!candidates.length && (
                  <p className="rounded-2xl bg-[#f4f4f6] px-4 py-6 text-center text-xs text-gray-400">
                    这个时间范围内没有可交换的其他课程实例。
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'cancel' && (
          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
            停课会保留一个取消 override，用来阻止课程模板把这一节重新补回来；之后固定周课不受影响。
          </div>
        )}

        {!preview && (
          <button
            type="button"
            onClick={() => void runPreview()}
            disabled={busy || (mode === 'swap' && !otherEventId)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#242424] py-3 text-sm font-black text-[#cae393] disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />}
            生成变动预览
          </button>
        )}

        {preview && (
          <div className="mt-5 space-y-3">
            <div className="rounded-[1.5rem] border border-black/[0.06] p-4">
              <h3 className="text-xs font-black text-[#242424]">变动预览</h3>
              <div className="mt-3 space-y-2">
                {preview.changes.map((change, index) => (
                  <div key={`${change.eventId || 'new'}-${index}`} className="rounded-2xl bg-[#f4f4f6] px-3 py-3">
                    <strong className="block text-xs">{change.courseName} · {change.title}</strong>
                    {change.from && (
                      <span className="mt-1 block text-[10px] text-gray-400">
                        原：{dateTimeLabel(change.from.startTime)} → {dateTimeLabel(change.from.endTime)}
                        {change.from.location ? ` · ${change.from.location}` : ''}
                      </span>
                    )}
                    <span className={`mt-1 block text-[10px] font-bold ${
                      change.action === 'cancel' ? 'text-red-500' : 'text-[#6d609c]'
                    }`}>
                      {change.action === 'cancel'
                        ? '新：本次停课'
                        : `新：${dateTimeLabel(change.to!.startTime)} → ${dateTimeLabel(change.to!.endTime)}${change.to!.location ? ` · ${change.to!.location}` : ''}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {preview.conflicts.length > 0 && (
              <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4">
                <h3 className="text-xs font-black text-red-700">发现日程冲突</h3>
                <div className="mt-2 space-y-1">
                  {preview.conflicts.map((item, index) => (
                    <p key={`${item.sourceType}-${item.id}-${index}`} className="text-[10px] leading-4 text-red-600">
                      {item.title} · {dateTimeLabel(item.startTime)} → {dateTimeLabel(item.endTime)}
                    </p>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-red-500">当前版本不会带冲突强行应用，请先调整时间。</p>
              </div>
            )}

            {!appliedPlanId ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  disabled={busy}
                  className="rounded-full bg-[#f4f4f6] py-3 text-xs font-bold text-gray-500"
                >
                  返回修改
                </button>
                <button
                  type="button"
                  onClick={() => void apply()}
                  disabled={busy || preview.conflicts.length > 0}
                  className="flex items-center justify-center gap-2 rounded-full bg-[#cae393] py-3 text-xs font-black text-[#242424] disabled:opacity-40"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  确认应用
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void undo()}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-full bg-[#f4f4f6] py-3 text-xs font-bold text-[#5d557b] disabled:opacity-40"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  撤销本次变动
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="rounded-full bg-[#242424] py-3 text-xs font-black text-[#cae393] disabled:opacity-40"
                >
                  完成
                </button>
              </div>
            )}
          </div>
        )}

        {message && (
          <p className="mt-3 rounded-2xl bg-[#f4f4f6] px-4 py-3 text-xs text-gray-600">{message}</p>
        )}
      </section>
    </div>,
    document.body,
  );
}
