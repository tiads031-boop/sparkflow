import assert from 'node:assert/strict';
import test from 'node:test';
import type { InspirationRecord } from '../src/api/inspirations.ts';
import { recordSourceLabel, recordText } from '../src/components/records/recordPresentation.ts';

function record(overrides: Partial<InspirationRecord> = {}): InspirationRecord {
  return {
    id: 'record-1',
    title: null,
    description: null,
    contentText: null,
    sourceType: 'manual',
    createdAt: '2026-09-22T08:00:00.000Z',
    updatedAt: '2026-09-22T08:00:00.000Z',
    tags: [],
    attachments: [],
    reflections: [],
    task: null,
    nextReviewAt: null,
    ...overrides,
  } as InspirationRecord;
}

test('record text prefers real text content and labels manual sources', () => {
  const item = record({ contentText: '一条新的理解' });
  assert.equal(recordText(item), '一条新的理解');
  assert.equal(recordSourceLabel(item), '手动记录');
});

test('record text summarizes attachment-only records without a second fact source', () => {
  const item = record({
    attachments: [
      { id: 'image-1', kind: 'image' },
      { id: 'audio-1', kind: 'audio' },
    ] as InspirationRecord['attachments'],
  });
  assert.equal(recordText(item), '1 张图片 · 1 段语音/音频');
});
