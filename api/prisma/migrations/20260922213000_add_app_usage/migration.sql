CREATE TABLE "app_usage_configs" (
  "userId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_usage_configs_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "app_usage_mappings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "packageName" TEXT NOT NULL,
  "appName" TEXT NOT NULL,
  "tagId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_usage_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app_usage_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "packageName" TEXT NOT NULL,
  "appName" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "tagId" TEXT,
  "tagName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_usage_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_usage_mappings_userId_packageName_key" ON "app_usage_mappings"("userId", "packageName");
CREATE INDEX "app_usage_mappings_userId_enabled_idx" ON "app_usage_mappings"("userId", "enabled");
CREATE UNIQUE INDEX "app_usage_sessions_userId_packageName_startTime_endTime_key" ON "app_usage_sessions"("userId", "packageName", "startTime", "endTime");
CREATE INDEX "app_usage_sessions_userId_startTime_idx" ON "app_usage_sessions"("userId", "startTime");

ALTER TABLE "app_usage_configs" ADD CONSTRAINT "app_usage_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_usage_mappings" ADD CONSTRAINT "app_usage_mappings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_usage_mappings" ADD CONSTRAINT "app_usage_mappings_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "app_usage_sessions" ADD CONSTRAINT "app_usage_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
