import type { calendar_v3 } from 'googleapis';

/**
 * Mapped Sparkflow CalendarEvent fields → Google Calendar Event
 */
export interface GoogleEventMapping {
  /** Google's event ID (null when not yet pushed) */
  googleEventId: string | null;
  /** Google's syncToken for incremental sync */
  syncToken: string | null;
  /** Last successful sync timestamp */
  lastSyncAt: Date | null;
  /** Current sync status */
  syncStatus: 'pending' | 'synced' | 'conflict' | 'skipped';
}

/**
 * Local CalendarEvent shape needed for mapping to Google
 */
export interface SparkflowEventForGoogle {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  description?: string | null;
  eventType: string;
  courseId?: string | null;
  color?: string | null;
  location?: string | null;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  skipped: number;
  errors: string[];
}

/**
 * Google Calendar event extended properties key constants
 */
export const EXTENDED_PROPERTIES = {
  SPARKFLOW_ID: 'sparkflowId',
  EVENT_TYPE: 'eventType',
  COURSE_ID: 'courseId',
} as const;

/**
 * Extract sparkflowId from a Google Calendar event's extended properties
 */
export function extractSparkflowId(
  event: calendar_v3.Schema$Event,
): string | undefined {
  return event.extendedProperties?.private?.[EXTENDED_PROPERTIES.SPARKFLOW_ID] ?? undefined;
}
