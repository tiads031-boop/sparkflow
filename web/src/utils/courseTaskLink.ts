import type { Task } from '../types';

export type CourseTaskWorkflowStatus = 'todo' | 'in-progress' | 'done';

const TASK_STATUS_MAP: Record<string, Task['status']> = {
  todo: 'To do',
  'To do': 'To do',
  'in-progress': 'In progress',
  'In progress': 'In progress',
  'in-review': 'In review',
  'In review': 'In review',
  done: 'Done',
  Done: 'Done',
  cancelled: 'Cancelled',
  Cancelled: 'Cancelled',
};

export function normalizeLinkedTaskStatus(status: string): Task['status'] {
  return TASK_STATUS_MAP[status] || 'To do';
}

export function buildLinkedCourseTask(input: {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  status: CourseTaskWorkflowStatus;
  tags: string[];
}): Task {
  return {
    id: input.id,
    title: input.title,
    description: `来自课程任务：${input.courseName}`,
    status: normalizeLinkedTaskStatus(input.status),
    priority: 'Medium',
    colorType: 'green',
    comments: 0,
    subtasks: [],
    section: 'study',
    project: input.courseName,
    courseId: input.courseId,
    tags: input.tags,
  };
}
