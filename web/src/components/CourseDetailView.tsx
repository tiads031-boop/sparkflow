import { useState, useMemo } from 'react';
import { ArrowLeft, Pin, PinOff, Trash2, Send, MapPin, Clock, User, Sparkles, Search, Tag, ClipboardCheck } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { CourseNote } from '../types';
import { apiRequest, DEFAULT_USER_ID } from '../api/client';

// ════════════════════════════════════════════════════
// Props
// ════════════════════════════════════════════════════

interface CourseDetailViewProps {
  onBack: () => void;
}

function readableCourseColor(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#242424';
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179 ? '#161616' : '#ffffff';
}

const DAY_LABELS: Record<number, string> = {
  1: '周一', 2: '周二', 3: '周三', 4: '周四',
  5: '周五', 6: '周六', 7: '周日',
};

const COURSE_TASK_STATUSES = [
  { value: 'todo', label: '待处理' },
  { value: 'in-progress', label: '进行中' },
  { value: 'done', label: '已完成' },
] as const;

type CourseTaskStatus = typeof COURSE_TASK_STATUSES[number]['value'];
type ParsedCourseTask = {
  body: string;
  tags: string[];
  status: CourseTaskStatus;
};

const TASK_META_RE = /^\[course-task:(todo|in-progress|done)\]\[tags:([^\]]*)\]\s*/;
const TASK_STATUS_LABELS: Record<string, string> = {
  'To do': '待处理',
  'In progress': '进行中',
  'In review': '进行中',
  Done: '已完成',
};

function parseCourseTaskBody(body: string): ParsedCourseTask {
  const match = body.match(TASK_META_RE);
  if (!match) return { body, tags: [], status: 'todo' };
  return {
    body: body.slice(match[0].length),
    tags: match[2].split(',').map((tag) => tag.trim()).filter(Boolean),
    status: match[1] as CourseTaskStatus,
  };
}

function serializeCourseTaskBody(task: ParsedCourseTask): string {
  const tags = task.tags.map((tag) => tag.trim()).filter(Boolean).join(',');
  return `[course-task:${task.status}][tags:${tags}] ${task.body.trim()}`;
}

function parseTagInput(input: string): string[] {
  return input
    .split(/[,\s，、]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// ════════════════════════════════════════════════════
// Week helpers
// ════════════════════════════════════════════════════

function getWeekRange(): { monday: Date; sunday: Date } {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

// ════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════

export default function CourseDetailView({ onBack }: CourseDetailViewProps) {
  const selectedCourse = useAppStore((s) => s.selectedCourse);
  const addNote = useAppStore((s) => s.addNote);
  const editNote = useAppStore((s) => s.editNote);
  const removeNote = useAppStore((s) => s.removeNote);
  const loadCourseDetail = useAppStore((s) => s.loadCourseDetail);

  const [noteText, setNoteText] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [noteStatus, setNoteStatus] = useState<CourseTaskStatus>('todo');
  const [taskSearch, setTaskSearch] = useState('');
  const [convertingNoteId, setConvertingNoteId] = useState<string | null>(null);

  // ⚠️ useMemo 必须在 early return 之前，保证 hooks 调用顺序一致
  const { thisWeekEvents, otherEvents } = useMemo(() => {
    if (!selectedCourse) return { thisWeekEvents: [], otherEvents: [] };
    const all = [...selectedCourse.events]
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const weekRange = getWeekRange();
    const thisWeek: typeof all = [];
    const future: typeof all = [];
    const past: typeof all = [];
    for (const ev of all) {
      const d = new Date(ev.startTime);
      if (d >= weekRange.monday && d <= weekRange.sunday) {
        thisWeek.push(ev);
      } else if (d > weekRange.sunday) {
        future.push(ev);
      } else {
        past.push(ev);
      }
    }
    past.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return {
      thisWeekEvents: thisWeek,
      otherEvents: [
        ...future.map((event) => ({ event, isPast: false })),
        ...past.map((event) => ({ event, isPast: true })),
      ].slice(0, 15),
    };
  }, [selectedCourse]);

  const hasAnyEvents = thisWeekEvents.length > 0 || otherEvents.length > 0;
  const totalEvents = selectedCourse?.events?.length ?? 0;

  if (!selectedCourse) {
    return (
      <div className="animate-page-enter">
        <button onClick={onBack} className="mb-4 p-2 -ml-2 rounded-full hover:bg-gray-200 transition-colors">
          <ArrowLeft size={20} className="text-[#242424]" />
        </button>
        <p className="text-center text-sm text-gray-400 py-12">课程未找到</p>
      </div>
    );
  }

  const c = selectedCourse;
  const sortedTasks = [...c.notes]
    .map((note) => ({ note, parsed: parseCourseTaskBody(note.body) }))
    .filter(({ parsed }) => {
      const query = taskSearch.trim().toLowerCase();
      if (!query) return true;
      return [
        parsed.body,
        ...parsed.tags,
        COURSE_TASK_STATUSES.find((status) => status.value === parsed.status)?.label || '',
      ].some((value) => value.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      if (a.note.pinned !== b.note.pinned) return a.note.pinned ? -1 : 1;
      return new Date(b.note.createdAt).getTime() - new Date(a.note.createdAt).getTime();
    });

  const handleAddNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteText('');
    setNoteTags('');
    setNoteStatus('todo');
    await addNote(c.id, serializeCourseTaskBody({
      body: text,
      tags: parseTagInput(noteTags),
      status: noteStatus,
    }));
  };

  const handleConvertToTask = async (note: CourseNote, parsed: ParsedCourseTask) => {
    if (convertingNoteId) return;
    setConvertingNoteId(note.id);
    try {
      await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          userId: DEFAULT_USER_ID,
          title: parsed.body,
          description: `来自课程任务：${c.name}`,
          status: parsed.status,
          priority: 'medium',
          section: 'project',
          project: c.name,
          courseId: c.id,
          tags: parsed.tags,
        }),
      });
      await loadCourseDetail(c.id);
    } finally {
      setConvertingNoteId(null);
    }
  };

  const formatEventDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${DAY_LABELS[d.getDay() || 7]}`;
  };

  const formatEventTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="animate-page-enter pb-24">
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-4 p-2 -ml-2 rounded-full hover:bg-gray-200 transition-colors"
      >
        <ArrowLeft size={20} className="text-[#242424]" />
      </button>

      {/* Hero Card */}
      <div
        className="course-hero rounded-[2rem] p-6 mb-5 shadow-sm"
        style={{ backgroundColor: c.color || '#b0a8db', color: readableCourseColor(c.color || '#b0a8db') }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white mb-2">{c.name}</h1>
            {c.teacher && (
              <div className="flex items-center gap-1.5 text-white/80 text-sm mb-1">
                <User size={14} />
                <span>{c.teacher}</span>
              </div>
            )}
            {c.room && (
              <div className="flex items-center gap-1.5 text-white/80 text-sm mb-1">
                <MapPin size={14} />
                <span>{c.room}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-white/70 text-sm">
              <Clock size={14} />
              <span>
                {c.dayOfWeek ? `${DAY_LABELS[c.dayOfWeek]} ` : ''}
                {c.startTime && c.endTime ? `${c.startTime}-${c.endTime}` : '时间未定'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex gap-2 mt-4">
          <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
            {c._count?.events || c.events?.length || 0} 次课
          </span>
          <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
            {c._count?.tasks || c.tasks?.length || 0} 个任务
          </span>
          <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
            {c._count?.notes || c.notes?.length || 0} 个课程任务
          </span>
        </div>
      </div>

      {/* Schedule (events list) */}
      {hasAnyEvents && (
        <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-4">
          <h3 className="text-sm font-bold text-[#242424] mb-3">上课安排</h3>

          {/* ── 本周课程（焦点聚焦）── */}
          {thisWeekEvents.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles size={14} className="text-[#b0a8db]" />
                <span className="text-xs font-bold text-[#b0a8db] tracking-wide">本周课程</span>
                <span className="text-[10px] text-gray-400 ml-auto">{thisWeekEvents.length} 节</span>
              </div>
              <div className="space-y-1.5">
                {thisWeekEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 py-3 px-4 rounded-2xl transition-all duration-300"
                    style={{
                      background: `${c.color || '#b0a8db'}12`,
                      boxShadow: `0 0 0 1px ${c.color || '#b0a8db'}20, 0 2px 8px ${c.color || '#b0a8db'}10`,
                    }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: c.color || '#b0a8db',
                        boxShadow: `0 0 0 3px ${c.color || '#b0a8db'}30`,
                      }}
                    />
                    <span className="text-xs text-[#242424] w-16 font-semibold">
                      {formatEventDate(ev.startTime)}
                    </span>
                    <span className="text-sm text-[#242424] font-bold">
                      {formatEventTime(ev.startTime)} - {formatEventTime(ev.endTime)}
                    </span>
                    <span
                      className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{
                        background: `${c.color || '#b0a8db'}30`,
                        color: '#242424',
                      }}
                    >
                      本周
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 后续课程 ── */}
          {otherEvents.length > 0 && (
            <div>
              {thisWeekEvents.length > 0 && (
                <div className="flex items-center gap-1.5 mb-2.5 mt-1">
                  <span className="text-xs font-bold text-gray-400 tracking-wide">后续课程</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{otherEvents.length} 节</span>
                </div>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto hide-scrollbar">
                {otherEvents.map(({ event: ev, isPast }) => (
                  <div
                    key={ev.id}
                    className={`flex items-center gap-3 py-2.5 px-3 rounded-xl bg-[#f4f4f6] ${
                      isPast ? 'opacity-55 grayscale' : ''
                    }`}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.color || '#b0a8db' }}
                    />
                    <span className="text-xs text-gray-500 w-16">{formatEventDate(ev.startTime)}</span>
                    <span className="text-sm text-[#242424] font-medium">
                      {formatEventTime(ev.startTime)} - {formatEventTime(ev.endTime)}
                    </span>
                    {isPast && (
                      <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-400">
                        已上过
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalEvents > 15 && thisWeekEvents.length < totalEvents && (
            <p className="text-xs text-gray-400 text-center mt-2">
              仅显示最近 15 次课，共 {totalEvents} 次
            </p>
          )}
        </div>
      )}

      {/* Tasks linked to this course */}
      {c.tasks && c.tasks.length > 0 && (
        <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-4">
          <h3 className="text-sm font-bold text-[#242424] mb-3">关联任务</h3>
          <div className="space-y-2">
            {c.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-[#f4f4f6]"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      task.colorType === 'dark' ? '#242424' :
                      task.colorType === 'green' ? '#cae393' : '#b0a8db',
                  }}
                />
                <span className="flex-1 text-sm text-[#242424] truncate">{task.title}</span>
                <span className="text-[10px] text-gray-400">{TASK_STATUS_LABELS[task.status] || '待处理'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Course tasks */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[#242424]">课程任务</h3>
          <span className="text-[10px] text-gray-400">{sortedTasks.length} 条</span>
        </div>

        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-2xl bg-[#f4f4f6]">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            placeholder="搜索课程任务或标签"
            className="flex-1 bg-transparent text-sm text-[#242424] outline-none placeholder:text-gray-300"
          />
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="添加课程任务..."
              className="flex-1 px-4 py-2.5 rounded-full bg-[#f4f4f6] text-sm text-[#242424] outline-none focus:ring-2 focus:ring-[#b0a8db]/30"
            />
            <button
              onClick={handleAddNote}
              disabled={!noteText.trim()}
              className="w-10 h-10 rounded-full bg-[#242424] text-white flex items-center justify-center disabled:opacity-30 transition-opacity"
              title="添加课程任务"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full bg-[#f4f4f6]">
              <Tag size={13} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={noteTags}
                onChange={(e) => setNoteTags(e.target.value)}
                placeholder="标签，用空格或逗号分隔"
                className="min-w-0 flex-1 bg-transparent text-xs text-[#242424] outline-none placeholder:text-gray-300"
              />
            </div>
            <select
              value={noteStatus}
              onChange={(e) => setNoteStatus(e.target.value as CourseTaskStatus)}
              className="px-3 py-2 rounded-full bg-[#f4f4f6] text-xs text-[#242424] outline-none"
            >
              {COURSE_TASK_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
        </div>

        {sortedTasks.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">
            {taskSearch.trim() ? '没有匹配的课程任务' : '暂无课程任务，先添加一个课堂行动项吧'}
          </p>
        ) : (
          <div className="space-y-2">
            {sortedTasks.map(({ note, parsed }) => (
              <NoteCard
                key={note.id}
                note={note}
                parsed={parsed}
                onTogglePin={() => editNote(note.id, { pinned: !note.pinned })}
                onChangeStatus={(status) => editNote(note.id, {
                  body: serializeCourseTaskBody({ ...parsed, status }),
                })}
                onDelete={() => removeNote(note.id)}
                onConvert={() => handleConvertToTask(note, parsed)}
                isConverting={convertingNoteId === note.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
// NoteCard sub-component
// ════════════════════════════════════════════════════

function NoteCard({
  note,
  parsed,
  onTogglePin,
  onChangeStatus,
  onDelete,
  onConvert,
  isConverting,
}: {
  note: CourseNote;
  parsed: ParsedCourseTask;
  onTogglePin: () => void;
  onChangeStatus: (status: CourseTaskStatus) => void;
  onDelete: () => void;
  onConvert: () => void;
  isConverting: boolean;
}) {
  const formattedTime = new Date(note.createdAt).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`p-3 rounded-2xl bg-[#f4f4f6] border ${
        note.pinned ? 'border-l-[3px] border-l-[#b0a8db]' : 'border-transparent'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#242424] leading-relaxed">{parsed.body}</p>
          {parsed.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {parsed.tags.map((tag) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#b0a8db]/15 text-[#242424]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <select
            value={parsed.status}
            onChange={(e) => onChangeStatus(e.target.value as CourseTaskStatus)}
            className="max-w-[76px] px-2 py-1 rounded-lg bg-white text-[10px] text-gray-500 outline-none"
            title="课程任务状态"
          >
            {COURSE_TASK_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <button
            onClick={onConvert}
            disabled={isConverting}
            className="p-1 rounded-lg text-gray-300 hover:text-[#242424] disabled:opacity-40 transition-colors"
            title="转化为任务"
          >
            <ClipboardCheck size={14} />
          </button>
          <button
            onClick={onTogglePin}
            className={`p-1 rounded-lg transition-colors ${
              note.pinned ? 'text-[#b0a8db]' : 'text-gray-300 hover:text-gray-500'
            }`}
            title={note.pinned ? '取消置顶' : '置顶'}
          >
            {note.pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded-lg text-gray-300 hover:text-red-400 transition-colors"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2">{formattedTime}</p>
    </div>
  );
}
