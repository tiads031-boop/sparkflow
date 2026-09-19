ALTER TABLE "calendar_events"
  ADD COLUMN "overrideType" TEXT,
  ADD COLUMN "overrideOriginalStart" TIMESTAMP(3),
  ADD COLUMN "overrideGroupId" TEXT;

CREATE INDEX "calendar_events_userId_overrideGroupId_idx"
  ON "calendar_events"("userId", "overrideGroupId");
