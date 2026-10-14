import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PlanningActionProposal } from '../ai/ai-provider';
import type { Prisma } from '@prisma/client';

/** Recheck the live calendar inside the same transaction as a confirmed AI write. */
export async function validateScheduleActions(
  tx: Prisma.TransactionClient,
  userId: string,
  actions: PlanningActionProposal[],
) {
  const edits = actions.flatMap((action) => {
    if (action.type !== 'create_task' && action.type !== 'update_task')
      return [];
    const changes = action.type === 'create_task' ? action : action.changes;
    if (
      changes.scheduledStart === undefined &&
      changes.scheduledEnd === undefined
    )
      return [];
    const start = changes.scheduledStart
      ? new Date(changes.scheduledStart)
      : null;
    const end = changes.scheduledEnd ? new Date(changes.scheduledEnd) : null;
    if (
      (start === null) !== (end === null) ||
      (start &&
        end &&
        (!Number.isFinite(start.getTime()) ||
          !Number.isFinite(end.getTime()) ||
          end <= start))
    ) {
      throw new BadRequestException('日程起止时间无效，请重新生成草案。');
    }
    return [
      {
        id: action.type === 'update_task' ? action.taskId : action.proposalId,
        title: action.type === 'update_task' ? action.taskTitle : action.title,
        update: action.type === 'update_task',
        expectedUpdatedAt: action.expectedTaskUpdatedAt,
        start,
        end,
      },
    ];
  });
  if (!edits.length) return;
  if (new Set(edits.map((edit) => edit.id)).size !== edits.length)
    throw new BadRequestException(
      '同一任务有多项时间变更，请重新生成一份草案。',
    );
  const updateIds = edits.filter((edit) => edit.update).map((edit) => edit.id);
  const current = updateIds.length
    ? await tx.task.findMany({
        where: { userId, id: { in: updateIds } },
        select: {
          id: true,
          title: true,
          status: true,
          scheduleLocked: true,
          updatedAt: true,
          repeatRule: true,
        },
      })
    : [];
  for (const edit of edits.filter((item) => item.update)) {
    const task = current.find((item) => item.id === edit.id);
    if (!task || ['done', 'cancelled'].includes(task.status))
      throw new ConflictException(
        `“${edit.title}”已变更或不可调整，请重新生成草案。`,
      );
    if (task.scheduleLocked)
      throw new ConflictException(
        `“${task.title}”已锁定时间，请先在日程中解锁。`,
      );
    if (task.repeatRule)
      throw new ConflictException(
        `“${task.title}”是重复任务，请在日程编辑中明确调整范围。`,
      );
    if (
      edit.expectedUpdatedAt &&
      task.updatedAt.toISOString() !== edit.expectedUpdatedAt
    )
      throw new ConflictException(
        `“${task.title}”在草案生成后已修改，请重新生成草案。`,
      );
  }
  const placements = edits.filter((edit) => edit.start && edit.end);
  if (!placements.length) return;
  const minStart = new Date(
    Math.min(...placements.map((item) => item.start!.getTime())),
  );
  const maxEnd = new Date(
    Math.max(...placements.map((item) => item.end!.getTime())),
  );
  const [busyTasks, events] = await Promise.all([
    tx.task.findMany({
      where: {
        userId,
        id: { notIn: edits.map((item) => item.id) },
        status: { notIn: ['done', 'cancelled'] },
        scheduledStart: { lt: maxEnd },
        scheduledEnd: { gt: minStart },
      },
      select: { title: true, scheduledStart: true, scheduledEnd: true },
    }),
    tx.calendarEvent.findMany({
      where: {
        userId,
        startTime: { lt: maxEnd },
        endTime: { gt: minStart },
        AND: [
          { OR: [{ overrideType: null }, { overrideType: { not: 'cancel' } }] },
          {
            OR: [
              { taskId: null },
              { taskId: { notIn: edits.map((item) => item.id) } },
            ],
          },
        ],
      },
      select: { title: true, startTime: true, endTime: true },
    }),
  ]);
  const occupied = [
    ...busyTasks.flatMap((item) =>
      item.scheduledStart && item.scheduledEnd
        ? [
            {
              title: item.title,
              start: item.scheduledStart,
              end: item.scheduledEnd,
            },
          ]
        : [],
    ),
    ...events.map((event) => ({
      title: event.title,
      start: event.startTime,
      end: event.endTime,
    })),
  ];
  for (const edit of placements) {
    const conflict = occupied.find(
      (item) => edit.start! < item.end && edit.end! > item.start,
    );
    if (conflict)
      throw new ConflictException(
        `“${edit.title}”与“${conflict.title}”时间冲突，请调整后重新确认。`,
      );
    occupied.push({ title: edit.title, start: edit.start!, end: edit.end! });
  }
}
