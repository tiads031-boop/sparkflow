ALTER TABLE "study_folders"
  ADD COLUMN "progressType" TEXT NOT NULL DEFAULT 'task',
  ADD COLUMN "targetValue" DOUBLE PRECISION,
  ADD COLUMN "progressUnit" TEXT;

CREATE TABLE "goal_progress_entries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "studyFolderId" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "goal_progress_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goal_progress_entries_studyFolderId_occurredAt_id_idx"
  ON "goal_progress_entries"("studyFolderId", "occurredAt", "id");
CREATE INDEX "goal_progress_entries_userId_occurredAt_idx"
  ON "goal_progress_entries"("userId", "occurredAt");

ALTER TABLE "goal_progress_entries"
  ADD CONSTRAINT "goal_progress_entries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goal_progress_entries"
  ADD CONSTRAINT "goal_progress_entries_studyFolderId_fkey"
  FOREIGN KEY ("studyFolderId") REFERENCES "study_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
