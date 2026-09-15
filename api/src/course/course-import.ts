import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { parseCourseBackup } from './course-backup';

type Row = Record<string, unknown>;
const record = (value: unknown): value is Row =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export type DuplicatePolicy = 'skip' | 'keep';
export type ParsedCourseBackup = ReturnType<typeof parseCourseBackup>;
export type ImportCourse = ParsedCourseBackup['courses'][number];

export interface CourseImportSource {
  schoolId: string;
  adapterId: string;
  system: string;
  termId?: string;
  origin?: string;
  fetchedAt?: string;
}

export interface ParsedCourseImport {
  version: 1 | 2;
  legacy: boolean;
  requestId?: string;
  targetSemesterId?: string;
  duplicatePolicy: DuplicatePolicy;
  source?: CourseImportSource;
  backup: ParsedCourseBackup;
  payloadHash: string;
}

export interface ExistingImportCourse {
  id: string;
  name: string;
  teacher?: string | null;
  room?: string | null;
  location?: string | null;
  dayOfWeek?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  weeks?: unknown;
  sourceEntryId?: string | null;
  sourceFingerprint?: string | null;
}

export interface CourseImportPreviewItem {
  index: number;
  name: string;
  fingerprint: string;
  duplicate: boolean;
  duplicateOf?: string;
  conflictCourseIds: string[];
  conflictCourseNames: string[];
}

function fail(message = '课程导入请求格式无效'): never {
  throw new BadRequestException(message);
}

function optionalText(value: unknown, max: number): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    return fail();
  return value.trim();
}

function requiredText(value: unknown, max: number): string {
  return optionalText(value, max) || fail();
}

function parseSource(value: unknown): CourseImportSource | undefined {
  if (value == null) return undefined;
  if (!record(value)) return fail();
  const fetchedAt = optionalText(value.fetchedAt, 80);
  if (fetchedAt && !Number.isFinite(Date.parse(fetchedAt)))
    return fail('导入来源时间无效');
  const origin = optionalText(value.origin, 500);
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.origin !== origin
      )
        return fail('导入来源网址无效');
    } catch {
      return fail('导入来源网址无效');
    }
  }
  return {
    schoolId: requiredText(value.schoolId, 160),
    adapterId: requiredText(value.adapterId, 160),
    system: requiredText(value.system, 80),
    termId: optionalText(value.termId, 120),
    origin,
    fetchedAt,
  };
}

export function parseCourseImport(value: unknown): ParsedCourseImport {
  if (
    record(value) &&
    value.format === 'sparkflow-course-import' &&
    value.version === 2
  ) {
    const requestId = requiredText(value.requestId, 120);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,119}$/.test(requestId))
      return fail('导入请求标识无效');
    const targetSemesterId = optionalText(value.targetSemesterId, 120);
    const duplicatePolicy =
      value.duplicatePolicy == null ? 'skip' : value.duplicatePolicy;
    if (duplicatePolicy !== 'skip' && duplicatePolicy !== 'keep')
      return fail('重复课程处理策略无效');
    const backup = parseCourseBackup(value.backup);
    if (backup.semesters.length !== 1)
      return fail('教务导入每次只能包含一个学期');
    const source = parseSource(value.source);
    const payloadHash = importPayloadHash({
      targetSemesterId,
      duplicatePolicy,
      source,
      backup,
    });
    return {
      version: 2,
      legacy: false,
      requestId,
      targetSemesterId,
      duplicatePolicy,
      source,
      backup,
      payloadHash,
    };
  }

  const backup = parseCourseBackup(value);
  return {
    version: 1,
    legacy: true,
    duplicatePolicy: 'keep',
    backup,
    payloadHash: importPayloadHash({ backup }),
  };
}

function normalized(value: unknown): string {
  return typeof value === 'string'
    ? value
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('zh-CN')
    : '';
}

function normalizedWeeks(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (week): week is number =>
          Number.isInteger(week) && week >= 1 && week <= 60,
      ),
    ),
  ].sort((left, right) => left - right);
}

export function courseFingerprint(
  course: ImportCourse | ExistingImportCourse,
  source?: CourseImportSource,
): string {
  const sourceId = normalized(course.sourceEntryId);
  const fields =
    sourceId && source
      ? [
          'source',
          source.schoolId,
          source.termId || '',
          sourceId,
          course.dayOfWeek,
          course.startTime,
          course.endTime,
          normalizedWeeks(course.weeks),
        ]
      : [
          'fields',
          course.name,
          course.teacher,
          course.room || course.location,
          course.dayOfWeek,
          course.startTime,
          course.endTime,
          normalizedWeeks(course.weeks),
        ];
  return createHash('sha256')
    .update(
      stableJson(
        fields.map((value) =>
          typeof value === 'string' ? normalized(value) : value,
        ),
      ),
    )
    .digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (record(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export function importPayloadHash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function overlaps(
  left: ImportCourse,
  right: ImportCourse | ExistingImportCourse,
): boolean {
  if (
    !left.dayOfWeek ||
    left.dayOfWeek !== right.dayOfWeek ||
    !left.startTime ||
    !left.endTime ||
    !right.startTime ||
    !right.endTime
  )
    return false;
  if (left.startTime >= right.endTime || right.startTime >= left.endTime)
    return false;
  const leftWeeks = new Set(normalizedWeeks(left.weeks));
  return normalizedWeeks(right.weeks).some((week) => leftWeeks.has(week));
}

export function previewCourseImport(
  courses: ImportCourse[],
  existing: ExistingImportCourse[],
  source?: CourseImportSource,
) {
  const known = new Map<string, { id: string; name: string }>();
  for (const course of existing) {
    const fingerprint =
      course.sourceFingerprint || courseFingerprint(course, source);
    known.set(fingerprint, { id: course.id, name: course.name });
  }

  const items: CourseImportPreviewItem[] = courses.map((course, index) => {
    const fingerprint = courseFingerprint(course, source);
    const duplicate = known.get(fingerprint);
    const earlier = courses
      .slice(0, index)
      .map((candidate, candidateIndex) => ({
        candidate,
        id: `payload:${candidateIndex}`,
        name: candidate.name,
      }));
    const conflicts = [
      ...existing.map((candidate) => ({
        candidate,
        id: candidate.id,
        name: candidate.name,
      })),
      ...earlier,
    ].filter(
      ({ candidate }) =>
        overlaps(course, candidate) &&
        (candidate.sourceFingerprint ||
          courseFingerprint(candidate, source)) !== fingerprint,
    );
    if (!duplicate)
      known.set(fingerprint, { id: `payload:${index}`, name: course.name });
    return {
      index,
      name: course.name,
      fingerprint,
      duplicate: Boolean(duplicate),
      duplicateOf: duplicate?.id,
      conflictCourseIds: conflicts.map((conflict) => conflict.id),
      conflictCourseNames: [
        ...new Set(conflicts.map((conflict) => conflict.name)),
      ],
    };
  });

  return {
    items,
    summary: {
      scheduleEntryCount: items.length,
      newCount: items.filter((item) => !item.duplicate).length,
      duplicateCount: items.filter((item) => item.duplicate).length,
      conflictCount: items.filter(
        (item) => !item.duplicate && item.conflictCourseIds.length > 0,
      ).length,
    },
  };
}
