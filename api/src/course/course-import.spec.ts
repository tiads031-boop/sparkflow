import { BadRequestException } from '@nestjs/common';
import {
  courseFingerprint,
  parseCourseImport,
  previewCourseImport,
  type CourseImportSource,
} from './course-import';

const source: CourseImportSource = {
  schoolId: 'school-zf',
  adapterId: 'zf-v9',
  system: 'zf-v9',
  termId: '2026-2027-1',
  origin: 'https://jw.example.edu.cn',
  fetchedAt: '2026-09-15T10:00:00.000Z',
};

const backup = () => ({
  format: 'sparkflow-courses',
  version: 1,
  semesters: [
    {
      id: 'source-semester',
      name: '秋季',
      startDate: '2026-09-07T00:00:00Z',
      endDate: '2027-01-10T00:00:00Z',
    },
  ],
  courses: [
    {
      name: ' 高等　数学 ',
      teacher: '张 老师',
      room: 'A101',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:40',
      weeks: [3, 1, 1],
      sourceEntryId: 'class-1',
      events: [],
    },
  ],
});

const envelope = () => ({
  format: 'sparkflow-course-import',
  version: 2,
  requestId: 'import-20260915-001',
  targetSemesterId: 'semester-existing',
  duplicatePolicy: 'skip',
  source,
  backup: backup(),
});

describe('course import contract', () => {
  it('parses the versioned envelope while keeping v1 backups compatible', () => {
    const parsed = parseCourseImport(envelope());
    expect(parsed).toMatchObject({
      version: 2,
      legacy: false,
      targetSemesterId: 'semester-existing',
      duplicatePolicy: 'skip',
    });
    expect(parsed.payloadHash).toMatch(/^[a-f0-9]{64}$/);

    const legacy = parseCourseImport(backup());
    expect(legacy).toMatchObject({
      version: 1,
      legacy: true,
      duplicatePolicy: 'keep',
    });
  });

  it('rejects unsafe source origins and reused malformed request IDs', () => {
    expect(() =>
      parseCourseImport({ ...envelope(), requestId: 'short' }),
    ).toThrow(BadRequestException);
    expect(() =>
      parseCourseImport({
        ...envelope(),
        source: { ...source, origin: 'javascript:alert(1)' },
      }),
    ).toThrow('导入来源网址无效');
  });

  it('creates a stable fingerprint from source IDs and normalized schedules', () => {
    const first = parseCourseImport(envelope());
    const secondValue = envelope();
    secondValue.backup.courses[0].name = '完全不同的显示名称';
    secondValue.backup.courses[0].weeks = [1, 3];
    const second = parseCourseImport(secondValue);
    expect(courseFingerprint(first.backup.courses[0], source)).toBe(
      courseFingerprint(second.backup.courses[0], source),
    );
  });

  it('separates exact duplicates from overlapping schedule conflicts', () => {
    const parsed = parseCourseImport(envelope());
    const imported = parsed.backup.courses[0];
    const duplicateFingerprint = courseFingerprint(imported, source);
    const preview = previewCourseImport(
      [
        imported,
        {
          ...imported,
          name: '大学英语',
          sourceEntryId: 'class-2',
          startTime: '09:00',
          endTime: '10:30',
        },
        { ...imported, name: '体育', sourceEntryId: 'class-3', dayOfWeek: 2 },
        imported,
      ],
      [
        {
          id: 'existing-1',
          name: '高等数学',
          teacher: '张老师',
          room: 'A101',
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '09:40',
          weeks: [1, 3],
          sourceEntryId: 'class-1',
          sourceFingerprint: duplicateFingerprint,
        },
      ],
      source,
    );

    expect(preview.summary).toEqual({
      scheduleEntryCount: 4,
      newCount: 2,
      duplicateCount: 2,
      conflictCount: 1,
    });
    expect(preview.items[0]).toMatchObject({
      duplicate: true,
      duplicateOf: 'existing-1',
    });
    expect(preview.items[1].conflictCourseNames).toContain('高等数学');
    expect(preview.items[2].conflictCourseIds).toHaveLength(0);
    expect(preview.items[3].duplicate).toBe(true);
  });
});
