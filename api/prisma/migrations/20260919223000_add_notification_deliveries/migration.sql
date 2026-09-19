-- M4 notification reliability: persist one delivery record per reminder/source/subscription.
-- This table is server-only and follows the existing deny-direct-client-access posture.

CREATE TABLE "notification_deliveries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "deliveryKey" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel" TEXT NOT NULL,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_deliveries_deliveryKey_key"
  ON "notification_deliveries"("deliveryKey");
CREATE INDEX "notification_deliveries_userId_deliveredAt_idx"
  ON "notification_deliveries"("userId", "deliveredAt");
CREATE INDEX "notification_deliveries_sourceType_sourceId_idx"
  ON "notification_deliveries"("sourceType", "sourceId");

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_deliveries FROM anon, authenticated;
CREATE POLICY deny_direct_client_access ON public.notification_deliveries
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
