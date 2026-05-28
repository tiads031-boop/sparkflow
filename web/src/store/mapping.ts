/**
 * Task ↔ ContextEntry 双向映射
 *
 * 协议层 (md) 和视图层 (Task) 之间的转换逻辑。
 * taskSlice 和 syncSlice 共用。
 */
import type { Task, ContextEntry, NoteItem } from '../types';

// ════════════════════════════════════════════════════
// Entries → Tasks (API 加载方向)
// ════════════════════════════════════════════════════

const STATUS_TO_TASK: Record<ContextEntry['status'], Task['status']> = {
  todo: 'To do',
  'in-progress': 'In progress',
  'in-review': 'In review',
  done: 'Done',
  cancelled: 'Cancelled',
};

const PRIORITY_TO_TASK: Record<ContextEntry['priority'], Task['priority']> = {
  high: 'High Priority',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_TO_COLOR: Record<ContextEntry['priority'], Task['colorType']> = {
  high: 'dark',
  medium: 'green',
  low: 'purple',
};

export function entriesToTasks(entries: ContextEntry[]): Task[] {
  return entries.map((e) => ({
    id: e.hash,
    title: e.title,
    description: e.description,
    status: STATUS_TO_TASK[e.status] || 'To do',
    priority: PRIORITY_TO_TASK[e.priority] || 'Medium',
    colorType: PRIORITY_TO_COLOR[e.priority] || 'green',
    section: e.section,
    contextMdHash: e.hash,
    project: e.project,
    comments: e.notes.length,
    subtasks: e.notes.map((n: NoteItem, i: number) => ({
      id: `${e.hash}-note-${i}`,
      title: n.text,
      completed: n.completed,
    })),
    time: e.description || undefined,
    dueDate: e.dueDate,
  }));
}

// ════════════════════════════════════════════════════
// Tasks → Entries (同步提交方向)
// ════════════════════════════════════════════════════

const STATUS_TO_ENTRY: Record<Task['status'], ContextEntry['status']> = {
  'To do': 'todo',
  'In progress': 'in-progress',
  'In review': 'in-review',
  Done: 'done',
  Cancelled: 'cancelled',
};

export function tasksToEntries(tasks: Task[]): ContextEntry[] {
  return tasks.map((t) => ({
    hash: t.contextMdHash || t.id,
    title: t.title,
    description: t.description || '',
    status: STATUS_TO_ENTRY[t.status] || 'todo',
    priority:
      t.priority === 'High Priority'
        ? 'high'
        : t.priority === 'Medium'
          ? 'medium'
          : 'low',
    section: t.section || 'personal',
    project: t.project || '',
    notes:
      t.subtasks?.map((s) => ({ text: s.title, completed: s.completed })) || [],
    rawLine: '',
    dueDate: t.dueDate,
  }));
}
