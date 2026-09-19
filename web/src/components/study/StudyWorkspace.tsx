import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Clock3,
  FolderOpen,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { Course, StudyFolder, StudyFolderInput, Task } from '../../types';
import {
  archiveStudyFolder,
  createStudyFolder,
  fetchStudyFolders,
  restoreStudyFolder,
  updateStudyFolder,
} from '../../api/study';

type StudySection = 'home' | 'folders' | 'review' | 'more';

const sections: Array<{ id: StudySection; label: string; icon: typeof BookOpen }> = [
  { id: 'home', label: '首页', icon: GraduationCap },
  { id: 'folders', label: '文件夹', icon: FolderOpen },
  { id: 'review', label: '复习', icon: RefreshCw },
  { id: 'more', label: '更多', icon: MoreHorizontal },
];

const folderColors = ['#cae393', '#b0a8db', '#f5c98b', '#8fd6cf', '#f4a6b8'];

function isSameLocalDay(value: string | undefined, today: Date) {
  if (!value) return false;
  const date = new Date(value);
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function FolderDialog({
  folder,
  tasks,
  courses,
  onClose,
  onSave,
}: {
  folder: StudyFolder | null;
  tasks: Task[];
  courses: Course[];
  onClose: () => void;
  onSave: (input: StudyFolderInput) => Promise<void>;
}) {
  const [name, setName] = useState(folder?.name || '');
  const [description, setDescription] = useState(folder?.description || '');
  const [color, setColor] = useState(folder?.color || folderColors[0]);
  const [courseIds, setCourseIds] = useState(folder?.courses.map((course) => course.id) || []);
  const [taskIds, setTaskIds] = useState(folder?.tasks.map((task) => task.id) || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (values: string[], value: string, setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-3 sm:items-center" role="dialog" aria-modal="true" aria-label={folder ? '编辑学习文件夹' : '新建学习文件夹'}>
      <form
        className="mb-[env(safe-area-inset-bottom,0px)] max-h-[88svh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem]"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim() || saving) return;
          setSaving(true);
          setError(null);
          try {
            await onSave({ name, description, color, courseIds, taskIds });
          } catch (err) {
            setError(err instanceof Error ? err.message : '保存失败');
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#242424]">{folder ? '编辑文件夹' : '新建学习文件夹'}</h2>
            <p className="mt-1 text-xs text-gray-400">关联现有课程和任务，不复制数据。</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[#f4f4f6] text-gray-500" aria-label="关闭">
            <X size={17} />
          </button>
        </div>

        <label className="block text-xs font-bold text-[#242424]">
          名称
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder="例如：考研英语" className="mt-1 w-full rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm outline-none ring-2 ring-transparent focus:ring-[#cae393]" />
        </label>
        <label className="mt-3 block text-xs font-bold text-[#242424]">
          说明
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="这个目标要完成什么？" className="mt-1 w-full resize-none rounded-2xl bg-[#f4f4f6] px-4 py-3 text-sm outline-none ring-2 ring-transparent focus:ring-[#cae393]" />
        </label>

        <div className="mt-4">
          <p className="mb-2 text-xs font-bold text-[#242424]">颜色</p>
          <div className="flex gap-2">
            {folderColors.map((item) => (
              <button key={item} type="button" onClick={() => setColor(item)} aria-label={`选择颜色 ${item}`} className={`h-8 w-8 rounded-full border-2 ${color === item ? 'border-[#242424]' : 'border-white'}`} style={{ backgroundColor: item }} />
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-bold text-[#242424]">关联课程</p>
          <div className="flex flex-wrap gap-2">
            {courses.length ? courses.map((course) => (
              <button key={course.id} type="button" onClick={() => toggle(courseIds, course.id, setCourseIds)} className={`rounded-full px-3 py-2 text-xs font-bold ${courseIds.includes(course.id) ? 'bg-[#242424] text-white' : 'bg-[#f4f4f6] text-gray-500'}`}>
                {course.name}
              </button>
            )) : <p className="text-xs text-gray-400">暂无课程，可稍后补充。</p>}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-bold text-[#242424]">关联学习任务</p>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {tasks.length ? tasks.map((task) => (
              <label key={task.id} className="flex items-center gap-3 rounded-2xl bg-[#f4f4f6] px-3 py-2.5 text-xs font-medium text-[#242424]">
                <input type="checkbox" checked={taskIds.includes(task.id)} onChange={() => toggle(taskIds, task.id, setTaskIds)} className="accent-[#242424]" />
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
              </label>
            )) : <p className="text-xs text-gray-400">暂无可关联任务。</p>}
          </div>
        </div>

        {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</p>}
        <button type="submit" disabled={!name.trim() || saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#242424] py-3 text-sm font-bold text-[#cae393] disabled:opacity-50">
          {saving && <Loader2 size={15} className="animate-spin" />}
          {folder ? '保存修改' : '创建文件夹'}
        </button>
      </form>
    </div>
  );
}

export default function StudyWorkspace({ onStartFocus }: { onStartFocus: () => void }) {
  const tasks = useAppStore((state) => state.tasks);
  const courses = useAppStore((state) => state.courses);
  const todayCount = useAppStore((state) => state.pomodoro.todayCount);
  const totalFocusMinutes = useAppStore((state) => state.pomodoro.totalFocusMinutes);
  const [section, setSection] = useState<StudySection>('home');
  const [folders, setFolders] = useState<StudyFolder[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<StudyFolder | null | undefined>(undefined);

  const loadFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      setFolders(await fetchStudyFolders('all'));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载学习文件夹失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void fetchStudyFolders('all')
      .then((items) => { if (active) setFolders(items); })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : '加载学习文件夹失败');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const today = new Date();
  const studyTasks = useMemo(() => tasks.filter((task) => task.section === 'study' || Boolean(task.courseId)), [tasks]);
  const todayTasks = studyTasks.filter((task) => task.status !== 'Done' && (
    isSameLocalDay(task.scheduledStart, today) || isSameLocalDay(task.dueDate, today)
  ));
  const weekday = today.getDay() || 7;
  const todayCourses = courses.filter((course) => course.dayOfWeek === weekday);
  const visibleFolders = folders.filter((folder) => showArchived ? folder.status === 'archived' : folder.status === 'active');

  const saveFolder = async (input: StudyFolderInput) => {
    if (editingFolder) await updateStudyFolder(editingFolder.id, input);
    else await createStudyFolder(input);
    setEditingFolder(undefined);
    await loadFolders();
  };

  const toggleArchive = async (folder: StudyFolder) => {
    try {
      if (folder.status === 'archived') await restoreStudyFolder(folder.id);
      else await archiveStudyFolder(folder.id);
      await loadFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新文件夹失败');
    }
  };

  return (
    <div className="animate-page-enter pb-24">
      <header className="mb-4 rounded-[2rem] bg-[#242424] p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#cae393]">Study Mode</p>
            <h1 className="mt-1 text-2xl font-black">今天学一点，明天轻松一点。</h1>
            <p className="mt-2 text-xs leading-relaxed text-white/60">课程、任务与专注仍来自 SparkFlow 的同一份数据。</p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#cae393] text-[#242424]"><GraduationCap size={21} /></div>
        </div>
        <button type="button" onClick={onStartFocus} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#cae393] py-3 text-sm font-black text-[#242424] active:scale-[0.99]">
          开始专注 <ArrowRight size={15} />
        </button>
      </header>

      <nav aria-label="学习模式导航" className="mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-white p-1.5 shadow-sm">
        {sections.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold ${section === item.id ? 'bg-[#eaf4d6] text-[#242424]' : 'text-gray-400'}`}><Icon size={15} />{item.label}</button>;
        })}
      </nav>

      {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}

      {section === 'home' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[1.6rem] bg-white p-4 shadow-sm"><Clock3 size={17} className="text-[#8b7fbc]" /><p className="mt-3 text-2xl font-black text-[#242424]">{totalFocusMinutes}<span className="ml-1 text-xs text-gray-400">分钟</span></p><p className="text-[10px] text-gray-400">今日专注 · {todayCount} 次</p></div>
            <div className="rounded-[1.6rem] bg-[#e5e2f3] p-4 shadow-sm"><FolderOpen size={17} className="text-[#5a4f86]" /><p className="mt-3 text-2xl font-black text-[#242424]">{folders.filter((folder) => folder.status === 'active').length}</p><p className="text-[10px] text-gray-500">进行中的学习目标</p></div>
          </div>

          <section className="rounded-[2rem] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-black text-[#242424]">今日学习</h2><p className="text-[10px] text-gray-400">来自学业任务与课程安排</p></div><CheckSquare size={18} className="text-[#8b7fbc]" /></div>
            <div className="space-y-2">
              {todayTasks.length ? todayTasks.slice(0, 5).map((task) => <div key={task.id} className="flex items-center gap-3 rounded-2xl bg-[#f4f4f6] px-3 py-3"><span className="h-2.5 w-2.5 rounded-full bg-[#cae393]" /><span className="min-w-0 flex-1 truncate text-xs font-bold text-[#242424]">{task.title}</span><span className="text-[10px] text-gray-400">{task.estimatedMinutes || task.duration || 25} 分钟</span></div>) : <p className="rounded-2xl bg-[#f4f4f6] px-4 py-5 text-center text-xs text-gray-400">今天还没有学习任务，可从待办中设置“学业”分组。</p>}
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-black text-[#242424]">今日课程</h2><p className="text-[10px] text-gray-400">按课程星期规则聚合</p></div><CalendarDays size={18} className="text-[#8b7fbc]" /></div>
            <div className="space-y-2">
              {todayCourses.length ? todayCourses.map((course) => <div key={course.id} className="flex items-center gap-3 rounded-2xl px-3 py-3" style={{ backgroundColor: `${course.color}24` }}><span className="h-8 w-1 rounded-full" style={{ backgroundColor: course.color }} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#242424]">{course.name}</p><p className="text-[10px] text-gray-400">{course.startTime || '待定'}{course.room ? ` · ${course.room}` : ''}</p></div></div>) : <p className="rounded-2xl bg-[#f4f4f6] px-4 py-5 text-center text-xs text-gray-400">今天没有课程安排。</p>}
            </div>
          </section>
        </div>
      )}

      {section === 'folders' && (
        <section className="rounded-[2rem] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2"><div><h2 className="text-sm font-black text-[#242424]">学习文件夹</h2><button type="button" onClick={() => setShowArchived((value) => !value)} className="mt-1 text-[10px] font-bold text-[#8b7fbc]">{showArchived ? '查看进行中' : '查看已归档'}</button></div><button type="button" onClick={() => setEditingFolder(null)} className="flex items-center gap-1 rounded-full bg-[#242424] px-3 py-2 text-xs font-bold text-[#cae393]"><Plus size={14} />新建</button></div>
          {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div> : (
            <div className="space-y-3">
              {visibleFolders.map((folder) => <article key={folder.id} className="rounded-[1.5rem] border border-black/5 p-4" style={{ backgroundColor: `${folder.color}22` }}><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: folder.color }}><BookOpen size={18} /></div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black text-[#242424]">{folder.name}</h3><p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{folder.description || '还没有说明'}</p><p className="mt-2 text-[10px] font-bold text-gray-400">{folder.courses.length} 门课程 · {folder.tasks.length} 个任务</p></div></div><div className="mt-3 flex gap-2"><button type="button" onClick={() => setEditingFolder(folder)} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/80 py-2 text-[11px] font-bold text-gray-600"><Pencil size={12} />编辑</button><button type="button" onClick={() => { void toggleArchive(folder); }} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/80 py-2 text-[11px] font-bold text-gray-600">{folder.status === 'archived' ? <RotateCcw size={12} /> : <Archive size={12} />}{folder.status === 'archived' ? '恢复' : '归档'}</button></div></article>)}
              {!visibleFolders.length && <p className="rounded-2xl bg-[#f4f4f6] px-4 py-10 text-center text-xs text-gray-400">{showArchived ? '没有已归档文件夹' : '创建第一个学习目标，把课程和任务放在一起。'}</p>}
            </div>
          )}
        </section>
      )}

      {section === 'review' && <section className="rounded-[2rem] bg-white p-7 text-center shadow-sm"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e5e2f3]"><RefreshCw size={22} className="text-[#665b91]" /></div><h2 className="mt-4 text-base font-black text-[#242424]">复习闭环将在 M2 开启</h2><p className="mt-2 text-xs leading-relaxed text-gray-400">下一阶段会加入掌握程度、复习建议，以及确认后写入日程的 Preview → Apply → Undo 流程。</p></section>}

      {section === 'more' && <section className="rounded-[2rem] bg-white p-5 shadow-sm"><h2 className="text-sm font-black text-[#242424]">学习模式说明</h2><div className="mt-4 space-y-3 text-xs leading-relaxed text-gray-500"><p>关闭学习模式只会隐藏入口，不会删除文件夹、课程或任务。</p><p>课程、任务、日程和专注仍复用现有模块，避免出现两套完成状态。</p></div></section>}

      {editingFolder !== undefined && <FolderDialog folder={editingFolder} tasks={studyTasks} courses={courses} onClose={() => setEditingFolder(undefined)} onSave={saveFolder} />}
    </div>
  );
}
