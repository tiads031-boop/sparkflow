-- Study Mode M1: user-owned learning folders linked to existing courses and tasks.

CREATE TABLE "study_folders" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT NOT NULL DEFAULT 'book-open',
  "color" TEXT NOT NULL DEFAULT '#cae393',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "study_folders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "study_folder_courses" (
  "folderId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  CONSTRAINT "study_folder_courses_pkey" PRIMARY KEY ("folderId", "courseId")
);

CREATE TABLE "study_folder_tasks" (
  "folderId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  CONSTRAINT "study_folder_tasks_pkey" PRIMARY KEY ("folderId", "taskId")
);

CREATE INDEX "study_folders_userId_status_idx" ON "study_folders"("userId", "status");
CREATE INDEX "study_folders_userId_updatedAt_idx" ON "study_folders"("userId", "updatedAt");
CREATE INDEX "study_folder_courses_courseId_idx" ON "study_folder_courses"("courseId");
CREATE INDEX "study_folder_tasks_taskId_idx" ON "study_folder_tasks"("taskId");

ALTER TABLE "study_folders" ADD CONSTRAINT "study_folders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_folder_courses" ADD CONSTRAINT "study_folder_courses_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "study_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_folder_courses" ADD CONSTRAINT "study_folder_courses_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_folder_tasks" ADD CONSTRAINT "study_folder_tasks_folderId_fkey"
  FOREIGN KEY ("folderId") REFERENCES "study_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_folder_tasks" ADD CONSTRAINT "study_folder_tasks_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.study_folders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.study_folders FROM anon, authenticated;
CREATE POLICY deny_direct_client_access ON public.study_folders
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.study_folder_courses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.study_folder_courses FROM anon, authenticated;
CREATE POLICY deny_direct_client_access ON public.study_folder_courses
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.study_folder_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.study_folder_tasks FROM anon, authenticated;
CREATE POLICY deny_direct_client_access ON public.study_folder_tasks
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
