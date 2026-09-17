-- Phase 15 M1: Capture -> Review -> Task

ALTER TABLE "inspirations"
  ALTER COLUMN "sourceUrl" DROP NOT NULL,
  ALTER COLUMN "sourceType" SET DEFAULT 'manual',
  ADD COLUMN "reviewState" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "nextReviewAt" TIMESTAMP(3),
  ADD COLUMN "lastReviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "inspiration_reflections" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "inspirationId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inspiration_reflections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inspirations_userId_nextReviewAt_idx"
  ON "inspirations"("userId", "nextReviewAt");

CREATE INDEX "inspiration_reflections_userId_idx"
  ON "inspiration_reflections"("userId");

CREATE INDEX "inspiration_reflections_inspirationId_createdAt_idx"
  ON "inspiration_reflections"("inspirationId", "createdAt");

ALTER TABLE "inspiration_reflections"
  ADD CONSTRAINT "inspiration_reflections_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inspiration_reflections"
  ADD CONSTRAINT "inspiration_reflections_inspirationId_fkey"
  FOREIGN KEY ("inspirationId") REFERENCES "inspirations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
