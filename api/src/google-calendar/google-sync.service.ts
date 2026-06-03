import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleAuthService } from './google-auth.service';
import {
  SyncResult,
  SparkflowEventForGoogle,
  extractSparkflowId,
} from './interfaces/google-event-mapping';
import type { calendar_v3 } from 'googleapis';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1s

@Injectable()
export class GoogleSyncService {
  private readonly logger = new Logger(GoogleSyncService.name);
  private isSyncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarService: GoogleCalendarService,
    private readonly authService: GoogleAuthService,
  ) {}

  /**
   * Push a single local event to Google Calendar.
   * Creates if no googleEventId; updates if it exists.
   * Retries up to 3 times with exponential backoff on failure.
   */
  async pushToGoogle(userId: string, eventId: string): Promise<void> {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id: eventId },
    });

    if (!event || event.userId !== userId) {
      this.logger.warn(`Event ${eventId} not found or not owned by user ${userId}`);
      return;
    }

    // Skip events user has chosen not to sync
    if (event.syncStatus === 'skipped') {
      return;
    }

    const sparkflowEvent: SparkflowEventForGoogle = {
      id: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      isAllDay: event.isAllDay,
      description: null, // CalendarEvent doesn't have description yet
      eventType: event.eventType,
      courseId: event.courseId,
      color: event.color,
      location: event.location,
    };

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (event.googleEventId) {
          await this.calendarService.updateEvent(
            userId,
            event.googleEventId,
            sparkflowEvent,
          );
        } else {
          await this.calendarService.createEvent(userId, sparkflowEvent);
        }
        this.logger.debug(
          `Push succeeded for event ${eventId} (attempt ${attempt})`,
        );
        return; // success
      } catch (error: any) {
        lastError = error as Error;
        this.logger.warn(
          `Push attempt ${attempt}/${MAX_RETRIES} failed for event ${eventId}: ${error?.message}`,
        );

        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted — mark as conflict
    this.logger.error(
      `Push permanently failed for event ${eventId} after ${MAX_RETRIES} attempts`,
    );
    await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: { syncStatus: 'conflict' },
    });
  }

  /**
   * Pull changes from Google Calendar into Sparkflow.
   * Uses syncToken for incremental sync.
   */
  async pullFromGoogle(
    userId: string,
    options: { forceFull?: boolean } = {},
  ): Promise<SyncResult> {
    const result: SyncResult = {
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      skipped: 0,
      errors: [],
    };

    const token = await this.prisma.googleToken.findUnique({
      where: { userId },
    });

    if (!token || !token.isActive) {
      result.errors.push('Google Calendar not connected');
      return result;
    }

    try {
      let events: calendar_v3.Schema$Event[];
      let nextSyncToken: string | null;

      try {
        const response = await this.calendarService.listEvents(userId, {
          syncToken: options.forceFull ? undefined : (token.syncToken ?? undefined),
          timeMin:
            options.forceFull || !token.syncToken
              ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
              : undefined,
          maxResults: 250,
        });
        events = response.events;
        nextSyncToken = response.nextSyncToken;
      } catch (error: any) {
        if (token.syncToken && this.isInvalidSyncTokenError(error)) {
          this.logger.warn(
            `Google syncToken invalid for user ${userId}; falling back to full sync`,
          );
          await this.prisma.googleToken.update({
            where: { userId },
            data: { syncToken: null },
          });
          const response = await this.calendarService.listEvents(userId, {
            timeMin: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            maxResults: 250,
          });
          events = response.events;
          nextSyncToken = response.nextSyncToken;
        } else {
          throw error;
        }
      }

      for (const googleEvent of events) {
        try {
          if (googleEvent.status === 'cancelled') {
            await this.handleDeletedEvent(userId, googleEvent, result);
          } else {
            await this.handleUpsertEvent(userId, googleEvent, result);
          }
        } catch (error: any) {
          result.errors.push(
            `Failed to process event ${googleEvent.id}: ${error?.message}`,
          );
        }
      }

      // Update syncToken
      if (nextSyncToken) {
        await this.prisma.googleToken.update({
          where: { userId },
          data: {
            syncToken: nextSyncToken,
            lastSyncAt: new Date(),
          },
        });
      }

      this.logger.log(
        `Pull completed for user ${userId}: ${result.pulled} pulled, ${result.conflicts} conflicts`,
      );
    } catch (error: any) {
      result.errors.push(`Pull failed: ${error?.message}`);
      this.logger.error(`Pull failed for user ${userId}`, error);
    }

    return result;
  }

  /**
   * Scheduled full sync — runs every 5 minutes for all connected users.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledSync(): Promise<void> {
    if (this.isSyncing) {
      this.logger.warn('Previous sync still in progress, skipping');
      return;
    }

    this.isSyncing = true;
    this.logger.log('Starting scheduled full sync');

    try {
      const tokens = await this.prisma.googleToken.findMany({
        where: { isActive: true },
        select: { userId: true },
      });

      for (const { userId } of tokens) {
        try {
          await this.manualSync(userId);
        } catch (error: any) {
          this.logger.error(
            `Scheduled sync failed for user ${userId}: ${error?.message}`,
          );
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Manual full sync trigger.
   */
  async manualSync(userId: string): Promise<SyncResult> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    this.logger.log(`Manual sync triggered for user ${userId}`);
    const result: SyncResult = {
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      skipped: 0,
      errors: [],
    };

    await this.ensureTaskCalendarEvents(userId);

    const pushCandidates = await this.prisma.calendarEvent.findMany({
      where: {
        userId,
        syncStatus: { not: 'skipped' },
      },
      orderBy: { updatedAt: 'asc' },
    });
    const eventsToPush = pushCandidates.filter(
      (event) =>
        !event.googleEventId ||
        !event.googleSyncedAt ||
        ['pending', 'conflict'].includes(event.syncStatus) ||
        event.updatedAt > event.googleSyncedAt,
    );

    for (const event of eventsToPush) {
      try {
        await this.pushToGoogle(userId, event.id);
        result.pushed++;
      } catch (error: any) {
        result.conflicts++;
        result.errors.push(
          `Failed to push event ${event.id}: ${error?.message}`,
        );
      }
    }

    const pullResult = await this.pullFromGoogle(userId);
    return this.mergeResults(result, pullResult);
  }

  /**
   * Check if a sync is currently in progress.
   */
  get isSyncRunning(): boolean {
    return this.isSyncing;
  }

  // ─── Private helpers ───────────────────────────────────────────

  /**
   * Handle a deleted (cancelled) Google event: mark local event as skipped.
   */
  private async handleDeletedEvent(
    userId: string,
    googleEvent: calendar_v3.Schema$Event,
    result: SyncResult,
  ): Promise<void> {
    if (!googleEvent.id) return;

    const localEvent = await this.prisma.calendarEvent.findFirst({
      where: { userId, googleEventId: googleEvent.id },
    });

    if (localEvent) {
      await this.prisma.calendarEvent.update({
        where: { id: localEvent.id },
        data: { syncStatus: 'skipped', googleEventId: null },
      });
      result.skipped++;
      this.logger.log(
        `Marked local event ${localEvent.id} as skipped (Google event deleted)`,
      );
    }
  }

  /**
   * Handle an upsert (create or update) from Google.
   */
  private async handleUpsertEvent(
    userId: string,
    googleEvent: calendar_v3.Schema$Event,
    result: SyncResult,
  ): Promise<void> {
    const sparkflowId = extractSparkflowId(googleEvent);

    // If Google event has a sparkflowId, try to match to a local event
    if (sparkflowId) {
      const localEvent = await this.prisma.calendarEvent.findFirst({
        where: { userId, id: sparkflowId },
      });

      if (localEvent) {
        const mapped = this.calendarService.mapFromGoogleEvent(googleEvent);
        if (mapped) {
          const taskId = await this.upsertTaskForGoogleEvent(
            userId,
            googleEvent,
            mapped,
            localEvent.taskId,
          );
          await this.prisma.calendarEvent.update({
            where: { id: localEvent.id },
            data: {
              googleEventId: googleEvent.id,
              title: mapped.title ?? localEvent.title,
              startTime: mapped.startTime ?? localEvent.startTime,
              endTime: mapped.endTime ?? localEvent.endTime,
              isAllDay: mapped.isAllDay ?? localEvent.isAllDay,
              eventType: mapped.eventType ?? localEvent.eventType,
              location: mapped.location ?? localEvent.location,
              taskId,
              googleSyncedAt: new Date(),
              syncStatus: 'synced',
            },
          });
        }
        result.pulled++;
        return;
      }
    }

    // If Google event has a googleEventId match locally, update the local record
    if (googleEvent.id) {
      const localByGoogleId = await this.prisma.calendarEvent.findFirst({
        where: { userId, googleEventId: googleEvent.id },
      });

      if (localByGoogleId) {
        const mapped = this.calendarService.mapFromGoogleEvent(googleEvent);
        if (mapped) {
          const taskId = await this.upsertTaskForGoogleEvent(
            userId,
            googleEvent,
            mapped,
            localByGoogleId.taskId,
          );
          await this.prisma.calendarEvent.update({
            where: { id: localByGoogleId.id },
            data: {
              title: mapped.title ?? localByGoogleId.title,
              startTime: mapped.startTime ?? localByGoogleId.startTime,
              endTime: mapped.endTime ?? localByGoogleId.endTime,
              isAllDay: mapped.isAllDay ?? localByGoogleId.isAllDay,
              eventType: mapped.eventType ?? localByGoogleId.eventType,
              location: mapped.location ?? localByGoogleId.location,
              taskId,
              googleSyncedAt: new Date(),
              syncStatus: 'synced',
            },
          });
          result.pulled++;
          return;
        }
      }
    }

    // New event from Google (no sparkflowId, no googleEventId match) —
    // create a local CalendarEvent
    const mapped = this.calendarService.mapFromGoogleEvent(googleEvent);
    if (mapped && googleEvent.id) {
      const taskId = await this.upsertTaskForGoogleEvent(
        userId,
        googleEvent,
        mapped,
      );
      await this.prisma.calendarEvent.create({
        data: {
          userId,
          title: mapped.title ?? 'Untitled Event',
          startTime: mapped.startTime!,
          endTime: mapped.endTime!,
          isAllDay: mapped.isAllDay ?? false,
          eventType: mapped.eventType ?? 'task',
          location: mapped.location,
          taskId,
          externalSource: 'google',
          externalEventId: googleEvent.id,
          googleEventId: googleEvent.id,
          googleSyncedAt: new Date(),
          syncStatus: 'synced',
        },
      });
      result.pulled++;
      this.logger.log(
        `Created local event from Google event ${googleEvent.id}`,
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async ensureTaskCalendarEvents(userId: string): Promise<void> {
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        calendarEvents: { none: {} },
        OR: [{ scheduledStart: { not: null } }, { dueDate: { not: null } }],
        status: { not: 'cancelled' },
      },
    });

    for (const task of tasks) {
      const startTime = task.scheduledStart ?? task.dueDate;
      if (!startTime) continue;

      const endTime =
        task.scheduledEnd ??
        new Date(
          startTime.getTime() + (task.estimatedMinutes ?? 30) * 60 * 1000,
        );

      await this.prisma.calendarEvent.create({
        data: {
          userId,
          taskId: task.id,
          courseId: task.courseId,
          title: task.title,
          eventType: 'task',
          startTime,
          endTime,
          isAllDay: !task.scheduledStart && !!task.dueDate,
          syncStatus: 'pending',
        },
      });
    }
  }

  private async upsertTaskForGoogleEvent(
    userId: string,
    googleEvent: calendar_v3.Schema$Event,
    mapped: Partial<SparkflowEventForGoogle>,
    existingTaskId?: string | null,
  ): Promise<string | undefined> {
    if (!mapped.startTime) return existingTaskId ?? undefined;

    if (existingTaskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: existingTaskId, userId },
      });
      if (task) {
        await this.prisma.task.update({
          where: { id: existingTaskId },
          data: {
            title: mapped.title ?? task.title,
            description: googleEvent.description ?? task.description,
            dueDate: mapped.startTime,
            scheduledStart: mapped.isAllDay ? null : mapped.startTime,
            scheduledEnd: mapped.isAllDay ? null : mapped.endTime,
          },
        });
        return existingTaskId;
      }
    }

    const existingEvent = googleEvent.id
      ? await this.prisma.calendarEvent.findFirst({
          where: { userId, googleEventId: googleEvent.id, taskId: { not: null } },
          select: { taskId: true },
        })
      : null;

    if (existingEvent?.taskId) {
      return this.upsertTaskForGoogleEvent(
        userId,
        googleEvent,
        mapped,
        existingEvent.taskId,
      );
    }

    const task = await this.prisma.task.create({
      data: {
        userId,
        title: mapped.title ?? 'Untitled Event',
        description: googleEvent.description,
        status: 'todo',
        priority: 'medium',
        section: 'calendar',
        dueDate: mapped.startTime,
        scheduledStart: mapped.isAllDay ? null : mapped.startTime,
        scheduledEnd: mapped.isAllDay ? null : mapped.endTime,
      },
    });

    return task.id;
  }

  private isInvalidSyncTokenError(error: any): boolean {
    return error?.code === 410 || error?.response?.status === 410;
  }

  private mergeResults(first: SyncResult, second: SyncResult): SyncResult {
    return {
      pushed: first.pushed + second.pushed,
      pulled: first.pulled + second.pulled,
      conflicts: first.conflicts + second.conflicts,
      skipped: first.skipped + second.skipped,
      errors: [...first.errors, ...second.errors],
    };
  }
}
