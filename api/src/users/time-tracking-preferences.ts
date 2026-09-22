import { BadRequestException } from '@nestjs/common';

export interface TimeTrackingPreferences {
  focusActualEnabled: boolean;
  quickStartEnabled: boolean;
  manualBackfillEnabled: boolean;
  defaultSceneId: string | null;
  focusAttachmentEnabled: boolean;
  externalSources: { androidUsage: 'not_connected' };
}

export type TimeTrackingPatch = Partial<
  Omit<TimeTrackingPreferences, 'externalSources'>
>;
const editable = [
  'focusActualEnabled',
  'quickStartEnabled',
  'manualBackfillEnabled',
  'defaultSceneId',
  'focusAttachmentEnabled',
] as const;
const booleanKeys = editable.filter((key) => key !== 'defaultSceneId');

export function parseTimeTrackingPreferences(
  value: unknown,
): TimeTrackingPreferences {
  const settings =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const stored =
    settings.timeTracking &&
    typeof settings.timeTracking === 'object' &&
    !Array.isArray(settings.timeTracking)
      ? (settings.timeTracking as Record<string, unknown>)
      : {};
  return {
    focusActualEnabled:
      typeof stored.focusActualEnabled === 'boolean'
        ? stored.focusActualEnabled
        : true,
    quickStartEnabled:
      typeof stored.quickStartEnabled === 'boolean'
        ? stored.quickStartEnabled
        : true,
    manualBackfillEnabled:
      typeof stored.manualBackfillEnabled === 'boolean'
        ? stored.manualBackfillEnabled
        : true,
    defaultSceneId:
      typeof stored.defaultSceneId === 'string' ? stored.defaultSceneId : null,
    focusAttachmentEnabled:
      typeof stored.focusAttachmentEnabled === 'boolean'
        ? stored.focusAttachmentEnabled
        : true,
    externalSources: { androidUsage: 'not_connected' },
  };
}

export function validateTimeTrackingPatch(value: unknown): TimeTrackingPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('时间记录设置格式无效');
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => !editable.includes(key as (typeof editable)[number]),
    )
  )
    throw new BadRequestException('时间记录设置包含未知属性');
  const result: TimeTrackingPatch = {};
  for (const key of booleanKeys) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'boolean')
      throw new BadRequestException(`${key} 必须为布尔值`);
    result[key] = input[key];
  }
  if (input.defaultSceneId !== undefined) {
    if (
      input.defaultSceneId !== null &&
      (typeof input.defaultSceneId !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(input.defaultSceneId))
    )
      throw new BadRequestException('默认场景 ID 无效');
    result.defaultSceneId = input.defaultSceneId;
  }
  return result;
}
