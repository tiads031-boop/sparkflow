-- AlterTable
ALTER TABLE "calendar_events"
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "externalSource" TEXT,
  ADD COLUMN IF NOT EXISTS "externalEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceCalendarTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "googleEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "googleSyncedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "syncStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_events_userId_externalSource_externalEventId_key"
  ON "calendar_events"("userId", "externalSource", "externalEventId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "google_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "tokenExpiry" TIMESTAMP(3) NOT NULL,
  "googleEmail" TEXT,
  "calendarId" TEXT DEFAULT 'primary',
  "syncToken" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "google_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "google_tokens_userId_key" ON "google_tokens"("userId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'google_tokens_userId_fkey'
  ) THEN
    ALTER TABLE "google_tokens"
      ADD CONSTRAINT "google_tokens_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
