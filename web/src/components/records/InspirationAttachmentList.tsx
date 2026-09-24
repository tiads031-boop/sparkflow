import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronUp,
  FileAudio,
  FileText,
  Image as ImageIcon,
  Loader2,
  Play,
  Sparkles,
  Video,
  X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  analyzeInspirationAttachment,
  fetchInspirationAttachmentBlob,
  summarizeInspirationAttachment,
  transcribeInspirationAttachment,
  type InspirationAttachment,
} from '../../api/inspirations';
import { useModalLifecycle } from '../ui/useModalLifecycle';

const MAX_ASR_BYTES = 7 * 1024 * 1024;
const MAX_MEDIA_AI_BYTES = 12 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentItem({
  inspirationId,
  attachment,
  variant = 'default',
  onOpenImage,
}: {
  inspirationId: string;
  attachment: InspirationAttachment;
  variant?: 'default' | 'card';
  onOpenImage?: () => void;
}) {
  const [current, setCurrent] = useState(attachment);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiAction, setAiAction] = useState<'transcribe' | 'summary' | 'analyze' | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  useEffect(() => {
    if (attachment.kind !== 'image') return;
    let cancelled = false;
    void fetchInspirationAttachmentBlob(inspirationId, attachment.id)
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        if (cancelled) URL.revokeObjectURL(objectUrl);
        else setUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setError('图片加载失败，点击重试'); });
    return () => { cancelled = true; };
  }, [inspirationId, attachment.id, attachment.kind]);

  const load = async () => {
    if (url || loading) return;
    setLoading(true);
    setError('');
    try {
      const blob = await fetchInspirationAttachmentBlob(
        inspirationId,
        current.id,
      );
      setUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : '附件读取失败');
    } finally {
      setLoading(false);
    }
  };

  const transcribe = async () => {
    if (aiAction || current.kind !== 'audio') return;
    setAiAction('transcribe');
    setError('');
    try {
      const next = await transcribeInspirationAttachment(
        inspirationId,
        current.id,
      );
      setCurrent(next);
      setExpandedTranscript(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '音频转写失败');
    } finally {
      setAiAction(null);
    }
  };

  const summarize = async () => {
    if (aiAction || !current.transcript?.trim()) return;
    setAiAction('summary');
    setError('');
    try {
      const next = await summarizeInspirationAttachment(
        inspirationId,
        current.id,
      );
      setCurrent(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : '摘要生成失败');
    } finally {
      setAiAction(null);
    }
  };

  const analyze = async () => {
    if (aiAction || current.kind === 'audio') return;
    setAiAction('analyze');
    setError('');
    try {
      const next = await analyzeInspirationAttachment(
        inspirationId,
        current.id,
      );
      setCurrent(next);
      if (next.transcript) setExpandedTranscript(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '多模态 AI 分析失败');
    } finally {
      setAiAction(null);
    }
  };

  const Icon = current.kind === 'image'
    ? ImageIcon
    : current.kind === 'video'
      ? Video
      : FileAudio;
  const label = current.kind === 'image'
    ? '图片'
    : current.kind === 'video'
      ? '视频'
      : '语音 / 音频';
  const audioTooLarge = current.kind === 'audio' && current.sizeBytes > MAX_ASR_BYTES;
  const mediaAiTooLarge = current.kind === 'video' && current.sizeBytes > MAX_MEDIA_AI_BYTES;

  return (
    <div className={`overflow-hidden rounded-2xl ${variant === 'card' && current.kind === 'image' ? 'bg-[var(--sf-bg)]' : 'border border-[var(--sf-border)] bg-[var(--sf-bg)]'}`}>
      {url && current.kind === 'image' && (
        <button type="button" onClick={onOpenImage} aria-label={`查看图片：${current.originalName || '记录图片'}`} className="block w-full">
          <img src={url} alt={current.originalName || '记录图片'}
            className={variant === 'card' ? 'h-48 w-full object-cover' : 'max-h-80 w-full bg-black/[0.03] object-contain'} />
        </button>
      )}
      {url && current.kind === 'video' && (
        <video
          src={url}
          controls
          preload="metadata"
          className="max-h-72 w-full bg-black"
        />
      )}
      {url && current.kind === 'audio' && (
        <div className="p-3">
          <audio src={url} controls preload="metadata" className="w-full" />
        </div>
      )}

      <button
        type="button"
        onClick={() => void load()}
        disabled={loading || Boolean(url)}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default ${url && current.kind === 'image' ? 'sr-only' : ''}`}
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--sf-surface)]">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
        </div>
        <span className="min-w-0 flex-1">
          <strong className="block text-[11px] text-[var(--sf-text-primary)]">{label}</strong>
          <span className="mt-0.5 block truncate text-[9px] text-[var(--sf-text-tertiary)]">
            {current.originalName || '附件'} · {formatBytes(current.sizeBytes)}
          </span>
        </span>
        {!url && !loading && <Play size={13} className="shrink-0 text-[var(--sf-text-tertiary)]" />}
      </button>

      {current.kind === 'audio' && (
        <div className="border-t border-[var(--sf-border)] px-3 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void transcribe()}
              disabled={Boolean(aiAction) || audioTooLarge}
              className="flex items-center gap-1.5 rounded-full bg-[var(--sf-surface)] px-3 py-2 text-[10px] font-bold text-[var(--sf-text-secondary)] disabled:opacity-40"
            >
              {aiAction === 'transcribe'
                ? <Loader2 size={12} className="animate-spin" />
                : <FileText size={12} />}
              {current.transcript ? '重新转写' : 'AI 转写'}
            </button>
            {current.transcript && (
              <button
                type="button"
                onClick={() => void summarize()}
                disabled={Boolean(aiAction)}
                className="flex items-center gap-1.5 rounded-full bg-[#f4f2fb] px-3 py-2 text-[10px] font-bold text-[#64598d] disabled:opacity-40"
              >
                {aiAction === 'summary'
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Sparkles size={12} />}
                {current.aiSummary ? '重新生成摘要' : '生成摘要'}
              </button>
            )}
          </div>

          {audioTooLarge && (
            <p className="mt-2 text-[9px] leading-4 text-amber-700">
              当前 AI 转写支持不超过 7 MB 的单个音频；附件仍可正常播放和保留。
            </p>
          )}
        </div>
      )}

      {current.kind === 'video' && (
        <div className="border-t border-[var(--sf-border)] px-3 py-3">
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={Boolean(aiAction) || mediaAiTooLarge}
            className="flex items-center gap-1.5 rounded-full bg-[#f4f2fb] px-3 py-2 text-[10px] font-bold text-[#64598d] disabled:opacity-40"
          >
            {aiAction === 'analyze'
              ? <Loader2 size={12} className="animate-spin" />
              : <Sparkles size={12} />}
            {current.aiSummary ? '重新分析视频' : 'AI 转写并摘要'}
          </button>
          <p className="mt-2 text-[9px] leading-4 text-[var(--sf-text-tertiary)]">
            只有你点击后才会把这段视频发送给配置的多模态模型处理。
          </p>
          {mediaAiTooLarge && (
            <p className="mt-1 text-[9px] leading-4 text-amber-700">
              当前视频 AI 分析支持不超过 12 MB；附件仍可正常播放和保留。
            </p>
          )}
        </div>
      )}

      {current.transcript && (
        <div className="mx-3 mb-3 rounded-2xl bg-[var(--sf-surface)] p-3">
          <button
            type="button"
            onClick={() => setExpandedTranscript((value) => !value)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <strong className="flex items-center gap-1.5 text-[10px] text-[var(--sf-text-primary)]">
              <FileText size={11} />
              {current.kind === 'video' ? '视频语音转写' : '转写文本'}
            </strong>
            {expandedTranscript
              ? <ChevronUp size={12} className="text-[var(--sf-text-tertiary)]" />
              : <ChevronDown size={12} className="text-[var(--sf-text-tertiary)]" />}
          </button>
          <p
            className={`mt-2 whitespace-pre-wrap text-[10px] leading-5 text-[var(--sf-text-secondary)] ${
              expandedTranscript ? '' : 'line-clamp-3'
            }`}
          >
            {current.transcript}
          </p>
        </div>
      )}

      {current.aiSummary && current.kind !== 'image' && (
        <div className="mx-3 mb-3 rounded-2xl bg-[#f4f2fb] p-3">
          <strong className="flex items-center gap-1.5 text-[10px] text-[#554a7d]">
            <Sparkles size={11} />
            AI 摘要
          </strong>
          <p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-[#6d638e]">
            {current.aiSummary}
          </p>
        </div>
      )}

      {error && (
        <p className="px-3 pb-2.5 text-[10px] text-red-600">{error}</p>
      )}
    </div>
  );
}

export default function InspirationAttachmentList({
  inspirationId,
  attachments = [],
  variant = 'default',
}: {
  inspirationId: string;
  attachments?: InspirationAttachment[];
  variant?: 'default' | 'card';
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const images = attachments.filter((attachment) => attachment.kind === 'image');
  if (!attachments.length) return null;

  return (
    <div className={`${variant === 'card' ? 'grid grid-cols-2 gap-2' : 'mt-3 grid grid-cols-2 gap-2'}`}>
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.id}
          inspirationId={inspirationId}
          attachment={attachment}
          variant={variant}
          onOpenImage={() => setSelected(images.findIndex((image) => image.id === attachment.id))}
        />
      ))}
      {selected !== null && images[selected] && createPortal(
        <ImageViewer key={images[selected].id} inspirationId={inspirationId} images={images} index={selected}
          onSelect={setSelected} onClose={() => setSelected(null)} />,
        document.body,
      )}
    </div>
  );
}

function ImageViewer({ inspirationId, images, index, onSelect, onClose }: {
  inspirationId: string;
  images: InspirationAttachment[];
  index: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  useModalLifecycle(true, onClose, { isolateAppMain: true });
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void fetchInspirationAttachmentBlob(inspirationId, images[index].id)
      .then((blob) => { if (active) setUrl(URL.createObjectURL(blob)); })
      .catch(() => { if (active) setError('图片加载失败'); });
    return () => { active = false; };
  }, [inspirationId, images, index]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onSelect((index + images.length - 1) % images.length);
      if (event.key === 'ArrowRight') onSelect((index + 1) % images.length);
    };
    window.addEventListener('keydown', keydown, true);
    return () => window.removeEventListener('keydown', keydown, true);
  }, [index, images.length, onSelect]);
  return <div role="dialog" aria-modal="true" aria-label="浏览记录图片"
    className="fixed inset-0 z-[150] flex flex-col bg-[#101115] text-white">
    <header className="flex items-center justify-between px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+16px)]">
      <button type="button" onClick={onClose} aria-label="返回记录" className="rounded-full bg-white/10 p-3"><X size={18} /></button>
      <span className="text-sm">{index + 1} / {images.length}</span>
      <span className="w-10" />
    </header>
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
      {url ? <img key={images[index].id} src={url} alt={images[index].originalName || '记录图片'} className="max-h-full max-w-full object-contain" /> :
        <span className="text-sm text-white/70">{error || '正在加载图片…'}</span>}
      {images.length > 1 && <>
        <button type="button" aria-label="上一张" onClick={() => onSelect((index + images.length - 1) % images.length)} className="absolute left-2 rounded-full bg-black/50 p-2"><ChevronLeft /></button>
        <button type="button" aria-label="下一张" onClick={() => onSelect((index + 1) % images.length)} className="absolute right-2 rounded-full bg-black/50 p-2"><ChevronRight /></button>
      </>}
    </div>
    <footer className="max-h-[30dvh] min-h-20 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-4 text-center text-xs text-white/70">
      {images[index].caption ? <p className="whitespace-pre-wrap text-sm leading-6 text-white">{images[index].caption}</p> : images[index].originalName}
    </footer>
  </div>;
}
