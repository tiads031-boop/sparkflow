import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const nicknamePattern = /^[\p{L}\p{N}_.-]+$/u;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeNickname(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('und');
}

async function nicknameToEmail(nickname: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nickname));
  const alias = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 52);
  return `n_${alias}@users.fish-life.cc.cd`;
}

function configuredPublishableKeys() {
  const keys = new Set<string>();
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacyKey) keys.add(legacyKey);
  try {
    const keyNames = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>;
    for (const keyName of Object.values(keyNames)) {
      const key = Deno.env.get(keyName);
      if (key) keys.add(key);
    }
  } catch {
    // A malformed optional key map must not weaken the header check.
  }
  return keys;
}

async function requestKey(request: Request, secret: string) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${forwardedFor}:${secret}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const apiKey = request.headers.get('apikey');
  if (!apiKey || !configuredPublishableKeys().has(apiKey)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let body: { nickname?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_nickname' });
  }

  if (typeof body.nickname !== 'string' || typeof body.password !== 'string') {
    return json({ ok: false, error: 'invalid_nickname' });
  }
  const nickname = normalizeNickname(body.nickname);
  const nicknameLength = Array.from(nickname).length;
  if (nicknameLength < 2 || nicknameLength > 24 || !nicknamePattern.test(nickname)) {
    return json({ ok: false, error: 'invalid_nickname' });
  }
  if (body.password.length < 6) return json({ ok: false, error: 'weak_password' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const adminKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !adminKey) return json({ ok: false, error: 'server_error' }, 503);

  const admin = createClient(supabaseUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: allowed, error: rateLimitError } = await admin.rpc(
    'consume_nickname_signup_attempt',
    { pRequestKey: await requestKey(request, adminKey), pLimit: 5 },
  );
  if (rateLimitError) return json({ ok: false, error: 'server_error' }, 503);
  if (allowed !== true) return json({ ok: false, error: 'rate_limited' }, 429);

  const email = await nicknameToEmail(nickname);
  const { error } = await admin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
    user_metadata: { nickname, account_type: 'nickname' },
  });

  if (error) {
    const detail = `${error.code ?? ''} ${error.message}`.toLowerCase();
    if (detail.includes('already') || detail.includes('exists') || detail.includes('registered')) {
      return json({ ok: false, error: 'nickname_taken' });
    }
    if (detail.includes('rate')) return json({ ok: false, error: 'rate_limited' });
    if (detail.includes('password')) return json({ ok: false, error: 'weak_password' });
    return json({ ok: false, error: 'server_error' }, 500);
  }

  return json({ ok: true });
});
