CREATE TABLE IF NOT EXISTS "nickname_signup_rate_limits" (
    "requestKey" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMPTZ NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "nickname_signup_rate_limits_pkey" PRIMARY KEY ("requestKey", "windowStartedAt"),
    CONSTRAINT "nickname_signup_rate_limits_attempt_count_check" CHECK ("attemptCount" > 0)
);

ALTER TABLE "nickname_signup_rate_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nickname_signup_rate_limits" FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "nickname_signup_rate_limits" FROM anon, authenticated;

CREATE OR REPLACE FUNCTION "consume_nickname_signup_attempt"(
    "pRequestKey" TEXT,
    "pLimit" INTEGER DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    current_count INTEGER;
    current_window TIMESTAMPTZ := date_trunc('hour', now());
BEGIN
    DELETE FROM public."nickname_signup_rate_limits"
    WHERE "windowStartedAt" < now() - INTERVAL '2 hours';

    INSERT INTO public."nickname_signup_rate_limits" (
        "requestKey",
        "windowStartedAt",
        "attemptCount"
    )
    VALUES ("pRequestKey", current_window, 1)
    ON CONFLICT ("requestKey", "windowStartedAt")
    DO UPDATE SET "attemptCount" = public."nickname_signup_rate_limits"."attemptCount" + 1
    RETURNING "attemptCount" INTO current_count;

    RETURN current_count <= GREATEST(1, LEAST("pLimit", 20));
END;
$$;

REVOKE ALL ON FUNCTION "consume_nickname_signup_attempt"(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "consume_nickname_signup_attempt"(TEXT, INTEGER) TO service_role;
