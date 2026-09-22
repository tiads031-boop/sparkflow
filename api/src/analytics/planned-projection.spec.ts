import { projectPlannedFacts } from './planned-projection';

const goal = { folder: { id: 'goal-1', name: '法考', color: '#cae393' } };

describe('analytics planned projection', () => {
  it('excludes focus projections and avoids duplicating an event-backed task', () => {
    const result = projectPlannedFacts(
      [
        {
          id: 'event-1',
          taskId: 'task-1',
          courseId: null,
          focusSessionId: null,
          title: '复习民法',
          eventType: 'task',
          isAllDay: false,
          startTime: new Date('2026-09-22T08:00:00.000Z'),
          endTime: new Date('2026-09-22T08:30:00.000Z'),
          task: { tags: ['法学'], project: null, studyFolders: [goal] },
        },
        {
          id: 'event-focus',
          taskId: 'task-1',
          courseId: null,
          focusSessionId: 'focus-1',
          title: '复习民法',
          eventType: 'focus',
          isAllDay: false,
          startTime: new Date('2026-09-22T08:05:00.000Z'),
          endTime: new Date('2026-09-22T08:35:00.000Z'),
          task: { tags: ['法学'], project: null, studyFolders: [goal] },
        },
      ],
      [
        {
          id: 'task-1',
          title: '复习民法',
          scheduledStart: new Date('2026-09-22T08:00:00.000Z'),
          scheduledEnd: new Date('2026-09-22T08:30:00.000Z'),
          estimatedMinutes: 30,
          tags: ['法学'],
          project: null,
          studyFolders: [goal],
        },
      ],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'event:event-1',
        taskId: 'task-1',
        goal: { id: 'goal-1', label: '法考', color: '#cae393' },
      }),
    );
  });

  it('derives a fallback task end from estimated minutes', () => {
    const [result] = projectPlannedFacts(
      [],
      [
        {
          id: 'task-2',
          title: '写论文',
          scheduledStart: new Date('2026-09-22T09:00:00.000Z'),
          scheduledEnd: null,
          estimatedMinutes: 45,
          tags: [],
          project: '毕业论文',
          studyFolders: [],
        },
      ],
    );
    expect(result.end.toISOString()).toBe('2026-09-22T09:45:00.000Z');
    expect(result.goal).toEqual({ id: '毕业论文', label: '毕业论文' });
  });

  it('collapses visually identical imported course events', () => {
    const event = {
      id: 'course-event-1',
      taskId: null,
      courseId: 'course-1',
      focusSessionId: null,
      title: '法律职业伦理',
      eventType: 'course',
      isAllDay: false,
      startTime: new Date('2026-09-22T01:00:00.000Z'),
      endTime: new Date('2026-09-22T02:30:00.000Z'),
      task: null,
    };
    expect(
      projectPlannedFacts(
        [event, { ...event, id: 'course-event-duplicate' }],
        [],
      ),
    ).toHaveLength(1);
  });
});
