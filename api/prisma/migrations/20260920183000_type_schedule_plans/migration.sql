ALTER TABLE "schedule_plans"
  ADD COLUMN "planType" TEXT NOT NULL DEFAULT 'task';

CREATE INDEX "schedule_plans_userId_planType_createdAt_idx"
  ON "schedule_plans"("userId", "planType", "createdAt");
