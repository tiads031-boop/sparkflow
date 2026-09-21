-- M2 Timeline 2.0: distinguish active Focus from manually backfilled actual time.
ALTER TABLE "pomodoro_sessions"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "entrySource" TEXT NOT NULL DEFAULT 'focus',
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "pomodoro_sessions_userId_status_startedAt_idx"
  ON "pomodoro_sessions"("userId", "status", "startedAt");
