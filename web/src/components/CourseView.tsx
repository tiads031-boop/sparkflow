import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Upload, Trash2, BookOpen, MapPin, User, Clock, Check } from 'lucide-react';
import { useAppStore, type Course, type CourseFormData } from '../store/appStore';

// ════════════════════════════════════════════════════
// Props
// ════════════════════════════════════════════════════

interface CourseViewProps {
  onCourseClick: (courseId: string) => void;
  onAddClick: () => void;
  onImportClick: (file: File) => void;
}

// ════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════

const DAY_LABELS: Record<number, string> = {
  1: '周一', 2: '周二', 3: '周三', 4: '周四',
  5: '周五', 6: '周六', 7: '周日',
};

const DAY_OPTIONS = [
  { value: 0, label: '无' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];

const COLOR_PRESETS = [
  '#cae393', // green
  '#b0a8db', // purple
  '#242424', // dark
  '#f4a261', // warm orange
  '#e76f51', // coral
  '#2a9d8f', // teal
  '#e9c46a', // golden
  '#a8dadc', // light blue
  '#f1c0e8', // pink
  '#d4a373', // tan
];

const EMPTY_FORM: CourseFormData = {
  name: '',
  teacher: '',
  room: '',
  color: '#cae393',
  dayOfWeek: undefined,
  startTime: '',
  endTime: '',
};

// ════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════

function formatCourseTime(course: Course): string | null {
  if (!course.dayOfWeek || !course.startTime || !course.endTime) return null;
  const day = DAY_LABELS[course.dayOfWeek] || '';
  return `${day} ${course.startTime}-${course.endTime}`;
}

// ════════════════════════════════════════════════════
// CourseView
// ════════════════════════════════════════════════════

export default function CourseView({ onCourseClick, onAddClick, onImportClick }: CourseViewProps) {
  const courses = useAppStore((s) => s.courses);
  const loadCourses = useAppStore((s) => s.loadCourses);
  const removeCourse = useAppStore((s) => s.removeCourse);
  const addCourse = useAppStore((s) => s.addCourse);
  const isCoursesLoading = useAppStore((s) => s.isCoursesLoading);
  const coursesError = useAppStore((s) => s.coursesError);
  const semesters = useAppStore((s) => s.semesters);
  const activeSemesterId = useAppStore((s) => s.activeSemesterId);
  const loadSemesters = useAppStore((s) => s.loadSemesters);
  const setActiveSemester = useAppStore((s) => s.setActiveSemester);
  const addSemester = useAppStore((s) => s.addSemester);
  const editSemester = useAppStore((s) => s.editSemester);
  const removeSemester = useAppStore((s) => s.removeSemester);

  // ── Form state ──
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CourseFormData>({ ...EMPTY_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Delete state ──
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Long press ──
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // ── Load courses & semesters on mount ──
  useEffect(() => {
    loadCourses();
    loadSemesters();
  }, [loadCourses, loadSemesters]);

  // ── Re-load when active semester changes ──
  useEffect(() => {
    loadCourses();
  }, [activeSemesterId, loadCourses]);

  // ── Handlers: Form ──
  const openForm = useCallback(() => {
    setFormData({ ...EMPTY_FORM });
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setFormData({ ...EMPTY_FORM });
  }, []);

  const updateField = useCallback(<K extends keyof CourseFormData>(key: K, value: CourseFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) return;
    setIsSubmitting(true);
    try {
      const data: CourseFormData = {
        name: formData.name.trim(),
        teacher: formData.teacher?.trim() || undefined,
        room: formData.room?.trim() || undefined,
        color: formData.color,
        dayOfWeek: formData.dayOfWeek || undefined,
        startTime: formData.startTime || undefined,
        endTime: formData.endTime || undefined,
        semesterId: activeSemesterId || undefined,
      };
      await addCourse(data);
      closeForm();
    } catch {
      // error handled by store
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, addCourse, closeForm]);

  // ── Handlers: Long press → delete ──
  const handleTouchStart = useCallback((course: Course) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      // haptic feedback via vibrate if available
      if (navigator.vibrate) navigator.vibrate(10);
      setDeleteTarget(course);
    }, 600);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleClick = useCallback((course: Course) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onCourseClick(course.id);
  }, [onCourseClick]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await removeCourse(deleteTarget.id);
    } catch {
      // error handled by store
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, removeCourse]);

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  // ── Handlers: Import ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportClick(file);
    }
    // reset so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [onImportClick]);

  // ── Semester form state ──
  const [showSemesterForm, setShowSemesterForm] = useState(false);
  const [semesterForm, setSemesterForm] = useState<{ id?: string; name: string; startDate: string; endDate: string }>({
    name: '', startDate: '', endDate: '',
  });

  const openSemesterForm = (semester?: typeof semesters[number]) => {
    if (semester) {
      const s = new Date(semester.startDate);
      const e = new Date(semester.endDate);
      setSemesterForm({
        id: semester.id,
        name: semester.name,
        startDate: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`,
        endDate: `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`,
      });
    } else {
      setSemesterForm({ name: '', startDate: '', endDate: '' });
    }
    setShowSemesterForm(true);
  };

  const handleSemesterSubmit = async () => {
    if (!semesterForm.name.trim() || !semesterForm.startDate || !semesterForm.endDate) return;
    if (semesterForm.id) {
      await editSemester(semesterForm.id, semesterForm);
    } else {
      await addSemester(semesterForm);
    }
    setShowSemesterForm(false);
    await loadCourses();
  };

  // ── Render ──
  const hasCourses = courses.length > 0;

  return (
    <div className="animate-page-enter pb-24 relative">
      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-[#242424]">课程表</h1>
        <div className="flex gap-2">
          {/* ICS Import */}
          <button
            onClick={handleImportClick}
            className="w-9 h-9 rounded-full bg-[#b0a8db]/20 text-[#b0a8db] flex items-center justify-center btn-press hover:bg-[#b0a8db]/30 transition-colors"
            title="导入 ICS 课表"
          >
            <Upload size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics"
            onChange={handleFileChange}
            className="hidden"
          />
          {/* New course */}
          <button
            onClick={() => {
              openForm();
              onAddClick();
            }}
            className="w-9 h-9 rounded-full bg-[#242424] text-white flex items-center justify-center shadow-sm btn-press hover:scale-105 transition-all"
            title="新建课程"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* ── 学期筛选 Pill 栏 ── */}
      {semesters.length > 0 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto hide-scrollbar -mx-1 px-1">
          {/* 全部 */}
          <button
            onClick={() => { setActiveSemester(null); }}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              !activeSemesterId
                ? 'bg-[#242424] text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-[#b0a8db]'
            }`}
          >
            全部
          </button>
          {semesters.map((sem) => (
            <button
              key={sem.id}
              onClick={() => { setActiveSemester(sem.id); }}
              onContextMenu={(e) => { e.preventDefault(); openSemesterForm(sem); }}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeSemesterId === sem.id
                  ? 'bg-[#242424] text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-[#b0a8db]'
              }`}
            >
              {sem.name}
              {sem.isActive && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-[#cae393] inline-block" />
              )}
            </button>
          ))}
          {/* 新建学期 */}
          <button
            onClick={() => openSemesterForm()}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-[#b0a8db]/15 text-[#b0a8db] flex items-center justify-center hover:bg-[#b0a8db]/25 transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      )}

      {/* ── Error banner ── */}
      {coursesError && (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-100 text-red-500 text-sm flex items-center gap-2">
          <span className="text-xs">⚠</span>
          <span>{coursesError}</span>
          <button
            onClick={() => loadCourses()}
            className="ml-auto text-xs font-medium underline hover:no-underline"
          >
            重试
          </button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isCoursesLoading && !hasCourses && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-[2rem] p-5 shadow-sm animate-pulse flex items-center gap-4"
            >
              <div className="w-1.5 h-12 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2.5">
                <div className="h-4 bg-gray-200 rounded-full w-2/3" />
                <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                <div className="h-3 bg-gray-100 rounded-full w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isCoursesLoading && !hasCourses && (
        <div className="text-center py-16 px-4">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-[#b0a8db]/15 flex items-center justify-center">
            <BookOpen size={32} className="text-[#b0a8db]" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-bold text-[#242424] mb-2">还没有课程</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed max-w-xs mx-auto">
            导入学校课表 ICS 文件，或手动创建课程，让 SparkFlow 帮你管理学习节奏
          </p>
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={handleImportClick}
              className="px-6 py-3 rounded-full bg-[#b0a8db] text-[#242424] font-medium text-sm shadow-sm btn-press hover:bg-[#a39bcb] transition-colors flex items-center gap-2"
            >
              <Upload size={16} />
              导入 ICS 课表
            </button>
            <button
              onClick={() => {
                openForm();
                onAddClick();
              }}
              className="px-6 py-3 rounded-full bg-[#242424] text-white font-medium text-sm shadow-sm btn-press hover:bg-black/80 transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              手动创建课程
            </button>
          </div>
        </div>
      )}

      {/* ── Course list ── */}
      {hasCourses && (
        <div className="space-y-2.5 stagger">
          {courses.map((course) => {
            const timeStr = formatCourseTime(course);
            const hasMeta = course.teacher || course.room || timeStr;

            return (
              <div
                key={course.id}
                className="bg-white rounded-[2rem] p-4 shadow-sm flex items-center gap-3.5 cursor-pointer btn-press select-none relative overflow-hidden task-block"
                onClick={() => handleClick(course)}
                onTouchStart={() => handleTouchStart(course)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                onMouseDown={() => handleTouchStart(course)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onContextMenu={(e) => e.preventDefault()}
              >
                {/* Color bar */}
                <div
                  className="w-1.5 h-14 rounded-full flex-shrink-0"
                  style={{ backgroundColor: course.color || '#cae393' }}
                />

                {/* Course info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-bold text-[#242424] truncate leading-tight">
                    {course.name}
                  </h3>

                  {hasMeta && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                      {course.teacher && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                          <User size={10} strokeWidth={2} />
                          <span className="truncate max-w-[120px]">{course.teacher}</span>
                        </span>
                      )}
                      {course.room && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                          <MapPin size={10} strokeWidth={2} />
                          <span className="truncate max-w-[100px]">{course.room}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {timeStr && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-400">
                      <Clock size={10} strokeWidth={2} />
                      <span>{timeStr}</span>
                    </div>
                  )}
                </div>

                {/* Stats badges */}
                {course._count && (course._count.events > 0 || course._count.tasks > 0 || course._count.notes > 0) && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {course._count.tasks > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#cae393]/20 text-[#242424] font-medium">
                        {course._count.tasks} 任务
                      </span>
                    )}
                    {course._count.notes > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#b0a8db]/20 text-[#242424] font-medium">
                        {course._count.notes} 笔记
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Delete confirmation bottom sheet ── */}
      {deleteTarget && (
        <div className="absolute inset-0 z-50" style={{ pointerEvents: 'none' }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            style={{ pointerEvents: 'auto' }}
            onClick={cancelDelete}
          />
          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] p-5 bg-[#f4f4f6] overflow-hidden animate-slide-up-sheet"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
            <div className="text-center mb-5">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={22} className="text-red-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-[#242424]">删除课程</h3>
              <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
                确定要删除「{deleteTarget.name}」吗？
                <br />
                该课程下的所有事件、任务和笔记将被一并移除。
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-full bg-white text-[#242424] font-medium text-sm border border-gray-200 btn-press"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-full bg-red-500 text-white font-medium text-sm btn-press flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create form bottom sheet ── */}
      {showForm && (
        <div className="absolute inset-0 z-50" style={{ pointerEvents: 'none' }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            style={{ pointerEvents: 'auto' }}
            onClick={closeForm}
          />
          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] px-5 pt-5 pb-8 bg-[#f4f4f6] overflow-y-auto animate-slide-up-sheet focus-ring"
            style={{ maxHeight: '85%', pointerEvents: 'auto' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
            <h3 className="text-lg font-bold text-[#242424] mb-5">新建课程</h3>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">课程名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="如：高等数学"
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-100 text-sm text-[#242424] placeholder:text-gray-300 focus:border-[#b0a8db] focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              {/* Teacher & Room (side by side) */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">教师</label>
                  <input
                    type="text"
                    value={formData.teacher || ''}
                    onChange={(e) => updateField('teacher', e.target.value)}
                    placeholder="如：张教授"
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-100 text-sm text-[#242424] placeholder:text-gray-300 focus:border-[#b0a8db] focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">教室</label>
                  <input
                    type="text"
                    value={formData.room || ''}
                    onChange={(e) => updateField('room', e.target.value)}
                    placeholder="如：教一楼 201"
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-100 text-sm text-[#242424] placeholder:text-gray-300 focus:border-[#b0a8db] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Day of week & Time */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">上课时间</label>
                <div className="flex gap-3">
                  <div className="w-24">
                    <select
                      value={formData.dayOfWeek ?? 0}
                      onChange={(e) => updateField('dayOfWeek', Number(e.target.value) || undefined)}
                      className="w-full px-3 py-3 rounded-2xl bg-white border border-gray-100 text-sm text-[#242424] focus:border-[#b0a8db] focus:outline-none transition-colors appearance-none"
                    >
                      {DAY_OPTIONS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="time"
                    value={formData.startTime || ''}
                    onChange={(e) => updateField('startTime', e.target.value)}
                    className="flex-1 px-4 py-3 rounded-2xl bg-white border border-gray-100 text-sm text-[#242424] focus:border-[#b0a8db] focus:outline-none transition-colors"
                  />
                  <span className="flex items-center text-gray-400 text-sm">至</span>
                  <input
                    type="time"
                    value={formData.endTime || ''}
                    onChange={(e) => updateField('endTime', e.target.value)}
                    className="flex-1 px-4 py-3 rounded-2xl bg-white border border-gray-100 text-sm text-[#242424] focus:border-[#b0a8db] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  课程颜色
                  <span
                    className="inline-block w-3 h-3 rounded-full ml-2 align-middle border border-gray-200"
                    style={{ backgroundColor: formData.color || '#cae393' }}
                  />
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateField('color', color)}
                      className={`w-9 h-9 rounded-full transition-all btn-press border-2 ${
                        formData.color === color
                          ? 'border-[#242424] scale-110 shadow-md'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-3">
                <button
                  onClick={closeForm}
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-full bg-white text-[#242424] font-medium text-sm border border-gray-200 btn-press"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!formData.name.trim() || isSubmitting}
                  className="flex-1 py-3 rounded-full bg-[#242424] text-white font-medium text-sm btn-press flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
                >
                  {isSubmitting ? '创建中...' : (
                    <>
                      <Check size={16} />
                      创建课程
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Course count indicator ── */}
      {hasCourses && (
        <div className="mt-4 text-center">
          <span className="text-xs text-gray-400">
            {courses.length} 门课程
            {courses.filter((c) => c.dayOfWeek).length > 0 &&
              ` · ${courses.filter((c) => c.dayOfWeek).length} 门已排课`}
          </span>
        </div>
      )}

      {/* ── Semester form bottom sheet ── */}
      {showSemesterForm && (
        <div className="absolute inset-0 z-50" style={{ pointerEvents: 'none' }}>
          <div
            className="absolute inset-0 bg-black/30"
            style={{ pointerEvents: 'auto' }}
            onClick={() => setShowSemesterForm(false)}
          />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] px-5 pt-5 pb-8 bg-[#f4f4f6] overflow-y-auto animate-slide-up-sheet"
            style={{ maxHeight: '85%', pointerEvents: 'auto' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-5" />
            <h3 className="text-lg font-bold text-[#242424] mb-5">
              {semesterForm.id ? '编辑学期' : '新建学期'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">学期名称</label>
                <input
                  type="text"
                  value={semesterForm.name}
                  onChange={(e) => setSemesterForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="如：大二下学期"
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-100 text-sm text-[#242424] placeholder:text-gray-300 focus:border-[#b0a8db] focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">起始日期（第 1 周周一）</label>
                <input
                  type="date"
                  value={semesterForm.startDate}
                  onChange={(e) => setSemesterForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-100 text-sm text-[#242424] focus:border-[#b0a8db] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">结束日期</label>
                <input
                  type="date"
                  value={semesterForm.endDate}
                  onChange={(e) => setSemesterForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-100 text-sm text-[#242424] focus:border-[#b0a8db] focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-3">
                <button
                  onClick={() => setShowSemesterForm(false)}
                  className="flex-1 py-3 rounded-full bg-white text-[#242424] font-medium text-sm border border-gray-200"
                >
                  取消
                </button>
                {semesterForm.id && (
                  <button
                    onClick={async () => {
                      await removeSemester(semesterForm.id!);
                      setShowSemesterForm(false);
                      await loadCourses();
                    }}
                    className="py-3 px-4 rounded-full bg-red-500 text-white font-medium text-sm"
                  >
                    删除
                  </button>
                )}
                <button
                  onClick={handleSemesterSubmit}
                  disabled={!semesterForm.name.trim() || !semesterForm.startDate || !semesterForm.endDate}
                  className="flex-1 py-3 rounded-full bg-[#242424] text-white font-medium text-sm disabled:opacity-40"
                >
                  {semesterForm.id ? '保存' : '创建'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
