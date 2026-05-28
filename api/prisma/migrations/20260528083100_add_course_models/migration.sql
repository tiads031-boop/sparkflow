-- CreateTable: courses
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacher" TEXT,
    "room" TEXT,
    "color" TEXT NOT NULL DEFAULT '#b0a8db',
    "dayOfWeek" INTEGER,
    "startTime" TEXT,
    "endTime" TEXT,
    "weeks" JSONB DEFAULT '[]',
    "location" TEXT,
    "icsUid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: course_notes
CREATE TABLE "course_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_notes_pkey" PRIMARY KEY ("id")
);

-- AlterTable: tasks (add courseId)
ALTER TABLE "tasks" ADD COLUMN "courseId" TEXT;

-- AlterTable: calendar_events (add courseId + isOverride)
ALTER TABLE "calendar_events" ADD COLUMN "courseId" TEXT;
ALTER TABLE "calendar_events" ADD COLUMN "isOverride" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "courses_icsUid_key" ON "courses"("icsUid");

-- CreateIndex
CREATE INDEX "courses_userId_idx" ON "courses"("userId");

-- CreateIndex
CREATE INDEX "course_notes_userId_idx" ON "course_notes"("userId");

-- CreateIndex
CREATE INDEX "course_notes_courseId_idx" ON "course_notes"("courseId");

-- CreateIndex
CREATE INDEX "tasks_courseId_idx" ON "tasks"("courseId");

-- CreateIndex
CREATE INDEX "calendar_events_courseId_idx" ON "calendar_events"("courseId");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_notes" ADD CONSTRAINT "course_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_notes" ADD CONSTRAINT "course_notes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
