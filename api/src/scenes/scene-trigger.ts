import type { Prisma } from '@prisma/client';
import { parseTimeTrackingPreferences } from '../users/time-tracking-preferences';

/** Associate a completed Focus with the user's one chosen Scene inside the Focus transaction. */
export async function attachDefaultFocusScene(
  tx: Prisma.TransactionClient,
  session: {
    id: string;
    userId: string;
    taskId: string | null;
    startedAt: Date;
    effectiveDurationSeconds: number;
  },
) {
  if (session.effectiveDurationSeconds <= 0) return;
  const user = await tx.user.findUnique({
    where: { id: session.userId },
    select: { settings: true },
  });
  const sceneId = parseTimeTrackingPreferences(user?.settings).defaultSceneId;
  if (!sceneId) return;
  const scene = await tx.sceneTemplate.findFirst({
    where: {
      id: sceneId,
      userId: session.userId,
      status: 'active',
      triggers: { has: 'focus' },
    },
    select: { id: true },
  });
  if (!scene) return;
  // System-created entries may await required custom fields; editing the entry validates them.
  await tx.sceneEntry.createMany({
    data: [
      {
        userId: session.userId,
        sceneId,
        sourceType: 'focus',
        occurredAt: session.startedAt,
        pomodoroSessionId: session.id,
        taskId: session.taskId,
        metadata: {},
        tags: [],
        clientRequestId: `auto:focus:${session.id}`,
      },
    ],
    skipDuplicates: true,
  });
}
