import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileAudio,
  FileText,
  Image as ImageIcon,
  Loader2,
  Play,
  ScanText,
  Sparkles,
  Video,
} from 'lucide-react';
import {
  analyzeInspirationAttachment,
  fetchInspirationAttachmentBlob,
  summarizeInspirationAttachment,
  transcribeInspirationAttachment,
  type InspirationAttachment,
} from '../../api/inspirations';

const MAX_ASR_BYTES = 7 * 1024 * 1024;
const MAX_MEDIA_AI_BYTES = 12 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentItem({
  inspirationId,
  attachment,
}: {
  inspirationId: string;
  attachment: InspirationAttachment;
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
  const mediaAiTooLarge = current.kind !== 'audio' && current.sizeBytes > MAX_MEDIA_AI_BYTES;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)]">
      {url && current.kind === 'image' && (
        <img
          src={url}
          alt={current.originalName || '记录图片'}
          className="max-h-80 w-full bg-black/[0.03] object-contain"
        />
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

      {current.kind === 'image' && (
        <div className="border-t border-[var(--sf-border)] px-3 py-3">
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={Boolean(aiAction) || mediaAiTooLarge}
            className="flex items-center gap-1.5 rounded-full bg-[#f4f2fb] px-3 py-2 text-[10px] font-bold text-[#64598d] disabled:opacity-40"
          >
            {aiAction === 'analyze'
              ? <Loader2 size={12} className="animate-spin" />
              : <ScanText size={12} />}
            {current.aiSummary ? '重新分析图片' : 'AI 提取信息'}
          </button>
          {mediaAiTooLarge && (
            <p className="mt-2 text-[9px] leading-4 text-amber-700">
              当前图片 AI 分析支持不超过 12 MB；附件仍可正常查看和保留。
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

      {current.aiSummary && (
        <div className="mx-3 mb-3 rounded-2xl bg-[#f4f2fb] p-3">
          <strong className="flex items-center gap-1.5 text-[10px] text-[#554a7d]">
            <Sparkles size={11} />
            {current.kind === 'image' ? 'AI 图片信息' : 'AI 摘要'}
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
}: {
  inspirationId: string;
  attachments?: InspirationAttachment[];
}) {
  if (!attachments.length) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.id}
          inspirationId={inspirationId}
          attachment={attachment}
        />
      ))}
    </div>
  );
}
