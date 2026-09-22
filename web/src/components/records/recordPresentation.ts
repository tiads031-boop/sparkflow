import type { InspirationRecord } from '../../api/inspirations';

export function recordText(record: InspirationRecord) {
  if (record.contentText || record.description || record.title) {
    return record.contentText || record.description || record.title || '未命名记录';
  }
  const attachments = record.attachments || [];
  const counts = {
    image: attachments.filter((item) => item.kind === 'image').length,
    audio: attachments.filter((item) => item.kind === 'audio').length,
    video: attachments.filter((item) => item.kind === 'video').length,
  };
  return [
    counts.image ? `${counts.image} 张图片` : null,
    counts.audio ? `${counts.audio} 段语音/音频` : null,
    counts.video ? `${counts.video} 个视频` : null,
  ].filter(Boolean).join(' · ') || '未命名记录';
}

export function recordSourceLabel(record: InspirationRecord) {
  return record.sourceType === 'manual' ? '手动记录' : record.sourceType || '记录';
}
