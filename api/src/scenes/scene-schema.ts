import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export type FieldType =
  | 'duration'
  | 'rating'
  | 'number'
  | 'text'
  | 'image'
  | 'location'
  | 'people';
export interface SceneField {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  unit?: string;
  min?: number;
  max?: number;
  options?: string[];
}

const types = new Set([
  'duration',
  'rating',
  'number',
  'text',
  'image',
  'location',
  'people',
]);
const triggers = new Set(['manual', 'focus', 'task_completed']);
const views = new Set(['heatmap', 'trend', 'list', 'photo']);
const keyPattern = /^[a-z][a-z0-9_]{0,39}$/;
const colorPattern = /^#[0-9a-f]{6}$/i;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('对象格式无效');
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new BadRequestException(`${label}格式无效`);
  }
  return value.trim();
}

function optionalString(
  value: unknown,
  label: string,
  max: number,
): string | null {
  return value === null || value === '' ? null : string(value, label, max);
}

function choiceList(
  value: unknown,
  allowed: Set<string>,
  label: string,
): string[] {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > allowed.size ||
    value.some((item) => typeof item !== 'string' || !allowed.has(item)) ||
    new Set(value).size !== value.length
  )
    throw new BadRequestException(`${label}格式无效`);
  return value as string[];
}

export function validateFields(value: unknown): SceneField[] {
  if (!Array.isArray(value) || value.length > 20)
    throw new BadRequestException('记录字段最多 20 个');
  const keys = new Set<string>();
  return value.map((raw) => {
    const field = record(raw);
    if (
      Object.keys(field).some(
        (key) =>
          ![
            'id',
            'key',
            'label',
            'type',
            'required',
            'unit',
            'min',
            'max',
            'options',
          ].includes(key),
      )
    )
      throw new BadRequestException('记录字段包含未知属性');
    const id = string(field.id, '字段 ID', 40);
    const key = string(field.key, '字段 key', 40);
    if (!keyPattern.test(id) || !keyPattern.test(key) || keys.has(key))
      throw new BadRequestException('字段 key/ID 无效或重复');
    keys.add(key);
    if (!types.has(field.type as string) || typeof field.required !== 'boolean')
      throw new BadRequestException('字段类型或必填标记无效');
    const type = field.type as FieldType;
    const result: SceneField = {
      id,
      key,
      label: string(field.label, '字段名称', 50),
      type,
      required: field.required,
    };
    if (field.unit !== undefined) result.unit = string(field.unit, '单位', 20);
    for (const bound of ['min', 'max'] as const) {
      if (field[bound] !== undefined) {
        if (typeof field[bound] !== 'number' || !Number.isFinite(field[bound]))
          throw new BadRequestException('数值边界无效');
        result[bound] = field[bound];
      }
    }
    if (
      result.min !== undefined &&
      result.max !== undefined &&
      result.min > result.max
    )
      throw new BadRequestException('数值边界无效');
    if (field.options !== undefined) {
      if (!Array.isArray(field.options) || field.options.length > 20)
        throw new BadRequestException('选项无效');
      result.options = field.options.map((option) =>
        string(option, '选项', 50),
      );
    }
    return result;
  });
}

export function templateData(input: unknown, partial = false) {
  const body = record(input);
  const allowed = [
    'name',
    'emoji',
    'color',
    'description',
    'category',
    'fieldSchema',
    'triggers',
    'allowedViews',
  ];
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    throw new BadRequestException('场景包含未知属性');
  const data: Record<string, unknown> = {};
  if (!partial || body.name !== undefined)
    data.name = string(body.name, '场景名称', 60);
  if (body.emoji !== undefined) data.emoji = string(body.emoji, '图标', 12);
  if (body.color !== undefined) {
    if (typeof body.color !== 'string' || !colorPattern.test(body.color))
      throw new BadRequestException('颜色格式无效');
    data.color = body.color.toLowerCase();
  }
  if (body.description !== undefined)
    data.description = optionalString(body.description, '描述', 500);
  if (body.category !== undefined)
    data.category = optionalString(body.category, '分类', 60);
  if (body.fieldSchema !== undefined)
    data.fieldSchema = validateFields(body.fieldSchema);
  if (body.triggers !== undefined)
    data.triggers = choiceList(body.triggers, triggers, '触发方式');
  if (body.allowedViews !== undefined)
    data.allowedViews = choiceList(body.allowedViews, views, '允许视图');
  return data;
}

export function entryMetadata(
  value: unknown,
  fields: SceneField[],
): Prisma.InputJsonValue {
  const metadata = record(value ?? {});
  const schema = new Map(fields.map((field) => [field.key, field]));
  if (Object.keys(metadata).length > 20)
    throw new BadRequestException('记录字段过多');
  for (const [key, raw] of Object.entries(metadata)) {
    const field = schema.get(key);
    if (!field) throw new BadRequestException(`未知字段：${key}`);
    const numeric = ['duration', 'rating', 'number'].includes(field.type);
    if (
      numeric
        ? typeof raw !== 'number' || !Number.isFinite(raw)
        : typeof raw !== 'string' || raw.length > 2000
    )
      throw new BadRequestException(`字段 ${key} 值无效`);
    if (
      numeric &&
      ((field.min !== undefined && (raw as number) < field.min) ||
        (field.max !== undefined && (raw as number) > field.max))
    )
      throw new BadRequestException(`字段 ${key} 超出范围`);
  }
  for (const field of fields)
    if (field.required && metadata[field.key] === undefined)
      throw new BadRequestException(`缺少必填字段：${field.key}`);
  return metadata as Prisma.InputJsonValue;
}

export function entryTags(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 30 ||
    value.some(
      (item) => typeof item !== 'string' || !item.trim() || item.length > 40,
    )
  )
    throw new BadRequestException('标签格式无效');
  return [...new Set(value.map((item: string) => item.trim()))];
}
