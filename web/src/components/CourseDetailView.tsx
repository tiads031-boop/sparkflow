import { useState } from 'react';
import { ArrowLeft, Pencil, Pin, PinOff, Trash2, Send, MapPin, Clock, User } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { CourseNote } from '../types';

// ════════════════════════════════════════════════════
// Props
// ════════════════════════════════════════════════════

interface CourseDetailViewProps {
  onBack: () => void;
}

const DAY_LABELS: Record<number, string> = {
  1: '周一', 2: '周二', 3: '周三', 4: '周四',
  5: '周五', 6: '周六', 7: '周日',
};

// ════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════

export default function CourseDetailView({ onBack }: CourseDetailViewProps) {
  const selectedCourse = useAppStore((s) => s.selectedCourse);
  const addNote = useAppStore((s) => s.addNote);
  const editNote = useAppStore((s) => s.editNote);
  const removeNote = useAppStore((s) => s.removeNote);

  const [noteText, setNoteText] = useState('');

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
  const sortedNotes = [...c.notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const sortedEvents = [...c.events]
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 15);

  const handleAddNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteText('');
    await addNote(c.id, text);
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
        className="rounded-[2rem] p-6 mb-5 shadow-sm"
        style={{ backgroundColor: c.color || '#b0a8db' }}
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
            {c._count?.notes || c.notes?.length || 0} 条笔记
          </span>
        </div>
      </div>

      {/* Schedule (events list) */}
      {sortedEvents.length > 0 && (
        <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-4">
          <h3 className="text-sm font-bold text-[#242424] mb-3">上课安排</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto hide-scrollbar">
            {sortedEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-[#f4f4f6]"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c.color || '#b0a8db' }}
                />
                <span className="text-xs text-gray-500 w-16">{formatEventDate(ev.start)}</span>
                <span className="text-sm text-[#242424] font-medium">
                  {formatEventTime(ev.start)} - {formatEventTime(ev.end)}
                </span>
              </div>
            ))}
          </div>
          {c.events.length > 15 && (
            <p className="text-xs text-gray-400 text-center mt-2">
              仅显示最近 15 次课，共 {c.events.length} 次
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
                <span className="text-[10px] text-gray-400">{task.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-[2rem] p-5 shadow-sm mb-4">
        <h3 className="text-sm font-bold text-[#242424] mb-3">课程笔记</h3>

        {/* Note input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            placeholder="写下课堂笔记..."
            className="flex-1 px-4 py-2.5 rounded-full bg-[#f4f4f6] text-sm text-[#242424] outline-none focus:ring-2 focus:ring-[#b0a8db]/30"
          />
          <button
            onClick={handleAddNote}
            disabled={!noteText.trim()}
            className="w-10 h-10 rounded-full bg-[#242424] text-white flex items-center justify-center disabled:opacity-30 transition-opacity"
          >
            <Send size={16} />
          </button>
        </div>

        {/* Notes list */}
        {sortedNotes.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">暂无笔记，写下课堂记录吧</p>
        ) : (
          <div className="space-y-2">
            {sortedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onTogglePin={() => editNote(note.id, { pinned: !note.pinned })}
                onDelete={() => removeNote(note.id)}
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
  onTogglePin,
  onDelete,
}: {
  note: CourseNote;
  onTogglePin: () => void;
  onDelete: () => void;
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
        <p className="flex-1 text-sm text-[#242424] leading-relaxed">{note.body}</p>
        <div className="flex items-center gap-1 flex-shrink-0">
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
