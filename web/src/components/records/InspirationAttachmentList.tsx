import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FileText, Loader2, Pause, Play, Sparkles, Video, X } from 'lucide-react';
import {
  analyzeInspirationAttachment,
  fetchInspirationAttachmentBlob,
  summarizeInspirationAttachment,
  transcribeInspirationAttachment,
  updateInspirationAttachmentCaption,
  type InspirationAttachment,
} from '../../api/inspirations';
import { useModalLifecycle } from '../ui/useModalLifecycle';

const MAX_ASR_BYTES = 7 * 1024 * 1024;
const MAX_MEDIA_AI_BYTES = 12 * 1024 * 1024;
const waveform = Array.from({ length: 37 }, (_, index) => 8 + Math.round(Math.abs(Math.sin(index * 1.7) * Math.cos(index * .57)) * 24));

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function AttachmentItem({ inspirationId, attachment, imageIndex, photoCount, onOpenImage }: {
  inspirationId: string;
  attachment: InspirationAttachment;
  imageIndex: number;
  photoCount: number;
  onOpenImage: (index: number) => void;
}) {
  const [current, setCurrent] = useState(attachment);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiAction, setAiAction] = useState<'transcribe' | 'summary' | 'analyze' | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (attachment.kind !== 'image') return;
    let active = true;
    let objectUrl: string | null = null;
    void fetchInspirationAttachmentBlob(inspirationId, attachment.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => { if (active) setError('图片加载失败'); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [inspirationId, attachment.id, attachment.kind]);
  useEffect(() => () => { if (url && attachment.kind !== 'image') URL.revokeObjectURL(url); }, [url, attachment.kind]);

  const load = async () => {
    if (url || loading) return;
    setLoading(true);
    setError('');
    try {
      const blob = await fetchInspirationAttachmentBlob(inspirationId, current.id);
      setUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : '附件读取失败');
    } finally {
      setLoading(false);
    }
  };
  const toggleAudio = () => {
    if (!url) { void load(); return; }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setError('音频播放失败'));
    else audio.pause();
  };
  const transcribe = async () => {
    if (aiAction || current.kind !== 'audio') return;
    setAiAction('transcribe'); setError('');
    try {
      const next = await transcribeInspirationAttachment(inspirationId, current.id);
      setCurrent(next); setExpandedTranscript(true);
    } catch (err) { setError(err instanceof Error ? err.message : '音频转写失败'); }
    finally { setAiAction(null); }
  };
  const summarize = async () => {
    if (aiAction || !current.transcript?.trim()) return;
    setAiAction('summary'); setError('');
    try { setCurrent(await summarizeInspirationAttachment(inspirationId, current.id)); }
    catch (err) { setError(err instanceof Error ? err.message : '摘要生成失败'); }
    finally { setAiAction(null); }
  };
  const analyze = async () => {
    if (aiAction || current.kind !== 'video') return;
    setAiAction('analyze'); setError('');
    try { const next = await analyzeInspirationAttachment(inspirationId, current.id); setCurrent(next); if (next.transcript) setExpandedTranscript(true); }
    catch (err) { setError(err instanceof Error ? err.message : '多模态 AI 分析失败'); }
    finally { setAiAction(null); }
  };

  if (current.kind === 'image') return <button type="button" onClick={() => onOpenImage(imageIndex)}
    className={`sf-photo-tile ${photoCount === 1 ? 'sf-photo-single' : ''}`} aria-label={`查看照片 ${imageIndex + 1}${current.caption ? '，有备注' : '，可添加备注'}`}>
    {url ? <img src={url} alt={current.caption || current.originalName || '记录照片'} loading="lazy" /> :
      <span className="sf-photo-loading">{error || '加载照片…'}</span>}
    {current.caption && <span className="sf-photo-caption-dot" aria-label="有照片备注" />}
  </button>;

  return <div className={`sf-media-panel ${current.kind === 'audio' ? 'sf-voice-panel' : 'sf-video-panel'}`}>
    {current.kind === 'audio' ? <div className="sf-voice-main">
      <button type="button" onClick={toggleAudio} disabled={loading} aria-label={loading ? '加载中' : !url ? '加载语音' : playing ? '暂停语音' : '播放语音'} className="sf-voice-play">
        {loading ? <Loader2 size={17} className="animate-spin" /> : playing ? <Pause size={16} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
      </button>
      <div className="sf-voice-info"><span className="sf-voice-label">语音记录 · {current.originalName || '音频'}</span>
        <div className="sf-voice-wave" aria-hidden="true">{waveform.map((height, index) => <i key={index} style={{ height, opacity: url && duration && index / waveform.length <= progress / duration ? 1 : .45 }} />)}</div>
        <span className="sf-voice-time">{formatTime(progress)} / {duration ? formatTime(duration) : '音频'}</span>
      </div>
      {url && <audio ref={audioRef} src={url} preload="metadata" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
    </div> : url ? <video src={url} controls preload="metadata" playsInline className="sf-video-player" /> :
      <button type="button" onClick={() => void load()} disabled={loading} className="sf-video-cover">
        <span className="sf-video-play">{loading ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}</span>
        <span><Video size={14} /> {current.originalName || '记录片段'}</span>
      </button>}
    {current.kind === 'audio' && <div className="sf-media-ai">
      <button type="button" onClick={() => void transcribe()} disabled={Boolean(aiAction) || current.sizeBytes > MAX_ASR_BYTES}><FileText size={13} /> {aiAction === 'transcribe' ? '转写中…' : current.transcript ? '重新转写' : 'AI 转写'}</button>
      {current.transcript && <button type="button" onClick={() => void summarize()} disabled={Boolean(aiAction)}><Sparkles size={13} /> {aiAction === 'summary' ? '生成中…' : current.aiSummary ? '重新生成摘要' : '生成摘要'}</button>}
      {current.sizeBytes > MAX_ASR_BYTES && <small>AI 转写暂不支持超过 7 MB 的音频，播放不受影响。</small>}
    </div>}
    {current.kind === 'video' && <div className="sf-media-ai"><button type="button" onClick={() => void analyze()} disabled={Boolean(aiAction) || current.sizeBytes > MAX_MEDIA_AI_BYTES}><Sparkles size={13} /> {aiAction === 'analyze' ? '分析中…' : current.aiSummary ? '重新分析视频' : 'AI 转写并摘要'}</button>
      {current.sizeBytes > MAX_MEDIA_AI_BYTES && <small>视频超过 12 MB，暂不支持 AI 分析。</small>}</div>}
    {current.transcript && <div className="sf-media-result"><button type="button" onClick={() => setExpandedTranscript((value) => !value)}><FileText size={13} /> 转写文本 {expandedTranscript ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button><p className={expandedTranscript ? '' : 'line-clamp-3'}>{current.transcript}</p></div>}
    {current.aiSummary && <div className="sf-media-result"><strong><Sparkles size={13} /> AI 摘要</strong><p>{current.aiSummary}</p></div>}
    {error && <p className="sf-media-error" role="alert">{error}</p>}
  </div>;
}

export default function InspirationAttachmentList({ inspirationId, attachments = [], variant = 'default', onCaptionSaved }: {
  inspirationId: string;
  attachments?: InspirationAttachment[];
  variant?: 'default' | 'card';
  onCaptionSaved?: (attachment: InspirationAttachment) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const images = attachments.filter((item) => item.kind === 'image').map((item) => ({ ...item, caption: captions[item.id] ?? item.caption }));
  const other = attachments.filter((item) => item.kind !== 'image');
  if (!attachments.length) return null;
  return <div className={`sf-attachments ${variant === 'card' ? 'sf-attachments-card' : ''}`}>
    {images.length > 0 && <div className={`sf-photo-grid sf-photo-count-${Math.min(images.length, 4)}`}>
      {images.map((item, index) => <AttachmentItem key={item.id} inspirationId={inspirationId} attachment={item} imageIndex={index} photoCount={images.length} onOpenImage={setSelected} />)}
    </div>}
    {other.map((item) => <AttachmentItem key={item.id} inspirationId={inspirationId} attachment={item} imageIndex={0} photoCount={0} onOpenImage={setSelected} />)}
    {selected !== null && images[selected] && createPortal(
      <ImageViewer key={images[selected].id} inspirationId={inspirationId} image={images[selected]} index={selected} count={images.length}
        onSelect={setSelected} onClose={() => setSelected(null)} onSave={async (caption) => {
          const updated = await updateInspirationAttachmentCaption(inspirationId, images[selected].id, caption);
          setCaptions((current) => ({ ...current, [updated.id]: updated.caption || '' }));
          onCaptionSaved?.(updated);
        }} />,
      document.body,
    )}
  </div>;
}

function ImageViewer({ inspirationId, image, index, count, onSelect, onClose, onSave }: {
  inspirationId: string;
  image: InspirationAttachment;
  index: number;
  count: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  onSave: (caption: string) => Promise<void>;
}) {
  useModalLifecycle(true, onClose, { isolateAppMain: true });
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState(image.caption || '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const startX = useRef<number | null>(null);
  useEffect(() => {
    let active = true; let objectUrl = '';
    void fetchInspirationAttachmentBlob(inspirationId, image.id)
      .then((blob) => { objectUrl = URL.createObjectURL(blob); if (active) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl); })
      .catch(() => { if (active) setError('图片加载失败'); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [inspirationId, image.id]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (editing) return;
      if (event.key === 'ArrowLeft' && count > 1) onSelect((index + count - 1) % count);
      if (event.key === 'ArrowRight' && count > 1) onSelect((index + 1) % count);
    };
    window.addEventListener('keydown', keydown, true);
    return () => window.removeEventListener('keydown', keydown, true);
  }, [index, count, onSelect, editing]);
  const save = async () => {
    setSaving(true); setError('');
    try { await onSave(caption.trim()); setEditing(false); }
    catch (err) { setError(err instanceof Error ? err.message : '照片备注保存失败'); }
    finally { setSaving(false); }
  };
  return <div role="dialog" aria-modal="true" aria-label="浏览记录照片" className="sf-image-viewer">
    <header className="sf-image-header"><button type="button" onClick={onClose} className="sf-viewer-control" aria-label="关闭照片预览"><X size={19} /></button><span>{index + 1} / {count}</span><span className="w-10" /></header>
    <div className="sf-image-canvas" onTouchStart={(event) => { startX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (editing || startX.current === null || count < 2) return; const dx = (event.changedTouches[0]?.clientX ?? startX.current) - startX.current; if (Math.abs(dx) > 60) onSelect((index + (dx < 0 ? 1 : count - 1)) % count); startX.current = null; }}>
      {url ? <img src={url} alt={image.caption || image.originalName || '记录照片'} /> : <span>{error || '正在加载照片…'}</span>}
      {count > 1 && <><button type="button" className="sf-image-prev sf-viewer-control" aria-label="上一张照片" disabled={editing || saving} onClick={() => onSelect((index + count - 1) % count)}><ChevronLeft size={20} /></button><button type="button" className="sf-image-next sf-viewer-control" aria-label="下一张照片" disabled={editing || saving} onClick={() => onSelect((index + 1) % count)}><ChevronRight size={20} /></button></>}
    </div>
    <footer className="sf-image-caption">
      {editing ? <><label htmlFor="sf-photo-caption">照片备注</label><textarea id="sf-photo-caption" value={caption} maxLength={2000} onChange={(event) => setCaption(event.target.value)} placeholder="写下这张照片的备注…" autoFocus /><div><button type="button" disabled={saving} onClick={() => { setCaption(image.caption || ''); setEditing(false); }}>取消</button><button type="button" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存备注'}</button></div></> : <button type="button" onClick={() => setEditing(true)} className="sf-caption-trigger">{caption || '＋ 添加照片备注'}</button>}
      {error && <p role="alert">{error}</p>}
    </footer>
  </div>;
}
