import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileAudio,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  ChevronLeft, ChevronRight, Check, Tag,
  Square,
  Video,
  X,
} from 'lucide-react';
import {
  createMultimodalInspiration,
  type InspirationRecord,
} from '../../api/inspirations';
import { useModalLifecycle } from '../ui/useModalLifecycle';
import { useAppStore } from '../../store/appStore';
import { deleteCaptureDraft, readCaptureDraft, writeCaptureDraft } from '../../utils/captureDraft';
import TagSelector from '../tags/TagSelector';
import './records.css';

const MAX_FILES = 6;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_RECORDING_MS = 120_000;

function preferredAudioMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/webm',
  ]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function audioExtension(type: string) {
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('ogg')) return 'ogg';
  return 'webm';
}

function fileKind(file: File) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'audio';
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImagePreview({ file }: { file: File }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt={file.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />;
}

export default function InspirationCaptureSheet({
  open,
  onClose,
  onSaved,
  focusSessionId,
  allowMedia = true,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (record: InspirationRecord) => void | Promise<void>;
  focusSessionId?: string;
  allowMedia?: boolean;
}) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [mediaOpen, setMediaOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  const currentUserId = useAppStore((state) => state.currentUserId);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingStopTimerRef = useRef<number | null>(null);
  const captureRequestIdRef = useRef<string>(crypto.randomUUID());

  const totalBytes = useMemo(
    () => files.reduce((total, file) => total + file.size, 0),
    [files],
  );

  useEffect(() => {
    if (!open || !draftReady || !currentUserId || focusSessionId) return;
    const timer = window.setTimeout(() => {
      if (!title.trim() && !text.trim() && files.length === 0) {
        void deleteCaptureDraft(currentUserId);
        return;
      }
      void writeCaptureDraft({
        userId: currentUserId,
        text,
        title,
        tags,
        files,
        requestId: captureRequestIdRef.current,
        updatedAt: new Date().toISOString(),
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [open, draftReady, currentUserId, focusSessionId, text, title, tags, files]);

  const microphoneSupported = typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia);

  const requestClose = () => {
    if (!saving && !recording) onClose();
  };
  useModalLifecycle(open, requestClose, { isolateAppMain: true });
  useModalLifecycle(mediaOpen, () => setMediaOpen(false));
  useModalLifecycle(tagOpen, () => setTagOpen(false));

  const releaseRecordingResources = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    if (recordingStopTimerRef.current !== null) {
      window.clearTimeout(recordingStopTimerRef.current);
      recordingStopTimerRef.current = null;
    }
  }, []);

  const cleanupRecording = () => {
    releaseRecordingResources();
    setRecording(false);
    setRecordingSeconds(0);
  };

  useEffect(() => {
    let cancelled = false;
    const resetTimer = window.setTimeout(() => {
      if (!open) {
        try {
          if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
        } catch {
          // Ignore recorder shutdown during close.
        }
        releaseRecordingResources();
        setRecording(false);
        setRecordingSeconds(0);
        setSaving(false);
        setTitle('');
        setMediaOpen(false);
        setTagOpen(false);
        setError(null);
        setDraftReady(false);
        return;
      }

      setDraftReady(false);
      setTags([]);
      void (async () => {
        if (currentUserId && !focusSessionId) {
          const draft = await readCaptureDraft(currentUserId);
          if (cancelled) return;
          if (draft) {
            setText(draft.text);
            setTitle(draft.title || '');
            setTags(draft.tags || []);
            setFiles(draft.files || []);
            captureRequestIdRef.current = draft.requestId || crypto.randomUUID();
          } else {
            setText('');
            setTitle('');
            setFiles([]);
            setTags([]);
            captureRequestIdRef.current = crypto.randomUUID();
          }
        } else {
          setText('');
          setFiles([]);
          setTags([]);
          captureRequestIdRef.current = crypto.randomUUID();
        }
        setDraftReady(true);

      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(resetTimer);
    };
  }, [open, currentUserId, focusSessionId, releaseRecordingResources]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      setRecordingSeconds(
        Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)),
      );
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    try {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    } catch {
      // Ignore recorder shutdown on unmount.
    }
    releaseRecordingResources();
  }, [releaseRecordingResources]);

  const addFiles = (incoming: File[]) => {
    setError(null);
    const supported = incoming.filter((file) => (
      file.type.startsWith('image/')
      || file.type.startsWith('audio/')
      || file.type.startsWith('video/')
    ));
    if (supported.length !== incoming.length) {
      setError('仅支持图片、音频和视频附件。');
      return;
    }
    if (supported.some((file) => file.size > MAX_FILE_BYTES)) {
      setError('单个附件不能超过 25MB。');
      return;
    }

    const next = [...files, ...supported];
    if (next.length > MAX_FILES) {
      setError(`单条记录最多添加 ${MAX_FILES} 个附件。`);
      return;
    }
    if (next.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
      setError('单条记录附件总大小不能超过 50MB。');
      return;
    }
    setFiles(next);
  };

  const startRecording = async () => {
    if (!microphoneSupported || recording || files.length >= MAX_FILES) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const mimeType = preferredAudioMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        cleanupRecording();
        if (!blob.size) {
          setError('这段录音没有录到内容，请重试。');
          return;
        }
        const file = new File(
          [blob],
          `voice-${new Date().toISOString().replace(/[:.]/g, '-') }.${audioExtension(type)}`,
          { type },
        );
        addFiles([file]);
      }, { once: true });

      recorder.start(500);
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setRecording(true);
      recordingStopTimerRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, MAX_RECORDING_MS);
    } catch (err) {
      cleanupRecording();
      const denied = err instanceof DOMException
        && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setError(
        denied
          ? '没有麦克风权限。你仍可以添加文字、图片或视频。'
          : '无法开始录音，请检查麦克风。',
      );
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
  };

  const save = async () => {
    if (saving || (!title.trim() && !text.trim() && (!allowMedia || files.length === 0))) return;
    setSaving(true);
    setError(null);
    try {
      const record = await createMultimodalInspiration(text, allowMedia ? files : [], tags, {
        requestId: captureRequestIdRef.current,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        focusSessionId,
        title,
      });
      window.dispatchEvent(new CustomEvent('sparkflow:records-changed'));
      await onSaved?.(record);
      if (currentUserId && !focusSessionId) await deleteCaptureDraft(currentUserId);
      setText('');
      setTitle('');
      setFiles([]);
      setTags([]);
      captureRequestIdRef.current = crypto.randomUUID();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const chooseFile = (accept: string) => {
    setMediaOpen(false);
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
  };
  const insertChecklist = () => {
    const area = textareaRef.current;
    if (!area) return;
    const start = area.selectionStart;
    const line = text.lastIndexOf('\n', start - 1) + 1;
    const prefix = text.slice(line, line + 2);
    const remove = prefix === '◯ ' || prefix === '☐ ';
    setText((value) => value.slice(0, line) + (remove ? '' : '◯ ') + value.slice(line + (remove ? 2 : 0)));
    window.requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(Math.max(line, start + (remove ? -2 : 2)), Math.max(line, start + (remove ? -2 : 2)));
    });
  };
  const handleChecklistEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    const area = event.currentTarget;
    const start = area.selectionStart;
    const line = text.lastIndexOf('\n', start - 1) + 1;
    const before = text.slice(line, start);
    if (!before.startsWith('◯ ')) return;
    event.preventDefault();
    if (before.trim() === '◯') {
      setText((value) => value.slice(0, line) + value.slice(start));
      window.requestAnimationFrame(() => area.setSelectionRange(line, line));
    } else {
      setText((value) => value.slice(0, start) + '\n◯ ' + value.slice(area.selectionEnd));
      window.requestAnimationFrame(() => area.setSelectionRange(start + 3, start + 3));
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="sf-note-backdrop" role="presentation" onClick={requestClose}>
      <section role="dialog" aria-modal="true" aria-label={focusSessionId ? '专注记录' : '随手记'}
        className="sf-note-editor" onClick={(event) => event.stopPropagation()}>
        <header className="sf-note-header">
          <button type="button" className="sf-note-back" onClick={requestClose} disabled={saving || recording} aria-label="返回记录"><ChevronLeft size={25} /></button>
          <div><span>SPARKFLOW · 记录</span><button type="button" className="sf-note-done" onClick={() => void save()} disabled={!draftReady || saving || recording || (!title.trim() && !text.trim() && (!allowMedia || files.length === 0))}>{saving ? '保存中…' : '完成'}</button></div>
        </header>
        <div className="sf-note-paper">
          <p className="sf-note-kicker"><span /> {focusSessionId ? '专注记录' : '随手记'} · {new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="写下标题" className="sf-note-title-input" aria-label="记录标题" maxLength={200} />
          <p className="sf-note-subtitle">{focusSessionId ? '这次专注里，有什么值得留下？' : '写下此刻的想法，稍后再来回看'}</p>
          <div className="sf-note-rule" />
          <textarea ref={textareaRef} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={handleChecklistEnter}
            placeholder="从这里开始记录……" className="sf-note-body-input" aria-label="记录正文" />
          {tags.length > 0 && <div className="sf-note-tags">{tags.map((tag) => <button key={tag} type="button" onClick={() => setTagOpen(true)}>#{tag}</button>)}</div>}
          {allowMedia && files.length > 0 && <div className="sf-note-uploads">
            {files.map((file, index) => {
              const kind = fileKind(file);
              const Icon = kind === 'image' ? ImageIcon : kind === 'video' ? Video : FileAudio;
              return <div key={`${file.name}-${file.lastModified}-${index}`} className="sf-note-upload">
                {kind === 'image' ? <ImagePreview file={file} /> : <span className="sf-note-upload-icon"><Icon size={18} /></span>}
                <span><strong>{kind === 'image' ? '照片' : kind === 'video' ? '视频' : '音频'}</strong><small>{file.name} · {formatBytes(file.size)}</small></span>
                <button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={saving || recording} aria-label={`移除 ${file.name}`}><X size={15} /></button>
              </div>;
            })}
            <small>{files.length}/{MAX_FILES} 个附件 · {formatBytes(totalBytes)}</small>
          </div>}
          {error && <p className="sf-note-error" role="alert">{error}</p>}
        </div>
        {allowMedia && <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />}
        <footer className="sf-note-footer">
          <div role="toolbar" aria-label="记录工具" className="sf-note-tools">
            <button type="button" onClick={insertChecklist} aria-label="插入圆形清单" title="清单"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="5.5" cy="6" r="2.7" fill="#d9efa9"/><path d="m4.5 6 .8.8 1.3-1.5M11 6h9"/><circle cx="5.5" cy="18" r="2.7"/><path d="M11 18h9"/></svg></button>
            {allowMedia && <button type="button" onClick={() => setMediaOpen(true)} disabled={saving || files.length >= MAX_FILES} aria-label="添加图片、视频或音频" title="添加附件"><Paperclip size={22} strokeWidth={1.8} /></button>}
            <button type="button" onClick={() => setTagOpen(true)} aria-label="选择或创建标签" title="标签"><Tag size={21} strokeWidth={1.8} /></button>
          </div>
          <button type="button" className="sf-note-save" onClick={() => void save()} disabled={!draftReady || saving || recording || (!title.trim() && !text.trim() && (!allowMedia || files.length === 0))} aria-label="保存记录">
            {saving ? <Loader2 size={21} className="animate-spin" /> : <Check size={23} />}
          </button>
        </footer>
        {mediaOpen && <div className="sf-note-overlay" role="presentation"><button type="button" className="sf-note-overlay-dim" onClick={() => setMediaOpen(false)} aria-label="关闭附件选择" /><div role="dialog" aria-modal="true" aria-label="添加内容" className="sf-note-pick-sheet">
          <div className="sf-note-handle" /><header><div><strong>添加内容</strong><small>为这条记录留下一点细节</small></div><button type="button" onClick={() => setMediaOpen(false)} aria-label="关闭附件选择"><X size={16} /></button></header>
          <div className="sf-note-pick-options">
            <button type="button" onClick={() => chooseFile('image/*')}><span className="sf-pick-icon sf-pick-photo"><ImageIcon size={20} /></span><span><strong>照片</strong><small>让这一刻看得见</small></span><ChevronRight size={17} /></button>
            <button type="button" onClick={() => chooseFile('video/*')}><span className="sf-pick-icon sf-pick-video"><Video size={20} /></span><span><strong>视频</strong><small>记录正在发生的画面</small></span><ChevronRight size={17} /></button>
            <button type="button" onClick={() => chooseFile('audio/*')}><span className="sf-pick-icon sf-pick-audio"><FileAudio size={20} /></span><span><strong>音频</strong><small>上传已有录音</small></span><ChevronRight size={17} /></button>
            {microphoneSupported && <button type="button" onClick={() => { setMediaOpen(false); void startRecording(); }}><span className="sf-pick-icon sf-pick-audio"><Mic size={20} /></span><span><strong>直接录音</strong><small>用声音记下此刻</small></span><ChevronRight size={17} /></button>}
          </div>
        </div></div>}
        {tagOpen && <div className="sf-note-overlay" role="presentation"><button type="button" className="sf-note-overlay-dim" onClick={() => setTagOpen(false)} aria-label="关闭标签选择" /><div role="dialog" aria-modal="true" aria-label="选择或创建标签" className="sf-note-pick-sheet sf-note-tag-sheet"><div className="sf-note-handle" /><header><div><strong>选择标签</strong><small>为记录整理一个线索</small></div><button type="button" onClick={() => setTagOpen(false)} aria-label="返回记录"><X size={16} /></button></header><div className="sf-note-tag-content"><TagSelector value={tags} onChange={setTags} compact /></div><button type="button" className="sf-note-tag-done" onClick={() => setTagOpen(false)}>完成 · 已选 {tags.length}</button></div></div>}
        {recording && <div className="sf-note-recording"><span className="sf-recording-dot" /> 正在录音 {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')} <button type="button" onClick={stopRecording}><Square size={12} fill="currentColor" /> 结束录音</button></div>}
      </section>
    </div>, document.body,
  );
}
