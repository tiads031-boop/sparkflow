-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "column" TEXT DEFAULT 'personal',
ADD COLUMN     "notes" JSONB DEFAULT '[]',
ADD COLUMN     "project" TEXT;
