import { Injectable, Logger } from '@nestjs/common';
import { calendar_v3, google } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleAuthService } from './google-auth.service';
import {
  SparkflowEventForGoogle,
  EXTENDED_PROPERTIES,
  extractSparkflowId,
} from './interfaces/google-event-mapping';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: GoogleAuthService,
  ) {}

  /**
   * List events from Google Calendar.
   * Uses syncToken for incremental sync when provided.
   */
  async listEvents(
    userId: string,
    options?: {
      syncToken?: string;
      timeMin?: Date;
      maxResults?: number;
    },
  ): Promise<{
    events: calendar_v3.Schema$Event[];
    nextSyncToken: string | null;
    nextPageToken: string | null;
  }> {
    const auth = await this.authService.getClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const token = await this.prisma.googleToken.findUnique({
      where: { userId },
    });
    const calendarId = token?.calendarId ?? 'primary';

    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId,
      maxResults: options?.maxResults ?? 50,
      singleEvents: true,
      showDeleted: !!options?.syncToken,
    };

    if (options?.syncToken) {
      params.syncToken = options.syncToken;
    } else if (options?.timeMin) {
      params.timeMin = options.timeMin.toISOString();
    }

    try {
      const allEvents: calendar_v3.Schema$Event[] = [];
      let pageToken: string | undefined;
      let nextSyncToken: string | null = null;

      do {
        const res = await calendar.events.list({ ...params, pageToken });
        allEvents.push(...(res.data.items ?? []));
        pageToken = res.data.nextPageToken ?? undefined;
        nextSyncToken = res.data.nextSyncToken ?? nextSyncToken;
      } while (pageToken);

      return {
        events: allEvents,
        nextSyncToken,
        nextPageToken: null,
      };
    } catch (error) {
      this.logger.error(`Failed to list events for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Create an event on Google Calendar from a Sparkflow event.
   */
  async createEvent(
    userId: string,
    sparkflowEvent: SparkflowEventForGoogle,
  ): Promise<string> {
    const auth = await this.authService.getClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const token = await this.prisma.googleToken.findUnique({
      where: { userId },
    });
    const calendarId = token?.calendarId ?? 'primary';

    const googleEvent = this.mapToGoogleEvent(sparkflowEvent);

    try {
      const res = await calendar.events.insert({
        calendarId,
        requestBody: googleEvent,
      });

      const googleEventId = res.data.id;
      if (!googleEventId) {
        throw new Error('Google did not return an event ID');
      }

      // Update the local record
      await this.prisma.calendarEvent.update({
        where: { id: sparkflowEvent.id },
        data: {
          googleEventId,
          googleSyncedAt: new Date(),
          syncStatus: 'synced',
        },
      });

      this.logger.log(
        `Created Google event ${googleEventId} for local event ${sparkflowEvent.id}`,
      );

      return googleEventId;
    } catch (error) {
      this.logger.error(
        `Failed to create Google event for local event ${sparkflowEvent.id}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update an existing Google Calendar event from a Sparkflow event.
   */
  async updateEvent(
    userId: string,
    googleEventId: string,
    sparkflowEvent: SparkflowEventForGoogle,
  ): Promise<void> {
    const auth = await this.authService.getClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const token = await this.prisma.googleToken.findUnique({
      where: { userId },
    });
    const calendarId = token?.calendarId ?? 'primary';

    const googleEvent = this.mapToGoogleEvent(sparkflowEvent);

    try {
      await calendar.events.update({
        calendarId,
        eventId: googleEventId,
        requestBody: googleEvent,
      });

      await this.prisma.calendarEvent.update({
        where: { id: sparkflowEvent.id },
        data: {
          googleSyncedAt: new Date(),
          syncStatus: 'synced',
        },
      });

      this.logger.log(
        `Updated Google event ${googleEventId} for local event ${sparkflowEvent.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update Google event ${googleEventId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete an event from Google Calendar.
   */
  async deleteEvent(userId: string, googleEventId: string): Promise<void> {
    const auth = await this.authService.getClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const token = await this.prisma.googleToken.findUnique({
      where: { userId },
    });
    const calendarId = token?.calendarId ?? 'primary';

    try {
      await calendar.events.delete({
        calendarId,
        eventId: googleEventId,
      });

      this.logger.log(`Deleted Google event ${googleEventId}`);
    } catch (error: any) {
      // 410 Gone means the event was already deleted — not a failure
      if (error?.code === 410) {
        this.logger.warn(
          `Google event ${googleEventId} already deleted (410 Gone)`,
        );
        return;
      }
      this.logger.error(`Failed to delete Google event ${googleEventId}`, error);
      throw error;
    }
  }

  /**
   * Map a Sparkflow CalendarEvent to Google Calendar Event format.
   */
  mapToGoogleEvent(sparkflow: SparkflowEventForGoogle): calendar_v3.Schema$Event {
    const event: calendar_v3.Schema$Event = {
      summary: sparkflow.title,
      description: sparkflow.description ?? undefined,
      extendedProperties: {
        private: {
          [EXTENDED_PROPERTIES.SPARKFLOW_ID]: sparkflow.id,
          [EXTENDED_PROPERTIES.EVENT_TYPE]: sparkflow.eventType,
        },
      },
    };

    // Set start/end times (dateTime for timed events, date for all-day)
    if (sparkflow.isAllDay) {
      event.start = {
        date: sparkflow.startTime.toISOString().split('T')[0],
      };
      event.end = {
        date: sparkflow.endTime.toISOString().split('T')[0],
      };
    } else {
      event.start = {
        dateTime: sparkflow.startTime.toISOString(),
      };
      event.end = {
        dateTime: sparkflow.endTime.toISOString(),
      };
    }

    // Optional fields
    if (sparkflow.location) {
      event.location = sparkflow.location;
    }

    if (sparkflow.courseId) {
      event.extendedProperties!.private![EXTENDED_PROPERTIES.COURSE_ID] =
        sparkflow.courseId;
    }

    // Color mapping: Sparkflow stores hex colors, Google uses colorId (1-11)
    // Basic mapping — extended color selection handled frontend-side
    if (sparkflow.color) {
      const colorId = this.mapHexToGoogleColorId(sparkflow.color);
      if (colorId) {
        event.colorId = colorId.toString();
      }
    }

    return event;
  }

  /**
   * Map a Google Calendar event back to a Sparkflow CalendarEvent shape.
   * Returns null if the event is cancelled (deleted on Google side).
   */
  mapFromGoogleEvent(
    googleEvent: calendar_v3.Schema$Event,
  ): Partial<SparkflowEventForGoogle> & { googleEventId: string } | null {
    if (googleEvent.status === 'cancelled') {
      return null;
    }

    const startTime = googleEvent.start?.dateTime
      ? new Date(googleEvent.start.dateTime)
      : googleEvent.start?.date
        ? new Date(googleEvent.start.date + 'T00:00:00')
        : null;

    const endTime = googleEvent.end?.dateTime
      ? new Date(googleEvent.end.dateTime)
      : googleEvent.end?.date
        ? new Date(googleEvent.end.date + 'T00:00:00')
        : null;

    if (!startTime || !endTime) {
      return null;
    }

    return {
      googleEventId: googleEvent.id!,
      title: googleEvent.summary ?? 'Untitled Event',
      startTime,
      endTime,
      isAllDay: !!googleEvent.start?.date,
      description: googleEvent.description,
      eventType:
        googleEvent.extendedProperties?.private?.[
          EXTENDED_PROPERTIES.EVENT_TYPE
        ] ?? 'task',
      courseId:
        googleEvent.extendedProperties?.private?.[
          EXTENDED_PROPERTIES.COURSE_ID
        ],
      location: googleEvent.location,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /**
   * Basic hex-to-Google colorId mapping.
   * Google Calendar has 11 preset colors; this is a rough equivalence.
   */
  private mapHexToGoogleColorId(hex: string): number | null {
    const colorMap: Record<string, number> = {
      '#185FA5': 1,  // blue
      '#CB444A': 11, // red
      '#A47AE2': 3,  // purple
      '#DA5F38': 6,  // orange
      '#5484ED': 9,  // bold blue
      '#46D6DB': 7,  // teal
      '#7AE7BF': 2,  // green
      '#F6BF26': 5,  // yellow
      '#727272': 8,  // gray
      '#B0A8DB': 3,  // lavender → purple
      '#E1E1E1': 8,  // light gray → gray
    };
    return colorMap[hex.toUpperCase()] ?? null;
  }
}
