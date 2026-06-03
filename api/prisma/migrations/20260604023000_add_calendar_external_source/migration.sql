-- AlterTable
ALTER TABLE "calendar_events"
  ADD COLUMN "location" TEXT,
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalEventId" TEXT,
  ADD COLUMN "sourceCalendarTitle" TEXT,
  ADD COLUMN "googleEventId" TEXT,
  ADD COLUMN "googleSyncedAt" TIMESTAMP(3),
  ADD COLUMN "syncStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_userId_externalSource_externalEventId_key"
  ON "calendar_events"("userId", "externalSource", "externalEventId");

-- CreateTable
CREATE TABLE "google_tokens" (
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
CREATE UNIQUE INDEX "google_tokens_userId_key" ON "google_tokens"("userId");

-- AddForeignKey
ALTER TABLE "google_tokens"
  ADD CONSTRAINT "google_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
