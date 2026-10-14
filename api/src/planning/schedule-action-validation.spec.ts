import { validateScheduleActions } from './schedule-action-validation';
import type { PlanningActionProposal } from '../ai/ai-provider';

const start = '2026-10-15T06:00:00.000Z';
const end = '2026-10-15T07:00:00.000Z';
const stamp = '2026-10-14T10:00:00.000Z';
const task = {
  id: 'listening',
  title: '听力练习',
  status: 'todo',
  repeatRule: null,
  scheduleLocked: false,
  updatedAt: new Date(stamp),
};
const move: PlanningActionProposal = {
  type: 'update_task',
  proposalId: 'p1',
  taskId: task.id,
  taskTitle: task.title,
  expectedTaskUpdatedAt: stamp,
  changes: { scheduledStart: start, scheduledEnd: end },
};
const create: PlanningActionProposal = {
  type: 'create_task',
  proposalId: 'p2',
  title: '阅读',
  scheduledStart: start,
  scheduledEnd: end,
};
function transaction(
  current = [task],
  events: Array<{ title: string; startTime: Date; endTime: Date }> = [],
) {
  return {
    task: {
      findMany: jest.fn(async (query: { where: { id: { in?: string[] } } }) =>
        query.where.id.in ? current : [],
      ),
    },
    calendarEvent: { findMany: jest.fn().mockResolvedValue(events) },
  };
}

describe('confirmed natural-language schedule changes', () => {
  it('rejects a newly conflicting fixed appointment instead of overwriting it', async () => {
    const tx = transaction(
      [task],
      [
        {
          title: '知识产权法',
          startTime: new Date(start),
          endTime: new Date(end),
        },
      ],
    );
    await expect(
      validateScheduleActions(tx as never, 'owner', [move]),
    ).rejects.toThrow('知识产权法');
    expect(tx.calendarEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'owner' }),
      }),
    );
  });
  it('rejects stale or locked task changes, including clearing a locked schedule', async () => {
    await expect(
      validateScheduleActions(
        transaction([
          { ...task, updatedAt: new Date('2026-10-14T11:00:00Z') },
        ]) as never,
        'owner',
        [move],
      ),
    ).rejects.toThrow('已修改');
    const clear = {
      ...move,
      changes: { scheduledStart: null, scheduledEnd: null },
    };
    await expect(
      validateScheduleActions(
        transaction([{ ...task, scheduleLocked: true }]) as never,
        'owner',
        [clear],
      ),
    ).rejects.toThrow('锁定');
    await expect(
      validateScheduleActions(
        transaction([{ ...task, repeatRule: 'DAILY' }]) as never,
        'owner',
        [clear],
      ),
    ).rejects.toThrow('重复任务');
  });
  it('detects conflicts within a selected batch and permits adjacent blocks', async () => {
    await expect(
      validateScheduleActions(transaction() as never, 'owner', [move, create]),
    ).rejects.toThrow('时间冲突');
    await expect(
      validateScheduleActions(transaction() as never, 'owner', [
        move,
        {
          ...create,
          scheduledStart: end,
          scheduledEnd: '2026-10-15T08:00:00Z',
        },
      ]),
    ).resolves.toBeUndefined();
  });
  it('allows an unlocked task to leave the calendar without deleting it', async () => {
    const tx = transaction();
    await expect(
      validateScheduleActions(tx as never, 'owner', [
        { ...move, changes: { scheduledStart: null, scheduledEnd: null } },
      ]),
    ).resolves.toBeUndefined();
    expect(tx.calendarEvent.findMany).not.toHaveBeenCalled();
  });
  it('rejects half-defined intervals and duplicate changes to one task', async () => {
    await expect(
      validateScheduleActions(transaction() as never, 'owner', [
        { ...move, changes: { scheduledStart: start } },
      ]),
    ).rejects.toThrow('无效');
    await expect(
      validateScheduleActions(transaction() as never, 'owner', [
        move,
        { ...move, proposalId: 'p3' },
      ]),
    ).rejects.toThrow('多项时间变更');
  });
});
