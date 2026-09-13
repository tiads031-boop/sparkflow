CREATE TABLE "schedule_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "beforeState" JSONB NOT NULL,
    "afterState" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "schedule_plans_userId_createdAt_idx" ON "schedule_plans"("userId", "createdAt");

ALTER TABLE "schedule_plans"
ADD CONSTRAINT "schedule_plans_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pomodoro_sessions" ALTER COLUMN "status" SET DEFAULT 'active';
