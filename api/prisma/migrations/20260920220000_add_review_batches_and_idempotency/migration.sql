-- Persistent daily inspiration review batches and idempotent capture/review writes.

ALTER TABLE "inspirations"
  ADD COLUMN "captureRequestId" TEXT;

ALTER TABLE "inspiration_reflections"
  ADD COLUMN "clientRequestId" TEXT;

CREATE UNIQUE INDEX "inspirations_userId_captureRequestId_key"
  ON "inspirations"("userId", "captureRequestId");

CREATE UNIQUE INDEX "inspiration_reflections_userId_clientRequestId_key"
  ON "inspiration_reflections"("userId", "clientRequestId");

CREATE TABLE "inspiration_review_batches" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "localDate" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inspiration_review_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inspiration_review_batches_userId_localDate_key"
  ON "inspiration_review_batches"("userId", "localDate");

CREATE INDEX "inspiration_review_batches_userId_createdAt_idx"
  ON "inspiration_review_batches"("userId", "createdAt");

CREATE TABLE "inspiration_review_batch_items" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "inspirationId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "processedAt" TIMESTAMP(3),
  "processedRequestId" TEXT,
  "resultReflectionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inspiration_review_batch_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inspiration_review_batch_items_batchId_inspirationId_key"
  ON "inspiration_review_batch_items"("batchId", "inspirationId");

CREATE UNIQUE INDEX "inspiration_review_batch_items_batchId_ordinal_key"
  ON "inspiration_review_batch_items"("batchId", "ordinal");

CREATE UNIQUE INDEX "inspiration_review_batch_items_batchId_processedRequestId_key"
  ON "inspiration_review_batch_items"("batchId", "processedRequestId");

CREATE INDEX "inspiration_review_batch_items_inspirationId_idx"
  ON "inspiration_review_batch_items"("inspirationId");

CREATE INDEX "inspiration_review_batch_items_batchId_state_idx"
  ON "inspiration_review_batch_items"("batchId", "state");

ALTER TABLE "inspiration_review_batches"
  ADD CONSTRAINT "inspiration_review_batches_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inspiration_review_batch_items"
  ADD CONSTRAINT "inspiration_review_batch_items_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "inspiration_review_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inspiration_review_batch_items"
  ADD CONSTRAINT "inspiration_review_batch_items_inspirationId_fkey"
  FOREIGN KEY ("inspirationId") REFERENCES "inspirations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
