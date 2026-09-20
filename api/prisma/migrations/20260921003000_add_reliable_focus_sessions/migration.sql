ALTER TABLE "pomodoro_sessions"
  ADD COLUMN "plannedDurationSeconds" INTEGER NOT NULL DEFAULT 1500,
  ADD COLUMN "effectiveDurationSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pausedDurationSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastResumedAt" TIMESTAMP(3),
  ADD COLUMN "pausedAt" TIMESTAMP(3),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "clientRequestId" TEXT;

UPDATE "pomodoro_sessions"
SET
  "plannedDurationSeconds" = GREATEST(60, "duration" * 60),
  "effectiveDurationSeconds" = CASE WHEN "status" = 'completed' THEN GREATEST(60, "duration" * 60) ELSE 0 END,
  "lastResumedAt" = CASE WHEN "status" = 'active' THEN "startedAt" ELSE NULL END;

CREATE UNIQUE INDEX "pomodoro_sessions_userId_clientRequestId_key"
  ON "pomodoro_sessions"("userId", "clientRequestId");

-- A user may recover one authoritative open session across tabs/devices.
WITH ranked_open AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "startedAt" DESC, "id" DESC) AS ordinal
  FROM "pomodoro_sessions"
  WHERE "status" IN ('active', 'paused')
)
UPDATE "pomodoro_sessions" AS session
SET "status" = 'interrupted', "endedAt" = CURRENT_TIMESTAMP
FROM ranked_open
WHERE session."id" = ranked_open."id" AND ranked_open.ordinal > 1;

CREATE UNIQUE INDEX "pomodoro_sessions_one_open_per_user_key"
  ON "pomodoro_sessions"("userId")
  WHERE "status" IN ('active', 'paused');

CREATE TABLE "pomodoro_segments" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pomodoro_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pomodoro_segments_sessionId_startedAt_idx"
  ON "pomodoro_segments"("sessionId", "startedAt");
ALTER TABLE "pomodoro_segments"
  ADD CONSTRAINT "pomodoro_segments_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "pomodoro_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "pomodoro_segments" ("id", "sessionId", "startedAt")
SELECT 'legacy-' || "id", "id", "startedAt"
FROM "pomodoro_sessions"
WHERE "status" = 'active';

ALTER TABLE "calendar_events" ADD COLUMN "focusSessionId" TEXT;
CREATE UNIQUE INDEX "calendar_events_focusSessionId_key" ON "calendar_events"("focusSessionId");
ALTER TABLE "calendar_events"
  ADD CONSTRAINT "calendar_events_focusSessionId_fkey"
  FOREIGN KEY ("focusSessionId") REFERENCES "pomodoro_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inspirations" ADD COLUMN "focusSessionId" TEXT;
CREATE INDEX "inspirations_focusSessionId_idx" ON "inspirations"("focusSessionId");
ALTER TABLE "inspirations"
  ADD CONSTRAINT "inspirations_focusSessionId_fkey"
  FOREIGN KEY ("focusSessionId") REFERENCES "pomodoro_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
