CREATE TABLE "inspiration_attachments" (
  "id" TEXT NOT NULL,
  "inspirationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "originalName" TEXT,
  "storageKey" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inspiration_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inspiration_attachments_storageKey_key"
  ON "inspiration_attachments"("storageKey");

CREATE INDEX "inspiration_attachments_inspirationId_createdAt_idx"
  ON "inspiration_attachments"("inspirationId", "createdAt");

ALTER TABLE "inspiration_attachments"
  ADD CONSTRAINT "inspiration_attachments_inspirationId_fkey"
  FOREIGN KEY ("inspirationId") REFERENCES "inspirations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
