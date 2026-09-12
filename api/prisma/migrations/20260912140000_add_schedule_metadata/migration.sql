ALTER TABLE "tasks"
  ADD COLUMN "scheduleLocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scheduleSource" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "scheduleColor" TEXT;

ALTER TABLE "calendar_events"
  ADD COLUMN "scheduleLocked" BOOLEAN NOT NULL DEFAULT false;
