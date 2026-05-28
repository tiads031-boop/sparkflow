-- AlterTable: rename column to section
ALTER TABLE "tasks" RENAME COLUMN "column" TO "section";

-- CreateIndex: unique constraint on contextMdHash + userId
CREATE UNIQUE INDEX "tasks_contextMdHash_userId_key" ON "tasks"("contextMdHash", "userId");
