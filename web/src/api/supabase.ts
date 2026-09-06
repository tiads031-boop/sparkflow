import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '') as string;
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '') as string;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient(
  supabaseUrl || 'https://invalid.local',
  supabasePublishableKey || 'missing-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}
