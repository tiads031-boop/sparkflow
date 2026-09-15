import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  FileJson,
  LoaderCircle,
  Plus,
  Save,
  School,
  Trash2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import { SchoolImport } from '../api/courseNative';
import {
  fetchScheduleImport,
  importScheduleBackup,
  previewScheduleImport,
  type CourseImportDuplicatePolicy,
  type CourseImportPreview,
  type CourseImportRequest,
  type CourseImportResult,
  type CourseImportSource,
} from '../api/courses';
import { useAppStore } from '../store/appStore';
import { useCourseSchedule } from '../store/courseSchedule';
import type { ScheduleBackup } from '../utils/courseSchedule';
import {
  normalizeCourseTime,
  requiredSectionNumbers,
  schoolBackup,
  serializeTimeSlots,
  summarizeSchoolImport,
  type SchoolImportData,
} from '../utils/schoolImport';
import {
  generateCourseTimeSlots,
  loadCourseTimeTemplates,
  saveCourseTimeTemplates,
  type CourseTimeTemplate,
} from '../utils/courseTimeTemplates';

interface CourseImportWizardProps {
  open: boolean;
  onClose: () => void;
  onImported: (message: string) => void | Promise<void>;
}

interface Adapter {
  id: string;
  scriptId?: string;
  school: string;
  name: string;
  url: string;
  description: string;
}

interface TimeSlotRow {
  number: number;
  start: string;
  end: string;
}

const STEP_LABELS = ['选择学校', '获取课表', '学期与作息', '预览确认'];
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const createRequestId = () => globalThis.crypto?.randomUUID?.() || `import-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

function validHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function suggestedSemesterEnd(start: string | undefined, totalWeeks: number | undefined) {
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(totalWeeks) || totalWeeks! < 1 || totalWeeks! > 60) return '';
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + totalWeeks! * 7 - 1);
  return date.toISOString().slice(0, 10);
}

function importedRows(data: SchoolImportData): TimeSlotRow[] {
  const rows = new Map<number, TimeSlotRow>();
  for (const slot of data.timeSlots || []) {
    const number = Number(slot.number);
    if (!Number.isInteger(number) || number < 1 || number > 30 || rows.has(number)) continue;
    rows.set(number, {
      number,
      start: normalizeCourseTime(slot.startTime) || '',
      end: normalizeCourseTime(slot.endTime) || '',
    });
  }
  for (const number of requiredSectionNumbers(data)) {
    if (!rows.has(number)) rows.set(number, { number, start: '', end: '' });
  }
  return [...rows.values()].sort((a, b) => a.number - b.number);
}

export default function CourseImportWizard({ open, onClose, onImported }: CourseImportWizardProps) {
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<Adapter[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [search, setSearch] = useState('');
  const [adapterId, setAdapterId] = useState('');
  const [url, setUrl] = useState('');
  const [showAddressEditor, setShowAddressEditor] = useState(false);
  const [schoolData, setSchoolData] = useState<SchoolImportData | null>(null);
  const [bookmark, setBookmark] = useState('');
  const [semester, setSemester] = useState({ name: '', start: '', end: '' });
  const [semesterMode, setSemesterMode] = useState<'new' | 'existing'>('new');
  const [targetSemesterId, setTargetSemesterId] = useState('');
  const [slots, setSlots] = useState<TimeSlotRow[]>([]);
  const [templates, setTemplates] = useState<CourseTimeTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [generatedSlots, setGeneratedSlots] = useState<TimeSlotRow[] | null>(null);
  const [generator, setGenerator] = useState({
    firstStart: '08:00', lessonMinutes: '45', breakMinutes: '10', sectionCount: '10',
    longBreakAfter: '4', longBreakMinutes: '90',
  });
  const [generatorError, setGeneratorError] = useState('');
  const [preview, setPreview] = useState<ScheduleBackup | null>(null);
  const [serverPreview, setServerPreview] = useState<CourseImportPreview | null>(null);
  const [duplicatePolicy, setDuplicatePolicy] = useState<CourseImportDuplicatePolicy>('skip');
  const [requestId, setRequestId] = useState(createRequestId);
  const [importSource, setImportSource] = useState<CourseImportSource>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const generatorPanel = useRef<HTMLDivElement>(null);
  const android = Capacitor.getPlatform() === 'android';
  const semesters = useAppStore(state => state.semesters);
  const activeSemesterId = useAppStore(state => state.activeSemesterId);
  const hasLoadedSemesters = useAppStore(state => state.hasLoadedSemesters);
  const adapter = catalog.find(item => item.id === adapterId);
  const normalizedUrl = url.trim();
  const urlValid = validHttpUrl(normalizedUrl);
  const targetSemester = semesters.find(item => item.id === targetSemesterId);

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return catalog;
    return catalog.filter(item => `${item.school} ${item.name}`.toLocaleLowerCase().includes(query));
  }, [catalog, search]);

  const previewSummary = useMemo(() => {
    if (!preview || !schoolData) return null;
    return summarizeSchoolImport(schoolData, preview);
  }, [preview, schoolData]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => previouslyFocused?.focus();
  }, [open]);

  useEffect(() => {
    if (open && !hasLoadedSemesters) void useAppStore.getState().loadSemesters();
  }, [hasLoadedSemesters, open]);

  useEffect(() => {
    if (open && step > 0) title.current?.focus();
  }, [open, step]);

  useEffect(() => {
    let mounted = true;
    fetch('/school-adapters/catalog.json')
      .then(response => {
        if (!response.ok) throw new Error('学校目录加载失败');
        return response.json() as Promise<Adapter[]>;
      })
      .then(items => {
        if (!mounted) return;
        setCatalog(items);
        setCatalogError('');
        const initialAdapterId = items[0]?.id || '';
        setAdapterId(current => current || initialAdapterId);
        setUrl(current => current || items[0]?.url || '');
        setTemplates(loadCourseTimeTemplates(initialAdapterId));
      })
      .catch(error => {
        if (mounted) setCatalogError(error instanceof Error ? error.message : '学校目录加载失败');
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose, open]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const chooseAdapter = (item: Adapter) => {
    setAdapterId(item.id);
    setTemplates(loadCourseTimeTemplates(item.id));
    setSelectedTemplateId('');
    setTemplateName('');
    setGeneratedSlots(null);
    setUrl(item.url || '');
    setShowAddressEditor(!item.url);
    setSchoolData(null);
    setBookmark('');
    setPreview(null);
    setServerPreview(null);
    setSemesterMode('new');
    setTargetSemesterId('');
    setImportSource(undefined);
    setSemester(current => ({ ...current, name: `${item.school} · 新学期` }));
    setMessage('');
  };

  const receive = (data: SchoolImportData) => {
    if (!data || !Array.isArray(data.courses) || data.courses.length < 1 || data.courses.length > 500) {
      throw new Error('文件中没有有效教务排课，或排课超过 500 条');
    }
    setSchoolData(data);
    setSlots(importedRows(data));
    setGeneratedSlots(null);
    const start = data.config?.semesterStartDate;
    const end = suggestedSemesterEnd(start, data.config?.semesterTotalWeeks);
    setSemesterMode('new');
    setTargetSemesterId('');
    setSemester(current => ({
      ...current,
      name: current.name || `${adapter?.school || '教务系统'} · 新学期`,
      start: start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : current.start,
      end: end || current.end,
    }));
    setPreview(null);
    setServerPreview(null);
    setRequestId(createRequestId());
    setImportSource({
      system: adapter?.scriptId || adapter?.id || 'school-import',
      schoolId: adapter?.id || 'school-import',
      adapterId: adapter?.scriptId || adapter?.id || 'school-import',
      termId: data.config?.termId || data.config?.currentSemesterId,
      origin: urlValid ? new URL(normalizedUrl).origin : undefined,
      fetchedAt: new Date().toISOString(),
    });
    setMessage(`已读取到 ${data.courses.length} 条排课`);
  };

  const readFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) throw new Error('文件不能超过 8 MB');
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error('无法解析 JSON 文件，请选择教务导入工具生成的文件');
    }
    receive(parsed as SchoolImportData);
  };

  const generateBookmark = async () => {
    if (!adapter) throw new Error('请先选择学校');
    const scriptId = adapter.scriptId || adapter.id;
    const responses = await Promise.all([
      fetch('/school-adapters/bridge.js'),
      fetch(`/school-adapters/${scriptId}.js`),
    ]);
    if (responses.some(response => !response.ok)) throw new Error('适配脚本加载失败');
    const [bridge, script] = await Promise.all(responses.map(response => response.text()));
    const finish = "window.shiguangBridge.notifyTaskCompletion=()=>{const s=window.__sparkflowImport;if(!s.courses.length){alert('未读取到课程');return;}const u=URL.createObjectURL(new Blob([JSON.stringify(s)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='SparkFlow-教务课表.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);};";
    setBookmark(`javascript:${encodeURIComponent(`void(function(){${bridge}\n${finish}\n${script}\n})()`)}`);
    setMessage('导入工具已生成，请按说明安装为浏览器书签');
  };

  const updateSlot = (index: number, field: 'number' | 'start' | 'end', value: string) => {
    setSlots(current => current.map((row, rowIndex) => rowIndex === index
      ? { ...row, [field]: field === 'number' ? Number(value) : value }
      : row));
    setPreview(null);
    setServerPreview(null);
  };

  const addSlot = () => {
    const previous = slots.at(-1);
    setSlots(current => [...current, {
      number: Math.max(0, ...current.map(row => row.number)) + 1,
      start: previous?.end || '',
      end: '',
    }]);
    setPreview(null);
    setServerPreview(null);
  };

  const copyPreviousSlot = (index: number) => {
    if (index < 1) return;
    const previous = slots[index - 1];
    setSlots(current => current.map((row, rowIndex) => rowIndex === index
      ? { ...row, start: previous.start, end: previous.end }
      : row));
    setPreview(null);
    setServerPreview(null);
  };

  const replaceSlots = (next: readonly { number: number; startTime: string; endTime: string }[]) => {
    setSlots(next.map(slot => ({ number: slot.number, start: slot.startTime, end: slot.endTime })));
    setGeneratedSlots(null);
    setPreview(null);
    setServerPreview(null);
  };

  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name) throw new Error('请填写模板名称');
    const normalized = serializeTimeSlots(slots.map(row => ({ number: row.number, startTime: row.start, endTime: row.end })))
      .split('\n').map(line => {
        const [number, range] = line.split(' ');
        const [startTime, endTime] = range.split('-');
        return { number: Number(number), startTime, endTime };
      });
    if (!normalized.length) throw new Error('请先填写至少一个有效节次');
    const next = [...templates, { id: crypto.randomUUID(), name, slots: normalized }];
    saveCourseTimeTemplates(adapterId, next);
    setTemplates(next);
    setSelectedTemplateId(next.at(-1)?.id || '');
    setTemplateName('');
    setMessage(`已为 ${adapter?.school || '当前学校'} 保存模板“${name}”`);
  };

  const deleteTemplate = () => {
    const selected = templates.find(template => template.id === selectedTemplateId);
    if (!selected) throw new Error('请先选择要删除的模板');
    const next = templates.filter(template => template.id !== selected.id);
    saveCourseTimeTemplates(adapterId, next);
    setTemplates(next);
    setSelectedTemplateId('');
    setMessage(`已删除模板“${selected.name}”`);
  };

  const applyTemplate = () => {
    const selected = templates.find(template => template.id === selectedTemplateId);
    if (!selected) throw new Error('请先选择作息模板');
    replaceSlots(selected.slots);
    setMessage(`已将“${selected.name}”应用到节次表，请核对后再预览导入`);
  };

  const generateSlots = () => {
    setGeneratorError('');
    setGeneratedSlots(null);
    setMessage('');
    try {
      const next = generateCourseTimeSlots({
        firstStart: generator.firstStart,
        lessonMinutes: Number(generator.lessonMinutes),
        breakMinutes: Number(generator.breakMinutes),
        sectionCount: Number(generator.sectionCount),
        longBreakAfter: generator.longBreakAfter ? Number(generator.longBreakAfter) : undefined,
        longBreakMinutes: generator.longBreakAfter ? Number(generator.longBreakMinutes) : undefined,
      }).map(slot => ({ number: slot.number, start: slot.startTime, end: slot.endTime }));
      setGeneratedSlots(next);
      setMessage('已生成作息预览；确认无误后点击“应用到节次表”');
    } catch (error) {
      setGeneratorError(error instanceof Error ? error.message : String(error));
      requestAnimationFrame(() => {
        const firstInput = generatorPanel.current?.querySelector<HTMLInputElement>('input');
        const invalidInput = generatorPanel.current?.querySelector<HTMLInputElement>('input:invalid');
        (invalidInput || firstInput)?.focus();
      });
    }
  };

  const updateGenerator = (field: keyof typeof generator, value: string) => {
    setGenerator(current => ({ ...current, [field]: value }));
    setGeneratorError('');
  };

  const selectExistingSemester = (id: string) => {
    setTargetSemesterId(id);
    const selected = semesters.find(item => item.id === id);
    if (selected) setSemester({
      name: selected.name,
      start: selected.startDate.slice(0, 10),
      end: selected.endDate.slice(0, 10),
    });
    setPreview(null);
    setServerPreview(null);
  };

  const selectSemesterMode = (mode: 'new' | 'existing') => {
    setSemesterMode(mode);
    setPreview(null);
    setServerPreview(null);
    if (mode === 'existing') selectExistingSemester(targetSemesterId || activeSemesterId || semesters[0]?.id || '');
    else {
      const start = schoolData?.config?.semesterStartDate || '';
      setSemester({
        name: `${adapter?.school || '教务系统'} · 新学期`,
        start,
        end: suggestedSemesterEnd(start, schoolData?.config?.semesterTotalWeeks),
      });
    }
  };

  const importRequest = (backup: ScheduleBackup): CourseImportRequest => ({
    format: 'sparkflow-course-import',
    version: 2,
    requestId,
    targetSemesterId: semesterMode === 'existing' ? targetSemesterId : undefined,
    duplicatePolicy,
    source: importSource,
    backup,
  });

  const buildPreview = async () => {
    if (!schoolData) throw new Error('请先读取教务课表');
    if (semesterMode === 'existing' && !targetSemester) throw new Error('请选择要导入的已有学期');
    const nextPreview = schoolBackup(
      schoolData,
      semester.name,
      semester.start,
      semester.end,
      serializeTimeSlots(slots.map(row => ({
        number: row.number,
        startTime: row.start,
        endTime: row.end,
      }))),
    );
    setPreview(nextPreview);
    setStep(3);
    try {
      setServerPreview(await previewScheduleImport(importRequest(nextPreview)));
    } catch {
      setServerPreview(null);
      throw new Error('本地预览已生成，但重复与冲突检查失败；请检查网络后返回重试');
    }
  };

  const resetCompletedImport = () => {
    setStep(0);
    setSchoolData(null);
    setBookmark('');
    setSemester({ name: adapter ? `${adapter.school} · 新学期` : '', start: '', end: '' });
    setSlots([]);
    setGeneratedSlots(null);
    setPreview(null);
    setServerPreview(null);
    setSemesterMode('new');
    setTargetSemesterId('');
    setDuplicatePolicy('skip');
    setRequestId(createRequestId());
    setImportSource(undefined);
    setMessage('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const confirmImport = async () => {
    if (!preview) throw new Error('请先生成导入预览');
    let result: CourseImportResult;
    try {
      result = await importScheduleBackup(importRequest(preview));
    } catch (error) {
      try {
        const recovered = await fetchScheduleImport(requestId);
        if (recovered.status !== 'applied' || !recovered.result) throw error;
        result = { ...recovered.result, replayed: true };
      } catch {
        throw error;
      }
    }
    await useAppStore.getState().loadSemesters();
    if (result.targetSemesterId) useAppStore.getState().setActiveSemester(result.targetSemesterId);
    const refreshResults = await Promise.allSettled([
      useAppStore.getState().loadCourses(),
      useCourseSchedule.getState().refresh(),
    ]);
    const refreshFailed = refreshResults.some(refreshResult => refreshResult.status === 'rejected');
    const skipped = result.skippedCount ? `，跳过 ${result.skippedCount} 条重复排课` : '';
    const replayed = result.replayed ? '（已恢复上次导入结果）' : '';
    const success = `已导入 ${result.courseCount} 条排课，生成 ${result.eventCount} 次上课${skipped}${replayed}${refreshFailed ? '；课表刷新失败，请稍后手动刷新' : ''}`;
    resetCompletedImport();
    onClose();
    await onImported(success);
  };

  const next = () => {
    if (step === 0) {
      if (!adapter) return setMessage('请选择学校');
      if (!urlValid) return setMessage('请填写有效的 HTTP/HTTPS 教务网址');
      setStep(1);
      setMessage('');
    } else if (step === 1) {
      if (!schoolData) return setMessage('请先获取或上传教务课表');
      setStep(2);
      setMessage('');
    } else if (step === 2) {
      void run(async () => buildPreview());
    } else {
      void run(confirmImport);
    }
  };

  if (!open) return null;

  return createPortal(<div className="course-import-overlay" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section className="course-import-sheet" role="dialog" aria-modal="true" aria-labelledby="course-import-title">
      <header className="course-import-header">
        <div>
          <p>教务课表导入</p>
          <h2 ref={title} tabIndex={-1} id="course-import-title">{STEP_LABELS[step] || STEP_LABELS[0]}</h2>
        </div>
        <button type="button" aria-label="关闭教务导入" disabled={busy} onClick={onClose}><X /></button>
      </header>

      <nav className="course-import-steps" aria-label="导入进度">
        {STEP_LABELS.map((label, index) => <div key={label} aria-current={index === step ? 'step' : undefined}>
          <span>{index < step ? <Check aria-hidden="true" /> : index + 1}</span>
          <small>{label}</small>
        </div>)}
      </nav>

      <div className="course-import-body">
        {step === 0 && <>
          <label>搜索学校
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="学校名称或教务系统" autoFocus />
          </label>
          {catalogError && <p role="status">{catalogError}</p>}
          <div className="course-import-grid" aria-label="学校列表">
            {filteredCatalog.map(item => <button
              type="button"
              className="course-import-card"
              aria-pressed={item.id === adapterId}
              key={item.id}
              onClick={() => chooseAdapter(item)}
            >
              <School aria-hidden="true" />
              <strong>{item.school}</strong>
              <span>{item.name}</span>
              <small>已提供适配 · 实际兼容性以学校页面为准</small>
            </button>)}
          </div>
          {!catalogError && filteredCatalog.length === 0 && <p role="status">没有找到匹配的学校</p>}
          {adapter && <div className="course-import-card">
            <strong>{adapter.name}</strong>
            {adapter.description && <p>{adapter.description}</p>}
            {urlValid && <a href={normalizedUrl} target="_blank" rel="noreferrer">打开教务网站 <ExternalLink aria-hidden="true" /></a>}
            <button type="button" onClick={() => setShowAddressEditor(value => !value)}>地址不正确？</button>
            {(showAddressEditor || !adapter.url) && <label>教务网址
              <input type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://jw.example.edu.cn" />
            </label>}
            {!urlValid && <p role="status">{url ? '请输入有效的 HTTP/HTTPS 地址' : '该学校暂未提供入口，请填写教务网址'}</p>}
            {urlValid && normalizedUrl.startsWith('http:') && <p role="status">此入口使用 HTTP，请只在可信的校园网络中登录。</p>}
          </div>}
        </>}

        {step === 1 && <>
          <div className="course-import-card">
            <strong>{android ? '在 Android 应用内获取' : '从浏览器获取课表'}</strong>
            {urlValid && <a href={normalizedUrl} target="_blank" rel="noreferrer">打开 {adapter?.school || '教务网站'} <ExternalLink aria-hidden="true" /></a>}
            {android ? <>
              <p>应用会打开教务页面。请登录、进入个人课表并选择学期，再执行解析。</p>
              <button type="button" disabled={busy || !adapter || !urlValid} onClick={() => void run(async () => {
                setMessage('正在打开教务页面，请完成登录并进入个人课表…');
                receive(await SchoolImport.open({ adapter: adapter!.scriptId || adapter!.id, url: normalizedUrl }));
              })}>打开教务并读取</button>
            </> : <>
              <p>在新标签页登录并打开个人课表。安装下方书签工具后，在课表页点击书签下载 JSON，再回到这里上传。</p>
              <button type="button" disabled={busy || !adapter} onClick={() => void run(generateBookmark)}>生成浏览器导入工具</button>
              {bookmark && <div>
                <label>书签网址代码
                  <textarea rows={3} readOnly value={bookmark} />
                </label>
                <button type="button" disabled={busy} onClick={() => void run(async () => {
                  await navigator.clipboard.writeText(bookmark);
                  setMessage('书签代码已复制');
                })}><Copy aria-hidden="true" /> 复制书签代码</button>
              </div>}
            </>}
          </div>
          <div className="course-import-card" onDragOver={event => event.preventDefault()} onDrop={event => {
            event.preventDefault();
            const selected = event.dataTransfer.files[0];
            if (selected && !busy) void run(() => readFile(selected));
          }}>
            <FileJson aria-hidden="true" />
            <strong>上传教务结果 JSON</strong>
            <p>所有平台均可使用。也可以把电脑导出的文件传到手机后上传。</p>
            <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}><Upload aria-hidden="true" /> 选择 JSON 文件</button>
          </div>
          <input ref={fileInput} type="file" hidden accept=".json,application/json" onChange={event => {
            const selected = event.target.files?.[0];
            event.target.value = '';
            if (selected) void run(() => readFile(selected));
          }} />
          {schoolData && <div className="course-import-card"><Check aria-hidden="true" /><strong>已读取到 {schoolData.courses.length} 条排课</strong><p>{schoolData.courses.slice(0, 5).map(course => course.name).join('、')}</p></div>}
        </>}

        {step === 2 && <>
          <div className="course-import-card">
            <strong>导入到哪个学期</strong>
            <div className="course-import-choice-row">
              <label><input type="radio" name="semester-mode" checked={semesterMode === 'new'} onChange={() => selectSemesterMode('new')} /> 创建新学期</label>
              <label><input type="radio" name="semester-mode" checked={semesterMode === 'existing'} disabled={!semesters.length} onChange={() => selectSemesterMode('existing')} /> 使用已有学期</label>
            </div>
            {semesterMode === 'existing' ? <>
              <label>目标学期
                <select required value={targetSemesterId} onChange={event => selectExistingSemester(event.target.value)}>
                  <option value="">请选择学期</option>
                  {semesters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              {targetSemester && <p>{targetSemester.startDate.slice(0, 10)} 至 {targetSemester.endDate.slice(0, 10)}；已有课程会参与重复与冲突检查。</p>}
            </> : <>
              <label>学期名称<input required value={semester.name} onChange={event => { setSemester(current => ({ ...current, name: event.target.value })); setPreview(null); setServerPreview(null); }} /></label>
              <div className="course-import-grid">
                <label>学期开始<input required type="date" value={semester.start} onChange={event => { setSemester(current => ({ ...current, start: event.target.value })); setPreview(null); setServerPreview(null); }} /></label>
                <label>学期结束<input required type="date" value={semester.end} onChange={event => { setSemester(current => ({ ...current, end: event.target.value })); setPreview(null); setServerPreview(null); }} /></label>
              </div>
            </>}
            <p>第一周从开学日期所在周的周一计算；所有时间均按北京时间排课。</p>
          </div>
          <div className="course-import-card">
            <strong>节次作息</strong>
            <p>教务文件内的作息已优先载入。模板仅显示当前学校保存的内容，并且需要手动应用。</p>
            <div className="course-time-template-controls">
              <label>当前学校模板
                <select value={selectedTemplateId} onChange={event => setSelectedTemplateId(event.target.value)}>
                  <option value="">{templates.length ? '选择模板' : '尚无已保存模板'}</option>
                  {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </label>
              <div className="course-time-actions">
                <button type="button" disabled={busy || !selectedTemplateId} onClick={() => void run(async () => applyTemplate())}>应用模板</button>
                <button type="button" disabled={busy || !selectedTemplateId} onClick={() => void run(async () => deleteTemplate())}><Trash2 aria-hidden="true" /> 删除</button>
              </div>
              <label>保存当前节次为新模板
                <input value={templateName} maxLength={40} onChange={event => setTemplateName(event.target.value)} placeholder="例如：冬季作息" />
              </label>
              <button type="button" disabled={busy || !templateName.trim() || !slots.length} onClick={() => void run(async () => saveTemplate())}><Save aria-hidden="true" /> 保存模板</button>
            </div>

            <div className="course-time-generator" ref={generatorPanel}>
              <strong>批量生成作息</strong>
              <div className="course-import-grid">
                <label>首节开始<input required type="time" value={generator.firstStart} aria-describedby={generatorError ? 'course-time-generator-error' : undefined} onChange={event => updateGenerator('firstStart', event.target.value)} /></label>
                <label>每节时长（分钟）<input required type="number" min="1" max="240" value={generator.lessonMinutes} aria-describedby={generatorError ? 'course-time-generator-error' : undefined} onChange={event => updateGenerator('lessonMinutes', event.target.value)} /></label>
                <label>普通课间（分钟）<input required type="number" min="0" max="240" value={generator.breakMinutes} aria-describedby={generatorError ? 'course-time-generator-error' : undefined} onChange={event => updateGenerator('breakMinutes', event.target.value)} /></label>
                <label>节数<input required type="number" min="1" max="30" value={generator.sectionCount} aria-describedby={generatorError ? 'course-time-generator-error' : undefined} onChange={event => updateGenerator('sectionCount', event.target.value)} /></label>
                <label>大课间在第几节后<input type="number" min="1" max="29" value={generator.longBreakAfter} aria-describedby={generatorError ? 'course-time-generator-error' : undefined} onChange={event => updateGenerator('longBreakAfter', event.target.value)} placeholder="留空则不设置" /></label>
                <label>大课间时长（分钟）<input required={Boolean(generator.longBreakAfter)} type="number" min="0" max="720" value={generator.longBreakMinutes} disabled={!generator.longBreakAfter} aria-describedby={generatorError ? 'course-time-generator-error' : undefined} onChange={event => updateGenerator('longBreakMinutes', event.target.value)} /></label>
              </div>
              <button type="button" disabled={busy} onClick={generateSlots}><WandSparkles aria-hidden="true" /> 生成预览</button>
              {generatorError && <p id="course-time-generator-error" role="alert">{generatorError}</p>}
              {generatedSlots && <div className="course-time-generated-preview" role="region" aria-label="批量生成作息预览">
                <p>{generatedSlots.map(slot => `${slot.number} ${slot.start}–${slot.end}`).join('　')}</p>
                <button type="button" disabled={busy} onClick={() => {
                  replaceSlots(generatedSlots.map(slot => ({ number: slot.number, startTime: slot.start, endTime: slot.end })));
                  setGeneratedSlots(null);
                  setMessage('已应用生成结果，请继续逐行核对或调整');
                }}>应用到节次表</button>
              </div>}
            </div>
            <div className="course-import-grid" role="table" aria-label="节次作息表">
              {slots.map((row, index) => <div key={`${index}-${row.number}`} role="row">
                <label>节次<input aria-label={`第 ${index + 1} 行节次`} type="number" min="1" max="30" value={row.number || ''} onChange={event => updateSlot(index, 'number', event.target.value)} /></label>
                <label>开始<input aria-label={`第 ${row.number} 节开始时间`} type="time" value={row.start} onChange={event => updateSlot(index, 'start', event.target.value)} /></label>
                <label>结束<input aria-label={`第 ${row.number} 节结束时间`} type="time" value={row.end} onChange={event => updateSlot(index, 'end', event.target.value)} /></label>
                <button type="button" aria-label={`复制上一节时间到第 ${row.number} 节`} disabled={busy || index === 0} onClick={() => copyPreviousSlot(index)}><Copy /></button>
                <button type="button" aria-label={`删除第 ${row.number} 节`} disabled={busy} onClick={() => { setSlots(current => current.filter((_, rowIndex) => rowIndex !== index)); setPreview(null); }}><Trash2 /></button>
              </div>)}
            </div>
            <button type="button" disabled={busy} onClick={addSlot}><Plus aria-hidden="true" /> 添加节次</button>
            {!slots.length && <p role="status">导入结果没有作息时间，请添加课程实际使用的节次。</p>}
          </div>
        </>}

        {step === 3 && preview && previewSummary && <>
          <div className="course-import-card">
            <strong>{semesterMode === 'existing' ? targetSemester?.name : preview.semesters[0]?.name}</strong>
            <p>{semester.start} 至 {semester.end}</p>
            <div className="course-import-grid">
              <span><strong>{previewSummary.uniqueCourseCount}</strong><small>门独立课程</small></span>
              <span><strong>{previewSummary.scheduleEntryCount}</strong><small>条排课</small></span>
              <span><strong>{previewSummary.generatedEventCount}</strong><small>次上课实例</small></span>
            </div>
            {previewSummary.excludedEventCount > 0 && <p>另有 {previewSummary.excludedEventCount} 次上课超出学期日期范围，未纳入导入。</p>}
            {serverPreview ? <>
              <div className="course-import-grid">
                <span><strong>{serverPreview.summary.newCount}</strong><small>条可新增</small></span>
                <span><strong>{serverPreview.summary.duplicateCount}</strong><small>条重复</small></span>
                <span><strong>{serverPreview.summary.conflictCount}</strong><small>条有冲突</small></span>
              </div>
              <p>冲突只会提示，不会自动删除或覆盖现有课程。</p>
            </> : <p>尚未完成服务端重复与冲突检查，提交时仍会再次校验。</p>}
            <div className="course-import-choice-row">
              <label><input type="radio" name="duplicate-policy" checked={duplicatePolicy === 'skip'} onChange={() => setDuplicatePolicy('skip')} /> 跳过重复（推荐）</label>
              <label><input type="radio" name="duplicate-policy" checked={duplicatePolicy === 'keep'} onChange={() => setDuplicatePolicy('keep')} /> 保留副本</label>
            </div>
            <p>{semesterMode === 'existing' ? `将导入到已有学期“${targetSemester?.name || semester.name}”。` : '本次导入会创建一个新学期。'}</p>
          </div>
          <div className="course-import-grid">
            {preview.courses.slice(0, 6).map((course, index) => <article className="course-import-card" key={`${course.id}-${index}`}>
              <strong>{course.name}</strong>
              <p>{course.teacher || '教师未填写'} · {course.room || course.location || '地点未填写'}</p>
              <p>周{course.dayOfWeek} · {course.startTime}–{course.endTime}</p>
              <small>{course.weeks?.length ? `${course.weeks.join('、')} 周` : '周次未填写'} · 共 {course.events.length} 次</small>
            </article>)}
          </div>
          {preview.courses.length > 6 && <p>另有 {preview.courses.length - 6} 条课程排课将在导入后显示。</p>}
        </>}

        {message && <p role="status">{message}</p>}
      </div>

      <footer className="course-import-footer">
        <button type="button" disabled={busy || step === 0} onClick={() => { setStep(current => Math.max(0, current - 1)); setMessage(''); }}><ArrowLeft aria-hidden="true" /> 返回修改</button>
        <button type="button" disabled={busy || (step === 1 && !schoolData) || (step === 3 && !preview)} onClick={next}>
          {busy ? <LoaderCircle aria-hidden="true" /> : step === 3 ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          {busy ? '处理中…' : step === 2 ? '查看导入预览' : step === 3 ? '确认导入' : '下一步'}
        </button>
      </footer>
    </section>
  </div>, document.body);
}
