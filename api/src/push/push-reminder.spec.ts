import {
  buildReminderDeliveryKey,
  groupReminderTasksByUser,
  reminderScheduledFor,
  reminderWindow,
  type ReminderTask,
} from './push-reminder';

function task(overrides: Partial<ReminderTask> = {}): ReminderTask {
  return {
    id: 'task-1',
    userId: 'user-a',
    title: '复习民法',
    dueDate: new Date('2026-09-20T10:30:00.000Z'),
    reminderAt: null,
    ...overrides,
  };
}

describe('push reminder helpers', () => {
  it('groups reminder tasks strictly by user', () => {
    const grouped = groupReminderTasksByUser([
      task({ id: 'a1', userId: 'user-a' }),
      task({ id: 'b1', userId: 'user-b' }),
      task({ id: 'a2', userId: 'user-a' }),
    ]);

    expect(grouped.get('user-a')?.map((item) => item.id)).toEqual(['a1', 'a2']);
    expect(grouped.get('user-b')?.map((item) => item.id)).toEqual(['b1']);
  });

  it('uses reminderAt before the due-date fallback', () => {
    const reminderAt = new Date('2026-09-20T09:15:00.000Z');
    expect(reminderScheduledFor(task({ reminderAt }))?.toISOString())
      .toBe(reminderAt.toISOString());
  });

  it('falls back to 30 minutes before dueDate', () => {
    expect(reminderScheduledFor(task())?.toISOString())
      .toBe('2026-09-20T10:00:00.000Z');
  });

  it('creates a stable delivery key per task reminder and subscription', () => {
    const first = buildReminderDeliveryKey(task(), 'sub-1');
    const second = buildReminderDeliveryKey(task(), 'sub-1');
    const otherSubscription = buildReminderDeliveryKey(task(), 'sub-2');

    expect(first).toBe(second);
    expect(first).not.toBe(otherSubscription);
    expect(first).toContain('user-a');
    expect(first).toContain('task-1');
  });

  it('uses a 10 minute reminder grace and 30 minute due-soon horizon', () => {
    const now = new Date('2026-09-20T10:00:00.000Z');
    const window = reminderWindow(now);

    expect(window.reminderStart.toISOString()).toBe('2026-09-20T09:50:00.000Z');
    expect(window.dueEnd.toISOString()).toBe('2026-09-20T10:30:00.000Z');
  });
});
