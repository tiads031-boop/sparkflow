-- The browser uses Supabase only for Auth. All application data is accessed
-- through the NestJS API, which derives userId from the verified access token.
-- With RLS enabled and no Data API policies, anon/authenticated clients cannot
-- bypass the API and query any application row directly.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspirations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- These tables contain credentials or private conversation content and must
-- remain server-only even if a policy is introduced for other tables later.
REVOKE ALL ON TABLE public.google_tokens FROM anon, authenticated;
REVOKE ALL ON TABLE public.push_subscriptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_conversations FROM anon, authenticated;
