ALTER TABLE "users"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "loginNickname" TEXT,
  ADD COLUMN "passwordHash" TEXT;

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_loginNickname_key" ON "users"("loginNickname");

CREATE TABLE "auth_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "revokedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "auth_sessions_tokenHash_key" ON "auth_sessions"("tokenHash");
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");

CREATE TABLE "auth_rate_limits" (
  "requestKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "windowStartedAt" TIMESTAMPTZ(6) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("requestKey", "action", "windowStartedAt"),
  CONSTRAINT "auth_rate_limits_attempt_count_check" CHECK ("attemptCount" > 0)
);

CREATE INDEX "auth_rate_limits_windowStartedAt_idx" ON "auth_rate_limits"("windowStartedAt");
