import { BadRequestException } from '@nestjs/common';
import {
  MAX_INSPIRATION_FILE_BYTES,
  MAX_INSPIRATION_TOTAL_BYTES,
  validateInspirationFiles,
} from './inspiration-media.service';

describe('Inspiration media validation', () => {
  it('accepts supported image/audio/video files inside limits', () => {
    expect(validateInspirationFiles([
      {
        buffer: Buffer.from('image'),
        size: 5,
        mimetype: 'image/png',
      },
      {
        buffer: Buffer.from('audio'),
        size: 5,
        mimetype: 'audio/webm;codecs=opus',
      },
      {
        buffer: Buffer.from('video'),
        size: 5,
        mimetype: 'video/mp4',
      },
    ])).toBe(15);
  });

  it('rejects unsupported file types', () => {
    expect(() => validateInspirationFiles([
      {
        buffer: Buffer.from('binary'),
        size: 6,
        mimetype: 'application/octet-stream',
      },
    ])).toThrow(BadRequestException);
  });

  it('rejects an oversized single file', () => {
    expect(() => validateInspirationFiles([
      {
        buffer: Buffer.alloc(1),
        size: MAX_INSPIRATION_FILE_BYTES + 1,
        mimetype: 'video/mp4',
      },
    ])).toThrow(BadRequestException);
  });

  it('rejects attachment batches beyond the total-size boundary', () => {
    const legalSingleFileBytes = Math.floor(MAX_INSPIRATION_TOTAL_BYTES / 3) + 1;
    expect(legalSingleFileBytes).toBeLessThan(MAX_INSPIRATION_FILE_BYTES);
    expect(() => validateInspirationFiles([
      {
        buffer: Buffer.alloc(1),
        size: legalSingleFileBytes,
        mimetype: 'video/mp4',
      },
      {
        buffer: Buffer.alloc(1),
        size: legalSingleFileBytes,
        mimetype: 'video/webm',
      },
      {
        buffer: Buffer.alloc(1),
        size: legalSingleFileBytes,
        mimetype: 'audio/webm',
      },
    ])).toThrow(BadRequestException);
  });
});
