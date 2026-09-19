-- VNext M5: persistent planning context for adaptive AI planning.
-- AIConversation remains the verbatim conversation log; PlanningThread stores
-- the current structured planning facts/constraints/preferences/strategy.

CREATE TABLE "planning_threads" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "scopeType" TEXT NOT NULL DEFAULT 'general',
  "scopeId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "brief" JSONB NOT NULL DEFAULT '[]',
  "constraints" JSONB NOT NULL DEFAULT '[]',
  "preferences" JSONB NOT NULL DEFAULT '[]',
  "strategy" JSONB NOT NULL DEFAULT '[]',
  "assumptions" JSONB NOT NULL DEFAULT '[]',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "planning_threads_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_conversations"
  ADD COLUMN "planningThreadId" TEXT;

ALTER TABLE "schedule_plans"
  ADD COLUMN "planningThreadId" TEXT,
  ADD COLUMN "planningThreadRevision" INTEGER;

CREATE INDEX "planning_threads_userId_status_idx"
  ON "planning_threads"("userId", "status");
CREATE INDEX "planning_threads_userId_updatedAt_idx"
  ON "planning_threads"("userId", "updatedAt");
CREATE INDEX "planning_threads_scopeType_scopeId_idx"
  ON "planning_threads"("scopeType", "scopeId");
CREATE INDEX "ai_conversations_planningThreadId_createdAt_idx"
  ON "ai_conversations"("planningThreadId", "createdAt");
CREATE INDEX "schedule_plans_planningThreadId_createdAt_idx"
  ON "schedule_plans"("planningThreadId", "createdAt");

ALTER TABLE "planning_threads"
  ADD CONSTRAINT "planning_threads_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_conversations"
  ADD CONSTRAINT "ai_conversations_planningThreadId_fkey"
  FOREIGN KEY ("planningThreadId") REFERENCES "planning_threads"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "schedule_plans"
  ADD CONSTRAINT "schedule_plans_planningThreadId_fkey"
  FOREIGN KEY ("planningThreadId") REFERENCES "planning_threads"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.planning_threads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.planning_threads FROM anon, authenticated;
CREATE POLICY deny_direct_client_access ON public.planning_threads
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
