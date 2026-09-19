import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { basename, extname, join, resolve, sep } from 'path';
import { randomUUID } from 'crypto';

export const MAX_INSPIRATION_ATTACHMENTS = 6;
export const MAX_INSPIRATION_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_INSPIRATION_TOTAL_BYTES = 50 * 1024 * 1024;

const MIME_KIND: Record<string, 'image' | 'audio' | 'video'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
  'audio/webm': 'audio',
  'audio/ogg': 'audio',
  'audio/mp4': 'audio',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'audio/x-m4a': 'audio',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
};

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/x-m4a': '.m4a',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

export interface StoredInspirationAttachment {
  id: string;
  kind: 'image' | 'audio' | 'video';
  mimeType: string;
  originalName: string | null;
  storageKey: string;
  sizeBytes: number;
}

function normalizedMime(value?: string) {
  return (value || '').trim().toLowerCase().split(';')[0];
}

export function validateInspirationFiles(
  files: Array<Pick<Express.Multer.File, 'buffer' | 'size' | 'mimetype'>> = [],
) {
  if (files.length > MAX_INSPIRATION_ATTACHMENTS) {
    throw new BadRequestException(`最多上传 ${MAX_INSPIRATION_ATTACHMENTS} 个附件`);
  }

  let totalBytes = 0;
  for (const file of files) {
    const size = file.size || file.buffer?.length || 0;
    const mimeType = normalizedMime(file.mimetype);
    if (!file.buffer?.length || size <= 0) {
      throw new BadRequestException('附件内容为空');
    }
    if (size > MAX_INSPIRATION_FILE_BYTES) {
      throw new BadRequestException('单个附件不能超过 25MB');
    }
    if (!MIME_KIND[mimeType]) {
      throw new BadRequestException('仅支持图片、音频和视频附件');
    }
    totalBytes += size;
  }

  if (totalBytes > MAX_INSPIRATION_TOTAL_BYTES) {
    throw new BadRequestException('单条记录附件总大小不能超过 50MB');
  }

  return totalBytes;
}

@Injectable()
export class InspirationMediaService {
  private readonly rootDir: string;

  constructor(private readonly config: ConfigService) {
    this.rootDir = resolve(
      this.config.get<string>('INSPIRATION_UPLOAD_DIR')?.trim()
        || join(process.cwd(), 'data', 'inspiration-attachments'),
    );
  }

  async persist(
    inspirationId: string,
    files: Express.Multer.File[] = [],
  ): Promise<StoredInspirationAttachment[]> {
    validateInspirationFiles(files);
    if (!files.length) return [];

    const directory = resolve(this.rootDir, inspirationId);
    this.assertInsideRoot(directory);
    await mkdir(directory, { recursive: true });

    const stored: StoredInspirationAttachment[] = [];
    try {
      for (const file of files) {
        const mimeType = normalizedMime(file.mimetype);
        const kind = MIME_KIND[mimeType];
        if (!kind) throw new BadRequestException('不支持的附件格式');

        const id = randomUUID();
        const extension = MIME_EXTENSION[mimeType] || extname(file.originalname || '').slice(0, 10);
        const storageKey = `${inspirationId}/${id}${extension}`;
        const absolutePath = this.absolutePath(storageKey);

        await writeFile(absolutePath, file.buffer, { flag: 'wx' });
        stored.push({
          id,
          kind,
          mimeType,
          originalName: file.originalname ? basename(file.originalname).slice(0, 255) : null,
          storageKey,
          sizeBytes: file.size || file.buffer.length,
        });
      }
      return stored;
    } catch (error) {
      await this.removeMany(stored.map((item) => item.storageKey));
      throw error;
    }
  }

  open(storageKey: string) {
    return createReadStream(this.absolutePath(storageKey));
  }

  absolutePath(storageKey: string) {
    const absolute = resolve(this.rootDir, storageKey);
    this.assertInsideRoot(absolute);
    return absolute;
  }

  async removeMany(storageKeys: string[]) {
    await Promise.all(storageKeys.map(async (storageKey) => {
      try {
        await unlink(this.absolutePath(storageKey));
      } catch {
        // File may already be absent. DB ownership remains the source of access truth.
      }
    }));
  }

  private assertInsideRoot(absolute: string) {
    const rootPrefix = this.rootDir.endsWith(sep) ? this.rootDir : `${this.rootDir}${sep}`;
    if (absolute !== this.rootDir && !absolute.startsWith(rootPrefix)) {
      throw new BadRequestException('Invalid attachment storage path');
    }
  }
}
