-- AlterTable
ALTER TABLE "calendar_events"
  ADD COLUMN "location" TEXT,
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalEventId" TEXT,
  ADD COLUMN "sourceCalendarTitle" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_userId_externalSource_externalEventId_key"
  ON "calendar_events"("userId", "externalSource", "externalEventId");
