ALTER TABLE "tasks"
ADD COLUMN "reminderAt" TIMESTAMP(3),
ADD COLUMN "repeatRule" TEXT,
ADD COLUMN "repeatStartDate" TIMESTAMP(3),
ADD COLUMN "repeatEndDate" TIMESTAMP(3);
