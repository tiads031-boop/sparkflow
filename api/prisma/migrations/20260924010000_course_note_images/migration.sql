CREATE TABLE "course_note_images" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_note_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_note_images_storageKey_key" ON "course_note_images"("storageKey");
CREATE INDEX "course_note_images_noteId_createdAt_idx" ON "course_note_images"("noteId", "createdAt");
ALTER TABLE "course_note_images" ADD CONSTRAINT "course_note_images_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "course_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
