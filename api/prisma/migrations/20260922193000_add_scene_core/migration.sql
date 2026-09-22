-- CreateTable
CREATE TABLE "scene_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '✨',
    "color" TEXT NOT NULL DEFAULT '#e8b8cb',
    "description" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fieldSchema" JSONB NOT NULL DEFAULT '[]',
    "triggers" TEXT[] DEFAULT ARRAY['manual']::TEXT[],
    "allowedViews" TEXT[] DEFAULT ARRAY['heatmap', 'list']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "pomodoroSessionId" TEXT,
    "taskId" TEXT,
    "inspirationId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scene_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scene_templates_userId_status_sortOrder_idx" ON "scene_templates"("userId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "scene_entries_pomodoroSessionId_key" ON "scene_entries"("pomodoroSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "scene_entries_inspirationId_key" ON "scene_entries"("inspirationId");

-- CreateIndex
CREATE INDEX "scene_entries_sceneId_occurredAt_id_idx" ON "scene_entries"("sceneId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "scene_entries_userId_occurredAt_idx" ON "scene_entries"("userId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "scene_entries_userId_clientRequestId_key" ON "scene_entries"("userId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "scene_templates" ADD CONSTRAINT "scene_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_entries" ADD CONSTRAINT "scene_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_entries" ADD CONSTRAINT "scene_entries_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scene_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_entries" ADD CONSTRAINT "scene_entries_pomodoroSessionId_fkey" FOREIGN KEY ("pomodoroSessionId") REFERENCES "pomodoro_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_entries" ADD CONSTRAINT "scene_entries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_entries" ADD CONSTRAINT "scene_entries_inspirationId_fkey" FOREIGN KEY ("inspirationId") REFERENCES "inspirations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
