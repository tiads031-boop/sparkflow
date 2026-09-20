CREATE TABLE "insight_generation_runs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "runKey" TEXT NOT NULL,
  "trigger" TEXT NOT NULL DEFAULT 'automatic',
  "cadence" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "sourceCount" INTEGER NOT NULL DEFAULT 0,
  "insightCount" INTEGER NOT NULL DEFAULT 0,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "insight_generation_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "insight_generation_runs_userId_runKey_key"
  ON "insight_generation_runs"("userId", "runKey");
CREATE INDEX "insight_generation_runs_userId_createdAt_idx"
  ON "insight_generation_runs"("userId", "createdAt");
CREATE INDEX "insight_generation_runs_status_scheduledFor_idx"
  ON "insight_generation_runs"("status", "scheduledFor");

ALTER TABLE "insight_generation_runs"
  ADD CONSTRAINT "insight_generation_runs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "insights" ADD COLUMN "generationRunId" TEXT;
CREATE INDEX "insights_generationRunId_idx" ON "insights"("generationRunId");
ALTER TABLE "insights"
  ADD CONSTRAINT "insights_generationRunId_fkey"
  FOREIGN KEY ("generationRunId") REFERENCES "insight_generation_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
