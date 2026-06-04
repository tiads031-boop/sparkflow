import type { CalendarEvent, NavOrder, NavVisibility, Spark, Task } from '../types';

const SCHEMA_VERSION = 1;

type SparkflowPreferences = {
  navVisibility?: NavVisibility;
  navOrder?: NavOrder;
  customTaskSections?: string[];
};

export type SparkflowExportSnapshot = {
  tasks: Task[];
  sparks: Spark[];
  events: CalendarEvent[];
  profile?: unknown;
  preferences?: SparkflowPreferences;
};

export type SparkflowImportData = {
  schemaVersion: number;
  exportedAt?: string;
  tasks: Task[];
  sparks: Spark[];
  events: CalendarEvent[];
  profile?: unknown;
  preferences?: SparkflowPreferences;
};

type UnknownRecord = Record<string, unknown>;

const taskStatuses: Task['status'][] = ['To do', 'In progress', 'In review', 'Done', 'Cancelled'];
const taskPriorities: Task['priority'][] = ['High Priority', 'Medium', 'Low'];
const taskColors: Task['colorType'][] = ['dark', 'green', 'purple'];

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

function sanitizeTask(value: unknown): Task | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const title = asString(value.title);
  if (!id || !title) return null;

  const rawSubtasks = Array.isArray(value.subtasks) ? value.subtasks : [];
  const subtasks = rawSubtasks
    .filter(isRecord)
    .map((subtask) => ({
      id: asString(subtask.id) || `${id}-subtask-${Math.random().toString(36).slice(2, 8)}`,
      title: asString(subtask.title) || '',
      completed: asBoolean(subtask.completed) ?? false,
    }))
    .filter((subtask) => subtask.title.trim().length > 0);

  const status = taskStatuses.includes(value.status as Task['status'])
    ? value.status as Task['status']
    : 'To do';
  const priority = taskPriorities.includes(value.priority as Task['priority'])
    ? value.priority as Task['priority']
    : 'Medium';
  const colorType = taskColors.includes(value.colorType as Task['colorType'])
    ? value.colorType as Task['colorType']
    : 'green';

  return {
    id,
    title,
    status,
    priority,
    colorType,
    time: asString(value.time),
    comments: asNumber(value.comments) ?? subtasks.length,
    subtasks,
    description: asString(value.description),
    dueDate: asString(value.dueDate),
    estimatedMinutes: asNumber(value.estimatedMinutes),
    section: asString(value.section),
    project: asString(value.project),
    startTime: asString(value.startTime),
    scheduledStart: asString(value.scheduledStart),
    scheduledEnd: asString(value.scheduledEnd),
    duration: asNumber(value.duration),
    reminderAt: asString(value.reminderAt),
    repeatRule: asString(value.repeatRule),
    repeatStartDate: asString(value.repeatStartDate),
    repeatEndDate: asString(value.repeatEndDate),
  };
}

function sanitizeSpark(value: unknown): Spark | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const text = asString(value.text);
  if (!id || !text) return null;

  const pos = isRecord(value.pos)
    ? {
        x: asNumber(value.pos.x) ?? 50,
        y: asNumber(value.pos.y) ?? 50,
      }
    : { x: 50, y: 50 };

  return {
    id,
    text,
    color: asString(value.color) || '#cae393',
    size: asNumber(value.size) ?? 1,
    pos,
    rot: asNumber(value.rot) ?? 0,
    z: asNumber(value.z) ?? 1,
    tag: asString(value.tag),
    source: asString(value.source),
    createdAt: asString(value.createdAt),
  };
}

function sanitizeEvent(value: unknown): CalendarEvent | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const title = asString(value.title);
  const startTime = asString(value.startTime);
  const endTime = asString(value.endTime);
  if (!id || !title || !startTime || !endTime) return null;

  const extendedProps = isRecord(value.extendedProps)
    ? {
        taskId: asString(value.extendedProps.taskId),
        eventType: asString(value.extendedProps.eventType),
      }
    : undefined;

  return {
    id,
    title,
    startTime,
    endTime,
    eventType: asString(value.eventType),
    courseId: asString(value.courseId),
    color: asString(value.color),
    isOverride: asBoolean(value.isOverride),
    extendedProps,
  };
}

function sanitizePreferences(value: unknown): SparkflowPreferences | undefined {
  if (!isRecord(value)) return undefined;
  const preferences: SparkflowPreferences = {};

  if (isRecord(value.navVisibility)) {
    preferences.navVisibility = value.navVisibility as NavVisibility;
  }
  if (Array.isArray(value.navOrder)) {
    preferences.navOrder = value.navOrder.filter((item): item is NavOrder[number] => typeof item === 'string') as NavOrder;
  }
  const customTaskSections = asStringArray(value.customTaskSections);
  if (customTaskSections) {
    preferences.customTaskSections = customTaskSections.map((item) => item.trim()).filter(Boolean);
  }

  return Object.keys(preferences).length > 0 ? preferences : undefined;
}

export function exportSparkflowData(snapshot: SparkflowExportSnapshot): void {
  const payload: SparkflowImportData = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tasks: snapshot.tasks,
    sparks: snapshot.sparks,
    events: snapshot.events,
    profile: snapshot.profile,
    preferences: snapshot.preferences,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  link.href = url;
  link.download = `sparkflow-export-${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function readSparkflowImportFile(file: File): Promise<SparkflowImportData> {
  const rawText = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('文件不是有效的 JSON');
  }

  if (!isRecord(parsed)) {
    throw new Error('导入文件结构不正确');
  }

  const schemaVersion = asNumber(parsed.schemaVersion) ?? SCHEMA_VERSION;
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks.map(sanitizeTask).filter(Boolean) as Task[] : [];
  const sparks = Array.isArray(parsed.sparks) ? parsed.sparks.map(sanitizeSpark).filter(Boolean) as Spark[] : [];
  const events = Array.isArray(parsed.events) ? parsed.events.map(sanitizeEvent).filter(Boolean) as CalendarEvent[] : [];
  const preferences = sanitizePreferences(parsed.preferences);

  if (!Array.isArray(parsed.tasks) && !Array.isArray(parsed.sparks) && !Array.isArray(parsed.events)) {
    throw new Error('导入文件缺少 tasks、sparks 或 events 数据');
  }

  return {
    schemaVersion,
    exportedAt: asString(parsed.exportedAt),
    tasks,
    sparks,
    events,
    profile: parsed.profile,
    preferences,
  };
}
