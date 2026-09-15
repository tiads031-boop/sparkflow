CREATE TABLE "course_import_batches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applying',
    "targetSemesterId" TEXT,
    "duplicatePolicy" TEXT NOT NULL DEFAULT 'skip',
    "source" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_import_batches_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "courses"
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "sourceSchoolId" TEXT,
  ADD COLUMN "sourceTermId" TEXT,
  ADD COLUMN "sourceEntryId" TEXT,
  ADD COLUMN "sourceFingerprint" TEXT,
  ADD COLUMN "importBatchId" TEXT;

CREATE UNIQUE INDEX "course_import_batches_userId_requestId_key"
ON "course_import_batches"("userId", "requestId");
CREATE INDEX "course_import_batches_userId_createdAt_idx"
ON "course_import_batches"("userId", "createdAt");
CREATE INDEX "courses_userId_semesterId_sourceFingerprint_idx"
ON "courses"("userId", "semesterId", "sourceFingerprint");
CREATE INDEX "courses_importBatchId_idx" ON "courses"("importBatchId");

ALTER TABLE "course_import_batches"
ADD CONSTRAINT "course_import_batches_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "courses"
ADD CONSTRAINT "courses_importBatchId_fkey"
FOREIGN KEY ("importBatchId") REFERENCES "course_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.course_import_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.course_import_batches FROM anon, authenticated;
CREATE POLICY deny_direct_client_access ON public.course_import_batches
AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
