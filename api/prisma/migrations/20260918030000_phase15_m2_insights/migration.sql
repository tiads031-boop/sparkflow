-- Phase 15 M2: explainable multi-record AI insights

CREATE TABLE "insights" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "aiModel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "insight_inspirations" (
  "insightId" TEXT NOT NULL,
  "inspirationId" TEXT NOT NULL,

  CONSTRAINT "insight_inspirations_pkey" PRIMARY KEY ("insightId", "inspirationId")
);

CREATE INDEX "insights_userId_status_idx"
  ON "insights"("userId", "status");

CREATE INDEX "insights_userId_createdAt_idx"
  ON "insights"("userId", "createdAt");

CREATE INDEX "insight_inspirations_inspirationId_idx"
  ON "insight_inspirations"("inspirationId");

ALTER TABLE "insights"
  ADD CONSTRAINT "insights_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "insight_inspirations"
  ADD CONSTRAINT "insight_inspirations_insightId_fkey"
  FOREIGN KEY ("insightId") REFERENCES "insights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "insight_inspirations"
  ADD CONSTRAINT "insight_inspirations_inspirationId_fkey"
  FOREIGN KEY ("inspirationId") REFERENCES "inspirations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the existing API-only boundary used by the application's tables.
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.insights FROM anon, authenticated;
DROP POLICY IF EXISTS deny_direct_client_access ON public.insights;
CREATE POLICY deny_direct_client_access
  ON public.insights
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

ALTER TABLE public.insight_inspirations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.insight_inspirations FROM anon, authenticated;
DROP POLICY IF EXISTS deny_direct_client_access ON public.insight_inspirations;
CREATE POLICY deny_direct_client_access
  ON public.insight_inspirations
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
