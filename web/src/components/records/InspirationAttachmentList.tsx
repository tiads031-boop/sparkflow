import { useEffect, useState } from 'react';
import {
  FileAudio,
  Image as ImageIcon,
  Loader2,
  Play,
  Video,
} from 'lucide-react';
import {
  fetchInspirationAttachmentBlob,
  type InspirationAttachment,
} from '../../api/inspirations';

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
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const load = async () => {
    if (url || loading) return;
    setLoading(true);
    setError('');
    try {
      const blob = await fetchInspirationAttachmentBlob(
        inspirationId,
        attachment.id,
      );
      setUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : '附件读取失败');
    } finally {
      setLoading(false);
    }
  };

  const Icon = attachment.kind === 'image'
    ? ImageIcon
    : attachment.kind === 'video'
      ? Video
      : FileAudio;
  const label = attachment.kind === 'image'
    ? '图片'
    : attachment.kind === 'video'
      ? '视频'
      : '语音 / 音频';

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--sf-border)] bg-[var(--sf-bg)]">
      {url && attachment.kind === 'image' && (
        <img
          src={url}
          alt={attachment.originalName || '记录图片'}
          className="max-h-72 w-full object-contain bg-black/[0.03]"
        />
      )}
      {url && attachment.kind === 'video' && (
        <video
          src={url}
          controls
          preload="metadata"
          className="max-h-72 w-full bg-black"
        />
      )}
      {url && attachment.kind === 'audio' && (
        <div className="p-3">
          <audio src={url} controls preload="metadata" className="w-full" />
        </div>
      )}

      <button
        type="button"
        onClick={() => void load()}
        disabled={loading || Boolean(url)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left disabled:cursor-default"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--sf-surface)]">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
        </div>
        <span className="min-w-0 flex-1">
          <strong className="block text-[11px] text-[var(--sf-text-primary)]">{label}</strong>
          <span className="mt-0.5 block truncate text-[9px] text-[var(--sf-text-tertiary)]">
            {attachment.originalName || '附件'} · {formatBytes(attachment.sizeBytes)}
          </span>
        </span>
        {!url && !loading && <Play size={13} className="shrink-0 text-[var(--sf-text-tertiary)]" />}
      </button>

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
