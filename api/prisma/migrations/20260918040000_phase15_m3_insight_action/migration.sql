-- Phase 15 M3: Insight -> Action -> Task

ALTER TABLE "tasks"
  ADD COLUMN "insightId" TEXT;

CREATE INDEX "tasks_insightId_idx"
  ON "tasks"("insightId");

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_insightId_fkey"
  FOREIGN KEY ("insightId") REFERENCES "insights"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
