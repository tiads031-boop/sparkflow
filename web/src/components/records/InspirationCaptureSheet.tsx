import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileAudio,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  Square,
  Trash2,
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
      if (!text.trim() && files.length === 0) {
        void deleteCaptureDraft(currentUserId);
        return;
      }
      void writeCaptureDraft({
        userId: currentUserId,
        text,
        files,
        requestId: captureRequestIdRef.current,
        updatedAt: new Date().toISOString(),
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [open, draftReady, currentUserId, focusSessionId, text, files]);

  const microphoneSupported = typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia);

  const requestClose = () => {
    if (!saving && !recording) onClose();
  };
  useModalLifecycle(open, requestClose, { isolateAppMain: true });

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
            setFiles(draft.files || []);
            captureRequestIdRef.current = draft.requestId || crypto.randomUUID();
          } else {
            setText('');
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
        window.setTimeout(() => textareaRef.current?.focus(), 30);
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
    if (saving || (!text.trim() && (!allowMedia || files.length === 0))) return;
    setSaving(true);
    setError(null);
    try {
      const record = await createMultimodalInspiration(text, allowMedia ? files : [], tags, {
        requestId: captureRequestIdRef.current,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        focusSessionId,
      });
      window.dispatchEvent(new CustomEvent('sparkflow:records-changed'));
      await onSaved?.(record);
      if (currentUserId && !focusSessionId) await deleteCaptureDraft(currentUserId);
      setText('');
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

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[115] flex items-end justify-center bg-black/30"
      role="presentation"
      onClick={requestClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={focusSessionId ? '专注记录' : '多模态随手记'}
        className="flex max-h-[min(92dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] bg-[var(--sf-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--sf-border)]" aria-hidden="true" />
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-4 pt-3">
          <div>
            <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--sf-accent)]">
              {focusSessionId ? 'Focus note' : 'Capture'}
            </p>
            <h2 className="text-base font-black text-[var(--sf-text-primary)]">
              {focusSessionId ? '记录这次专注' : '随手记'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--sf-text-tertiary)]">
              {focusSessionId
                ? '文字、语音、图片或视频，会和这次专注放在一起。'
                : '文字、语音、图片、视频，留下一种就可以。'}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving || recording}
            className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sf-bg)] disabled:opacity-40"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={focusSessionId ? '这次专注里，有什么值得留下？' : '现在想到什么，就先留下来……'}
            className="min-h-32 w-full resize-none rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)] px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--sf-text-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--sf-accent)_28%,transparent)]"
          />

          <div className="mt-3 rounded-2xl border border-[var(--sf-border)] p-3">
            <TagSelector value={tags} onChange={setTags} compact />
          </div>

          {allowMedia ? <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(Array.from(event.target.files || []));
              event.target.value = '';
            }}
          /> : null}

          {allowMedia ? <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving || recording || files.length >= MAX_FILES}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--sf-bg)] px-3 py-3 text-xs font-bold text-[var(--sf-text-secondary)] disabled:opacity-40"
            >
              <Paperclip size={14} /> 图片 / 视频
            </button>

            {recording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 py-3 text-xs font-bold text-red-700"
              >
                <Square size={12} fill="currentColor" />
                完成录音 {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startRecording()}
                disabled={saving || !microphoneSupported || files.length >= MAX_FILES}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--sf-bg)] px-3 py-3 text-xs font-bold text-[var(--sf-text-secondary)] disabled:opacity-40"
                title={microphoneSupported ? '录制语音' : '当前环境不支持录音'}
              >
                <Mic size={14} /> 录一段语音
              </button>
            )}
          </div> : <p className="mt-3 text-xs text-[var(--sf-text-secondary)]">当前设置仅保存文字与标签。</p>}

          {allowMedia && files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, index) => {
                const kind = fileKind(file);
                const Icon = kind === 'image'
                  ? ImageIcon
                  : kind === 'video'
                    ? Video
                    : FileAudio;
                return (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--sf-border)] px-3 py-2.5"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--sf-bg)]">
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-xs text-[var(--sf-text-primary)]">
                        {kind === 'image' ? '图片' : kind === 'video' ? '视频' : '语音 / 音频'}
                      </strong>
                      <span className="mt-0.5 block truncate text-[10px] text-[var(--sf-text-tertiary)]">
                        {file.name} · {formatBytes(file.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      disabled={saving || recording}
                      className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sf-bg)] text-[var(--sf-text-tertiary)] disabled:opacity-40"
                      aria-label="移除附件"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
              <p className="text-right text-[9px] text-[var(--sf-text-tertiary)]">
                {files.length}/{MAX_FILES} 个附件 · {formatBytes(totalBytes)}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
              {error}
            </p>
          )}
        </div>

        <footer className="shrink-0 border-t border-[var(--sf-divider)] bg-[var(--sf-surface)] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={!draftReady || saving || recording || (!text.trim() && (!allowMedia || files.length === 0))}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sf-text-primary)] py-3 text-sm font-black text-[var(--sf-surface)] shadow-[0_10px_28px_rgba(18,18,22,0.14)] disabled:opacity-40"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? '正在保存附件…' : focusSessionId ? '保存专注记录' : '保存记录'}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
